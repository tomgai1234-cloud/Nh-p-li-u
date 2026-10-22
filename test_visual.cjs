const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
(async () => {
    const html = fs.readFileSync('proxy_test_3.html', 'utf8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    // Simulate what happens in visualSelector
    const visualSelector = '.scene7Thumbs__list'; 
    const targetEl = doc.querySelector(visualSelector);
    if (targetEl) {
        const imgTags = targetEl.querySelectorAll('img');
        const mainImages = Array.from(imgTags).map(img => {
            let src = img.getAttribute('data-src') || img.getAttribute('src');
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                else if (src.startsWith('/')) src = 'https://www.panasonic.com' + src;
                
                if (src.includes('image.panasonic.com/is/image')) {
                    src = src.split('?')[0] + '?scl=1&fmt=png-alpha';
                }
            }
            return src;
        }).filter(Boolean);
        console.log("Visual images:", mainImages);
    } else {
        console.log("Target not found");
    }
})();
