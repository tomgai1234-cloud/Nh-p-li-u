const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

(async () => {
    // Read the HTML we grabbed via proxy earlier
    const htmlText = fs.readFileSync('proxy_test_5.html', 'utf8');
    
    const result = { main: [] };
    const mainImages = new Set();

    // 1. Try Scene7 images
    const scene7Regex = /https:\/\/image\.panasonic\.com\/is\/image\/Panasonic\/[^?"&]+/g;
    let scene7Match;
    while ((scene7Match = scene7Regex.exec(htmlText)) !== null) {
        const baseUrl = scene7Match[0];
        if (!baseUrl.includes('_gallery_') && !baseUrl.includes('placeholder')) {
            mainImages.add(baseUrl + '?scl=1&fmt=png-alpha');
        }
    }

    // 2. Try Magento fotorama gallery data
    const regex = /["']full["']\s*:\s*["']([^"']+)["']/g;
    let match;
    while ((match = regex.exec(htmlText)) !== null) {
        let imgUrl = match[1].replace(/\\/g, ''); 
        if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
        else if (imgUrl.startsWith('/')) imgUrl = 'https://www.panasonic.com' + imgUrl;
        mainImages.add(imgUrl);
    }
    
    result.main = Array.from(mainImages).filter(u => !u.includes('placeholder'));
    console.log("Images found:", result.main);
})();
