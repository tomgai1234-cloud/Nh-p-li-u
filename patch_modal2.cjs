const fs = require('fs');
let content = fs.readFileSync('components/ManageCustomSizesModal.tsx', 'utf8');
content = content.replace(
  "  onAdd: (preset: Omit<CustomSizePreset, 'id'>) => void;\n  onDelete: (presetId: string) => void;\n",
  "  onAdd?: (preset: Omit<CustomSizePreset, 'id'>) => void;\n  onDelete?: (presetId: string) => void;\n"
);
fs.writeFileSync('components/ManageCustomSizesModal.tsx', content);
