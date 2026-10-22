import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import TextInput from '../TextInput';
import { Lock, Unlock, Settings } from 'lucide-react';
import type { CustomSizePreset } from '../../types';

interface AdjustmentPanelProps {
  onResize: (newWidth: number, newHeight: number, keepAspectRatio: boolean) => void;
  onRecanvas: (newWidth: number, newHeight: number) => void;
  onAutoResize: () => void;
  currentDimensions: { width: number; height: number } | null;
  isBatchEdit: boolean;
  customSizePresets: CustomSizePreset[];
  onManagePresets: () => void;
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ 
    onResize, 
    onRecanvas,
    onAutoResize,
    currentDimensions, 
    isBatchEdit,
    customSizePresets,
    onManagePresets 
}) => {
    const [activeTab, setActiveTab] = useState<'resize' | 'recanvas'>('resize');
    
    const [width, setWidth] = useState<string>('');
    const [height, setHeight] = useState<string>('');
    const [keepAspectRatio, setKeepAspectRatio] = useState<boolean>(true);
    
    const aspectRatio = useMemo(() => {
        if (currentDimensions && currentDimensions.height > 0) {
        return currentDimensions.width / currentDimensions.height;
        }
        return 1;
    }, [currentDimensions]);
    
    useEffect(() => {
        if (currentDimensions) {
            handleCancel();
        }
    }, [currentDimensions]);

    const handleCancel = () => {
        if (currentDimensions) {
            setWidth(String(currentDimensions.width));
            setHeight(String(currentDimensions.height));
        }
    }

    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newWidth = e.target.value;
        setWidth(newWidth);
        if (!isBatchEdit && activeTab === 'resize' && keepAspectRatio && newWidth) {
          const calculatedHeight = Math.round(Number(newWidth) / aspectRatio);
          setHeight(String(calculatedHeight));
        }
    };
    
    const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newHeight = e.target.value;
        setHeight(newHeight);
        if (!isBatchEdit && activeTab === 'resize' && keepAspectRatio && newHeight) {
          const calculatedWidth = Math.round(Number(newHeight) * aspectRatio);
          setWidth(String(calculatedWidth));
        }
    };

    const handlePresetClick = (preset: CustomSizePreset) => {
        const lockType = preset.lockType || 'unlocked';
    
        setWidth(String(preset.width));
        setHeight(String(preset.height));
    
        if (lockType === 'unlocked') {
            setKeepAspectRatio(false);
        } else {
            setKeepAspectRatio(true);
            if (currentDimensions) {
                const currentAspectRatio = currentDimensions.width / currentDimensions.height;
                if (lockType === 'width-fixed' || lockType === 'fixed-width') {
                    const newHeight = Math.round(preset.width / currentAspectRatio);
                    setHeight(String(newHeight));
                } else { // height-fixed
                    const newWidth = Math.round(preset.height * currentAspectRatio);
                    setWidth(String(newWidth));
                }
            }
        }
    };
    
    const handleApply = () => {
        const numWidth = parseInt(width, 10);
        const numHeight = parseInt(height, 10);
        if (!isNaN(numWidth) && !isNaN(numHeight) && numWidth > 0 && numHeight > 0) {
            if (activeTab === 'resize') {
                onResize(numWidth, numHeight, keepAspectRatio);
            } else {
                onRecanvas(numWidth, numHeight);
            }
        }
    };

    const TabButton: React.FC<{ tab: 'resize' | 'recanvas', label: string }> = ({ tab, label }) => (
        <button
          onClick={() => setActiveTab(tab)}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === tab
              ? 'bg-sky-600 text-white'
              : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {label}
        </button>
      );

    return (
        <div className="space-y-6 text-zinc-300">
            <div>
                <h3 className="text-lg font-bold text-zinc-100 mb-4">Chỉnh cỡ</h3>
                <div className="flex items-center gap-2 p-1 bg-zinc-800 rounded-lg">
                    <TabButton tab="resize" label="Kích thước Ảnh" />
                    <TabButton tab="recanvas" label="Kích thước Canvas" />
                </div>
            </div>

            <div className="space-y-2">
                <button 
                    onClick={onManagePresets} 
                    className="w-full flex justify-between items-center p-3 bg-zinc-700/50 border border-zinc-600 rounded-md hover:bg-zinc-700 transition-colors"
                >
                    <span className="font-medium">Tùy chỉnh</span>
                    <Settings className="w-5 h-5 text-zinc-400" />
                </button>
                
                <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
                    {customSizePresets.map((preset) => (
                        <button 
                            key={preset.id}
                            onClick={() => handlePresetClick(preset)}
                            className="w-full text-left p-3 bg-zinc-800/60 border border-zinc-700 rounded-md hover:bg-zinc-700/80 transition-colors"
                        >
                            <span className="text-sm text-zinc-300">{preset.name} ({preset.width} &times; {preset.height})</span>
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-zinc-700/50">
                <Button 
                    onClick={onAutoResize}
                    disabled={!currentDimensions || activeTab !== 'resize'} 
                    colorScheme="slate" 
                    className="!py-2 !w-full"
                >
                    Tự động 800px (Cạnh dài nhất)
                </Button>
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <label htmlFor="width" className="block text-sm text-zinc-400 mb-1 text-center">Rộng</label>
                        <TextInput id="width" type="number" value={width} onChange={handleWidthChange} placeholder="1000" className="text-center"/>
                    </div>
                    <div className="self-center pb-1">
                        {activeTab === 'resize' ? (
                            <button 
                                onClick={() => setKeepAspectRatio(!keepAspectRatio)}
                                className="p-2 text-zinc-400 hover:text-indigo-400 transition-colors duration-200 rounded-md"
                                title={keepAspectRatio ? "Mở khóa tỷ lệ" : "Khóa tỷ lệ"}
                            >
                                {keepAspectRatio ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                                <span className="sr-only">{keepAspectRatio ? "Khóa tỷ lệ" : "Mở khóa tỷ lệ"}</span>
                            </button>
                        ) : (
                            <div className="w-9 h-9"></div>
                        )}
                    </div>
                    <div className="flex-1">
                        <label htmlFor="height" className="block text-sm text-zinc-400 mb-1 text-center">Cao</label>
                        <TextInput id="height" type="number" value={height} onChange={handleHeightChange} placeholder="1000" className="text-center"/>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Button onClick={handleApply} colorScheme="primary" className="!py-2.5 flex-1">Áp dụng</Button>
                    <Button onClick={handleCancel} colorScheme="ghost" className="!py-2.5 flex-1">Hủy</Button>
                </div>
            </div>
        </div>
    )
};

export default AdjustmentPanel;