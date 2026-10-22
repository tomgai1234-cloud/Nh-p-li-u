
import React, { useState } from 'react';
import Button from '../Button';
import TextInput from '../TextInput';
import { Upload, Trash2 } from 'lucide-react';

interface WatermarkPanelProps {
  onApply: (file: File | null, text: string, position: number, opacity: number, scale: number) => void;
  onCancel: () => void;
}

const POSITIONS = [
    1, 2, 3,
    4, 5, 6,
    7, 8, 9
];

const WatermarkPanel: React.FC<WatermarkPanelProps> = ({ onApply, onCancel }) => {
  const [type, setType] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [position, setPosition] = useState(5); // Center
  const [opacity, setOpacity] = useState(50);
  const [scale, setScale] = useState(30); // Percent of image width

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    }
  };

  const handleApply = () => {
      onApply(type === 'image' ? file : null, text, position, opacity, scale);
  }

  return (
    <div className="space-y-6 text-zinc-300">
      <div>
        <h3 className="text-lg font-bold text-zinc-100 mb-4">Watermark</h3>
        
        {/* Type Switch */}
        <div className="flex bg-zinc-800 rounded-lg p-1 border border-zinc-700 mb-4">
            <button
                onClick={() => setType('text')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    type === 'text' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
                Chữ (Text)
            </button>
            <button
                onClick={() => setType('image')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    type === 'image' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
                Ảnh (Logo)
            </button>
        </div>

        {/* Input */}
        {type === 'text' ? (
            <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Nội dung</label>
                <TextInput 
                    value={text} 
                    onChange={e => setText(e.target.value)} 
                    placeholder="VD: Shop Chính Hãng" 
                />
            </div>
        ) : (
            <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Tải logo lên</label>
                {!file ? (
                    <label className="flex flex-col items-center justify-center w-full h-24 px-4 transition bg-zinc-800/50 border-2 border-zinc-600 border-dashed rounded-lg appearance-none cursor-pointer hover:border-sky-500 focus:outline-none hover:bg-zinc-800">
                        <Upload className="w-6 h-6 text-zinc-500 mb-1" />
                        <span className="text-xs text-zinc-400">Chọn ảnh PNG</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                ) : (
                    <div className="flex items-center justify-between p-2 bg-zinc-900 border border-zinc-700 rounded-lg">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <img src={previewUrl!} alt="Logo" className="w-8 h-8 object-contain" />
                            <span className="text-xs truncate">{file.name}</span>
                        </div>
                        <button onClick={() => { setFile(null); setPreviewUrl(null); }} className="text-zinc-500 hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4 pt-4 border-t border-zinc-700/50">
          
          {/* Position Grid */}
          <div>
              <label className="text-sm font-medium text-zinc-300 block mb-2">Vị trí</label>
              <div className="grid grid-cols-3 gap-2 w-24 mx-auto">
                  {POSITIONS.map(pos => (
                      <button
                        key={pos}
                        onClick={() => setPosition(pos)}
                        className={`w-6 h-6 border rounded-sm transition-colors ${
                            position === pos 
                            ? 'bg-sky-500 border-sky-400' 
                            : 'bg-zinc-800 border-zinc-600 hover:bg-zinc-700'
                        }`}
                      />
                  ))}
              </div>
          </div>

          <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-zinc-300">Độ mờ (Opacity)</label>
                <span className="text-xs text-zinc-400">{opacity}%</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="100" 
                value={opacity} 
                onChange={e => setOpacity(Number(e.target.value))} 
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:rounded-full"
              />
          </div>

          <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-zinc-300">Kích thước</label>
                <span className="text-xs text-zinc-400">{scale}%</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="80" 
                value={scale} 
                onChange={e => setScale(Number(e.target.value))} 
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:rounded-full"
              />
          </div>
      </div>

      <div className="pt-4 border-t border-zinc-700/50 flex items-center gap-4">
        <Button 
            onClick={handleApply} 
            disabled={(type === 'text' && !text) || (type === 'image' && !file)} 
            colorScheme="primary" 
            className="!py-2.5 flex-1"
        >
            Áp dụng
        </Button>
        <Button onClick={onCancel} colorScheme="ghost" className="!py-2.5 flex-1">Hủy</Button>
      </div>
    </div>
  );
};

export default WatermarkPanel;
