const fs = require('fs');
let code = fs.readFileSync('utils/ecommerceScraper.ts', 'utf8');
code = code.replace(/else if \\(lowerUrl\\.includes\\('store\\.apac\\.panasonic\\.com'\\)\\) {/g, "else if (lowerUrl.includes('panasonic.com')) {");
fs.writeFileSync('utils/ecommerceScraper.ts', code);
