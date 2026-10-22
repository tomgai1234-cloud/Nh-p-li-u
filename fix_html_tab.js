const fs = require('fs');

const content = fs.readFileSync('components/tabs/HtmlDescriptionScraperTab.tsx', 'utf8');
console.log(content.length);
