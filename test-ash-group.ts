async function run() {
    const res = await fetch("https://ash.vn/products/4a7h67-000-4a7h67.js");
    const data = await res.json();
    
    console.log("OPTIONS:", JSON.stringify(data.options, null, 2));
    
    // Group variants by color
    let colorOptionIndex = -1;
    if (data.options) {
        const opt = data.options.find((o: any) => o.name.toLowerCase().includes('màu') || o.name.toLowerCase().includes('color') || o.name.toLowerCase().includes('colour') || o.name === 'Màu Sắc');
        if (opt) colorOptionIndex = opt.position;
    }
    console.log("COLOR OPTION INDEX:", colorOptionIndex);
    
    const colorsMap = new Map();
    if (data.variants) {
        for (const variant of data.variants) {
            let color = 'Default';
            if (colorOptionIndex === 1) color = variant.option1;
            else if (colorOptionIndex === 2) color = variant.option2;
            else if (colorOptionIndex === 3) color = variant.option3;
            else if (variant.title) color = variant.title.split('/')[0].trim();
            
            if (!colorsMap.has(color)) {
                colorsMap.set(color, []);
            }
            colorsMap.get(color).push(variant);
        }
    }
    console.log("COLORS FOUND:", Array.from(colorsMap.keys()));
}
run();
