import { specializedScrape } from './utils/ecommerceScraper';

async function run() {
    console.log("Starting test...");
    const url = "https://ash.vn/products/4a7h67-000-4a7h67";
    const data = await specializedScrape(url);
    console.log(JSON.stringify(data, null, 2));
}
run();
