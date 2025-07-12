#!/bin/bash

# LLM Proxy Startup Script

set -e

echo "🚀 Starting LLM API Proxy..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your configuration."
fi

# Create configs directory if it doesn't exist
if [ ! -d "configs" ]; then
    echo "📁 Creating configs directory..."
    mkdir -p configs
fi

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
    echo "📁 Creating logs directory..."
    mkdir -p logs
fi

# Check if configuration files exist
if [ ! -f "configs/openai-conf.json" ]; then
    echo "⚠️  No configuration files found in configs/ directory."
    echo "   Please create configuration files before starting the proxy."
    echo "   Example: configs/openai-conf.json"
fi

echo "✅ Environment setup complete!"

# Start the server
echo "🌐 Starting server..."
npm start 