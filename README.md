# LLM API Proxy

A robust, transparent REST API proxy service for LLM APIs with profile-based configuration and comprehensive logging.

## Features

- **Profile-based Configuration**: Support multiple LLM API configurations via JSON files
- **Version Management**: Multiple versions per profile for different API configurations
- **Transparent Proxying**: Forward requests to various LLM APIs (OpenAI, Azure OpenAI, etc.)
- **Comprehensive Logging**: Log all requests/responses with sanitized sensitive data
- **Streaming Support**: Handle streaming responses for chat completions
- **Error Handling**: Robust error handling with detailed logging
- **Security**: CORS, Helmet, and request sanitization
- **Health Monitoring**: Built-in health check and configuration endpoints

## Project Structure

```
llm-proxy/
├── configs/                 # Configuration files
│   ├── openai.json          # OpenAI API configurations
│   ├── azure.json           # Azure OpenAI configurations
│   └── *.example.json       # Example configurations
├── logs/                    # Log files (auto-created)
├── src/
│   ├── modules/
│   │   ├── config.js        # Configuration loader
│   │   ├── logger.js        # Logging service
│   │   └── proxy.js         # Core proxy logic
│   └── middleware/
│       └── error.js         # Error handling
├── index.js                 # Main application
├── package.json
├── env.example              # Environment variables template
└── README.md
```

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd llm-proxy

# Install dependencies
npm install

# Copy environment file
cp env.example .env
```

### 2. Configuration

Create configuration files in the `configs/` directory:

**`configs/openai.json`:**
```json
{
  "v1": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "your-openai-api-key-v1",
    "description": "OpenAI API v1 configuration"
  },
  "v5": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "your-openai-api-key-v5",
    "description": "OpenAI API v5 configuration"
  }
}
```

**`configs/azure.json`:**
```json
{
  "v1": {
    "baseUrl": "https://your-azure-resource.openai.azure.com/openai/deployments/your-deployment",
    "apiKey": "your-azure-api-key",
    "description": "Azure OpenAI v1 configuration"
  }
}
```

### 3. Environment Variables

Edit `.env` file:
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Logging Configuration
LOG_LEVEL=info
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# Security Configuration
CORS_ORIGIN=*
```

### 4. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## API Usage

### URL Structure

```
/:<profile>/:<version>/*
```

- `:<profile>`: Configuration profile name (e.g., `openai`, `azure`)
- `:<version>`: Version identifier (e.g., `v1`, `v5`)
- `/*`: Path to forward to the target API

### Examples

#### Chat Completions

```bash
curl http://localhost:3000/openai/v5/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

#### List Models

```bash
curl http://localhost:3000/openai/v5/models \
  -H "Content-Type: application/json"
```

#### Azure OpenAI

```bash
curl http://localhost:3000/azure/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "version": "1.0.0",
  "session": {
    "id": "b8fae66f",
    "startTime": "2024-01-15T10:30:00.000Z",
    "duration": 123456
  }
}
```

### Session Information

```bash
curl http://localhost:3000/session
```

Response:
```json
{
  "session": {
    "sessionId": "b8fae66f",
    "sessionStartTime": "2024-01-15T10:30:00.000Z",
    "sessionDuration": 123456,
    "logFilePath": "/path/to/logs/20250115103000_b8fae66f.log"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Configuration Info

```bash
curl http://localhost:3000/config
```

Response:
```json
{
  "profiles": {
    "openai": {
      "versions": ["v1", "v5"],
      "description": "Configuration for openai profile"
    },
    "azure": {
      "versions": ["v1"],
      "description": "Configuration for azure profile"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Logging

Logs are automatically created in the `logs/` directory with session-based logging. Each server session creates a single log file with the format:
```
YYYYMMDDHHMMSS_<sessionID>.log
```

Example: `20250704062359_b8fae66f.log`

### Session-Based Logging

- **Single File Per Session**: All API interactions within a server session are logged to one file
- **Persistent Session ID**: Each server instance gets a unique session ID that persists from start to shutdown
- **Comprehensive Coverage**: All requests, responses, errors, and session events are logged together
- **Easy Analysis**: Review all interactions for a specific server run in one place

### Log Format

Each log entry contains:
- Timestamp
- Session ID and session start time
- Request details (method, URL, headers, body)
- Target URL
- Response details (status, headers, body)
- Duration
- Request ID
- Profile and version information
- Session events (start, shutdown, errors)

### Log Sanitization

Sensitive data is automatically redacted:
- Authorization headers
- API keys
- Cookies
- Set-cookie headers

## Error Handling

The proxy handles various error scenarios:

- **404**: Profile or version not found
- **500**: Invalid configuration
- **502**: Upstream service unavailable
- **504**: Upstream service timeout
- **400**: Invalid request data

All errors include:
- Error message
- Request ID for tracking
- Timestamp
- Stack trace (in development mode)

## Security Features

- **CORS Protection**: Configurable CORS policies
- **Helmet**: Security headers
- **Request Sanitization**: Automatic removal of sensitive headers
- **Rate Limiting**: Built-in rate limiting support
- **Request ID Tracking**: Unique request IDs for all requests

## Configuration Management

### Adding New Profiles

1. Create a new configuration file: `configs/<profile>.json`
2. Define versions with baseUrl and apiKey
3. Restart the server

### Updating Configurations

1. Edit the configuration file
2. Restart the server to reload configurations

### Configuration Validation

The proxy validates all configurations on startup:
- Required fields: `baseUrl`, `apiKey`
- URL format validation
- API key format validation

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for automatic restarts on file changes.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment mode |
| `LOG_LEVEL` | info | Logging level |
| `LOG_MAX_SIZE` | 50m | Max log file size |
| `LOG_MAX_FILES` | 10 | Max log files to keep |
| `CORS_ORIGIN` | * | CORS origin |
| `BODY_LIMIT` | 50mb | Request body size limit |

### Testing

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test configuration endpoint
curl http://localhost:3000/config

# Test session information
curl http://localhost:3000/session

# Test proxy with OpenAI
curl http://localhost:3000/openai/v5/models

# Test session logging
npm run test:logging
```

## Production Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure proper CORS origins
3. Set up log rotation
4. Use environment variables for sensitive data
5. Set up monitoring and alerting

### Monitoring

- Health check endpoint: `/health`
- Configuration endpoint: `/config`
- Log files in `logs/` directory
- Request ID tracking for debugging

## Troubleshooting

### Common Issues

1. **Configuration not found**: Check config file format and location
2. **API key errors**: Verify API keys in configuration files
3. **CORS errors**: Check CORS_ORIGIN environment variable
4. **Timeout errors**: Increase timeout in proxy configuration

### Debug Mode

Set `LOG_LEVEL=debug` for detailed logging.

### Log Analysis

Logs are in JSON format for easy parsing:
```bash
# View current session logs
tail -f logs/$(ls -t logs/*.log | head -1)

# Search for errors in current session
grep "error" logs/$(ls -t logs/*.log | head -1)

# List all session logs
ls -la logs/*.log

# View specific session log
cat logs/20250704062359_b8fae66f.log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.