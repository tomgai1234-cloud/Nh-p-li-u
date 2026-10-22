const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('titleist_sample.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

console.log("h1:", doc.querySelector('h1')?.textContent?.trim());
console.log("og:title:", doc.querySelector('meta[property="og:title"]')?.getAttribute('content'));
console.log("product-image count:", doc.querySelectorAll('.product-image, .zoom-image-wrapper, .primary-image').length);

const primaryContainers = Array.from(doc.querySelectorAll(
    '.slider-for, .has-slideshow, .m-photo-gallery, [class*="photo-gallery"], [class*="image-gallery"], .portfolio-wrapper, [id*="image-gallery"]'
));
console.log("primaryContainers matched:", primaryContainers.length);
