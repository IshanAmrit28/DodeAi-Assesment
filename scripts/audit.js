const { getDbConnection } = require('../backend/src/config/database');

const queries = {
    "list_tables": "SELECT name FROM sqlite_master WHERE type='table';",
    
    "schema_info": "SELECT m.name as table_name, p.name as column_name, p.type, p.[notnull], p.pk FROM sqlite_master m LEFT OUTER JOIN pragma_table_info((m.name)) p on m.name <> p.name WHERE m.type = 'table' ORDER BY table_name, p.cid;",
    
    // TASK 2: DATA INTEGRITY CHECKS
    "orders_no_items": "SELECT sh.salesOrder FROM sales_headers sh LEFT JOIN sales_items si ON sh.salesOrder = si.salesOrder WHERE si.salesOrder IS NULL;",
    
    "orders_no_deliveries": "SELECT sh.salesOrder FROM sales_headers sh LEFT JOIN delivery_items di ON sh.salesOrder = di.referenceSdDocument WHERE di.referenceSdDocument IS NULL;",
    
    "deliveries_no_invoices": "SELECT dh.deliveryDocument FROM delivery_headers dh LEFT JOIN billing_items bi ON dh.deliveryDocument = bi.referenceSdDocument WHERE bi.referenceSdDocument IS NULL;",
    
    "invoices_no_payments": "SELECT bh.billingDocument FROM billing_headers bh LEFT JOIN journal_entries je ON bh.billingDocument = je.referenceDocument WHERE je.referenceDocument IS NULL;",
    
    "payments_no_invoices": "SELECT je.accountingDocument FROM journal_entries je LEFT JOIN billing_headers bh ON je.referenceDocument = bh.billingDocument WHERE bh.billingDocument IS NULL AND je.referenceDocument IS NOT NULL AND je.referenceDocument != '';",
    
    // TASK 3: FLOW CONSISTENCY
    "delivered_not_invoiced": "SELECT di.deliveryDocument FROM delivery_items di LEFT JOIN billing_items bi ON di.deliveryDocument = bi.referenceSdDocument WHERE bi.referenceSdDocument IS NULL;",
    
    "invoiced_not_delivered": "SELECT bi.billingDocument FROM billing_items bi LEFT JOIN delivery_items di ON bi.referenceSdDocument = di.deliveryDocument WHERE di.deliveryDocument IS NULL;",
};

async function runQueries() {
    const client = getDbConnection();
    const results = {};

    for (const [name, q] of Object.entries(queries)) {
        try {
            const rs = await client.execute(q);
            results[name] = rs.rows.slice(0, 10); // Top 10
            results[`${name}_count`] = rs.rows.length;
        } catch (e) {
            results[name] = e.message;
        }
    }

    for (const [k, v] of Object.entries(results)) {
        if (k.endsWith("_count")) {
            const queryName = k.replace("_count", "");
            console.log(`--- ${queryName} ---`);
            console.log(`Count: ${v}`);
            if (results[queryName] && Array.isArray(results[queryName]) && results[queryName].length > 0) {
                console.log("Top 10 samples:");
                console.table(results[queryName]);
            }
            console.log("\n");
        }
    }
}

runQueries().catch(console.error);
