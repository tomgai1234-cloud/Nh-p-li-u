const fs = require('fs');
let code = fs.readFileSync('components/ResultsView.tsx', 'utf8');

code = code.replace(
    "totalResultsCount={results.length}",
    "totalResultsCount={results.length}\n                showReviewMode={true}"
);

fs.writeFileSync('components/ResultsView.tsx', code);
