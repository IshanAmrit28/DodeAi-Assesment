const { getDbConnection } = require("../config/database");

async function executeSafeQuery(sqlText) {
    const client = getDbConnection();
    const rs = await client.execute(sqlText);
    return rs.rows;
}

function extractRelatedIds(data) {
    const relatedIds = [];
    const idFields = ['billingDocument', 'accountingDocument', 'deliveryDocument', 'businessPartner', 'product', 'customer', 'material', 'salesOrder'];
    
    data.forEach(row => {
        idFields.forEach(field => {
            if (row[field]) {
                relatedIds.push(String(row[field]));
            }
        });
    });

    return [...new Set(relatedIds)];
}

function cleanSqlText(rawText) {
    let sqlText = rawText;
    if (sqlText.includes("```sql")) {
        sqlText = sqlText.split("```sql")[1].split("```")[0].trim();
    } else if (sqlText.includes("```")) {
        sqlText = sqlText.split("```")[1].split("```")[0].trim();
    }
    return sqlText;
}

module.exports = { executeSafeQuery, extractRelatedIds, cleanSqlText };
