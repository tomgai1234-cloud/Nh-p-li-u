const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `    try {
      if (targetUrl.startsWith('//')) targetUrl = 'https:' + targetUrl;
      let parsedUrl;
      try { parsedUrl = new URL(targetUrl); } catch { return res.status(400).json({ error: "Invalid URL provided" }); } // ensure valid early
      
      const referer = parsedUrl.protocol + '//' + parsedUrl.hostname.replace(/^(cdn|media|static|images)\\./, '') + '/';
      const response = await axios.get(targetUrl, {`;

const replacement = `    try {
      if (targetUrl.startsWith('//')) targetUrl = 'https:' + targetUrl;
      let parsedUrl;
      try { parsedUrl = new URL(targetUrl); } catch { return res.status(400).json({ error: "Invalid URL provided" }); } // ensure valid early
      
      if (targetUrl.includes('panasonic.com')) {
          const puppeteer = (await import('puppeteer-extra')).default;
          const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
          puppeteer.use(StealthPlugin());
          let browser;
          try {
             browser = await puppeteer.launch({ 
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,1080', '--disable-blink-features=AutomationControlled'],
                headless: true
             });
             const page = await browser.newPage();
             await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
             await page.setExtraHTTPHeaders({
                'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
             });
             await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
             await new Promise(r => setTimeout(r, 2000));
             const html = await page.content();
             res.setHeader('Content-Type', 'text/html');
             return res.send(html);
          } catch(e) {
             console.error("Puppeteer proxy error:", e);
             return res.status(500).json({ error: "Error fetching with Puppeteer" });
          } finally {
             if (browser) await browser.close();
          }
      }

      const referer = parsedUrl.protocol + '//' + parsedUrl.hostname.replace(/^(cdn|media|static|images)\\./, '') + '/';
      const response = await axios.get(targetUrl, {`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
