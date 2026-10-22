import React from 'react';
import Button from '../Button';
import { Crop, Square, RectangleHorizontal, RectangleVertical } from 'lucide-react';

interface CropRotatePanelProps {
  onRotate: (degrees: number) => void;
  onFlip: (direction: 'horizontal' | 'vertical') => void;
  onSetAspectRatio: (ratio: number | undefined) => void;
  onCropApply: () => void;
  onCropCancel: () => void;
}

const RATIO_PRESETS = [
    { label: 'Free', ratio: undefined, icon: <Crop className="w-5 h-5" /> },
    { label: '1:1', ratio: 1/1, icon: <Square className="w-5 h-5" /> },
    { label: '3:2', ratio: 3/2, icon: <RectangleHorizontal className="w-5 h-5" /> },
    { label: '2:3', ratio: 2/3, icon: <RectangleVertical className="w-5 h-5" /> },
    { label: '4:3', ratio: 4/3, icon: <RectangleHorizontal className="w-5 h-5" /> },
    { label: '3:4', ratio: 3/4, icon: <RectangleVertical className="w-5 h-5" /> },
    { label: '16:9', ratio: 16/9, icon: <RectangleHorizontal className="w-5 h-5" /> },
    { label: '9:16', ratio: 9/16, icon: <RectangleVertical className="w-5 h-5" /> },
];

const CropRotatePanel: React.FC<CropRotatePanelProps> = ({ onRotate, onFlip, onSetAspectRatio, onCropApply, onCropCancel }) => {
  return (
    <div className="space-y-6 text-zinc-300">
      <div>
        <h3 className="text-lg font-bold text-zinc-100 mb-4">Cắt & Xoay</h3>
        <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onRotate(-90)} colorScheme="slate" className="!py-2">Xoay trái</Button>
            <Button onClick={() => onRotate(90)} colorScheme="slate" className="!py-2">Xoay phải</Button>
            <Button onClick={() => onFlip('horizontal')} colorScheme="slate" className="!py-2">Lật ngang</Button>
            <Button onClick={() => onFlip('vertical')} colorScheme="slate" className="!py-2">Lật dọc</Button>
        </div>
      </div>
      
      <div className="pt-4 border-t border-zinc-700/50">
        <h4 className="font-semibold text-zinc-200 mb-3">Tỷ lệ khung hình</h4>
        <div className="grid grid-cols-4 gap-2">
            {RATIO_PRESETS.map(preset => (
                <button 
                    key={preset.label}
                    onClick={() => onSetAspectRatio(preset.ratio)}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-md bg-zinc-700/50 hover:bg-zinc-700 transition-colors"
                    title={preset.label}
                >
                    {preset.icon}
                    <span className="text-xs">{preset.label}</span>
                </button>
            ))}
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-700/50 flex items-center gap-4">
        <Button onClick={onCropApply} colorScheme="primary" className="!py-2.5 flex-1">Áp dụng</Button>
        <Button onClick={onCropCancel} colorScheme="ghost" className="!py-2.5 flex-1">Hủy</Button>
      </div>
    </div>
  );
};

export default CropRotatePanel;