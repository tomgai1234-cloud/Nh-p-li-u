const https = require('https');

const fileId = '1uCNYOfgopm-ogL7sGvLh4JDIFrKURfvl';
const testUrls = [
    `https://lh3.googleusercontent.com/d/${fileId}=s0`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w2500`,
    `https://drive.google.com/uc?id=${fileId}&export=download`
];

testUrls.forEach(u => {
    https.get(u, res => {
        console.log(u, '-> Status:', res.statusCode, 'Content-Type:', res.headers['content-type'], 'Size:', res.headers['content-length']);
    });
});
