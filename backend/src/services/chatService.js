const { callGenerativeAI } = require('../llm/geminiClient');
const { validateQueryIntent, validateSql } = require('../guardrails/guardrail');
const { executeSafeQuery, extractRelatedIds, cleanSqlText } = require('../query/queryProcessor');
const { infoLogger, warnLogger, errorLogger } = require('../utils/logger');
const { SYSTEM_PROMPT } = require('../utils/prompts');

const QUERY_CACHE = new Map();

async function getChatResponse(message) {
    const trimmedMessage = message.trim();
    infoLogger(`Received query: ${trimmedMessage}`);

    // 1. Guardrail Check
    if (!validateQueryIntent(trimmedMessage)) {
        warnLogger(`Query intent rejected: ${trimmedMessage}`);
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
        infoLogger(`Query matched cache: ${trimmedMessage}`);
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
        const { text: sqlTextRaw, keyName: keyUsed, fallbackUsed } = await callGenerativeAI(trimmedMessage, SYSTEM_PROMPT);
        const sqlText = cleanSqlText(sqlTextRaw);
        infoLogger(`Gemini SQL Generation - Key used: ${keyUsed}, Fallback: ${fallbackUsed}`);
        infoLogger(`Generated SQL: ${sqlText}`);

        // 4. SQL Validation
        if (!validateSql(sqlText)) {
            warnLogger(`SQL Validation failed for query: ${trimmedMessage} | SQL: ${sqlText}`);
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
        const data = await executeSafeQuery(sqlText);
        
        // 6. Gemini Answer Generation
        const resPrompt = `The user asked: '${trimmedMessage}'. The database result for this inquiry is: ${JSON.stringify(data)}. Provide a clear, natural language answer based solely on this data. Use standard Markdown tables for structured data. IMPORTANT: Use ONLY single pipes '|' for columns. NEVER use double pipes '||'. Ensure there are empty lines (double newlines) before and after any Markdown table, and that each row is on a new line. If the data shows a process flow, use a structured step-by-step format or a standard table. If the data is empty, say you couldn't find any records. Do not output anything else.`;
        
        const { text: answerText, keyName: ansKeyUsed, fallbackUsed: ansFallbackUsed } = await callGenerativeAI(resPrompt);

        // Extract related node IDs
        const finalRelatedIds = extractRelatedIds(data);

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
        errorLogger(`Error processing query '${trimmedMessage}': ${error.message}`);
        // Mimic existing fallback behavior
        if (error.message.includes("System is under high load") || error.message.includes("fail") || error.message.includes("rate limit")) {
            return {
                answer: "System is under high load or API is currently unavailable. Please try again later.",
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
