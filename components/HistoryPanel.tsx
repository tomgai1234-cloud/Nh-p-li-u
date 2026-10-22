import React from 'react';
import type { HistoryEntry } from '../types';
import { History, Trash2 } from 'lucide-react';
import Button from './Button';

interface HistoryPanelProps {
  history: HistoryEntry[];
  onLoad: (entry: HistoryEntry) => void;
  onClear: () => void;
  onDeleteItem: (entryId: string) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onLoad, onClear, onDeleteItem }) => {
  return (
    <div className="bg-zinc-800/50 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-2xl border border-zinc-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-sky-300 flex items-center gap-2">
            <History className="w-6 h-6" />
            Lịch sử
        </h2>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1 transition-colors"
            aria-label="Xóa lịch sử"
          >
            <Trash2 className="w-4 h-4" />
            Xóa
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="text-zinc-400 text-sm">Chưa có lịch sử nào.</p>
      ) : (
        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {history.map((entry) => (
            <li key={entry.id} className="flex justify-between items-center p-2 rounded-lg bg-zinc-900/50 border border-zinc-700 transition-colors duration-200 hover:bg-zinc-700/50">
              <div className="flex-1 min-w-0 pr-2">
                <p className="font-semibold text-zinc-200 truncate" title={entry.productNames.join(', ')}>
                  {entry.productNames.join(', ')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-sky-400 truncate max-w-[120px]" title={entry.userEmail}>
                    {entry.userEmail || 'N/A'}
                  </p>
                  <span className="text-zinc-600 text-[10px]">•</span>
                  <p className="text-[10px] text-zinc-400">
                    {new Date(entry.timestamp).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                 <Button 
                    onClick={() => onLoad(entry)} 
                    className="!w-auto !px-3 !py-1 !text-xs"
                    colorScheme="slate"
                >
                    Tải
                </Button>
                <button
                  onClick={() => onDeleteItem(entry.id)}
                  className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors rounded-md"
                  aria-label={`Xóa mục`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HistoryPanel;