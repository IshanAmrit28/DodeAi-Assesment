const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { getDbConnection } = require("./src/config/database");
const { getChatResponse } = require("./src/services/chatService");

const app = express();
const PORT = process.env.PORT || 3000;

const rawOrigins = process.env.CORS_ALLOWED_ORIGINS || "*";
const origins = rawOrigins.split(",").map(o => o.trim()).filter(o => o);

app.use(cors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

async function _fetchGraphData(limit = 500, targetIds = null) {
    const client = getDbConnection();

    let edgesRs;
    if (targetIds && targetIds.length > 0) {
        const idsStr = targetIds.join("','");
        edgesRs = await client.execute(`SELECT source, target, type FROM edges WHERE source IN ('${idsStr}') OR target IN ('${idsStr}') LIMIT 200`);
    } else {
        edgesRs = await client.execute(`SELECT source, target, type FROM edges LIMIT ${limit}`);
    }

    const edgesData = edgesRs.rows;
    const nodesDict = {};
    const edges = [];
    const allIds = new Set();

    if (targetIds) {
        targetIds.forEach(id => allIds.add(id));
    }

    edgesData.forEach(row => {
        allIds.add(row.source);
        allIds.add(row.target);
    });

    const metaMap = {};
    
    // Get all tables except edges and sqlite_sequence
    const tablesRs = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('edges', 'sqlite_sequence')");
    const availableTables = tablesRs.rows.map(r => r.name);

    for (const table of availableTables) {
        if (allIds.size === 0) break;

        // Better heuristic for ID col
        let idCol = 'id'; // default
        if (table === 'business_partners') idCol = 'businessPartner';
        else if (table === 'billing_headers') idCol = 'billingDocument';
        else if (table === 'delivery_headers') idCol = 'deliveryDocument';
        else if (table === 'journal_entries') idCol = 'accountingDocument';
        else if (table === 'products') idCol = 'product';
        else if (table === 'payments') idCol = 'accountingDocument';
        else {
            // Check table info to find the first column as default ID
            const infoRs = await client.execute(`PRAGMA table_info(${table})`);
            if (infoRs.rows.length > 0) {
                idCol = infoRs.rows[0].name;
            }
        }

        const idsArray = Array.from(allIds);
        const idsStr = idsArray.join("','");
        
        try {
            const resultsRs = await client.execute(`SELECT * FROM ${table} WHERE ${idCol} IN ('${idsStr}')`);
            resultsRs.rows.forEach(res => {
                const mid = String(res[idCol]);
                const label = table.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()).replace(/s$/, '');
                metaMap[mid] = { type: label, data: res };
            });
        } catch (err) {
            console.error(`Error fetching from table ${table}: ${err.message}`);
        }
    }

    edgesData.forEach((row, idx) => {
        const { source: src, target: tgt, type: edgeType } = row;
        [src, tgt].forEach(nodeId => {
            if (!nodesDict[nodeId]) {
                const info = metaMap[nodeId] || { type: "Entity", data: {} };
                nodesDict[nodeId] = {
                    id: nodeId,
                    label: nodeId,
                    type: info.type,
                    metadata: info.data
                };
            }
        });
        edges.push({
            id: `e${idx}`,
            source: src,
            target: tgt,
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
