const { infoLogger } = require('../utils/logger');

function requestLogger(req, res, next) {
    infoLogger(`[HTTP] ${req.method} ${req.path}`);
    next();
}

module.exports = requestLogger;
