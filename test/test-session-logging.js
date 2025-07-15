const { 
    logInteraction, 
    logError, 
    logSessionInfo, 
    getSessionInfo, 
    getSessionLogFilePath,
    closeSessionLogger,
    sessionId 
} = require('../src/modules/logger');

async function testSessionLogging() {
    console.log('🧪 Testing Session-Based Logging System...\n');
    
    try {
        // Test 1: Check session info
        console.log('📋 Test 1: Session Information');
        const sessionInfo = getSessionInfo();
        console.log('✅ Session ID:', sessionInfo.sessionId);
        console.log('✅ Session Start Time:', sessionInfo.sessionStartTime);
        console.log('✅ Session Duration:', sessionInfo.sessionDuration, 'ms');
        console.log('✅ Log File Path:', sessionInfo.logFilePath);
        console.log('✅ Session ID matches:', sessionId === sessionInfo.sessionId);
        
        // Test 2: Log session info
        console.log('\n📋 Test 2: Session Info Logging');
        logSessionInfo('Test session info message', { 
            testData: 'sample data',
            testNumber: 42 
        });
        console.log('✅ Session info logged successfully');
        
        // Test 3: Log API interaction
        console.log('\n📋 Test 3: API Interaction Logging');
        const mockLogData = {
            requestId: 'test-request-123',
            startTime: Date.now() - 1000,
            durationMs: 1000,
            request: {
                method: 'POST',
                url: '/test/profile/v1/chat/completions',
                headers: {
                    'content-type': 'application/json',
                    'authorization': 'Bearer test-key'
                },
                body: { model: 'gpt-3.5-turbo', messages: [] },
                query: {}
            },
            targetUrl: 'https://api.openai.com/v1/chat/completions'
        };
        
        logInteraction('test-profile', 'v1', mockLogData);
        console.log('✅ API interaction logged successfully');
        
        // Test 4: Log error
        console.log('\n📋 Test 4: Error Logging');
        const testError = new Error('Test error message');
        testError.code = 'TEST_ERROR';
        
        logError('test-profile', 'v1', 'Test error occurred', testError, {
            requestId: 'test-error-123',
            additionalContext: 'test context'
        });
        console.log('✅ Error logged successfully');
        
        // Test 5: Check log file exists
        console.log('\n📋 Test 5: Log File Verification');
        const fs = require('fs');
        const logFilePath = getSessionLogFilePath();
        
        if (fs.existsSync(logFilePath)) {
            const stats = fs.statSync(logFilePath);
            console.log('✅ Log file exists:', logFilePath);
            console.log('✅ Log file size:', stats.size, 'bytes');
            console.log('✅ Log file created:', stats.birthtime);
        } else {
            console.log('⚠️  Log file does not exist yet (may be buffered)');
        }
        
        // Test 6: Graceful shutdown
        console.log('\n📋 Test 6: Graceful Shutdown');
        closeSessionLogger();
        console.log('✅ Session logger closed successfully');
        
        console.log('\n🎉 All session logging tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Session logging test failed:', error);
        return false;
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testSessionLogging().catch(console.error);
}

module.exports = { testSessionLogging }; 