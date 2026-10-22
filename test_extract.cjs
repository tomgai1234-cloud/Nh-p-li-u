const fs = require('fs');

const html = fs.readFileSync('drive_page.html', 'utf8');

const fileMap = new Map();

// Pattern matching Google Drive file items in public folder page
const itemRegex = /\[\[null,"([a-zA-Z0-9_-]{25,45})"\][\s\S]*?\[\[\["([^"]+\.(?:jpg|jpeg|png|webp|gif|svg|mp4|mov))"/gi;
let m;
while ((m = itemRegex.exec(html)) !== null) {
    const id = m[1];
    const name = m[2];
    if (id && name && !fileMap.has(id)) {
        fileMap.set(id, {
            id,
            name,
            url: `https://drive.google.com/thumbnail?id=${id}&sz=w2500`
        });
    }
}

console.log('Result count:', fileMap.size);
console.log('Files:', Array.from(fileMap.values()));
