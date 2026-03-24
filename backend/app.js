const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const { infoLogger } = require("./src/utils/logger");
const requestLogger = require("./src/middlewares/requestLogger");
const errorHandler = require("./src/middlewares/errorHandler");

const chatRoutes = require("./src/routes/chatRoutes");
const graphRoutes = require("./src/routes/graphRoutes");

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
app.use(requestLogger);

app.use("/chat", chatRoutes);
app.use("/graph", graphRoutes);

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use(errorHandler);

app.listen(PORT, () => {
    infoLogger(`Server running on port ${PORT}`);
});
