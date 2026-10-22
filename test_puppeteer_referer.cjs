const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function test() {
    const url = 'https://image.panasonic.com/is/image/Panasonic/NR-BX421XGKV_1?scl=1&fmt=png-alpha';
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true
    });
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Referer': 'https://www.panasonic.com/',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        });
        console.log("Navigating to image...");
        const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log("Status:", response.status());
        const buffer = await response.buffer();
        console.log("Buffer length:", buffer.length);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}

test();
