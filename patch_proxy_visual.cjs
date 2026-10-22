const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000,
        validateStatus: () => true,
        responseType: 'text'
      });
      
      let html = response.data;
      if (typeof html !== 'string') {
          return res.status(500).send("Not HTML content");
      }`;

const replacement = `      let html = '';
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
             // Wait briefly to ensure content loads
             await new Promise(r => setTimeout(r, 2000));
             html = await page.content();
          } catch(e) {
             console.error("Puppeteer proxy visual error:", e);
             return res.status(500).send("Error fetching visual proxy with Puppeteer");
          } finally {
             if (browser) await browser.close();
          }
      } else {
          const response = await axios.get(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 30000,
            validateStatus: () => true,
            responseType: 'text'
          });
          html = response.data;
      }
      
      if (typeof html !== 'string') {
          return res.status(500).send("Not HTML content");
      }`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
