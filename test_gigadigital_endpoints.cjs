const axios = require('axios');

async function searchEndpoints() {
    const url = 'https://gigadigital.vn/static/js/main.7651c374.js';
    const res = await axios.get(url);
    const text = res.data;
    
    const matches = text.match(/["']\/[a-zA-Z0-9_\-\/]+["']/g) || [];
    const filtered = matches.filter(m => m.length > 3 && m.length < 30 && !m.includes('.'));
    console.log('API path matches:', Array.from(new Set(filtered)).slice(0, 100));
}
searchEndpoints();
