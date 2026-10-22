const fs = require('fs');
let code = fs.readFileSync('components/tabs/ImageScraperTab.tsx', 'utf8');

code = code.replace(
  "const resultsArray = Object.keys(scrapingResults).map(url => ({ url, ...scrapingResults[url] })).sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0)); // Newest batch first, but within batch order is kept... wait, reverse means largest index at top.",
  "const resultsArray = Object.keys(scrapingResults).map(url => ({ url, ...scrapingResults[url] })).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)); // Oldest at top (matches input order)"
);

fs.writeFileSync('components/tabs/ImageScraperTab.tsx', code);
