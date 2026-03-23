const { createClient } = require("@libsql/client");
const path = require("path");
require("dotenv").config();

let client = null;

function getDbConnection() {
    if (client) return client;

    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (url && token) {
        // Connect to Turso Cloud
        client = createClient({
            url: url,
            authToken: token,
        });
    } else {
        // Fallback to local SQLite for development
        const dbPath = path.resolve(__dirname, "../../data/database.sqlite");
        client = createClient({
            url: `file:${dbPath}`,
        });
    }
    return client;
}

module.exports = { getDbConnection };
