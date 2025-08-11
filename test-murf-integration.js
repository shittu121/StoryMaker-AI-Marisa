const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function testMurfIntegration() {
    console.log('Testing Murf.ai integration...');
    
    // Check if API key is configured
    if (!process.env.MURF_API_KEY) {
        console.error('❌ MURF_API_KEY not found in environment variables');
        console.log('Please add MURF_API_KEY to your .env file');
        return;
    }
    
    console.log('✅ MURF_API_KEY found in environment');
    
    // Test API call
    try {
        const response = await fetch('https://api.murf.ai/v1/speech/generate', {
            method: 'POST',
            headers: {
                'api-key': process.env.MURF_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: 'Hello, this is a test of the Murf.ai integration.',
                voiceId: 'en-US-natalie'
            })
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Murf.ai API call successful');
            console.log('Response keys:', Object.keys(data));
            
            if (data.audioFile) {
                console.log('✅ Audio file URL received:', data.audioFile);
            } else if (data.encodedAudio) {
                console.log('✅ Encoded audio received (length:', data.encodedAudio.length, 'characters)');
            } else {
                console.log('⚠️  No audio data in response');
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Murf.ai API call failed:', response.status);
            console.error('Error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Error testing Murf.ai integration:', error.message);
    }
}

testMurfIntegration();
