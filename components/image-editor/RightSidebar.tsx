
import React from 'react';
import type { ImageState } from '../../types';
import Button from '../Button';
import { Check, Trash2 } from 'lucide-react';

interface RightSidebarProps {
  images: ImageState[];
  activeIndex: number | null;
  setActiveIndex: (index: number) => void;
  isBatchEdit: boolean;
  setIsBatchEdit: (isBatch: boolean) => void;
  onUploadClick: () => void;
  onToggleSelection: (index: number) => void;
  onToggleSelectAll: () => void;
  onDeleteImage: (index: number) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ 
  images, 
  activeIndex, 
  setActiveIndex, 
  isBatchEdit, 
  setIsBatchEdit, 
  onUploadClick,
  onToggleSelection,
  onToggleSelectAll,
  onDeleteImage
}) => {
  const allSelected = images.length > 0 && images.every(img => img.isSelected);

  return (
    <aside className="w-64 bg-zinc-900/40 p-3 border-l border-zinc-700 flex flex-col flex-shrink-0">
      {/* FIX: Re-structured the toggle switch to be a single, fully clickable label element */}
      <label className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/50 mb-3 cursor-pointer">
        <span className="text-sm font-medium text-zinc-200 select-none">
          Chỉnh sửa hàng loạt
        </span>
        <div className="relative inline-flex items-center">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isBatchEdit}
            onChange={(e) => setIsBatchEdit(e.target.checked)}
          />
          <div className="w-11 h-6 bg-zinc-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-sky-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
        </div>
      </label>

      {isBatchEdit && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/50 mb-3 border border-zinc-700">
          <input
            type="checkbox"
            id="select-all-toggle"
            className="w-4 h-4 text-sky-600 bg-zinc-700 border-zinc-500 rounded focus:ring-sky-500 cursor-pointer"
            checked={allSelected}
            onChange={onToggleSelectAll}
          />
          <label htmlFor="select-all-toggle" className="text-sm font-medium text-zinc-200 cursor-pointer">
            Chọn tất cả
          </label>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
        {images.map((image, index) => {
          const isActive = activeIndex === index;
          const isSelected = !!image.isSelected;

          const handleClick = () => {
            if (isBatchEdit) {
                onToggleSelection(index);
            }
            setActiveIndex(index);
          };

          return (
            <div
              key={`${image.id}-${index}`}
              onClick={handleClick}
              className={`
                w-full h-24 rounded-lg overflow-hidden transition-all duration-200 relative group cursor-pointer
                ${isActive && !isSelected ? 'ring-2 ring-sky-400' : 'ring-1 ring-transparent hover:ring-zinc-400'}
              `}
            >
              <img src={image.url} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
              
              {/* Delete Button (visible on hover) */}
              <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDeleteImage(index);
                }}
                className="absolute top-1 right-1 p-1.5 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all z-20 backdrop-blur-sm"
                title="Xóa ảnh"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Dimensions Badge (Bottom Left) */}
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-zinc-200 text-[10px] font-mono rounded backdrop-blur-sm pointer-events-none">
                  {image.dimensions.width}x{image.dimensions.height}
              </div>
              
              {/* IMPROVEMENT: Enhanced visual feedback for selected items */}
              {isBatchEdit && isSelected && (
                <div className="absolute inset-0 bg-sky-500/40 pointer-events-none border-2 border-sky-300 rounded-lg"></div>
              )}

              {isBatchEdit && (
                <div className={`absolute top-2 left-2 w-5 h-5 rounded bg-zinc-900/80 border-2 ${isSelected ? 'border-sky-300' : 'border-zinc-400'} flex items-center justify-center pointer-events-none transition-colors`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-sky-300" />}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex-shrink-0">
        <Button onClick={onUploadClick} colorScheme="slate" className="!w-full !py-2">
            Thêm Ảnh
        </Button>
      </div>
    </aside>
  );
};

export default RightSidebar;
