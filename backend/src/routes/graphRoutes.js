const express = require("express");
const router = express.Router();
const { handleGetGraph, handleGetGraphFocus } = require("../controllers/graphController");

router.get("/", handleGetGraph);
router.get("/focus", handleGetGraphFocus);

module.exports = router;
