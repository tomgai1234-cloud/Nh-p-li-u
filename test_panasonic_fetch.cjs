const axios = require('axios');

async function test() {
    const url = 'https://image.panasonic.com/is/image/Panasonic/NR-BX421XGKV_1?scl=1&fmt=png-alpha';
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.panasonic.com/',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        console.log("Status:", response.status);
        console.log("Content-Type:", response.headers['content-type']);
        console.log("Data length:", response.data.length);
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Response headers:", e.response.headers);
        }
    }
}

test();
