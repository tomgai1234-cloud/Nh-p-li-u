const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeSamsungComplete(startUrl) {
  console.log('Scraping URL:', startUrl);
  const res = await axios.get(startUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    timeout: 15000
  });

  const html = res.data;
  const $ = cheerio.load(html);

  // 1. Title
  let title = $('h1.pdd-header__title, .pdd-header-title, h1').first().text().trim()
           || $('meta[property="og:title"]').attr('content')
           || 'Samsung Product';
  title = title.replace(/\s+/g, ' ').trim();

  // Clean title from " | Samsung Việt Nam" or "| Buy"
  title = title.split('|')[0].trim();

  // 2. Price
  let price = $('.pdd-header__price .price, .pd-buying-price__price, [data-modelprice]').first().text().trim()
           || $('meta[property="product:price:amount"]').attr('content')
           || '';
  price = price.replace(/[^0-9]/g, '');

  // Helper to extract gallery images from Cheerio DOM
  const extractGalleryImgs = (doc, targetModelCode) => {
    const list = [];
    const lowerCode = (targetModelCode || '').toLowerCase();
    const cleanCode = lowerCode.replace(/[^a-z0-9]/g, '');

    doc('.pdd-header-gallery img, .pdp-header__gallery-area img, [class*="gallery"] img').each((_, el) => {
      const src = doc(el).attr('data-desktop-src') || doc(el).attr('srcset') || doc(el).attr('src') || doc(el).attr('data-src');
      if (!src) return;

      const fullUrl = src.split('?')[0].replace(/^\/\//, 'https://');
      const lower = fullUrl.toLowerCase();
      const lowerNoHyphen = lower.replace(/[^a-z0-9]/g, '');

      // STRICT FILTER: Must be a Samsung P6PIM gallery image
      if (lower.includes('/p6pim/') && lower.includes('/gallery/')) {
        // If targetModelCode is provided, check that it matches
        if (!lowerCode || lower.includes(lowerCode) || lowerNoHyphen.includes(cleanCode)) {
          // Add high-res Scene7 modifier
          const highRes = `${fullUrl}?$1440_1152_PNG$`;
          if (!list.includes(highRes)) list.push(highRes);
        }
      }
    });

    // Fallback: regex search in HTML if DOM selector found few images
    if (list.length === 0) {
      const regex = new RegExp(`(?:https?:)?//images\\.samsung\\.com/is/image/samsung/p6pim/[^?"\'&\\s<>]+/gallery/[^?"\'&\\s<>]+`, 'gi');
      let m;
      const rawHtml = doc.html();
      while ((m = regex.exec(rawHtml)) !== null) {
        const fullUrl = m[0].split('?')[0].replace(/^\/\//, 'https://');
        const lower = fullUrl.toLowerCase();
        if (!lowerCode || lower.includes(lowerCode) || lower.includes(lowerCode.substring(0, 8))) {
          const highRes = `${fullUrl}?$1440_1152_PNG$`;
          if (!list.includes(highRes)) list.push(highRes);
        }
      }
    }

    return list;
  };

  // 3. Color variants
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

  console.log(`Discovered ${colorOptions.length} color variants:`, colorOptions.map(c => `${c.name} (${c.modelCode})`));

  // Find active variant on current page
  const activeColor = colorOptions.find(c => c.isChecked) || colorOptions[0] || {
    name: 'Mặc định',
    modelCode: '',
    colorSlug: ''
  };

  const primaryImgs = extractGalleryImgs($, activeColor.modelCode);
  console.log(`Primary variant [${activeColor.name}] has ${primaryImgs.length} images.`);

  const variantGroups = [];
  const variantHeroImages = [];
  const variantNames = {};

  if (primaryImgs.length > 0) {
    const hero = primaryImgs[0];
    variantGroups.push({
      name: activeColor.name,
      image: hero,
      images: primaryImgs
    });
    variantHeroImages.push(hero);
    variantNames[hero] = activeColor.name;
  }

  // Fetch remaining variants
  const remainingVariants = colorOptions.filter(c => c.modelCode.toUpperCase() !== activeColor.modelCode.toUpperCase());

  for (const variant of remainingVariants) {
    try {
      // Derive variant URL by replacing colorSlug and modelCode
      let varUrl = startUrl;
      if (activeColor.colorSlug && variant.colorSlug) {
        varUrl = varUrl.replace(new RegExp(activeColor.colorSlug, 'i'), variant.colorSlug);
      }
      if (activeColor.modelCode && variant.modelCode) {
        varUrl = varUrl.replace(new RegExp(activeColor.modelCode, 'i'), variant.modelCode.toLowerCase());
      }

      console.log(`Fetching variant [${variant.name}] from:`, varUrl);
      const varRes = await axios.get(varUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });

      const var$ = cheerio.load(varRes.data);
      const varImgs = extractGalleryImgs(var$, variant.modelCode);
      console.log(`Variant [${variant.name}] found ${varImgs.length} images.`);

      if (varImgs.length > 0) {
        const hero = varImgs[0];
        variantGroups.push({
          name: variant.name,
          image: hero,
          images: varImgs
        });
        variantHeroImages.push(hero);
        variantNames[hero] = variant.name;
      }
    } catch (err) {
      console.error(`Error fetching variant ${variant.name}:`, err.message);
    }
  }

  console.log('\n=== FINAL SUMMARY ===');
  console.log('Title:', title);
  console.log('Total Variant Groups:', variantGroups.length);
  variantGroups.forEach(g => {
    console.log(`- Nhóm [${g.name}]: ${g.images.length} ảnh. Hero: ${g.image}`);
  });
}

scrapeSamsungComplete('https://www.samsung.com/vn/business/smartphones/galaxy-a/galaxy-a18-light-blue-128gb-sm-a185glbkxxv/buy/');
