import axios from "axios";
import * as cheerio from "cheerio";

async function test() {
    try {
        const url = "https://aristino.com/products/quan-lot-nam-briefs-aristino-abf069";
        const res = await axios.get("http://localhost:3000/api/proxy?url=" + encodeURIComponent(url));
        const html = res.data;
        
        const $ = cheerio.load(html);
        const swatches = $('.swatch-element img, .swatch img, .color-swatch img, label.variant-swatch img, [data-value] img');
        
        swatches.each((i, el) => {
            console.log("Swatch", i, "src:", $(el).attr('src'), "alt:", $(el).attr('alt'), "title:", $(el).attr('title'));
        });
        
    } catch (e: any) {
        console.error(e.message);
    }
}
test();
