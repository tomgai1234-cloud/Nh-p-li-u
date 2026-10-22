const fs = require('fs');
let code = fs.readFileSync('components/ResultCard.tsx', 'utf8');

// 1. Update useEffects
code = code.replace(
  `  // Sync localDescriptionHtml when prop changes
  React.useEffect(() => {
    setLocalDescriptionHtml(descriptionHtml);
    setSpecs(null);
    setSections(null); // Reset sections
  }, [descriptionHtml]);`,
  `  // Sync localDescriptionHtml when prop changes
  React.useEffect(() => {
    setLocalDescriptionHtml(descriptionHtml);
  }, [descriptionHtml]);

  React.useEffect(() => {
    setSpecs(null);
    setSections(null); // Reset sections
  }, [productName]);

  // Auto-extract specs when expanded if not already extracted
  React.useEffect(() => {
      if (isExpanded && specs === null && sections === null && !isExtractingSpecs) {
          handleExtractSpecs();
      }
  }, [isExpanded, productName]);`
);

// 2. Remove Review Mode tab button
code = code.replace(
  `                                <button
                                  onClick={handleExtractSpecs}
                                  className={\`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 flex items-center gap-2 border \${
                                      activeTab === 'review'
                                      ? 'bg-purple-600/30 text-purple-400 border-purple-500/50'
                                      : 'bg-zinc-800/50 text-purple-500/80 hover:bg-purple-600/20 hover:text-purple-400 border-purple-500/30'
                                  }\`}
                              >
                                  <SlidersHorizontal className="w-4 h-4" />
                                  Review Mode
                              </button>`,
  ``
);

// 3. Move Bật/Tắt Nội Dung outside of activeTab switch
const reviewBlockStart = `                            {activeTab === 'review' ? (
                                <div className="bg-zinc-900/50 border border-purple-500/30 rounded-lg p-4">`;
const reviewBlockEnd = `                                </div>
                            ) : activeTab === 'accuracy' ? (`;

const splitCode = code.split(reviewBlockStart);
if (splitCode.length === 2) {
    const afterStart = splitCode[1];
    const splitEnd = afterStart.split(reviewBlockEnd);
    if (splitEnd.length === 2) {
        const reviewContent = splitEnd[0];
        
        let newContent = `
                        {/* Review Mode Content - Always visible at top */}
                        <div className="bg-zinc-900/50 border border-purple-500/30 rounded-lg p-4 mb-6">
                            ${reviewContent}
                        </div>

                        <div>
                            {activeTab === 'accuracy' ? (`;
                            
        code = splitCode[0] + newContent + splitEnd[1];
    }
}

// 4. Remove activeTab state setting in handleExtractSpecs
code = code.replace(
  `  const handleExtractSpecs = async () => {
      setActiveTab('review');`,
  `  const handleExtractSpecs = async () => {`
);

fs.writeFileSync('components/ResultCard.tsx', code);
console.log('Done');
