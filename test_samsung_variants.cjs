const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const variants = [
    { name: 'Xanh Mây', code: 'SM-A185GLBKXXV', colorSlug: 'light-blue', url: 'https://www.samsung.com/vn/business/smartphones/galaxy-a/galaxy-a18-light-blue-128gb-sm-a185glbkxxv/buy/' },
    { name: 'Đen Titan', code: 'SM-A185GZKKXXV', colorSlug: 'black', url: 'https://www.samsung.com/vn/business/smartphones/galaxy-a/galaxy-a18-black-128gb-sm-a185gzkkxxv/buy/' },
    { name: 'Xám Bạc', code: 'SM-A185GZSKXXV', colorSlug: 'silver', url: 'https://www.samsung.com/vn/business/smartphones/galaxy-a/galaxy-a18-silver-128gb-sm-a185gzskxxv/buy/' }
  ];

  for (const v of variants) {
    const res = await axios.get(v.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const galleryImgs = [];
    $('.pdd-header-gallery img').each((i, el) => {
      const src = $(el).attr('data-desktop-src') || $(el).attr('srcset') || $(el).attr('src');
      if (src && src.includes('p6pim')) {
        const clean = src.split('?')[0].replace(/^\/\//, 'https://');
        if (!galleryImgs.includes(clean)) galleryImgs.push(clean);
      }
    });
    console.log(`=== Variant: ${v.name} (${v.code}) ===`);
    console.log(`Found ${galleryImgs.length} high-res gallery images:`);
    galleryImgs.forEach((img, idx) => console.log(`  [${idx}] ${img}`));
  }
}

test();
