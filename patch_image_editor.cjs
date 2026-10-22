const fs = require('fs');
let content = fs.readFileSync('components/tabs/ImageEditorTab.tsx', 'utf8');
content = content.replace(
  "export interface ManageCustomSizesModalProps {",
  "export interface ManageCustomSizesModalProps {\n  onSave: (presets: CustomSizePreset[]) => void;"
);
fs.writeFileSync('components/tabs/ImageEditorTab.tsx', content);
