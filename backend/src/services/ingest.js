const fs = require('fs');
const path = require('path');
const { getDbConnection } = require('../config/database');
require('dotenv').config();

const DATA_PATH = path.resolve(__dirname, '../../data/sap-o2c-data');

function getColumnsFromJsonl(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const firstLine = content.split('\n')[0];
    if (!firstLine) return [];
    try {
        return Object.keys(JSON.parse(firstLine));
    } catch (e) {
        return [];
    }
}

async function initTable(client, tableName, columns) {
    if (!columns || columns.length === 0) return;

    const colDefs = columns.map(col => {
        if (col.includes('Amount') || col.includes('Quantity') || col.toLowerCase().includes('total') || col.includes('Price')) {
            return `${col} REAL`;
        }
        return `${col} TEXT`;
    });

    let pk = "";
    if (columns.includes('salesOrder') && columns.includes('salesOrderItem')) {
        pk = "PRIMARY KEY (salesOrder, salesOrderItem)";
    } else if (columns.includes('deliveryDocument') && columns.includes('deliveryDocumentItem')) {
        pk = "PRIMARY KEY (deliveryDocument, deliveryDocumentItem)";
    } else if (columns.includes('billingDocument') && columns.includes('billingDocumentItem')) {
        pk = "PRIMARY KEY (billingDocument, billingDocumentItem)";
    } else if (columns.includes('billingDocument')) {
        pk = "PRIMARY KEY (billingDocument)";
    } else if (columns.includes('accountingDocument')) {
        pk = "PRIMARY KEY (accountingDocument)";
    } else if (columns.includes('deliveryDocument')) {
        pk = "PRIMARY KEY (deliveryDocument)";
    } else if (columns.includes('salesOrder')) {
        pk = "PRIMARY KEY (salesOrder)";
    } else if (columns.includes('product') && columns.includes('language')) {
        pk = "PRIMARY KEY (product, language)";
    } else if (columns.includes('product')) {
        pk = "PRIMARY KEY (product)";
    } else if (columns.includes('businessPartner')) {
        pk = "PRIMARY KEY (businessPartner)";
    } else if (columns.includes('plant')) {
        pk = "PRIMARY KEY (plant)";
    }

    let query = `CREATE TABLE IF NOT EXISTS ${tableName} (${colDefs.join(', ')}`;
    if (pk) query += `, ${pk}`;
    query += `)`;

    await client.execute(query);
}

async function loadJsonl(client, tableName, filePath, columns) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const data = JSON.parse(line);
            const values = columns.map(col => {
                const val = data[col];
                if (typeof val === 'object' && val !== null) {
                    return JSON.stringify(val);
                }
                return val;
            });

            const placeholders = columns.map(() => '?').join(',');
            const colsStr = columns.join(',');
            
            await client.execute({
                sql: `INSERT OR REPLACE INTO ${tableName} (${colsStr}) VALUES (${placeholders})`,
                args: values
            });
        } catch (e) {
            // Skip errors
        }
    }
}

async function ingestAll() {
    const client = getDbConnection();

    const itemsToProcess = [
        ['business_partners', 'business_partners'],
        ['bp_addresses', 'business_partner_addresses'],
        ['products', 'products'],
        ['product_descriptions', 'product_descriptions'],
        ['plants', 'plants'],
        ['sales_headers', 'sales_order_headers'],
        ['sales_items', 'sales_order_items'],
        ['delivery_headers', 'outbound_delivery_headers'],
        ['delivery_items', 'outbound_delivery_items'],
        ['billing_headers', 'billing_document_headers'],
        ['billing_items', 'billing_document_items'],
        ['billing_cancellations', 'billing_document_cancellations'],
        ['journal_entries', 'journal_entry_items_accounts_receivable'],
        ['payments', 'payments_accounts_receivable']
    ];

    for (const [table, folder] of itemsToProcess) {
        const folderPath = path.join(DATA_PATH, folder);
        if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));
            if (files.length === 0) continue;

            const columns = getColumnsFromJsonl(path.join(folderPath, files[0]));
            console.log(`Initializing table ${table} with columns: ${columns.join(', ')}`);
            await initTable(client, table, columns);

            for (const file of files) {
                console.log(`Loading ${file} into ${table}...`);
                await loadJsonl(client, table, path.join(folderPath, file), columns);
            }
        }
    }

    console.log("Generating edges...");
    await client.execute("CREATE TABLE IF NOT EXISTS edges (source TEXT, target TEXT, type TEXT, metadata TEXT)");

    // Generate Edges
    await client.execute("INSERT INTO edges SELECT salesOrder, material, 'CONTAINS', '{}' FROM sales_items WHERE material IS NOT NULL");
    await client.execute("INSERT INTO edges SELECT soldToParty, salesOrder, 'SOLD_TO', '{}' FROM sales_headers WHERE soldToParty IS NOT NULL");
    await client.execute("INSERT INTO edges SELECT referenceSdDocument, deliveryDocument, 'SHIPPED_IN', '{}' FROM delivery_items WHERE referenceSdDocument IS NOT NULL AND referenceSdDocument != ''");
    await client.execute("INSERT INTO edges SELECT referenceSdDocument, billingDocument, 'BILLED_IN', '{}' FROM billing_items WHERE referenceSdDocument IS NOT NULL AND referenceSdDocument != ''");
    await client.execute("INSERT INTO edges SELECT soldToParty, billingDocument, 'SOLD_TO', '{}' FROM billing_headers WHERE soldToParty IS NOT NULL");
    await client.execute("INSERT INTO edges SELECT billingDocument, material, 'CONTAINS', '{}' FROM billing_items WHERE material IS NOT NULL");
    await client.execute("INSERT INTO edges SELECT referenceDocument, accountingDocument, 'GENERATES', '{}' FROM journal_entries WHERE referenceDocument IS NOT NULL AND referenceDocument != ''");
    await client.execute("INSERT INTO edges SELECT customer, accountingDocument, 'FOR_CUSTOMER', '{}' FROM journal_entries WHERE customer IS NOT NULL");
    await client.execute("INSERT INTO edges SELECT customer, accountingDocument, 'PAID_BY', '{}' FROM payments WHERE customer IS NOT NULL");

    console.log("Ingestion complete.");
}

if (require.main === module) {
    ingestAll().catch(console.error);
}

module.exports = { ingestAll };
