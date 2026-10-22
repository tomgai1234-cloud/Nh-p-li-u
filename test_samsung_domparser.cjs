const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeSamsungV2(startUrl) {
    const cleanUrl = startUrl.split('?')[0].replace(/\/$/, '');
    const res = await axios.get(cleanUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 15000
    });
    const htmlText = res.data;
    const $ = cheerio.load(htmlText);

    // 1. Title
    let title = $('h1.pdd-header__title, .pdd-header-title, h1').first().text().trim()
             || $('meta[property="og:title"]').attr('content')
             || 'Samsung Product';
    title = title.replace(/\s+/g, ' ').split('|')[0].split('- Samsung')[0].trim();

    // 2. Price
    let price = $('.pdd-header__price .price, .pd-buying-price__price, [data-modelprice]').first().text().trim()
             || $('meta[property="product:price:amount"]').attr('content')
             || '';
    price = price.replace(/[^0-9]/g, '');

    // Helper: Normalize Scene7
    const normalizeSamsungImg = (rawUrl) => {
        let u = rawUrl.trim().replace(/\\"/g, '').replace(/\\/g, '');
        if (u.startsWith('//')) u = 'https:' + u;
        else if (u.startsWith('/')) u = 'https://www.samsung.com' + u;

        if (u.includes('images.samsung.com/is/image/samsung/')) {
            const base = u.split('?')[0];
            return `${base}?$1440_1152_PNG$`;
        }
        return u;
    };

    // Helper: Extract Gallery Images for a specific modelCode
    const extractGalleryImgs = (doc, targetModelCode) => {
        const list = [];
        const lowerCode = (targetModelCode || '').toLowerCase();
        const cleanCode = lowerCode.replace(/[^a-z0-9]/g, '');

        // 1. Try DOM elements first (.pdd-header-gallery, etc.)
        doc('.pdd-header-gallery img, .pdp-header__gallery-area img, [class*="gallery"] img').each((_, el) => {
            const src = doc(el).attr('data-desktop-src') || doc(el).attr('srcset') || doc(el).attr('src') || doc(el).attr('data-src');
            if (!src) return;

            const fullUrl = src.split('?')[0].replace(/^\/\//, 'https://');
            const lower = fullUrl.toLowerCase();
            const lowerNoHyphen = lower.replace(/[^a-z0-9]/g, '');

            if (lower.includes('/p6pim/') && lower.includes('/gallery/') && !lower.includes('-thumb-')) {
                if (!lowerCode || lower.includes(lowerCode) || lowerNoHyphen.includes(cleanCode)) {
                    const highRes = normalizeSamsungImg(fullUrl);
                    if (!list.includes(highRes)) list.push(highRes);
                }
            }
        });

        // 2. Regex fallback across HTML
        const p6pimRegex = /(?:https?:)?\/\/images\.samsung\.com\/is\/image\/samsung\/p6pim\/[^?"'&\s<>]+\/gallery\/[^?"'&\s<>]+/gi;
        let m;
        const rawHtml = doc.html();
        while ((m = p6pimRegex.exec(rawHtml)) !== null) {
            const raw = m[0];
            const fullUrl = raw.split('?')[0].replace(/^\/\//, 'https://');
            const lower = fullUrl.toLowerCase();
            const lowerNoHyphen = lower.replace(/[^a-z0-9]/g, '');

            if (!lower.includes('-thumb-')) {
                if (!lowerCode || lower.includes(lowerCode) || lowerNoHyphen.includes(cleanCode)) {
                    const highRes = normalizeSamsungImg(fullUrl);
                    if (!list.includes(highRes)) list.push(highRes);
                }
            }
        }

        return list;
    };

    // 3. Color variants extraction
    const colorOptions = [];
    $('#option-color input, .option-color input, [name="pd-color"], input[id*="pd-color"]').each((_, el) => {
        const $el = $(el);
        const modelCode = ($el.attr('data-modelcode') || '').trim();
        if (!modelCode) return;

        const labelText = $el.siblings('label').find('.pd-option-selector__text').text().trim()
                       || $el.siblings('label').text().trim()
                       || '';

        const anLa = $el.attr('an-la') || '';
        let colorSlug = '';
        if (anLa.toLowerCase().includes('color:')) {
            colorSlug = anLa.split(/color:/i)[1].trim().toLowerCase().replace(/\s+/g, '-');
        }

        if (!colorOptions.some(c => c.modelCode.toUpperCase() === modelCode.toUpperCase())) {
            colorOptions.push({
                name: labelText || colorSlug || modelCode,
                modelCode: modelCode.toUpperCase(),
                colorSlug,
                isChecked: $el.is(':checked') || $el.attr('checked') === 'checked'
            });
        }
    });

    const activeColor = colorOptions.find(c => c.isChecked) || colorOptions[0] || {
        name: 'Mặc định',
        modelCode: '',
        colorSlug: ''
    };

    const primaryGallery = extractGalleryImgs($, activeColor.modelCode);

    const variantGroups = [];
    const variantHeroImages = [];
    const variantNames = {};

    if (primaryGallery.length > 0) {
        const hero = primaryGallery[0];
        variantGroups.push({
            name: activeColor.name,
            image: hero,
            images: primaryGallery
        });
        variantHeroImages.push(hero);
        variantNames[hero] = activeColor.name;
    }

    // Fetch remaining variants asynchronously
    const otherColors = colorOptions.filter(c => c.modelCode.toUpperCase() !== activeColor.modelCode.toUpperCase());
    const fetchPromises = otherColors.map(async (variant) => {
        try {
            let varUrl = cleanUrl;
            if (activeColor.colorSlug && variant.colorSlug) {
                varUrl = varUrl.replace(new RegExp(activeColor.colorSlug, 'i'), variant.colorSlug);
            }
            if (activeColor.modelCode && variant.modelCode) {
                varUrl = varUrl.replace(new RegExp(activeColor.modelCode, 'i'), variant.modelCode.toLowerCase());
            }

            const varRes = await axios.get(varUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 8000
            });
            const var$ = cheerio.load(varRes.data);
            const varImgs = extractGalleryImgs(var$, variant.modelCode);

            if (varImgs.length > 0) {
                const hero = varImgs[0];
                return {
                    name: variant.name,
                    image: hero,
                    images: varImgs
                };
            }
        } catch (e) {
            console.warn(`Failed to fetch variant ${variant.name}:`, e.message);
        }
        return null;
    });

    const fetchResults = await Promise.allSettled(fetchPromises);
    fetchResults.forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
            const grp = res.value;
            variantGroups.push(grp);
            variantHeroImages.push(grp.image);
            variantNames[grp.image] = grp.name;
        }
    });

    return {
        title,
        price,
        color: activeColor.name,
        main: primaryGallery,
        variants: variantHeroImages,
        variantNames,
        variantGroups,
        description: [],
        videos: []
    };
}

(async () => {
    const res = await scrapeSamsungV2('https://www.samsung.com/vn/business/smartphones/galaxy-a/galaxy-a18-light-blue-128gb-sm-a185glbkxxv/buy/');
    console.log('Result title:', res.title);
    console.log('Main images count:', res.main.length);
    console.log('Variants count:', res.variants.length);
    console.log('Variant groups count:', res.variantGroups.length);
    res.variantGroups.forEach(g => {
        console.log(`- [${g.name}]: ${g.images.length} images. First: ${g.image.substring(0, 80)}...`);
    });
})();
