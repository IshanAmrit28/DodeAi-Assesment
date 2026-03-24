function infoLogger(msg, data = {}) {
    console.log(`[INFO] ${msg}`, Object.keys(data).length ? data : '');
}

function warnLogger(msg, data = {}) {
    console.warn(`[WARN] ${msg}`, Object.keys(data).length ? data : '');
}

function errorLogger(msg, errData = {}) {
    console.error(`[ERROR] ${msg}`, Object.keys(errData).length ? errData : '');
}

module.exports = { infoLogger, warnLogger, errorLogger };
