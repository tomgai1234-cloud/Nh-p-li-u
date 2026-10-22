const fs = require('fs');
let code = fs.readFileSync('utils/ecommerceScraper.ts', 'utf8');

const target = `                        mainImages = Array.from(imgTags).map(img => {
                            let src = img.getAttribute('data-src') || img.getAttribute('src');
                            if (src && src.startsWith('//')) src = 'https:' + src;
                            return src;
                        }).filter(Boolean) as string[];`;

const replacement = `                        mainImages = Array.from(imgTags).map(img => {
                            let src = img.getAttribute('data-src') || img.getAttribute('src');
                            if (src) {
                                if (src.startsWith('//')) src = 'https:' + src;
                                else if (src.startsWith('/')) {
                                    try { src = new URL(url).origin + src; } catch (e) {}
                                }
                                
                                // Clean up Panasonic scene7 thumbnail modifiers
                                if (src.includes('image.panasonic.com/is/image')) {
                                    src = src.split('?')[0] + '?scl=1&fmt=png-alpha';
                                }
                            }
                            return src;
                        }).filter(Boolean) as string[];`;

code = code.replace(target, replacement);
fs.writeFileSync('utils/ecommerceScraper.ts', code);
