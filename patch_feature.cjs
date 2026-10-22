const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `                const extraSelectors = ['#utility', '#wheretobuy', '#categorylinks', '#support'];
                extraSelectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => el.remove());
                });`;

const replacement = `                const extraSelectors = ['#overview', '#utility', '#wheretobuy', '#categorylinks', '#support'];
                extraSelectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => el.remove());
                });

                // Remove everything before the "Feature" section if it exists
                const featureSection = document.getElementById('feature') || document.querySelector('section[id="feature"]');
                if (featureSection) {
                    let prev = featureSection.previousElementSibling;
                    while (prev) {
                        const temp = prev.previousElementSibling;
                        prev.remove();
                        prev = temp;
                    }
                } else {
                    // Try to find a heading containing "Tính năng" and remove its preceding siblings
                    const allH2 = Array.from(document.querySelectorAll('h2, h1, h3'));
                    const featureH2 = allH2.find(h => h.textContent?.trim().toLowerCase() === 'tính năng' || h.textContent?.trim().toLowerCase() === 'features');
                    if (featureH2) {
                        const container = featureH2.closest('section') || featureH2.closest('div[data-scroll]');
                        if (container) {
                            let prev = container.previousElementSibling;
                            while (prev) {
                                const temp = prev.previousElementSibling;
                                prev.remove();
                                prev = temp;
                            }
                        }
                    }
                }`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
