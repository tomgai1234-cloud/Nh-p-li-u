const https = require('https');
const fs = require('fs');

const folderUrl = 'https://drive.google.com/drive/folders/1UXOOysUL7RbmBgqqMTPigBetOys3846h';

https.get(folderUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        fs.writeFileSync('drive_page.html', data);
        console.log('Saved drive_page.html, size:', data.length);
        
        // Search for file IDs or drive viewer URLs or googleusercontent URLs
        const googleUserContent = data.match(/https?:\/\/[a-zA-Z0-9-]+\.googleusercontent\.com\/[^\s"'\>]+/gi) || [];
        console.log('googleusercontent URLs:', googleUserContent.length, googleUserContent.slice(0, 5));
        
        // Search for folder ID or file IDs
        const ids = data.match(/1UXOOysUL7RbmBgqqMTPigBetOys3846h[^\s"'\>]*/gi) || [];
        console.log('Folder ID occurrences:', ids.length);
    });
});
