const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('titleist_rendered.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

console.log("Title:", doc.querySelector('title')?.textContent);
console.log("H1:", doc.querySelector('h1')?.textContent?.trim());
console.log("Meta og:image:", doc.querySelector('meta[property="og:image"]')?.getAttribute('content'));

// 1. Primary Product Gallery (.product-image, .zoom-image-wrapper, .primary-image, .pdp-main, etc.)
const primaryImgs = [];
doc.querySelectorAll('.product-image img, .zoom-image-wrapper img, .primary-image, .product-col-1 img, #pdpMain img').forEach(img => {
  const src = img.getAttribute('data-src') || img.getAttribute('src') || img.getAttribute('srcset');
  const srcset = img.getAttribute('srcset');
  primaryImgs.push({
    src,
    srcset,
    dataSrc: img.getAttribute('data-src'),
    parentClass: img.parentElement?.className
  });
});
console.log("Primary images count:", primaryImgs.length);
console.log("Primary images:", primaryImgs);

// 2. All demandware and scene7 images on page
const allImgElements = Array.from(doc.querySelectorAll('img, picture source'));
console.log("Total image elements on page:", allImgElements.length);

const grouped = {
  demandwareClubs: [],
  scene7: [],
  other: []
};

allImgElements.forEach(el => {
  let src = el.getAttribute('srcset') || el.getAttribute('data-srcset') || el.getAttribute('data-src') || el.getAttribute('src');
  if (!src) return;
  if (src.includes('demandware.static')) {
    grouped.demandwareClubs.push({ tag: el.tagName, src: src.slice(0, 150), parent: el.parentElement?.className });
  } else if (src.includes('scene7')) {
    grouped.scene7.push({ tag: el.tagName, src: src.slice(0, 150), parent: el.parentElement?.className });
  }
});

console.log("Demandware images count:", grouped.demandwareClubs.length);
console.log("Demandware images sample:", grouped.demandwareClubs.slice(0, 15));
console.log("Scene7 images count:", grouped.scene7.length);
console.log("Scene7 images sample:", grouped.scene7.slice(0, 15));
