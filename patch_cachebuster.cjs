const fs = require('fs');
let code = fs.readFileSync('utils/ecommerceScraper.ts', 'utf8');
code = code.replace(/const cacheBuster = url\\.includes\\('\\?'\\) \\? \\\`&_=\\$\\{Date\\.now\\(\\)\\}\\\` : \\\`\\?_=\\$\\{Date\\.now\\(\\)\\}\\\`;/g, 
"const cacheBuster = '&_=' + Date.now();");
fs.writeFileSync('utils/ecommerceScraper.ts', code);
