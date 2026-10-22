import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch({ 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.goto('https://example.com');
        console.log('Puppeteer works! Title:', await page.title());
        await browser.close();
    } catch (e) {
        console.error('Puppeteer failed:', e);
    }
})();
