const { getChatResponse } = require("../services/chatService");

async function handleChat(req, res, next) {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "message required" });
        }
        const result = await getChatResponse(message);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

module.exports = { handleChat };
