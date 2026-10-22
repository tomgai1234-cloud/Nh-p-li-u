const fs = require('fs');
let code = fs.readFileSync('components/tabs/HtmlDescriptionScraperTab.tsx', 'utf8');

code = code.replace(
  "setIsVisualPickerOpen(false);\n          }",
  "setIsVisualPickerOpen(false);\n              toast.success('Đã chọn vùng lấy dữ liệu!');\n          }"
);

fs.writeFileSync('components/tabs/HtmlDescriptionScraperTab.tsx', code);
