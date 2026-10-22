const fs = require('fs');
let code = fs.readFileSync('components/tabs/ImageScraperTab.tsx', 'utf8');

code = code.replace(
  "if (e.data && e.data.type === 'SELECTOR_PICKED') {",
  "if (e.data && e.data.type === 'PICKER_RESULT') {"
);

code = code.replace(
  "setVariantSelector(e.data.selector);\n                }\n            }",
  "setVariantSelector(e.data.selector);\n                }\n                setIsVisualPickerOpen(false);\n            }"
);

fs.writeFileSync('components/tabs/ImageScraperTab.tsx', code);
