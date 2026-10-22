const fs = require('fs');
let code = fs.readFileSync('components/tabs/ImageScraperTab.tsx', 'utf8');

// handleExportExcel
code = code.replace(
  "const resultsArray = Object.keys(scrapingResults)\n            .map(url => ({ url, ...scrapingResults[url] }))\n            .filter(r => r.status === 'success');",
  `const resultsArray = Object.keys(scrapingResults)
            .map(url => ({ url, ...scrapingResults[url] }))
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
            .filter(r => r.status === 'success');`
);

// handleCopyExcelData
code = code.replace(
  "const resultsArray = Object.keys(scrapingResults)\n            .map(url => ({ url, ...scrapingResults[url] }))\n            .filter(r => r.status === 'success');",
  `const resultsArray = Object.keys(scrapingResults)
            .map(url => ({ url, ...scrapingResults[url] }))
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
            .filter(r => r.status === 'success');`
);

// handlePushToSheets
code = code.replace(
  "const resultsArray = Object.keys(scrapingResults)\n            .map(url => ({ url, ...scrapingResults[url] }))\n            .filter(r => r.status === 'success');",
  `const resultsArray = Object.keys(scrapingResults)
            .map(url => ({ url, ...scrapingResults[url] }))
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
            .filter(r => r.status === 'success');`
);

// Main rendering array
code = code.replace(
  "const resultsArray = Object.keys(scrapingResults).map(url => ({ url, ...scrapingResults[url] })).reverse(); // Newest first",
  "const resultsArray = Object.keys(scrapingResults).map(url => ({ url, ...scrapingResults[url] })).sort((a, b) => (b.orderIndex || 0) - (a.orderIndex || 0)); // Newest batch first, but within batch order is kept... wait, reverse means largest index at top."
);

fs.writeFileSync('components/tabs/ImageScraperTab.tsx', code);
