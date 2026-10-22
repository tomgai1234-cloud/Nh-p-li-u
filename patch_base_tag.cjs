const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/html = html\.replace\(\/<head>\/i, \`<head>\$\{baseTag\}\`\);/g, 'html = html.replace(/<head[^>]*>/i, match => `${match}${baseTag}`);');

fs.writeFileSync('server.ts', code);
