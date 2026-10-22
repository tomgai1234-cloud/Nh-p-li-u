
import React, { useState } from 'react';
import Button from '../Button';
import { Upload, Trash2, Image as ImageIcon, Sparkles } from 'lucide-react';
import TextInput from '../TextInput';
import Spinner from '../Spinner';

interface FramePanelProps {
  onApplyFrame: (
    frameFile: File | null, 
    giftFile: File | null, 
    giftText: string, 
    giftTextStyle: { size: number, color: string, font: string },
    use1000x1000: boolean,
    mode: 'overlay' | 'template' | 'combo',
    comboSettings?: {
        comboFile: File | null,
        offsetY: number,
        scale: number,
    }
  ) => void;
  onCancel: () => void;
  onRemoveBg?: (file: File) => Promise<File>;
}

const checkerboardStyle: React.CSSProperties = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2371717a' fill-opacity='0.2' fill-rule='evenodd'%3E%3Cpath d='M0 0h10v10H0V0zm10 10h10v10H10V10z'/%3E%3C/g%3E%3C/svg%3E")`,
    backgroundSize: '20px 20px',
};

const FONT_OPTIONS = [
    { label: 'Sans-serif', value: 'sans-serif' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Tahoma', value: 'Tahoma' },
    { label: 'Times New Roman', value: 'Times New Roman' },
    { label: 'Courier New', value: 'Courier New' },
];

const FramePanel: React.FC<FramePanelProps> = ({ onApplyFrame, onCancel, onRemoveBg }) => {
  const [mode, setMode] = useState<'overlay' | 'template' | 'combo'>('template');
  const [frameFile, setFrameFile] = useState<File | null>(null);
  
  // Template Mode State
  const [giftFile, setGiftFile] = useState<File | null>(null);
  const [giftText, setGiftText] = useState('');
  const [textSize, setTextSize] = useState(18);
  const [textColor, setTextColor] = useState('#000000');
  const [textFont, setTextFont] = useState('sans-serif');

  // Combo Mode State
  const [comboFile, setComboFile] = useState<File | null>(null);
  const [comboOffsetY, setComboOffsetY] = useState(50); // 0-100% height (50 = middle)
  const [comboScale, setComboScale] = useState(100); // 100% of auto-calculated size
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // Previews
  const [framePreview, setFramePreview] = useState<string | null>(null);
  const [giftPreview, setGiftPreview] = useState<string | null>(null);
  const [comboPreview, setComboPreview] = useState<string | null>(null);
  
  const [use1000x1000, setUse1000x1000] = useState(true);

  const handleFrameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFrameFile(file);
      setFramePreview(URL.createObjectURL(file));
    }
  };

  const handleGiftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setGiftFile(file);
      setGiftPreview(URL.createObjectURL(file));
    }
  };

  const handleComboChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setComboFile(file);
        setComboPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveBg = async () => {
      if (!comboFile || !onRemoveBg) return;
      setIsRemovingBg(true);
      try {
          const newFile = await onRemoveBg(comboFile);
          setComboFile(newFile);
          setComboPreview(URL.createObjectURL(newFile));
      } catch (error) {
          alert("Không thể xóa nền ảnh này. Vui lòng thử lại.");
      } finally {
          setIsRemovingBg(false);
      }
  };

  const handleApply = () => {
    onApplyFrame(
        frameFile, 
        giftFile, 
        giftText, 
        { size: textSize, color: textColor, font: textFont }, 
        use1000x1000,
        mode,
        { comboFile, offsetY: comboOffsetY, scale: comboScale }
    );
  };

  const isApplyDisabled = () => {
      if (mode === 'template') return !frameFile && !giftFile && !giftText;
      if (mode === 'combo') return !comboFile;
      return !frameFile; // overlay mode
  };

  return (
    <div className="space-y-6 text-zinc-300">
      <div>
        <h3 className="text-lg font-bold text-zinc-100 mb-2">Khung & Ghép ảnh</h3>
        <div className="flex bg-zinc-800 rounded-lg p-1 border border-zinc-700 mb-4">
            <button
                onClick={() => setMode('template')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    mode === 'template' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
                Quà tặng
            </button>
            <button
                onClick={() => setMode('combo')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    mode === 'combo' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
                Ghép Combo
            </button>
            <button
                onClick={() => setMode('overlay')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    mode === 'overlay' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
                Khung đè
            </button>
        </div>
      </div>

      <div className="space-y-5 pt-4 border-t border-zinc-700/50">
          <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 cursor-pointer hover:bg-zinc-800 transition-colors">
              <input 
                type="checkbox" 
                checked={use1000x1000} 
                onChange={e => setUse1000x1000(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-sky-500 focus:ring-sky-500"
              />
              <span className="text-sm font-medium">Ép về cỡ 1000x1000px</span>
          </label>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Khung trang trí (PNG)</label>
            {!frameFile ? (
                <label className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-zinc-800/30 border-2 border-zinc-700 border-dashed rounded-lg cursor-pointer hover:border-sky-500 hover:bg-zinc-800/50">
                    <Upload className="w-6 h-6 text-zinc-500 mb-2" />
                    <span className="text-xs text-zinc-400">Tải khung (Nên dùng ảnh PNG trong suốt)</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFrameChange} />
                </label>
            ) : (
                <div className="relative group rounded-lg overflow-hidden border border-zinc-600 bg-zinc-900 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 opacity-20" style={checkerboardStyle}></div>
                    <img src={framePreview!} alt="Frame" className="relative z-10 h-full object-contain" />
                    <button onClick={() => { setFrameFile(null); setFramePreview(null); }} className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded hover:bg-red-600">
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            )}
          </div>

          {mode === 'template' && (
              <div className="space-y-4 animate-fade-in pt-4 border-t border-zinc-800">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Ảnh Quà Tặng</label>
                    {!giftFile ? (
                        <label className="flex flex-col items-center justify-center w-full h-24 px-4 transition bg-zinc-800/30 border-2 border-zinc-700 border-dashed rounded-lg cursor-pointer hover:border-sky-500 hover:bg-zinc-800/50">
                            <ImageIcon className="w-5 h-5 text-zinc-500 mb-1" />
                            <span className="text-[10px] text-zinc-400">Chọn ảnh quà (Sẽ hiện ở góc phải)</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleGiftChange} />
                        </label>
                    ) : (
                        <div className="relative group rounded-lg overflow-hidden border border-zinc-600 bg-zinc-900 h-20 flex items-center justify-center">
                            <div className="absolute inset-0 opacity-20" style={checkerboardStyle}></div>
                            <img src={giftPreview!} alt="Gift" className="relative z-10 h-full object-contain" />
                            <button onClick={() => { setGiftFile(null); setGiftPreview(null); }} className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded hover:bg-red-600">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-3 p-3 bg-zinc-800/40 rounded-lg border border-zinc-700">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Chữ quà tặng</label>
                    <TextInput 
                        placeholder="VD: Quà tặng 0đ"
                        value={giftText}
                        onChange={e => setGiftText(e.target.value)}
                        className="!py-1.5 !text-sm"
                    />
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-zinc-500 uppercase block mb-1">Cỡ</label>
                            <input type="number" value={textSize} onChange={e => setTextSize(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-sm outline-none focus:border-sky-500" />
                        </div>
                        <div>
                            <label className="text-[10px] text-zinc-500 uppercase block mb-1">Màu</label>
                            <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-full h-8 bg-zinc-900 border border-zinc-600 rounded cursor-pointer p-1" />
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Font</label>
                        <select value={textFont} onChange={e => setTextFont(e.target.value)} className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-xs outline-none focus:border-sky-500">
                            {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>
              </div>
          )}

          {mode === 'combo' && (
              <div className="space-y-4 animate-fade-in pt-4 border-t border-zinc-800">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Ảnh Phụ (Ghép Combo)</label>
                    {!comboFile ? (
                        <label className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-zinc-800/30 border-2 border-zinc-700 border-dashed rounded-lg cursor-pointer hover:border-sky-500 hover:bg-zinc-800/50">
                            <ImageIcon className="w-6 h-6 text-zinc-500 mb-2" />
                            <span className="text-xs text-zinc-400">Chọn ảnh sản phẩm thứ 2</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleComboChange} />
                        </label>
                    ) : (
                        <div className="space-y-2">
                            <div className="relative group rounded-lg overflow-hidden border border-zinc-600 bg-zinc-900 h-32 flex items-center justify-center">
                                <div className="absolute inset-0 opacity-20" style={checkerboardStyle}></div>
                                {isRemovingBg ? (
                                    <div className="relative z-10 flex flex-col items-center gap-2">
                                        <Spinner />
                                        <span className="text-xs text-sky-400">Đang tách nền...</span>
                                    </div>
                                ) : (
                                    <img src={comboPreview!} alt="Combo" className="relative z-10 h-full object-contain" />
                                )}
                                <button onClick={() => { setComboFile(null); setComboPreview(null); }} className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded hover:bg-red-600 z-20">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                            
                            {onRemoveBg && (
                                <Button 
                                    onClick={handleRemoveBg} 
                                    disabled={isRemovingBg} 
                                    colorScheme="slate" 
                                    className="!py-1.5 !text-xs w-full border-sky-500/30 text-sky-200 hover:bg-sky-900/30"
                                >
                                    <Sparkles className="w-3 h-3 mr-2" />
                                    Xóa nền (AI)
                                </Button>
                            )}
                        </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2">
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-[10px] text-zinc-500 uppercase">Vị trí dọc</label>
                                <span className="text-[10px] text-zinc-400">{comboOffsetY}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="100" value={comboOffsetY} onChange={e => setComboOffsetY(Number(e.target.value))}
                                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:rounded-full"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-[10px] text-zinc-500 uppercase">Kích thước</label>
                                <span className="text-[10px] text-zinc-400">{comboScale}%</span>
                            </div>
                            <input 
                                type="range" min="50" max="150" value={comboScale} onChange={e => setComboScale(Number(e.target.value))}
                                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:rounded-full"
                            />
                        </div>
                  </div>
              </div>
          )}
      </div>

      <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700 text-xs text-zinc-400">
          {mode === 'template' ? (
              <p>Chế độ Quà tặng: Ảnh nhỏ góc phải trên.</p>
          ) : mode === 'combo' ? (
              <p>Chế độ Combo: Tự động ghép <strong>ảnh chính bên trái</strong> và <strong>ảnh phụ bên phải</strong> (to hơn quà tặng).</p>
          ) : (
              <p>Chế độ Overlay: Khung phủ kín ảnh.</p>
          )}
      </div>

      <div className="pt-4 border-t border-zinc-700/50 flex items-center gap-4">
        <Button onClick={handleApply} disabled={isApplyDisabled()} colorScheme="primary" className="!py-2.5 flex-1">Áp dụng</Button>
        <Button onClick={onCancel} colorScheme="ghost" className="!py-2.5 flex-1">Hủy</Button>
      </div>
    </div>
  );
};

export default FramePanel;
