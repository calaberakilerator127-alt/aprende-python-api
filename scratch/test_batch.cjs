const axios = require('axios');

async function testBatch() {
  const baseURL = 'https://aprende-python-api.onrender.com/api';
  try {
    // Necesitamos un token para probar /data/all
    // Primero nos logueamos con el usuario de prueba que creamos en el subagent
    console.log('--- Logging in ---');
    const login = await axios.post(`${baseURL}/auth/login`, {
      email: 'test_qa_final@test.com',
      password: 'Password123!'
    });
    const token = login.data.token;
    console.log('Token obtained.');

    console.log('\n--- Testing Batch Data Fetch /data/all ---');
    const batch = await axios.get(`${baseURL}/data/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Batch Success! Tables fetched:', Object.keys(batch.data).join(', '));
    if (batch.data.profiles) console.log('Profiles count:', batch.data.profiles.length);
    
  } catch (err) {
    console.error('Test Failed:', err.message);
    if (err.response) {
      console.error('Response Data:', err.response.data);
    }
  }
}

testBatch();
