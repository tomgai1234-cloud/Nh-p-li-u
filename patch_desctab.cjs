const fs = require('fs');
let fileContent = fs.readFileSync('components/tabs/DescriptionGeneratorTab.tsx', 'utf8');

// Add rewriteDescriptionWithSpecs to imports
if (!fileContent.includes("rewriteDescriptionWithSpecs")) {
    fileContent = fileContent.replace(
        "import { generateProductDescription, generateBatchSimpleDescriptions, generateBatchDetailedDescriptions, suggestGuidelines } from '../../services/geminiService';",
        "import { generateProductDescription, generateBatchSimpleDescriptions, generateBatchDetailedDescriptions, suggestGuidelines, rewriteDescriptionWithSpecs } from '../../services/geminiService';"
    );
}

// Create the handleApplyReviewToAll function
const functionInjection = `
  const handleApplyReviewToAll = async (specsToRemove: {name: string, value: string}[], sectionsToRemove: string[]) => {
      if (currentResults.length === 0) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
          const newResults = [...currentResults];
          let completed = 0;
          
          for (let i = 0; i < newResults.length; i++) {
              setLoadingProgress(\`Đang áp dụng thay đổi hàng loạt: \${completed + 1}/\${newResults.length}\`);
              if (newResults[i].status === 'success') {
                  const newHtml = await rewriteDescriptionWithSpecs(
                      newResults[i].descriptionHtml,
                      [], // specsToKeep
                      specsToRemove,
                      sectionsToRemove
                  );
                  newResults[i].descriptionHtml = newHtml;
                  // Note: we don't update descriptionText here to keep it fast, or we could strip HTML
                  const stripHtml = (html: string) => { const tmp = document.createElement('DIV'); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || ''; };
                  newResults[i].descriptionText = stripHtml(newHtml);
              }
              completed++;
          }
          
          setCurrentResults(newResults);
          setLoadingProgress('');
      } catch (err: any) {
          setError(err.message || "Có lỗi xảy ra khi áp dụng thay đổi hàng loạt.");
      } finally {
          setIsLoading(false);
          setLoadingProgress('');
      }
  };
`;

// Insert the function before the handleGenerate function
fileContent = fileContent.replace(
  "const handleGenerate = async () => {",
  functionInjection + "\n  const handleGenerate = async () => {"
);

// Update ResultsView prop
fileContent = fileContent.replace(
  "<ResultsView results={currentResults} />",
  "<ResultsView results={currentResults} onApplyReviewToAll={handleApplyReviewToAll} />"
);

fs.writeFileSync('components/tabs/DescriptionGeneratorTab.tsx', fileContent);
