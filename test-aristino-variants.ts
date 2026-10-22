import axios from "axios";

async function test() {
    try {
        const url = "https://aristino.com/products/quan-lot-nam-briefs-aristino-abf069";
        const res = await axios.get("http://localhost:3000/api/proxy?url=" + encodeURIComponent(url));
        const html = res.data;
        
        const scriptMatch = html.match(/product = (\{"available"[\s\S]*?\});/);
        if (scriptMatch) {
            console.log("Found product object");
            const prod = JSON.parse(scriptMatch[1]);
            console.log("Options:", prod.options);
            console.log("Variants count:", prod.variants?.length);
            if (prod.variants && prod.variants.length > 0) {
                 console.log(prod.variants.slice(0, 3).map((v: any) => v.option1 + " " + v.option2 + " => " + (v.featured_image ? v.featured_image.src : 'null')));
            }
        } else {
             console.log("No product object found");
        }
    } catch (e: any) {
        console.error(e.message);
    }
}
test();
