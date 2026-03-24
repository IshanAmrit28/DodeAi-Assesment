const { fetchGraphData } = require("../services/graphService");

async function handleGetGraph(req, res, next) {
    try {
        const data = await fetchGraphData(500);
        res.json(data);
    } catch (error) {
        next(error);
    }
}

async function handleGetGraphFocus(req, res, next) {
    try {
        const ids = req.query.ids;
        if (!ids) return res.status(400).json({ error: "ids parameter required" });
        const targetIds = ids.split(",");
        const data = await fetchGraphData(500, targetIds);
        res.json(data);
    } catch (error) {
        next(error);
    }
}

module.exports = { handleGetGraph, handleGetGraphFocus };
