const fs = require('fs');
let code = fs.readFileSync('utils/ecommerceScraper.ts', 'utf8');

const target = `    try {
        const titleMatch = htmlText.match(/<title>(.*?)<\\/title>/);
        if (titleMatch) result.title = titleMatch[1].trim();

        // Extract full images from Magento fotorama gallery data
        const regex = /["']full["']\\s*:\\s*["']([^"']+)["']/g;
        let match;
        const mainImages = new Set<string>();
        while ((match = regex.exec(htmlText)) !== null) {
            let imgUrl = match[1].replace(/\\\\/g, ''); // Fix escaped slashes \\/ -> /
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            else if (imgUrl.startsWith('/')) imgUrl = new URL(url).origin + imgUrl;
            mainImages.add(imgUrl);
        }
        
        result.main = Array.from(mainImages).filter(u => !u.includes('placeholder'));`;

const replacement = `    try {
        const titleMatch = htmlText.match(/<title>(.*?)<\\/title>/);
        if (titleMatch) result.title = titleMatch[1].trim();

        // Extract images from Scene7 thumbs or Magento fotorama gallery data
        const mainImages = new Set<string>();

        // 1. Try Scene7 images
        const scene7Regex = /https:\\/\\/image\\.panasonic\\.com\\/is\\/image\\/Panasonic\\/[^?"&]+/g;
        let scene7Match;
        while ((scene7Match = scene7Regex.exec(htmlText)) !== null) {
            const baseUrl = scene7Match[0];
            // Exclude gallery JSON definitions and thumbnails
            if (!baseUrl.includes('_gallery_') && !baseUrl.includes('placeholder')) {
                // Add standard modifiers for full size
                mainImages.add(baseUrl + '?scl=1&fmt=png-alpha');
            }
        }

        // 2. Try Magento fotorama gallery data
        const regex = /["']full["']\\s*:\\s*["']([^"']+)["']/g;
        let match;
        while ((match = regex.exec(htmlText)) !== null) {
            let imgUrl = match[1].replace(/\\\\/g, ''); // Fix escaped slashes \\/ -> /
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            else if (imgUrl.startsWith('/')) imgUrl = new URL(url).origin + imgUrl;
            mainImages.add(imgUrl);
        }
        
        result.main = Array.from(mainImages).filter(u => !u.includes('placeholder'));`;

code = code.replace(target, replacement);
fs.writeFileSync('utils/ecommerceScraper.ts', code);
