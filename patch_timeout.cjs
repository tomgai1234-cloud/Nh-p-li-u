const fs = require('fs');
let code = fs.readFileSync('utils/ecommerceScraper.ts', 'utf8');
code = code.replace("setTimeout(() => controller.abort(), 10000); // 10s timeout", "setTimeout(() => controller.abort(), 40000); // 40s timeout");
fs.writeFileSync('utils/ecommerceScraper.ts', code);
