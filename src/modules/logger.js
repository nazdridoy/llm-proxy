const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Create a logger instance cache
const loggerCache = new Map();

/**
 * Create or retrieve a logger for a specific profile and version
 * @param {string} profile - The profile name
 * @param {string} version - The version identifier
 * @returns {winston.Logger} Winston logger instance
 */
const createLogger = (profile, version) => {
    const loggerId = `${profile}-${version}`;
    
    if (loggerCache.has(loggerId)) {
        return loggerCache.get(loggerId);
    }

    const today = new Date().toISOString().split('T')[0];
    const logFileName = `${today}-${profile}-${version}-log.log`;
    const logFilePath = path.join(logsDir, logFileName);

    const logger = winston.createLogger({
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
            profile,
            version
        },
        transports: [
            new winston.transports.File({
                filename: logFilePath,
                maxsize: process.env.LOG_MAX_SIZE || '10m',
                maxFiles: process.env.LOG_MAX_FILES || 5,
                tailable: true
            })
        ]
    });

    // Add console transport in development
    if (process.env.NODE_ENV === 'development') {
        logger.add(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }));
    }

    loggerCache.set(loggerId, logger);
    return logger;
};

/**
 * Log a complete request/response interaction
 * @param {string} profile - The profile name
 * @param {string} version - The version identifier
 * @param {object} logData - The data to log
 */
const logInteraction = (profile, version, logData) => {
    try {
        const logger = createLogger(profile, version);
        
        // Sanitize sensitive data
        const sanitizedData = sanitizeLogData(logData);
        
        logger.info('API Interaction', {
            ...sanitizedData,
            timestamp: new Date().toISOString(),
            profile,
            version
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
        const logger = createLogger(profile, version);
        
        logger.error(message, {
            error: {
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            context,
            timestamp: new Date().toISOString(),
            profile,
            version
        });
    } catch (logError) {
        console.error('Error logging failed:', logError);
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
 * Get log file path for a specific profile and version
 * @param {string} profile - The profile name
 * @param {string} version - The version identifier
 * @param {string} date - Optional date in YYYY-MM-DD format
 * @returns {string} Log file path
 */
const getLogFilePath = (profile, version, date = null) => {
    const logDate = date || new Date().toISOString().split('T')[0];
    const logFileName = `${logDate}-${profile}-${version}-log.log`;
    return path.join(logsDir, logFileName);
};

module.exports = { 
    logInteraction, 
    logError, 
    createLogger, 
    getLogFilePath,
    sanitizeLogData 
}; 