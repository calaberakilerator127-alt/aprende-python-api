const axios = require('axios');

async function testBackend() {
  const baseURL = 'https://aprende-python-api.onrender.com/api';
  console.log('--- Testing Backend Health ---');
  try {
    const health = await axios.get(`${baseURL}/health`);
    console.log('Health:', health.data);
    
    console.log('\n--- Testing CORS Headers (Simulated) ---');
    const options = await axios({
      method: 'OPTIONS',
      url: `${baseURL}/auth/login`,
      headers: {
        'Origin': 'https://aprende-python-theta.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log('CORS Status:', options.status);
    console.log('CORS Headers:', options.headers);
  } catch (err) {
    console.error('Test Failed:', err.message);
    if (err.response) {
      console.error('Response Data:', err.response.data);
      console.error('Response Headers:', err.response.headers);
    }
  }
}

testBackend();
