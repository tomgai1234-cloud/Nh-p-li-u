const axios = require('axios');

async function test() {
    const targetUrl = 'https://image.panasonic.com/is/image/Panasonic/NR-BX421XGKV_1?scl=1&fmt=png-alpha';
    const googleProxyUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(targetUrl)}`;
    
    console.log("Testing Google Image Proxy:", googleProxyUrl);
    try {
        const res = await axios.get(googleProxyUrl, { timeout: 10000 });
        console.log("-> Success! Status:", res.status, "Length:", res.data.length);
    } catch (e) {
        console.error("-> Failed:", e.message);
    }
}

test();
