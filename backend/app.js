const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { getDbConnection } = require("./src/config/database");
const { getChatResponse } = require("./src/services/chatService");

const app = express();
const PORT = process.env.PORT || 3000;

const rawOrigins = process.env.CORS_ALLOWED_ORIGINS || "*";
const origins = rawOrigins === "*" ? "*" : rawOrigins.split(",").map(o => o.trim()).filter(o => o);

app.use(cors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Optimized fetch graph data
async function _fetchGraphData(limit = 500, targetIds = null) {
    const client = getDbConnection();
    console.log(`Fetching graph data: limit=${limit}, targets=${targetIds?.length || 0}`);

    let edgesRs;
    try {
        if (targetIds && targetIds.length > 0) {
            const idsStr = targetIds.join("','");
            edgesRs = await client.execute(`SELECT source, target, type FROM edges WHERE source IN ('${idsStr}') OR target IN ('${idsStr}') LIMIT 200`);
        } else {
            edgesRs = await client.execute(`SELECT source, target, type FROM edges LIMIT ${limit}`);
        }
    } catch (dbErr) {
        console.error("Database error fetching edges:", dbErr.message);
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

    // Mapping of tables to their primary ID column
    const entityTables = [
        { name: 'business_partners', id: 'businessPartner', label: 'Business Partner' },
        { name: 'products', id: 'product', label: 'Product' },
        { name: 'plants', id: 'plant', label: 'Plant' },
        { name: 'sales_headers', id: 'salesOrder', label: 'Sales Order' },
        { name: 'delivery_headers', id: 'deliveryDocument', label: 'Delivery' },
        { name: 'billing_headers', id: 'billingDocument', label: 'Invoice' },
        { name: 'journal_entries', id: 'accountingDocument', label: 'Accounting' }
    ];

    // Parallelize metadata fetching for speed
    await Promise.all(entityTables.map(async (table) => {
        try {
            const resultsRs = await client.execute(`SELECT * FROM ${table.name} WHERE ${table.id} IN ('${idsStr}')`);
            resultsRs.rows.forEach(res => {
                const mid = String(res[table.id]);
                metaMap[mid] = { type: table.label, data: res };
            });
        } catch (err) {
            // Silently skip if table doesn't exist or query fails
            console.debug(`Note: Could not fetch from ${table.name}: ${err.message}`);
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

app.get("/graph", async (req, res) => {
    try {
        const data = await _fetchGraphData(500);
        res.json(data);
    } catch (error) {
        console.error("Error in /graph endpoint:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/graph/focus", async (req, res) => {
    try {
        const ids = req.query.ids;
        if (!ids) return res.status(400).json({ error: "ids parameter required" });
        const targetIds = ids.split(",");
        const data = await _fetchGraphData(500, targetIds);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "message required" });
        const result = await getChatResponse(message);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
