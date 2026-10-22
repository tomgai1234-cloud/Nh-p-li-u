const axios = require('axios');

async function test() {
    const url = 'http://localhost:3000/api/proxy?url=' + encodeURIComponent('https://www.panasonic.com/vn/consumer/home-appliances/fridge/2-door-bottom-freezer/nr-bx421xgkv.html');
    try {
        const res = await axios.get(url);
        const htmlText = res.data;
        
        // Find all occurrences of /content/dam/ containing NR-BX421XGKV or bx421
        const regex = /\/content\/dam\/[^\s"'<>]+?(?:bx421|BX421)[^\s"'<>]*?\.(?:jpg|jpeg|png|webp)/gi;
        const matches = htmlText.match(regex) || [];
        console.log("Matches found in /content/dam/ for BX421:", Array.from(new Set(matches)));
        
        // Find ANY /content/dam/ images in the product-detail or carousel areas
        const allDam = htmlText.match(/\/content\/dam\/Panasonic\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)/gi) || [];
        console.log("Total /content/dam/ images found:", allDam.length);
        console.log("Samples of /content/dam/ images:");
        console.log(Array.from(new Set(allDam)).slice(0, 10));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
