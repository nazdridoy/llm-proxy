require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { proxyRequest } = require('./modules/proxy');
const { errorHandler, notFoundHandler, requestIdMiddleware } = require('./middleware/error');
const { getProfiles, getVersions } = require('./modules/config');
const { logSessionInfo, getSessionInfo, closeSessionLogger } = require('./modules/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API proxy
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true
}));

// Request parsing middleware
app.use(express.json({ 
    limit: process.env.BODY_LIMIT || '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf; // Store raw body for logging
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: process.env.BODY_LIMIT || '50mb' 
}));

// Request ID middleware
app.use(requestIdMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
    const sessionInfo = getSessionInfo();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('../package.json').version,
        session: {
            id: sessionInfo.sessionId,
            startTime: sessionInfo.sessionStartTime,
            duration: sessionInfo.sessionDuration
        }
    });
});

// Configuration info endpoint
app.get('/config', (req, res) => {
    const profiles = getProfiles();
    const configInfo = {};
    
    profiles.forEach(profile => {
        configInfo[profile] = {
            versions: getVersions(profile),
            description: `Configuration for ${profile} profile`
        };
    });
    
    res.json({
        profiles: configInfo,
        timestamp: new Date().toISOString()
    });
});

// Session info endpoint
app.get('/session', (req, res) => {
    const sessionInfo = getSessionInfo();
    res.json({
        session: sessionInfo,
        timestamp: new Date().toISOString()
    });
});

// Main proxy route - handles all requests with pattern /:profile/:version/*
app.all('/:profile/:version/*', proxyRequest);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    // Log session ending
    logSessionInfo('Server shutdown initiated', { signal });
    
    server.close(() => {
        console.log('HTTP server closed.');
        
        // Close the session logger
        closeSessionLogger();
        
        console.log('Session logger closed.');
        process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        closeSessionLogger();
        process.exit(1);
    }, 10000);
};

// Start the server
const server = app.listen(PORT, () => {
    const sessionInfo = getSessionInfo();
    console.log(`🚀 LLM API Proxy server listening on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`⚙️  Config info: http://localhost:${PORT}/config`);
    console.log(`📋 Session info: http://localhost:${PORT}/session`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📝 Log level: ${process.env.LOG_LEVEL || 'info'}`);
    console.log(`🆔 Session ID: ${sessionInfo.sessionId}`);
    console.log(`📁 Log file: ${sessionInfo.logFilePath}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    closeSessionLogger();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    closeSessionLogger();
    process.exit(1);
});

module.exports = app; 