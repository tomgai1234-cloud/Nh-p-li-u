import React from 'react';
import Button from '../Button';

interface ColorAdjustmentPanelProps {
  brightness: number;
  contrast: number;
  saturation: number;
  setBrightness: (value: number) => void;
  setContrast: (value: number) => void;
  setSaturation: (value: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

const Slider: React.FC<{
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
}> = ({ label, value, onChange, min = 0, max = 200 }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <label className="text-sm font-medium text-zinc-300">{label}</label>
      <span className="text-sm font-mono text-sky-300 bg-zinc-700/50 px-2 py-0.5 rounded-md">{value}%</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-sky-500 [&::-moz-range-thumb]:rounded-full"
    />
  </div>
);

const ColorAdjustmentPanel: React.FC<ColorAdjustmentPanelProps> = ({
  brightness,
  contrast,
  saturation,
  setBrightness,
  setContrast,
  setSaturation,
  onApply,
  onCancel,
}) => {

  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  return (
    <div className="space-y-6 text-zinc-300">
      <div>
        <h3 className="text-lg font-bold text-zinc-100 mb-2">Chỉnh màu</h3>
        <p className="text-sm text-zinc-400">Điều chỉnh độ sáng, độ tương phản và độ bão hòa của ảnh.</p>
      </div>
      
      <div className="space-y-4 pt-4 border-t border-zinc-700/50">
        <Slider
          label="Độ sáng"
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
        />
        <Slider
          label="Tương phản"
          value={contrast}
          onChange={(e) => setContrast(Number(e.target.value))}
        />
        <Slider
          label="Bão hòa"
          value={saturation}
          onChange={(e) => setSaturation(Number(e.target.value))}
        />
        <button onClick={handleReset} className="text-sm text-sky-400 hover:text-sky-300 transition-colors w-full text-left pt-2">
            Reset
        </button>
      </div>

      <div className="pt-4 border-t border-zinc-700/50 flex items-center gap-4">
        <Button onClick={onApply} colorScheme="primary" className="!py-2.5 flex-1">Áp dụng</Button>
        <Button onClick={onCancel} colorScheme="ghost" className="!py-2.5 flex-1">Hủy</Button>
      </div>
    </div>
  );
};

export default ColorAdjustmentPanel;