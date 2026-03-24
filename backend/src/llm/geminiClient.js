const { GoogleGenerativeAI } = require("@google/generative-ai");
const { warnLogger, errorLogger } = require("../utils/logger");

const MODEL_NAME = "gemini-2.5-flash";

async function callGenerativeAI(prompt, systemInstruction = null) {
    const keys = [
        { name: "GEMINI_API_KEY_1", val: process.env.GEMINI_API_KEY_1 },
        { name: "GEMINI_API_KEY_2", val: process.env.GEMINI_API_KEY_2 },
        { name: "GEMINI_API_KEY_3", val: process.env.GEMINI_API_KEY_3 },
    ];

    const availableKeys = keys.filter(k => k.val);
    
    if (availableKeys.length === 0) {
        errorLogger("No Gemini API keys found in environment variables.");
        throw new Error("API Configuration error: No Gemini AI keys found. Please check your .env file.");
    }

    const attempts = [];
    if (availableKeys[0]) {
        attempts.push(availableKeys[0]);
        attempts.push(availableKeys[0]);
    }
    if (availableKeys[1]) attempts.push(availableKeys[1]);
    if (availableKeys[2]) attempts.push(availableKeys[2]);

    let fallbackUsed = false;

    for (let i = 0; i < attempts.length; i++) {
        const { name, val } = attempts[i];

        try {
            const genAI = new GoogleGenerativeAI(val);
            const modelConfig = { model: MODEL_NAME };
            if (systemInstruction) {
                modelConfig.systemInstruction = systemInstruction;
            }
            const model = genAI.getGenerativeModel(modelConfig);

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();

            if (i > 0) fallbackUsed = true;
            return { text, keyName: name, fallbackUsed };
        } catch (error) {
            warnLogger(`Key ${name} failed. Attempt ${i + 1}. Error: ${error.message}`);
            if (i === 0 && attempts.length > 1) await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    throw new Error("All configured Gemini API keys failed or are rate limited. Please try again later.");
}

module.exports = { callGenerativeAI };
