import React from 'react';
import { Undo2, Redo2, Download, Info } from 'lucide-react';
import Button from '../Button';

interface EditorHeaderProps {
  onUndo: () => void;
  onRedo: () => void;
  onSaveClick: () => void;
  onInfoClick: () => void;
  undoDisabled: boolean;
  saveDisabled: boolean;
  infoDisabled: boolean;
  activeImageName: string | null;
  activeToolLabel: string | null;
  onBreadcrumbClick: () => void;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({ 
  onUndo, 
  onRedo, 
  onSaveClick, 
  onInfoClick, 
  undoDisabled, 
  saveDisabled, 
  infoDisabled,
  activeImageName,
  activeToolLabel,
  onBreadcrumbClick,
}) => {
  return (
    <header className="flex flex-col bg-zinc-900/50 border-b border-zinc-700 flex-shrink-0">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-zinc-200 ml-2">Picture Editor</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onUndo} disabled={undoDisabled} className="p-2 text-zinc-300 rounded-md hover:bg-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors" title="Hoàn tác">
            <Undo2 className="w-5 h-5" />
          </button>
          <button onClick={onRedo} disabled={true} className="p-2 text-zinc-300 rounded-md hover:bg-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors" title="Làm lại (chưa có)">
            <Redo2 className="w-5 h-5" />
          </button>
          <button onClick={onInfoClick} disabled={infoDisabled} className="p-2 text-zinc-300 rounded-md hover:bg-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors" title="Thông tin ảnh">
            <Info className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => {}} colorScheme="slate" className="!w-auto !py-1.5 !px-4 !text-sm">Tắt</Button>
          <Button onClick={onSaveClick} disabled={saveDisabled} className="!w-auto !py-1.5 !px-4 !text-sm">Lưu</Button>
        </div>
      </div>
       {(activeImageName) && (
        <nav aria-label="Breadcrumb" className="px-4 pb-2 text-sm text-zinc-400 flex items-center gap-1.5 flex-wrap">
          <button onClick={onBreadcrumbClick} className="hover:text-sky-400 transition-colors">
            Picture Editor
          </button>
          <span className="text-zinc-500">/</span>
          <span className="font-medium text-zinc-300 truncate max-w-[200px] sm:max-w-xs" title={activeImageName}>
            {activeImageName}
          </span>
          {activeToolLabel && (
            <>
                <span className="text-zinc-500">/</span>
                <span className="font-semibold text-sky-300">{activeToolLabel}</span>
            </>
          )}
        </nav>
      )}
    </header>
  );
};

export default EditorHeader;