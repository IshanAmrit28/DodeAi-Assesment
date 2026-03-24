const { getDbConnection } = require("../config/database");
const { infoLogger, errorLogger } = require("../utils/logger");

async function fetchGraphData(limit = 500, targetIds = null) {
    const client = getDbConnection();
    infoLogger(`Fetching graph data: limit=${limit}, targets=${targetIds?.length || 0}`);

    let edgesRs;
    try {
        if (targetIds && targetIds.length > 0) {
            const idsStr = targetIds.join("','");
            edgesRs = await client.execute(`SELECT source, target, type FROM edges WHERE source IN ('${idsStr}') OR target IN ('${idsStr}') LIMIT 200`);
        } else {
            edgesRs = await client.execute(`SELECT source, target, type FROM edges LIMIT ${limit}`);
        }
    } catch (dbErr) {
        errorLogger("Database error fetching edges:", { message: dbErr.message });
        throw dbErr;
    }

    const edgesData = edgesRs.rows;
    const nodesDict = {};
    const edges = [];
    const allIds = new Set();

    if (targetIds) {
        targetIds.forEach(id => allIds.add(String(id)));
    }

    edgesData.forEach(row => {
        allIds.add(String(row.source));
        allIds.add(String(row.target));
    });

    if (allIds.size === 0) return { nodes: [], edges: [] };

    const metaMap = {};
    const idsArray = Array.from(allIds);
    const idsStr = idsArray.join("','");

    const entityTables = [
        { name: 'business_partners', id: 'businessPartner', label: 'Business Partner' },
        { name: 'products', id: 'product', label: 'Product' },
        { name: 'plants', id: 'plant', label: 'Plant' },
        { name: 'sales_headers', id: 'salesOrder', label: 'Sales Order' },
        { name: 'delivery_headers', id: 'deliveryDocument', label: 'Delivery' },
        { name: 'billing_headers', id: 'billingDocument', label: 'Invoice' },
        { name: 'journal_entries', id: 'accountingDocument', label: 'Accounting' }
    ];

    await Promise.all(entityTables.map(async (table) => {
        try {
            const resultsRs = await client.execute(`SELECT * FROM ${table.name} WHERE ${table.id} IN ('${idsStr}')`);
            resultsRs.rows.forEach(res => {
                const mid = String(res[table.id]);
                metaMap[mid] = { type: table.label, data: res };
            });
        } catch (err) {
            // Silently skip
        }
    }));

    edgesData.forEach((row, idx) => {
        const { source: src, target: tgt, type: edgeType } = row;
        [src, tgt].forEach(nodeId => {
            const sId = String(nodeId);
            if (!nodesDict[sId]) {
                const info = metaMap[sId] || { type: "Entity", data: {} };
                nodesDict[sId] = {
                    id: sId,
                    label: sId,
                    type: info.type,
                    metadata: info.data
                };
            }
        });
        edges.push({
            id: `e${idx}`,
            source: String(src),
            target: String(tgt),
            type: edgeType
        });
    });

    return { nodes: Object.values(nodesDict), edges };
}

module.exports = { fetchGraphData };
