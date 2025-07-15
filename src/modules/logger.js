const winston = require('winston');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const logsDir = path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Generate a unique session ID when the module is first loaded
const sessionId = crypto.randomBytes(8).toString('hex');
const sessionIdShort = sessionId.slice(0, 8);
const sessionStartTime = new Date();

// Create a single logger instance for the entire session
let sessionLogger = null;

/**
 * Initialize the session logger
 * @returns {winston.Logger} Winston logger instance
 */
const initializeSessionLogger = () => {
    if (sessionLogger) {
        return sessionLogger;
    }

    // Format: YYYYMMDDHHMMSS_<sessionID8>.log
    const pad = (n) => n.toString().padStart(2, '0');
    const d = sessionStartTime;
    const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const logFileName = `${dateStr}_${sessionIdShort}.log`;
    const logFilePath = path.join(logsDir, logFileName);

    sessionLogger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.errors({ stack: true }),
            winston.format.json()
        ),
        defaultMeta: { 
            service: 'llm-proxy',
            sessionId,
            sessionStartTime: sessionStartTime.toISOString()
        },
        transports: [
            new winston.transports.File({
                filename: logFilePath,
                maxsize: process.env.LOG_MAX_SIZE || '50m', // Increased for session-based logging
                maxFiles: process.env.LOG_MAX_FILES || 10,  // Increased for session-based logging
                tailable: true
            })
        ]
    });

    // Add console transport in development
    if (process.env.NODE_ENV === 'development') {
        sessionLogger.add(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }));
    }

    // Log session start
    sessionLogger.info('Session started', {
        sessionId,
        sessionStartTime: sessionStartTime.toISOString(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform
    });

    return sessionLogger;
};

/**
 * Get the session logger instance
 * @returns {winston.Logger} Winston logger instance
 */
const getSessionLogger = () => {
    if (!sessionLogger) {
        return initializeSessionLogger();
    }
    return sessionLogger;
};

/**
 * Log a complete request/response interaction
 * @param {string} profile - The profile name
 * @param {string} version - The version identifier
 * @param {object} logData - The data to log
 */
const logInteraction = (profile, version, logData) => {
    try {
        const logger = getSessionLogger();
        
        // Sanitize sensitive data
        const sanitizedData = sanitizeLogData(logData);
        
        logger.info('API Interaction', {
            ...sanitizedData,
            profile,
            version,
            sessionId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Logging error:', error);
    }
};

/**
 * Log an error
 * @param {string} profile - The profile name
 * @param {string} version - The version identifier
 * @param {string} message - Error message
 * @param {object} error - Error object
 * @param {object} context - Additional context
 */
const logError = (profile, version, message, error, context = {}) => {
    try {
        const logger = getSessionLogger();
        
        logger.error(message, {
            error: {
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            context,
            profile,
            version,
            sessionId,
            timestamp: new Date().toISOString()
        });
    } catch (logError) {
        console.error('Error logging failed:', logError);
    }
};

/**
 * Log session information
 * @param {string} message - Log message
 * @param {object} data - Additional data to log
 */
const logSessionInfo = (message, data = {}) => {
    try {
        const logger = getSessionLogger();
        
        logger.info(message, {
            ...data,
            sessionId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Session logging error:', error);
    }
};

/**
 * Sanitize log data to remove sensitive information
 * @param {object} data - The data to sanitize
 * @returns {object} Sanitized data
 */
const sanitizeLogData = (data) => {
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive headers
    if (sanitized.request && sanitized.request.headers) {
        const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
        sensitiveHeaders.forEach(header => {
            if (sanitized.request.headers[header]) {
                sanitized.request.headers[header] = '[REDACTED]';
            }
        });
    }
    
    // Remove sensitive response headers
    if (sanitized.response && sanitized.response.headers) {
        const sensitiveHeaders = ['set-cookie', 'authorization'];
        sensitiveHeaders.forEach(header => {
            if (sanitized.response.headers[header]) {
                sanitized.response.headers[header] = '[REDACTED]';
            }
        });
    }
    
    return sanitized;
};

/**
 * Get current session information
 * @returns {object} Session information
 */
const getSessionInfo = () => {
    return {
        sessionId,
        sessionStartTime: sessionStartTime.toISOString(),
        sessionDuration: Date.now() - sessionStartTime.getTime(),
        logFilePath: getSessionLogFilePath()
    };
};

/**
 * Get the current session log file path
 * @returns {string} Log file path
 */
const getSessionLogFilePath = () => {
    // Format: YYYYMMDDHHMMSS_<sessionID8>.log
    const pad = (n) => n.toString().padStart(2, '0');
    const d = sessionStartTime;
    const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const logFileName = `${dateStr}_${sessionIdShort}.log`;
    return path.join(logsDir, logFileName);
};

/**
 * Gracefully close the session logger
 */
const closeSessionLogger = () => {
    if (sessionLogger) {
        sessionLogger.info('Session ending', {
            sessionId,
            sessionEndTime: new Date().toISOString(),
            sessionDuration: Date.now() - sessionStartTime.getTime()
        });
        
        sessionLogger.close();
        sessionLogger = null;
    }
};

// Initialize the session logger when the module is loaded
initializeSessionLogger();

module.exports = { 
    logInteraction, 
    logError, 
    logSessionInfo,
    getSessionInfo,
    getSessionLogFilePath,
    closeSessionLogger,
    sanitizeLogData,
    sessionId
}; 