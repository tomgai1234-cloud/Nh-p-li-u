const fs = require('fs');
let code = fs.readFileSync('components/tabs/HtmlDescriptionScraperTab.tsx', 'utf8');

code = code.replace(
  "setClickSelector(event.data.selector);\n              }\n          }",
  "setClickSelector(event.data.selector);\n              }\n              setIsVisualPickerOpen(false);\n          }"
);

fs.writeFileSync('components/tabs/HtmlDescriptionScraperTab.tsx', code);
