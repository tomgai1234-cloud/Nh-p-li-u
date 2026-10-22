const fs = require('fs');
let code = fs.readFileSync('components/tabs/ImageScraperTab.tsx', 'utf8');

// 1. Update type
code = code.replace(
  "source: 'api' | 'ai';\n};",
  "source: 'api' | 'ai';\n    orderIndex?: number;\n};"
);

// 2. Update handleSubmit initialization
code = code.replace(
  "const newResults: Record<string, ScrapingResult> = { ...scrapingResults };\n        urlsToProcess.forEach(url => {",
  `const newResults: Record<string, ScrapingResult> = { ...scrapingResults };
        let maxOrderIndex = 0;
        Object.values(newResults).forEach(r => {
            if (r.orderIndex && r.orderIndex > maxOrderIndex) {
                maxOrderIndex = Math.ceil(r.orderIndex);
            }
        });
        
        urlsToProcess.forEach(url => {`
);

code = code.replace(
  "newResults[url] = { \n                    data: { title: url, main: [], variants: [], description: [], videos: [] }, \n                    status: 'loading', \n                    source: 'ai' \n                };",
  `maxOrderIndex += 1;
                newResults[url] = { 
                    data: { title: url, main: [], variants: [], description: [], videos: [] }, 
                    status: 'loading', 
                    source: 'ai',
                    orderIndex: maxOrderIndex
                };`
);

// 3. Update the Array.isArray(data) branch
code = code.replace(
  "const results = data as ScrapedProductData[];\n                    setScrapingResults(prev => {\n                        const updated = { ...prev };",
  `const results = data as ScrapedProductData[];
                    setScrapingResults(prev => {
                        const updated = { ...prev };
                        const originalOrderIndex = updated[url]?.orderIndex || Date.now();`
);

code = code.replace(
  "updated[uniqueUrl] = {\n                                data: d,\n                                status: 'success',\n                                source: source\n                            };",
  `updated[uniqueUrl] = {
                                data: d,
                                status: 'success',
                                source: source,
                                orderIndex: originalOrderIndex + (index * 0.001)
                            };`
);

// 4. Update the non-array success branch
code = code.replace(
  "setScrapingResults(prev => ({\n                        ...prev,\n                        [url]: {\n                            data: result,\n                            status: 'success',\n                            source: source\n                        }\n                    }));",
  `setScrapingResults(prev => ({\n                        ...prev,\n                        [url]: {\n                            data: result,\n                            status: 'success',\n                            source: source,\n                            orderIndex: prev[url]?.orderIndex\n                        }\n                    }));`
);

// 5. Update the error branch
code = code.replace(
  "setScrapingResults(prev => ({\n                    ...prev,\n                    [url]: {\n                        data: { title: url, main: [], variants: [], description: [], videos: [] },\n                        status: 'error',\n                        error: err instanceof Error ? err.message : 'Lỗi không xác định.',\n                        source: 'ai'\n                    }\n                }));",
  `setScrapingResults(prev => ({\n                    ...prev,\n                    [url]: {\n                        data: { title: url, main: [], variants: [], description: [], videos: [] },\n                        status: 'error',\n                        error: err instanceof Error ? err.message : 'Lỗi không xác định.',\n                        source: 'ai',\n                        orderIndex: prev[url]?.orderIndex\n                    }\n                }));`
);

fs.writeFileSync('components/tabs/ImageScraperTab.tsx', code);
