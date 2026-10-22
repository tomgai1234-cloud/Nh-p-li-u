const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('/tmp/samsung.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== ALL IMAGES IN HTML ===');
const allImgs = [];
$('img').each((i, el) => {
  const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-desktop-src') || $(el).attr('data-mobile-src');
  const alt = $(el).attr('alt') || '';
  const cls = $(el).attr('class') || '';
  if (src) {
    allImgs.push({ src, alt, cls });
  }
});

console.log('Total img tags:', allImgs.length);
allImgs.forEach((img, i) => {
  console.log(`[${i}] ${img.src} | Alt: ${img.alt} | Class: ${img.cls}`);
});

console.log('\n=== SCENE7 / GALLERY REGEX IN FULL HTML ===');
const scene7Regex = /https?:\/\/images\.samsung\.com\/is\/image\/samsung\/[^"'\s<>]+/gi;
const s7Matches = Array.from(new Set(html.match(scene7Regex) || []));
console.log('Total Scene7 URLs:', s7Matches.length);
s7Matches.forEach((u, i) => {
  console.log(`S7 [${i}]:`, u);
});
