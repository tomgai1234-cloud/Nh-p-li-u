const axios = require('axios');
const fs = require('fs');

async function main() {
  try {
    const url = "https://www.titleist.com/product/studio-style-catalina/753C%3ACP-H753.html";
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      }
    });
    console.log('Status:', res.status, 'HTML length:', res.data.length);
    fs.writeFileSync('titleist_sample.html', res.data);
    
    const html = res.data;
    // Look for all image matches
    const scene7Regex = /https?:\/\/[a-zA-Z0-9.\-_/:]*scene7[a-zA-Z0-9.\-_/:]*/gi;
    const scene7Matches = [...new Set(html.match(scene7Regex) || [])];
    console.log('Scene7 URLs:', scene7Matches);

    const allImgRegex = /https?:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"'\s<>]*)?/gi;
    const allImgs = [...new Set(html.match(allImgRegex) || [])];
    console.log('All image URLs count:', allImgs.length);
    console.log('Sample image URLs:', allImgs.slice(0, 20));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

main();
