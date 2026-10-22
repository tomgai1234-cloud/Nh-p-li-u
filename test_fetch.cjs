const axios = require('axios');
axios.post('http://localhost:3000/api/scrape', { url: 'https://www.panasonic.com/vn/consumer/home-appliances/fridge/2-door-bottom-freezer/nr-bx421xgkv.html' })
  .then(res => console.log("SUCCESS:", JSON.stringify(res.data, null, 2)))
  .catch(err => console.error("ERROR:", err.response ? err.response.data : err.message));
