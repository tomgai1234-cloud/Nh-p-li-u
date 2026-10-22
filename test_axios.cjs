const axios = require('axios');

const fileId = '1uCNYOfgopm-ogL7sGvLh4JDIFrKURfvl';
const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w2500`;

axios.get(url, { responseType: 'arraybuffer' }).then(res => {
    console.log('Axios fetch success! Status:', res.status, 'Type:', res.headers['content-type'], 'Buffer bytes:', res.data.length);
}).catch(e => {
    console.error('Axios error:', e.message);
});
