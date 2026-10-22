const axios = require('axios');

async function test() {
    const url = 'https://www.panasonic.com/vn/consumer/home-appliances/fridge/2-door-bottom-freezer/nr-bx421xgkv.html';
    // Let's test calling our local backend proxy API or google translate proxy
    const proxyUrls = [
        'http://localhost:3000/api/proxy?url=' + encodeURIComponent(url),
        'https://translate.google.com/translate?sl=en&tl=vi&u=' + encodeURIComponent(url)
    ];

    for (const pUrl of proxyUrls) {
        console.log("Testing proxy:", pUrl.substring(0, 60) + "...");
        try {
            const res = await axios.get(pUrl, { timeout: 15000 });
            console.log("-> Success! Status:", res.status, "HTML length:", res.data.length);
            if (res.data.includes('NR-BX421XGKV')) {
                console.log("-> HTML contains product ID!");
            } else {
                console.log("-> HTML does NOT contain product ID.");
            }
        } catch (e) {
            console.log("-> Failed:", e.message);
        }
    }
}

test();
