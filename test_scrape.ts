import { fetchWithFallback } from './utils/ecommerceScraper.ts';
(async () => {
    const url = 'https://www.panasonic.com/vn/consumer/home-appliances/fridge/2-door-bottom-freezer/nr-bx421xgkv.html';
    const htmlText = await fetchWithFallback(url, 'text');
    console.log("HTML length:", htmlText ? htmlText.length : "null");
})();
