const axios = require('axios');

async function test() {
    const url = 'https://www.panasonic.com/content/dam/pim/vn/vi/NR/NR-BX4/NR-BX421XGKV/ast-1701837.jpg';
    console.log("Testing direct download of content dam image:", url);
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            responseType: 'arraybuffer',
            timeout: 10000
        });
        console.log("-> Success! Status:", res.status, "Length:", res.data.length);
    } catch (e) {
        console.log("-> Failed:", e.message);
    }
}

test();
