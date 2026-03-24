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

module.exports = { validateQueryIntent, validateSql };
