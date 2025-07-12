const axios = require('axios');
const { getConfig, validateConfig } = require('./config');
const { logInteraction, logError } = require('./logger');

/**
 * Core proxy middleware that forwards requests to target LLM APIs
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
const proxyRequest = async (req, res, next) => {
    const { profile, version } = req.params;
    const downstreamPath = req.params[0]; // The remaining path after profile/version
    
    const startTime = Date.now();
    const requestId = generateRequestId();

    try {
        // Get configuration for the profile and version
        const config = getConfig(profile, version);
        
        if (!config) {
            const error = new Error(`Configuration not found for profile '${profile}' and version '${version}'`);
            error.status = 404;
            throw error;
        }

        // Validate configuration
        if (!validateConfig(config)) {
            const error = new Error(`Invalid configuration for profile '${profile}' and version '${version}'`);
            error.status = 500;
            throw error;
        }

        // Construct target URL
        const targetUrl = `${config.baseUrl}/${downstreamPath}`;
        
        // Prepare headers for the outgoing request
        const headers = prepareHeaders(req.headers, config.apiKey, targetUrl);
        
        // Prepare request configuration
        const requestConfig = {
            method: req.method,
            url: targetUrl,
            headers,
            timeout: 30000, // 30 second timeout
            maxRedirects: 5,
            validateStatus: () => true // Accept all status codes
        };

        // Only set responseType to 'stream' if explicitly requesting streaming
        if (req.body && req.body.stream === true) {
            requestConfig.responseType = 'stream';
        }

        // Add request body for non-GET requests
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
            requestConfig.data = req.body;
        }

        // Add query parameters
        if (Object.keys(req.query).length > 0) {
            requestConfig.params = req.query;
        }

        // Make the request to the target API
        const response = await axios(requestConfig);
        
        const durationMs = Date.now() - startTime;

        // Set response headers
        setResponseHeaders(res, response.headers);
        
        // Set response status
        res.status(response.status);

        // Handle streaming responses (for chat completions)
        if (isStreamingResponse(response, req)) {
            await handleStreamingResponse(res, response, profile, version, {
                requestId,
                startTime,
                durationMs,
                request: {
                    method: req.method,
                    url: req.originalUrl,
                    headers: req.headers,
                    body: req.body,
                    query: req.query
                },
                targetUrl
            });
        } else {
            // Handle regular responses
            await handleRegularResponse(res, response, profile, version, {
                requestId,
                startTime,
                durationMs,
                request: {
                    method: req.method,
                    url: req.originalUrl,
                    headers: req.headers,
                    body: req.body,
                    query: req.query
                },
                targetUrl
            });
        }

    } catch (error) {
        const durationMs = Date.now() - startTime;
        
        // Log the error
        logError(profile, version, 'Proxy request failed', error, {
            requestId,
            durationMs,
            request: {
                method: req.method,
                url: req.originalUrl,
                headers: req.headers,
                body: req.body,
                query: req.query
            }
        });

        // Handle different types of errors
        if (error.response) {
            // Upstream API error
            setResponseHeaders(res, error.response.headers);
            res.status(error.response.status).json(error.response.data);
        } else if (error.status) {
            // Configuration or validation error
            res.status(error.status).json({ 
                error: error.message,
                requestId 
            });
        } else {
            // Network or other error
            res.status(500).json({ 
                error: 'Internal server error',
                requestId 
            });
        }
    }
};

/**
 * Prepare headers for the outgoing request
 * @param {object} incomingHeaders - Headers from the incoming request
 * @param {string} apiKey - API key from configuration
 * @param {string} targetUrl - Target URL
 * @returns {object} Prepared headers
 */
const prepareHeaders = (incomingHeaders, apiKey, targetUrl) => {
    const headers = { ...incomingHeaders };
    
    // Set authorization header with configured API key
    headers['Authorization'] = `Bearer ${apiKey}`;
    
    // Remove headers that shouldn't be forwarded
    delete headers.host;
    delete headers['content-length'];
    
    // Set host header for the target URL
    try {
        const url = new URL(targetUrl);
        headers.host = url.host;
    } catch (error) {
        // If URL parsing fails, keep original host
    }
    
    return headers;
};

/**
 * Set response headers from the upstream response
 * @param {object} res - Express response object
 * @param {object} upstreamHeaders - Headers from upstream response
 */
const setResponseHeaders = (res, upstreamHeaders) => {
    Object.keys(upstreamHeaders).forEach(key => {
        // Skip headers that shouldn't be forwarded
        if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
            res.setHeader(key, upstreamHeaders[key]);
        }
    });
};

/**
 * Check if response is a streaming response
 * @param {object} response - Axios response object
 * @param {object} req - Express request object
 * @returns {boolean} True if streaming response
 */
const isStreamingResponse = (response, req) => {
    // Only treat as streaming if:
    // - The request has stream: true
    // - The response.data is a stream (has .on)
    return (
        req.body && req.body.stream === true &&
        response.data && typeof response.data.on === 'function'
    );
};

/**
 * Handle streaming responses (for chat completions)
 * @param {object} res - Express response object
 * @param {object} response - Axios response object
 * @param {string} profile - Profile name
 * @param {string} version - Version identifier
 * @param {object} logData - Data for logging
 */
const handleStreamingResponse = async (res, response, profile, version, logData) => {
    let responseBody = '';
    
    // Set appropriate headers for streaming
    res.setHeader('Content-Type', response.headers['content-type'] || 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    response.data.on('data', (chunk) => {
        try {
            const chunkStr = chunk.toString();
            responseBody += chunkStr;
            res.write(chunkStr);
        } catch (error) {
            logError(profile, version, 'Error writing streaming chunk', error, logData);
        }
    });

    response.data.on('end', () => {
        try {
            res.end();
            
            // Log the complete interaction
            logInteraction(profile, version, {
                ...logData,
                response: {
                    status: response.status,
                    headers: response.headers,
                    body: responseBody
                }
            });
        } catch (error) {
            logError(profile, version, 'Error ending streaming response', error, logData);
        }
    });

    response.data.on('error', (error) => {
        logError(profile, version, 'Streaming response error', error, logData);
        try {
            res.end();
        } catch (endError) {
            // Ignore errors when ending response
        }
    });
};

/**
 * Handle regular (non-streaming) responses
 * @param {object} res - Express response object
 * @param {object} response - Axios response object
 * @param {string} profile - Profile name
 * @param {string} version - Version identifier
 * @param {object} logData - Data for logging
 */
const handleRegularResponse = async (res, response, profile, version, logData) => {
    let responseBody = '';
    
    if (response.data) {
        if (typeof response.data === 'string') {
            responseBody = response.data;
        } else {
            responseBody = JSON.stringify(response.data);
        }
    }

    // Send the response
    res.send(response.data);
    
    // Log the complete interaction
    logInteraction(profile, version, {
        ...logData,
        response: {
            status: response.status,
            headers: response.headers,
            body: responseBody
        }
    });
};

/**
 * Generate a unique request ID
 * @returns {string} Request ID
 */
const generateRequestId = () => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

module.exports = { proxyRequest }; 