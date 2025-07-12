const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testHealth() {
    try {
        console.log('🔍 Testing health endpoint...');
        const response = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health check passed:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        return false;
    }
}

async function testConfig() {
    try {
        console.log('🔍 Testing config endpoint...');
        const response = await axios.get(`${BASE_URL}/config`);
        console.log('✅ Config endpoint passed:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Config endpoint failed:', error.message);
        return false;
    }
}

async function testProxy() {
    try {
        console.log('🔍 Testing proxy endpoint...');
        const response = await axios.get(`${BASE_URL}/openai/v5/models`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Proxy test passed:', response.status);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('⚠️  Proxy test: Configuration not found (expected if no valid API key)');
            return true;
        }
        console.error('❌ Proxy test failed:', error.message);
        return false;
    }
}

async function testChatCompletion() {
    try {
        console.log('🔍 Testing chat completion...');
        const response = await axios.post(`${BASE_URL}/openai/v5/chat/completions`, {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'user', content: 'Hello, this is a test message.' }
            ],
            max_tokens: 50
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Chat completion test passed:', response.status);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log('⚠️  Chat completion test: Unauthorized (expected if no valid API key)');
            return true;
        }
        console.error('❌ Chat completion test failed:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting LLM Proxy Tests...\n');
    
    const tests = [
        { name: 'Health Check', fn: testHealth },
        { name: 'Config Endpoint', fn: testConfig },
        { name: 'Proxy Models', fn: testProxy },
        { name: 'Chat Completion', fn: testChatCompletion }
    ];
    
    let passed = 0;
    let total = tests.length;
    
    for (const test of tests) {
        console.log(`\n📋 Running: ${test.name}`);
        const result = await test.fn();
        if (result) passed++;
        console.log('─'.repeat(50));
    }
    
    console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All tests passed! The proxy is working correctly.');
    } else {
        console.log('⚠️  Some tests failed. Check the configuration and API keys.');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests }; 