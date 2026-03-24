const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getDbConnection } = require("../config/database");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const MODEL_NAME = "gemini-2.5-flash";

const SYSTEM_PROMPT = `
You are an expert SAP O2C (Order to Cash) data analyst. Your goal is to translate natural language questions into precise SQL queries.
Return ONLY the SQLite query string. Ensure there is no markdown, no explanation, no comments, just raw SQL.

Database Schema:
- business_partners: businessPartner, businessPartnerFullName, etc.
- bp_addresses: businessPartner, cityName, country, postalCode, region, streetName.
- products: product, productType, etc.
- product_descriptions: product, productDescription, language.
- plants: plant, plantName.
- sales_headers: salesOrder, salesOrderType, soldToParty, creationDate, totalNetAmount, transactionCurrency, overallDeliveryStatus.
- sales_items: salesOrder, salesOrderItem, material, requestedQuantity, netAmount.
- delivery_headers: deliveryDocument, creationDate, overallGoodsMovementStatus.
- delivery_items: deliveryDocument, deliveryDocumentItem, referenceSdDocument (Points to salesOrder), actualDeliveryQuantity.
- billing_headers: billingDocument, billingDocumentType, creationDate, billingDocumentDate, totalNetAmount, transactionCurrency, accountingDocument, soldToParty.
- billing_items: billingDocument, billingDocumentItem, material, billingQuantity, netAmount, referenceSdDocument (Points to deliveryDocument).
- billing_cancellations: billingDocument, billingDocumentIsCancelled, cancelledBillingDocument.
- journal_entries: accountingDocument, glAccount, referenceDocument (Points to billingDocument), transactionCurrency, amountInTransactionCurrency, postingDate, customer, clearingDate.
- payments: accountingDocument, clearingDate, amountInTransactionCurrency, invoiceReference (Points to accountingDocument).

Key Relationships (Flow: SO -> Delivery -> Billing -> Journal -> Payment):
1. SO to Delivery: sales_items.salesOrder = delivery_items.referenceSdDocument
2. Delivery to Billing: delivery_items.deliveryDocument = billing_items.referenceSdDocument
3. Billing to Journal: billing_headers.accountingDocument = journal_entries.accountingDocument (OR billing_headers.billingDocument = journal_entries.referenceDocument)
4. Journal to Payment: journal_entries.accountingDocument = payments.invoiceReference
5. Master Data:
   - sales_headers.soldToParty = business_partners.businessPartner
   - business_partners.businessPartner = bp_addresses.businessPartner
   - products.product = product_descriptions.product
   - sales_items.material = products.product
   - delivery_items.material = products.product
   - billing_items.material = products.product

Rules to prevent hallucination:
- ONLY output SQL. No formatting blocks like \`\`\`sql.
- ONLY use the tables and columns provided in the schema above.
- Use JOINs when necessary.
- ALWAYS use DISTINCT for ID columns.
- Keep the SQL efficient.
- If the user asks about a specific document ID, search for it in the relevant columns using text matching.
- NEVER use query parameters like '?' in the SQL. The SQL must be directly executable.
- If a specific ID is not provided, do not filter by ID; use LIMIT 10 instead to show examples.
`;

const QUERY_CACHE = new Map();

async function callGeminiWithFailover(prompt, systemInstruction = null) {
    const keys = [
        { name: "GEMINI_API_KEY_1", val: process.env.GEMINI_API_KEY_1 },
        { name: "GEMINI_API_KEY_2", val: process.env.GEMINI_API_KEY_2 },
        { name: "GEMINI_API_KEY_3", val: process.env.GEMINI_API_KEY_3 },
    ];

    const availableKeys = keys.filter(k => k.val);
    
    if (availableKeys.length === 0) {
        console.error("No Gemini API keys found in environment variables.");
        throw new Error("API Configuration error: No Gemini AI keys found. Please check your .env file.");
    }

    // Prepare attempts: first key twice, then others
    const attempts = [];
    if (availableKeys[0]) {
        attempts.push(availableKeys[0]);
        attempts.push(availableKeys[0]);
    }
    if (availableKeys[1]) attempts.push(availableKeys[1]);
    if (availableKeys[2]) attempts.push(availableKeys[2]);

    let fallbackUsed = false;

    for (let i = 0; i < attempts.length; i++) {
        const { name, val } = attempts[i];

        try {
            const genAI = new GoogleGenerativeAI(val);
            const model = genAI.getGenerativeModel({ 
                model: MODEL_NAME,
                systemInstruction: systemInstruction 
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();

            if (i > 0) fallbackUsed = true;
            return { text, keyName: name, fallbackUsed };
        } catch (error) {
            console.warn(`Key ${name} failed. Attempt ${i + 1}. Error: ${error.message}`);
            // Only delay on first attempt of first key if there are more keys
            if (i === 0 && attempts.length > 1) await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    throw new Error("All configured Gemini API keys failed or are rate limited. Please try again later.");
}

function validateQueryIntent(query) {
    const keywords = ["order", "deliver", "bill", "invoice", "payment", "customer", "product", "partner", "sales"];
    const queryLower = query.toLowerCase();
    return keywords.some(k => queryLower.includes(k));
}

function validateSql(sql) {
    const sqlUpper = sql.toUpperCase().trim();
    const forbidden = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "GRANT", "REVOKE", "TRUNCATE"];

    if (!sqlUpper.startsWith("SELECT")) return false;

    for (const f of forbidden) {
        if (sqlUpper.includes(f)) return false;
    }

    return true;
}

async function getChatResponse(message) {
    const trimmedMessage = message.trim();
    console.info(`Received query: ${trimmedMessage}`);

    // 1. Guardrail Check
    if (!validateQueryIntent(trimmedMessage)) {
        console.warn(`Query intent rejected: ${trimmedMessage}`);
        return {
            answer: "This system is designed to answer questions related to the provided dataset only.",
            sql: null,
            data: null,
            api_key_used: null,
            fallback_used: false,
            cached: false,
            relatedNodeIds: []
        };
    }

    // 2. Cache Check
    if (QUERY_CACHE.has(trimmedMessage)) {
        console.info(`Query matched cache: ${trimmedMessage}`);
        const cachedResult = QUERY_CACHE.get(trimmedMessage);
        return {
            ...cachedResult,
            api_key_used: null,
            fallback_used: false,
            cached: true
        };
    }

    try {
        // 3. Gemini SQL Generation
        const { text: sqlTextRaw, keyName: keyUsed, fallbackUsed } = await callGeminiWithFailover(trimmedMessage, SYSTEM_PROMPT);
        let sqlText = sqlTextRaw;
        console.info(`Gemini SQL Generation - Key used: ${keyUsed}, Fallback: ${fallbackUsed}`);
        console.info(`Generated SQL: ${sqlText}`);

        // Strip markdown
        if (sqlText.includes("```sql")) {
            sqlText = sqlText.split("```sql")[1].split("```")[0].trim();
        } else if (sqlText.includes("```")) {
            sqlText = sqlText.split("```")[1].split("```")[0].trim();
        }

        // 4. SQL Validation
        if (!validateSql(sqlText)) {
            console.warn(`SQL Validation failed for query: ${trimmedMessage} | SQL: ${sqlText}`);
            return {
                answer: "Generated query failed security validation.",
                sql: null,
                data: null,
                api_key_used: keyUsed,
                fallback_used: fallbackUsed,
                cached: false,
                relatedNodeIds: []
            };
        }

        // 5. SQLite Execution
        const client = getDbConnection();
        const rs = await client.execute(sqlText);
        const data = rs.rows;
        
        // 6. Gemini Answer Generation
        const resPrompt = `The user asked: '${trimmedMessage}'. The database result for this inquiry is: ${JSON.stringify(data)}. Provide a clear, natural language answer based solely on this data. Use standard Markdown tables for structured data. IMPORTANT: Use ONLY single pipes '|' for columns. NEVER use double pipes '||'. Ensure there are empty lines (double newlines) before and after any Markdown table, and that each row is on a new line. If the data shows a process flow, use a structured step-by-step format or a standard table. If the data is empty, say you couldn't find any records. Do not output anything else.`;
        
        const { text: answerText, keyName: ansKeyUsed, fallbackUsed: ansFallbackUsed } = await callGeminiWithFailover(resPrompt);

        // Extract related node IDs
        const relatedIds = [];
        const idFields = ['billingDocument', 'accountingDocument', 'deliveryDocument', 'businessPartner', 'product', 'customer', 'material', 'salesOrder'];
        
        data.forEach(row => {
            idFields.forEach(field => {
                if (row[field]) {
                    relatedIds.push(String(row[field]));
                }
            });
        });

        const finalRelatedIds = [...new Set(relatedIds)];

        const result = {
            answer: answerText,
            sql: sqlText,
            data: data,
            relatedNodeIds: finalRelatedIds
        };

        // Update Cache
        QUERY_CACHE.set(trimmedMessage, result);

        return {
            ...result,
            api_key_used: ansKeyUsed,
            fallback_used: fallbackUsed || ansFallbackUsed,
            cached: false
        };

    } catch (error) {
        console.error(`Error processing query '${trimmedMessage}': ${error.message}`);
        if (error.message.includes("System is under high load")) {
            return {
                answer: "System is under high load. Please try again later.",
                sql: null,
                data: null,
                api_key_used: null,
                fallback_used: true,
                cached: false,
                relatedNodeIds: []
            };
        }
        return {
            answer: `An error occurred: ${error.message}`,
            sql: null,
            data: null,
            api_key_used: null,
            fallback_used: false,
            cached: false,
            relatedNodeIds: []
        };
    }
}

module.exports = { getChatResponse };
