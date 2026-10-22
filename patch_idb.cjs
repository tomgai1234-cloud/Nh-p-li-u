const fs = require('fs');

const IDB_IMPORTS = "import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';";
const IDB_IMPORTS_SAME_DIR = "import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../services/idbService';";

const componentsToPatch = [
    {
        file: 'components/tabs/BulkDownloadHistoryTab.tsx',
        storeName: 'STORE_NAMES.BULK_DOWNLOADS',
        patchHistory: true
    },
    {
        file: 'components/tabs/BulkDownloadTab.tsx',
        storeName: 'STORE_NAMES.BULK_DOWNLOADS',
        patchHistory: false,
        replacements: [
            {
                from: /await addDoc\(collection\(db, 'bulk_downloads'\), \{/g,
                to: "await addHistory(STORE_NAMES.BULK_DOWNLOADS, {"
            }
        ]
    },
    {
        file: 'components/tabs/BulkDriveUpload.tsx',
        storeName: 'STORE_NAMES.BULK_DOWNLOADS',
        patchHistory: false,
        replacements: [
            {
                from: /await addDoc\(collection\(db, 'bulk_downloads'\), \{/g,
                to: "await addHistory(STORE_NAMES.BULK_DOWNLOADS, {"
            }
        ]
    },
    {
        file: 'components/tabs/BulkShopifyUpload.tsx',
        storeName: 'STORE_NAMES.BULK_DOWNLOADS',
        patchHistory: false,
        replacements: [
            {
                from: /await addDoc\(collection\(db, 'bulk_downloads'\), \{/g,
                to: "await addHistory(STORE_NAMES.BULK_DOWNLOADS, {"
            }
        ]
    },
    {
        file: 'components/tabs/FileConverterV2Tab.tsx',
        storeName: 'STORE_NAMES.CONVERSIONS',
        patchHistory: true,
        replacements: [
            {
                from: /await addDoc\(collection\(db, 'conversions'\), \{/g,
                to: "await addHistory(STORE_NAMES.CONVERSIONS, {"
            }
        ]
    },
    {
        file: 'components/tabs/ImageScraperTab.tsx',
        storeName: 'STORE_NAMES.SCRAPINGS',
        patchHistory: false,
        replacements: [
            {
                from: /await addDoc\(collection\(db, 'scrapings'\), \{/g,
                to: "await addHistory(STORE_NAMES.SCRAPINGS, {"
            }
        ]
    },
    {
        file: 'components/tabs/ProductExtractorTab.tsx',
        storeName: 'STORE_NAMES.ATTRIBUTES_EXTRACTIONS',
        patchHistory: true,
        replacements: [
            {
                from: /await addDoc\(collection\(db, 'attributes_extractions'\), \{/g,
                to: "await addHistory(STORE_NAMES.ATTRIBUTES_EXTRACTIONS, {"
            }
        ]
    },
    {
        file: 'components/tabs/ProductNameStandardizerTab.tsx',
        storeName: 'STORE_NAMES.NAME_STANDARDIZATIONS',
        patchHistory: true,
        replacements: [
            {
                from: /await addDoc\(collection\(db, 'name_standardizations'\), \{/g,
                to: "await addHistory(STORE_NAMES.NAME_STANDARDIZATIONS, {"
            }
        ]
    },
    {
        file: 'components/tabs/ScrapingHistoryTab.tsx',
        storeName: 'STORE_NAMES.SCRAPINGS',
        patchHistory: true
    },
    {
        file: 'components/tabs/ShopeeScraperTab.tsx',
        storeName: 'STORE_NAMES.SCRAPINGS',
        patchHistory: false,
        replacements: [
            {
                from: /await addDoc\(collection\(db, 'scrapings'\), \{/g,
                to: "await addHistory(STORE_NAMES.SCRAPINGS, {"
            }
        ]
    },
    {
        file: 'components/tabs/DescriptionGeneratorTab.tsx',
        storeName: 'STORE_NAMES.DESCRIPTIONS',
        patchHistory: true,
        replacements: [
            {
                from: /await addDoc\(collection\(db, 'descriptions'\), \{/g,
                to: "await addHistory(STORE_NAMES.DESCRIPTIONS, {"
            }
        ]
    }
];

function patchFile(task) {
    if (!fs.existsSync(task.file)) return;
    let content = fs.readFileSync(task.file, 'utf8');

    // Remove firestore imports that are no longer used for these
    // But keep db, auth as they might be used elsewhere (like users)
    // Add our idbService import
    if (!content.includes('idbService')) {
        const importParts = content.split('\n');
        let lastImportIndex = 0;
        for (let i = 0; i < importParts.length; i++) {
            if (importParts[i].startsWith('import ')) {
                lastImportIndex = i;
            }
        }
        importParts.splice(lastImportIndex + 1, 0, IDB_IMPORTS);
        content = importParts.join('\n');
    }

    if (task.replacements) {
        task.replacements.forEach(rep => {
            content = content.replace(rep.from, rep.to);
        });
    }

    if (task.patchHistory) {
        const fetchHistoryRegex = /const\s+fetchHistory\s*=\s*\(\)\s*=>\s*\{[\s\S]*?const\s+unsubscribe\s*=\s*onSnapshot\([\s\S]*?\}\);[\s\S]*?return\s+unsubscribe;[\s\S]*?\}/g;
        
        const newFetchHistory = `
        const fetchHistory = () => {
            if (!auth.currentUser) return () => {};
            
            const loadData = async () => {
                const results = await listHistory(${task.storeName});
                setHistoryList(results);
            };
            
            loadData();
            return subscribeToStore(${task.storeName}, loadData);
        }`;

        // Some components might have it inside useEffect directly, or a function fetchHistory
        if (content.match(fetchHistoryRegex)) {
            content = content.replace(fetchHistoryRegex, newFetchHistory);
        } else {
            // Find useEffect
            const useEffectRegex = /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!auth\.currentUser\)\s*return;\s*let\s+q\s*=\s*query\([\s\S]*?const\s+unsubscribe\s*=\s*onSnapshot\([\s\S]*?\}\);\s*return\s*\(\)\s*=>\s*\{\s*unsubscribe\(\);\s*\};\s*\},\s*\[auth\.currentUser\]\);/g;
            
            const newUseEffect = `useEffect(() => {
        if (!auth.currentUser) return;
        const loadData = async () => {
            const results = await listHistory(${task.storeName});
            setHistoryList(results);
        };
        loadData();
        const unsubscribe = subscribeToStore(${task.storeName}, loadData);
        return () => unsubscribe();
    }, [auth.currentUser]);`;
            
            if (content.match(useEffectRegex)) {
                content = content.replace(useEffectRegex, newUseEffect);
            } else {
                // Another variant
                const useEffectRegex2 = /useEffect\(\(\)\s*=>\s*\{\s*const\s+fetchHistory\s*=\s*\(\)\s*=>\s*\{[\s\S]*?const\s+unsubscribe\s*=\s*onSnapshot\([\s\S]*?\}\);\s*return\s+unsubscribe;[\s\S]*?\};\s*let\s+unsub\s*=\s*fetchHistory\(\);\s*return\s*\(\)\s*=>\s*\{\s*if\s*\(unsub\)\s*unsub\(\);\s*\};\s*\},\s*\[auth\.currentUser\]\);/g;
                
                if (content.match(useEffectRegex2)) {
                   content = content.replace(useEffectRegex2, `useEffect(() => {
        const loadData = async () => {
            const results = await listHistory(${task.storeName});
            setHistoryList(results);
        };
        loadData();
        const unsubscribe = subscribeToStore(${task.storeName}, loadData);
        return () => unsubscribe();
    }, [auth.currentUser]);`);
                }
            }
        }
    }

    fs.writeFileSync(task.file, content);
}

componentsToPatch.forEach(patchFile);
console.log('Patch complete');
