const axios = require('axios');

const testUrls = [
    'https://corsproxy.io/?' + encodeURIComponent('https://image.panasonic.com/is/image/Panasonic/NR-BX421XGKV_1?scl=1&fmt=png-alpha'),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://image.panasonic.com/is/image/Panasonic/NR-BX421XGKV_1?scl=1&fmt=png-alpha'),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://image.panasonic.com/is/image/Panasonic/NR-BX421XGKV_1?scl=1&fmt=png-alpha'),
    'https://thingproxy.freeboard.io/fetch/' + 'https://image.panasonic.com/is/image/Panasonic/NR-BX421XGKV_1?scl=1&fmt=png-alpha'
];

async function test() {
    for (const url of testUrls) {
        console.log("Testing:", url.substring(0, 60) + "...");
        try {
            const res = await axios.get(url, { timeout: 10000 });
            console.log("-> Success! Status:", res.status, "Length:", res.data.length);
            return;
        } catch (e) {
            console.log("-> Failed:", e.message);
        }
    }
}

test();
