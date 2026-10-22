const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `            // Clean up unwanted elements before extracting
            await page.evaluate(() => {
                // Remove Panasonic's Size and Weight section
                const h2s = Array.from(document.querySelectorAll('h2, h3'));`;

const replacement = `            // Clean up unwanted elements before extracting
            await page.evaluate(() => {
                const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, span, p, strong, b'));
                for (const h of headings) {
                    const text = h.textContent?.trim().toLowerCase() || '';
                    if (text === 'tư vấn mua hàng' || text.includes('cần hỗ trợ mua hàng')) {
                        const section = h.closest('section') || h.closest('div[id="utility"]');
                        if (section) {
                            let current = section;
                            while (current) {
                                const next = current.nextElementSibling;
                                current.remove();
                                current = next;
                            }
                        }
                    }
                }

                const extraSelectors = ['#utility', '#wheretobuy', '#categorylinks', '#support'];
                extraSelectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => el.remove());
                });

                // Remove Panasonic's Size and Weight section
                const h2s = Array.from(document.querySelectorAll('h2, h3'));`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
