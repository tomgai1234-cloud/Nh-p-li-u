const fs = require('fs');
let content = fs.readFileSync('components/ManageCustomSizesModal.tsx', 'utf8');
content = content.replace(
  "interface ManageCustomSizesModalProps {",
  "interface ManageCustomSizesModalProps {\n  onSave: (presets: CustomSizePreset[]) => void;"
);
fs.writeFileSync('components/ManageCustomSizesModal.tsx', content);
