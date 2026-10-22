const axios = require('axios');

async function test() {
    const url = 'http://localhost:3000/api/proxy?url=' + encodeURIComponent('https://www.panasonic.com/vn/consumer/home-appliances/fridge/2-door-bottom-freezer/nr-bx421xgkv.html');
    try {
        const res = await axios.get(url);
        const htmlText = res.data;
        
        // Find all img tags and extract src, data-src, etc.
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        let match;
        const srcs = new Set();
        while ((match = imgRegex.exec(htmlText)) !== null) {
            srcs.add(match[1]);
        }
        
        const dataSrcs = new Set();
        const dataSrcRegex = /<img[^>]+data-src=["']([^"']+)["']/gi;
        while ((match = dataSrcRegex.exec(htmlText)) !== null) {
            dataSrcs.add(match[1]);
        }

        console.log("Total unique src attributes:", srcs.size);
        console.log("Samples:");
        console.log(Array.from(srcs).slice(0, 15));

        console.log("\nTotal unique data-src attributes:", dataSrcs.size);
        console.log("Samples:");
        console.log(Array.from(dataSrcs).slice(0, 15));

        // Search for any other image-looking URLs
        const allImgUrls = htmlText.match(/https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp|gif)/gi) || [];
        const uniqueAll = Array.from(new Set(allImgUrls));
        console.log("\nTotal unique absolute image URLs in the entire HTML:", uniqueAll.length);
        console.log("Samples of non-panasonic or other domains:");
        console.log(uniqueAll.filter(u => !u.includes('panasonic.com')).slice(0, 10));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
