const fs = require('fs');
let code = fs.readFileSync('components/tabs/ImageScraperTab.tsx', 'utf8');

if (!code.includes("import toast")) {
    code = code.replace(
        "import JSZip from 'jszip';",
        "import JSZip from 'jszip';\nimport toast from 'react-hot-toast';"
    );
    fs.writeFileSync('components/tabs/ImageScraperTab.tsx', code);
}
