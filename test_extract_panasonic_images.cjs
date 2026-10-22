const axios = require('axios');

async function test() {
    const url = 'http://localhost:3000/api/proxy?url=' + encodeURIComponent('https://www.panasonic.com/vn/consumer/home-appliances/fridge/2-door-bottom-freezer/nr-bx421xgkv.html');
    try {
        const res = await axios.get(url);
        const htmlText = res.data;
        console.log("HTML fetched successfully. Length:", htmlText.length);

        const mainImages = new Set();
        const scene7Regex = /https:\/\/image\.panasonic\.com\/is\/image\/Panasonic\/[^?"&]+/g;
        let scene7Match;
        while ((scene7Match = scene7Regex.exec(htmlText)) !== null) {
            const baseUrl = scene7Match[0];
            if (!baseUrl.includes('_gallery_') && !baseUrl.includes('placeholder')) {
                mainImages.add(baseUrl + '?scl=1&fmt=png-alpha');
            }
        }

        console.log("Extracted Scene7 images count:", mainImages.size);
        console.log("Extracted Scene7 images:", Array.from(mainImages));

        // Let's also check fotorama Magento gallery matches
        const magentoImages = new Set();
        const regex = /["']full["']\s*:\s*["']([^"']+)["']/g;
        let match;
        while ((match = regex.exec(htmlText)) !== null) {
            let imgUrl = match[1].replace(/\\/g, '');
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            magentoImages.add(imgUrl);
        }
        console.log("Extracted Magento images count:", magentoImages.size);
        console.log("Extracted Magento images:", Array.from(magentoImages));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
