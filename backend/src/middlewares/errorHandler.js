const { errorLogger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
    errorLogger(`[Request Error] ${err.message}`, { stack: err.stack, path: req.path });
    
    const status = err.status || 500;
    res.status(status).json({
        error: status === 500 ? "Internal Server Error" : err.message
    });
}

module.exports = errorHandler;
