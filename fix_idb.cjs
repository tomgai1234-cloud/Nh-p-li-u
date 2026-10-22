const fs = require('fs');
const glob = require('glob');

const files = glob.sync('components/tabs/*.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add imports if missing
  if (content.includes('addDoc') && !content.includes('addHistory')) {
    content = content.replace(
      "import { collection",
      "import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';\nimport { collection"
    );
    changed = true;
  }

  // Replace addDoc with addHistory
  if (content.includes('await addDoc(collection(db, \'bulk_downloads\'),')) {
    content = content.replace(/await addDoc\(collection\(db, 'bulk_downloads'\), \{/g, "await addHistory(STORE_NAMES.BULK_DOWNLOADS, {");
    changed = true;
  }
  if (content.includes('await addDoc(collection(db, \'scrapings\'),')) {
    content = content.replace(/await addDoc\(collection\(db, 'scrapings'\), \{/g, "await addHistory(STORE_NAMES.SCRAPINGS, {");
    changed = true;
  }
  
  // Replace serverTimestamp with Date.now()
  if (changed) {
    content = content.replace(/serverTimestamp\(\)/g, "Date.now()");
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
