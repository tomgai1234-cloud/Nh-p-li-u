const fs = require('fs');

async function test() {
  const puppeteer = (await import('puppeteer-extra')).default;
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
  puppeteer.use(StealthPlugin());
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  
  const url = 'https://www.titleist.com/product/studio-style-catalina/753C%3ACP-H753.html';
  console.log('Navigating to:', url);
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  const title = await page.title();
  console.log('Page Title:', title);

  const images = await page.evaluate(() => {
    const allImgTags = Array.from(document.querySelectorAll('img, picture source, [style*="background-image"], .m-photo-gallery img, .slider-for img'));
    const results = [];
    
    // Check all img elements
    document.querySelectorAll('img').forEach(img => {
      results.push({
        tag: 'img',
        src: img.src,
        dataSrc: img.getAttribute('data-src'),
        srcset: img.srcset,
        className: img.className,
        parentClass: img.parentElement ? img.parentElement.className : ''
      });
    });

    // Check picture source
    document.querySelectorAll('picture source').forEach(s => {
      results.push({
        tag: 'source',
        srcset: s.srcset,
        dataSrcset: s.getAttribute('data-srcset'),
        parentClass: s.parentElement ? s.parentElement.className : ''
      });
    });

    // Check any gallery container
    const galleries = document.querySelectorAll('.slider-for, .has-slideshow, .m-photo-gallery, [class*="gallery"], [class*="product-image"], [class*="slider"], [class*="media"]');
    const galleryHtmls = Array.from(galleries).map(g => ({ class: g.className, id: g.id, outerHTML: g.outerHTML.slice(0, 500) }));

    return { title: document.title, results, galleries: galleryHtmls };
  });

  console.log('Found images count:', images.results.length);
  const fs = require('fs');
  fs.writeFileSync('titleist_extracted.json', JSON.stringify(images, null, 2));

  // Output all unique URLs containing scene7 or product images
  const allUrls = [];
  images.results.forEach(r => {
    if (r.src) allUrls.push(r.src);
    if (r.dataSrc) allUrls.push(r.dataSrc);
    if (r.srcset) allUrls.push(r.srcset.split(',')[0].split(' ')[0]);
    if (r.dataSrcset) allUrls.push(r.dataSrcset.split(',')[0].split(' ')[0]);
  });
  console.log('Unique raw image URLs:', [...new Set(allUrls)]);

  await browser.close();
}

test().catch(e => console.error(e));
