const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target2 = `    try {
        const puppeteer = (await import('puppeteer')).default;
        
        let browser;
        try {
            browser = await puppeteer.launch({ 
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,1080'],
                headless: true
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 1080 });`;

const replacement2 = `    try {
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
            await page.setViewport({ width: 1280, height: 1080 });`;

code = code.replace(target2, replacement2);
fs.writeFileSync('server.ts', code);
