const fs = require('fs');
const html = fs.readFileSync('/tmp/samsung.html', 'utf8');

function extractSamsungVariantsAndImages(htmlText, url) {
    // 1. Color Options
    const colorOptions = [];
    const inputRegex = /<input[^>]+name=["']pd-color["'][^>]*>/gi;
    let inputMatch;
    
    // Find all pd-color inputs
    const inputMatches = [];
    while ((inputMatch = inputRegex.exec(htmlText)) !== null) {
        inputMatches.push({
            tag: inputMatch[0],
            index: inputMatch.index
        });
    }

    inputMatches.forEach(({ tag, index }) => {
        const modelCodeMatch = tag.match(/data-modelcode=["']([^"']+)["']/i);
        if (!modelCodeMatch) return;
        const modelCode = modelCodeMatch[1].trim();

        const anLaMatch = tag.match(/an-la=["']Color:([^"']+)["']/i);
        const colorSlug = anLaMatch ? anLaMatch[1].trim().toLowerCase().replace(/\s+/g, '-') : '';

        // Look ahead in the HTML for the corresponding label / pd-option-selector__text
        const lookAhead = htmlText.substring(index, index + 600);
        const textMatch = lookAhead.match(/class=["'][^"']*pd-option-selector__text[^"']*["'][^>]*>([^<]+)</i);
        const name = (textMatch ? textMatch[1].trim() : '') || colorSlug || modelCode;

        const isChecked = /checked(?:=["']checked["'])?/i.test(tag);

        if (!colorOptions.some(c => c.modelCode.toUpperCase() === modelCode.toUpperCase())) {
            colorOptions.push({
                name,
                modelCode: modelCode.toUpperCase(),
                colorSlug,
                isChecked
            });
        }
    });

    // 2. Helper to extract gallery images for a specific model code
    const extractGalleryForCode = (sourceHtml, code) => {
        const lowerCode = (code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const images = [];

        // Pattern 1: find from pdd-header-gallery container
        const galleryRegex = /class=["'][^"']*pdd-header-gallery[^"']*["'][\s\S]*?(?:<\/section>|<\/div>\s*<\/div>)/i;
        const galContainer = sourceHtml.match(galleryRegex);
        const searchScope = galContainer ? galContainer[0] : sourceHtml;

        const p6pimRegex = /(?:https?:)?\/\/images\.samsung\.com\/is\/image\/samsung\/p6pim\/[^?"'&\s<>]+\/gallery\/[^?"'&\s<>]+/gi;
        let m;
        while ((m = p6pimRegex.exec(searchScope)) !== null) {
            const rawUrl = m[0];
            const clean = rawUrl.split('?')[0].replace(/^\/\//, 'https://');
            const lowerClean = clean.toLowerCase();
            const cleanNoHyphen = lowerClean.replace(/[^a-z0-9]/g, '');

            if (!lowerCode || cleanNoHyphen.includes(lowerCode) || cleanNoHyphen.includes(lowerCode.substring(0, 8))) {
                const highRes = `${clean}?$1440_1152_PNG$`;
                if (!images.includes(highRes)) {
                    images.push(highRes);
                }
            }
        }
        return images;
    };

    return {
        colorOptions,
        extractGalleryForCode
    };
}

const { colorOptions, extractGalleryForCode } = extractSamsungVariantsAndImages(html, 'https://www.samsung.com/vn/business/smartphones/galaxy-a/galaxy-a18-light-blue-128gb-sm-a185glbkxxv/buy/');
console.log('Colors:', colorOptions);
const imgs0 = extractGalleryForCode(html, colorOptions[0].modelCode);
console.log(`Images for ${colorOptions[0].name}:`, imgs0.length);
imgs0.forEach((u, i) => console.log(`  [${i}] ${u}`));
