const { logError } = require('../modules/logger');

/**
 * Centralized error handling middleware
 * @param {Error} err - Error object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    const requestId = req.headers['x-request-id'] || generateRequestId();
    
    // Extract profile and version from URL if available
    const urlParts = req.path.split('/');
    const profile = urlParts[1] || 'unknown';
    const version = urlParts[2] || 'unknown';
    
    // Log the error
    logError(profile, version, 'Unhandled error occurred', err, {
        requestId,
        request: {
            method: req.method,
            url: req.originalUrl,
            headers: req.headers,
            body: req.body,
            query: req.query,
            ip: req.ip
        }
    });

    // Determine error status code
    let statusCode = 500;
    let errorMessage = 'Internal Server Error';
    
    if (err.status) {
        statusCode = err.status;
        errorMessage = err.message;
    } else if (err.code === 'ECONNREFUSED') {
        statusCode = 502;
        errorMessage = 'Bad Gateway - Unable to connect to upstream service';
    } else if (err.code === 'ETIMEDOUT') {
        statusCode = 504;
        errorMessage = 'Gateway Timeout - Upstream service timeout';
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = 'Bad Request - Invalid input data';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorMessage = 'Unauthorized';
    }

    // Send error response
    res.status(statusCode).json({
        error: errorMessage,
        requestId,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            details: err.message
        })
    });
};

/**
 * Generate a unique request ID
 * @returns {string} Request ID
 */
const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 404 handler for unmatched routes
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const notFoundHandler = (req, res) => {
    const requestId = generateRequestId();
    
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        requestId,
        timestamp: new Date().toISOString()
    });
};

/**
 * Request ID middleware to add unique ID to all requests
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const requestIdMiddleware = (req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || generateRequestId();
    res.setHeader('x-request-id', req.headers['x-request-id']);
    next();
};

module.exports = { 
    errorHandler, 
    notFoundHandler, 
    requestIdMiddleware 
}; 