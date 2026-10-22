const fs = require('fs');
let code = fs.readFileSync('components/ResultCard.tsx', 'utf8');

if (!code.includes("showReviewMode?: boolean;")) {
    code = code.replace(
        "totalResultsCount?: number;",
        "totalResultsCount?: number;\n  showReviewMode?: boolean;"
    );
}

if (!code.includes("showReviewMode, totalResultsCount")) {
    code = code.replace(
        "onApplyReviewToAll, totalResultsCount",
        "onApplyReviewToAll, totalResultsCount, showReviewMode"
    );
}

const reviewModeBlockStart = "{/* Review Mode Content - Always visible at top */}";
const reviewModeBlockEnd = "</div>\n                                </div>"; // End of Review Mode Content

// Add conditional rendering
const reviewReplacement = `{showReviewMode && (
                        <>
                        {/* Review Mode Content - Always visible at top */}`;
code = code.replace("{/* Review Mode Content - Always visible at top */}", reviewReplacement);

// We need to close the condition before the HTML content part:
const htmlContentStart = "<div>\n                            {activeTab === 'accuracy' ?";
const htmlContentReplacement = `</>\n                        )}\n\n                        <div>\n                            {activeTab === 'accuracy' ?`;
code = code.replace(htmlContentStart, htmlContentReplacement);

fs.writeFileSync('components/ResultCard.tsx', code);
