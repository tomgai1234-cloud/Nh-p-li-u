const axios = require('axios');
const fs = require('fs');

async function test() {
  const url = 'https://resources.samsung.com/etc.clientlibs/samsung/clientlibs/business/global/clientlib-templates/bu-page-buying-pd-shop.min.022ac3810434e7403de5d230023e5ca6.js';
  const res = await axios.get(url);
  const text = res.data;
  console.log('JS Length:', text.length);

  // Look for gallery or ajax call
  const regexes = [
    /gallery/gi,
    /modelcode/gi,
    /\.json/gi,
    /p6pim/gi,
    /\/data\//gi,
    /\/api\//gi
  ];
  regexes.forEach(r => {
    const m = text.match(r);
    console.log(r, 'count:', m ? m.length : 0);
  });

  // Extract strings containing .json or /gallery
  const jsonUrls = text.match(/["'][^"']*\.json[^"']*["']/gi) || [];
  console.log('JSON URLs:', jsonUrls.slice(0, 10));

  // Search where modelCode is used in AJAX
  const ajaxChunks = [];
  let idx = 0;
  while ((idx = text.indexOf('modelCode', idx)) !== -1) {
    ajaxChunks.push(text.substring(Math.max(0, idx - 100), Math.min(text.length, idx + 150)));
    idx += 9;
    if (ajaxChunks.length >= 10) break;
  }
  console.log('=== modelCode occurrences in JS ===');
  ajaxChunks.forEach((c, i) => console.log(`[${i}]:`, c.replace(/\n/g, ' ')));
}
test();
