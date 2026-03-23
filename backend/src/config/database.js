const { createClient } = require("@libsql/client");
const path = require("path");
require("dotenv").config();

function getDbConnection() {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (url && token) {
        // Connect to Turso Cloud
        return createClient({
            url: url,
            authToken: token,
        });
    } else {
        // Fallback to local SQLite for development
        const dbPath = path.resolve(__dirname, "../../data/database.sqlite");
        return createClient({
            url: `file:${dbPath}`,
        });
    }
}

module.exports = { getDbConnection };
