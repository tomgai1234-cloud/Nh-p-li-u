
import React, { useState } from 'react';
import Button from '../Button';
import TextInput from '../TextInput';

interface UpscalePanelProps {
  currentDimensions: { width: number; height: number };
  onUpscale: (targetWidth: number, targetHeight: number, quality: 'speed' | 'quality') => void;
  isLoading: boolean;
}

const UpscalePanel: React.FC<UpscalePanelProps> = ({ currentDimensions, onUpscale, isLoading }) => {
  const [scaleFactor, setScaleFactor] = useState<number>(2);
  const [quality, setQuality] = useState<'speed' | 'quality'>('speed');
  
  // Calculate target dimensions based on factor
  const targetWidth = Math.round(currentDimensions.width * scaleFactor);
  const targetHeight = Math.round(currentDimensions.height * scaleFactor);

  return (
    <div className="space-y-6 text-zinc-300">
      <div>
        <h3 className="text-lg font-bold text-zinc-100 mb-2">Tăng độ phân giải (Upscale)</h3>
        <p className="text-sm text-zinc-400">
          Sử dụng AI để phóng to và tái tạo chi tiết cho ảnh bị mờ hoặc độ phân giải thấp.
        </p>
      </div>

      <div className="space-y-4 pt-4 border-t border-zinc-700/50">
        {/* Quality Toggle */}
        <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <div>
                <p className="text-sm font-medium text-zinc-200">Chất lượng AI</p>
                <p className="text-xs text-zinc-500">{quality === 'speed' ? 'Nhanh (Flash)' : 'Chất lượng cao (Pro - Cần API Key)'}</p>
            </div>
            <div className="flex bg-zinc-900 rounded-md p-1 border border-zinc-700">
                <button 
                    onClick={() => setQuality('speed')}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${quality === 'speed' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                    Tốc độ
                </button>
                <button 
                    onClick={() => setQuality('quality')}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${quality === 'quality' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                    Chất lượng
                </button>
            </div>
        </div>

        <div className="flex justify-between items-center bg-zinc-800 p-3 rounded-lg border border-zinc-700">
            <div>
                <p className="text-xs text-zinc-500 uppercase">Hiện tại</p>
                <p className="font-mono text-zinc-200">{currentDimensions.width} x {currentDimensions.height} px</p>
            </div>
            <div className="text-zinc-500">➔</div>
            <div className="text-right">
                <p className="text-xs text-sky-400 uppercase">Kết quả (Dự kiến)</p>
                <p className="font-mono text-sky-300">{targetWidth} x {targetHeight} px</p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
            <button
                onClick={() => setScaleFactor(2)}
                className={`p-4 rounded-lg border flex flex-col items-center justify-center transition-all ${
                    scaleFactor === 2 
                    ? 'bg-sky-600/20 border-sky-500 text-sky-300' 
                    : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700 text-zinc-400'
                }`}
            >
                <span className="text-xl font-bold">2x</span>
                <span className="text-xs">HD / Rõ nét</span>
            </button>
            <button
                onClick={() => setScaleFactor(4)}
                className={`p-4 rounded-lg border flex flex-col items-center justify-center transition-all ${
                    scaleFactor === 4
                    ? 'bg-sky-600/20 border-sky-500 text-sky-300' 
                    : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700 text-zinc-400'
                }`}
            >
                <span className="text-xl font-bold">4x</span>
                <span className="text-xs">Ultra HD</span>
            </button>
        </div>
        
        <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-md text-xs text-yellow-200/80">
            <span className="font-bold">Lưu ý:</span> Quá trình này có thể mất 10-20 giây để AI vẽ lại các chi tiết.
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-700/50">
        <Button 
            onClick={() => onUpscale(targetWidth, targetHeight, quality)} 
            disabled={isLoading} 
            colorScheme="primary" 
            className="!py-3"
        >
            Bắt đầu xử lý
        </Button>
      </div>
    </div>
  );
};

export default UpscalePanel;
