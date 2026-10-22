const fs = require('fs');
let content = fs.readFileSync('components/tabs/DescriptionGeneratorTab.tsx', 'utf8');

const regex = /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!auth\.currentUser\)\s*\{\s*setHistory\(\[\]\);\s*return;\s*\}[\s\S]*?return\s*\(\)\s*=>\s*unsubscribe\(\);\s*\}\);/g;

// Fallback search with indexOf
const startSearch = "useEffect(() => {\n    if (!auth.currentUser) {";
const endSearch = "  }, []);";

let startIndex = content.indexOf(startSearch);

if (startIndex !== -1) {
  let endIndex = content.indexOf(endSearch, startIndex) + endSearch.length;
  
  const replacement = `useEffect(() => {
    setIsSyncing(true);
    const loadData = async () => {
      try {
        let results = await listHistory(STORE_NAMES.DESCRIPTIONS, 50);
        if (auth.currentUser?.email !== 'tungnguyen.0612993@gmail.com') {
            results = results.filter((item: any) => item.uid === auth.currentUser?.uid);
        }
        
        const historyData: HistoryEntry[] = results.map((data: any) => ({
          id: data.id?.toString(),
          timestamp: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
          productNames: data.productNames || [data.productName],
          results: data.results || [{
            productName: data.productName,
            descriptionText: data.description,
            descriptionHtml: data.description,
            sources: [],
            status: data.status || 'success'
          }],
          userEmail: data.userEmail || 'N/A'
        }));
        
        setHistory(historyData);
      } catch (err) {
        console.error("Error loading history:", err);
      } finally {
        setIsSyncing(false);
      }
    };
    
    loadData();
    const unsubscribe = subscribeToStore(STORE_NAMES.DESCRIPTIONS, loadData);
    return () => unsubscribe();
  }, [auth.currentUser]);`;

  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync('components/tabs/DescriptionGeneratorTab.tsx', content);
  console.log("Patched via indexOf");
} else {
  console.log("Not found via indexOf");
}
