const axios = require('axios');
const fs = require('fs');
(async () => {
    const html = fs.readFileSync('proxy_test_3.html', 'utf8');
    
    // Simulate scrapePanasonic
    const result = { main: [] };
    const mainImages = new Set();
    const scene7Regex = /https:\/\/image\.panasonic\.com\/is\/image\/Panasonic\/[^?"&']+/g;
    let scene7Match;
    while ((scene7Match = scene7Regex.exec(html)) !== null) {
        const baseUrl = scene7Match[0];
        // Exclude gallery JSON definitions and thumbnails
        if (!baseUrl.includes('_gallery_') && !baseUrl.includes('placeholder')) {
            // Add standard modifiers for full size
            mainImages.add(baseUrl + '?scl=1&fmt=png-alpha');
        }
    }
    
    const regex = /["']full["']\s*:\s*["']([^"']+)["']/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        let imgUrl = match[1].replace(/\\/g, ''); // Fix escaped slashes \/ -> /
        if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
        else if (imgUrl.startsWith('/')) imgUrl = 'https://www.panasonic.com' + imgUrl;
        mainImages.add(imgUrl);
    }
    
    result.main = Array.from(mainImages).filter(u => !u.includes('placeholder'));
    console.log(result.main);
})();
