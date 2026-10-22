import React from 'react';
import type { SingleGenerationResult } from '../types';
// FIX: Changed to a named import to match the updated export in ResultCard.tsx.
import { ResultCard } from './ResultCard';
import { Sparkles } from 'lucide-react';

interface ResultsViewProps {
  results: SingleGenerationResult[];
  onApplyReviewToAll?: (specsToRemove: {name: string, value: string}[], sectionsToRemove: string[]) => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ results, onApplyReviewToAll }) => {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-zinc-800/30 rounded-2xl border border-zinc-700 h-full">
         <Sparkles className="w-12 h-12 text-zinc-500 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-300">Kết quả của bạn sẽ xuất hiện ở đây</h3>
        <p className="text-zinc-400">Điền vào biểu mẫu và bắt đầu tạo mô tả sản phẩm.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-200">Kết quả được tạo</h2>
      <div className="max-h-[80vh] overflow-y-auto pr-4 -mr-4">
        <div className="flex flex-col gap-4">
            {results.map((result, index) => (
            <ResultCard
                key={index}
                productName={result.productName}
                descriptionText={result.descriptionText}
                descriptionHtml={result.descriptionHtml}
                sources={result.sources}
                status={result.status}
                error={result.error}
                onApplyReviewToAll={onApplyReviewToAll}
                totalResultsCount={results.length}
                showReviewMode={true}
                seoKeywords={result.seoKeywords}
                searchQueries={result.searchQueries}
                metaDescription={result.metaDescription}
            />
            ))}
        </div>
      </div>
    </div>
  );
};

export default ResultsView;