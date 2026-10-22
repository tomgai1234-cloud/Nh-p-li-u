const fs = require('fs');
let code = fs.readFileSync('components/tabs/ImageScraperTab.tsx', 'utf8');

code = code.replace(
  "setIsVisualPickerOpen(false);\n            }",
  "setIsVisualPickerOpen(false);\n                toast.success('Đã chọn vùng!');\n            }"
);

fs.writeFileSync('components/tabs/ImageScraperTab.tsx', code);
