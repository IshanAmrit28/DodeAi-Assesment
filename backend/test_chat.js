const axios = require('axios');

async function testChat() {
    try {
        const response = await axios.post('http://localhost:3000/chat', {
            message: 'Show me all sales orders'
        });
        console.log('Chat Response Status:', response.status);
        console.log('Chat Response Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Chat Request Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

testChat();
