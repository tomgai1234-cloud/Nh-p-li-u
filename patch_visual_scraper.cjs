const fs = require('fs');
let code = fs.readFileSync('utils/ecommerceScraper.ts', 'utf8');

const target = `                        imgs.forEach(img => {
                            let src = img.getAttribute('src') || img.getAttribute('data-src');
                            if (src) {
                                if (src.startsWith('//')) src = 'https:' + src;
                                else if (src.startsWith('/')) src = new URL(url).origin + src;
                                mainImages.push(src);
                            }
                        });`;

const replacement = `                        imgs.forEach(img => {
                            let src = img.getAttribute('src') || img.getAttribute('data-src');
                            if (src) {
                                if (src.startsWith('//')) src = 'https:' + src;
                                else if (src.startsWith('/')) src = new URL(url).origin + src;
                                
                                // Clean up Panasonic scene7 thumbnail modifiers
                                if (src.includes('image.panasonic.com/is/image')) {
                                    src = src.split('?')[0] + '?scl=1&fmt=png-alpha';
                                }
                                
                                mainImages.push(src);
                            }
                        });`;

code = code.replace(target, replacement);
fs.writeFileSync('utils/ecommerceScraper.ts', code);
