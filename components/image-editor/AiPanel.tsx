
import React, { useState } from 'react';
import TextArea from '../TextArea';
import TextInput from '../TextInput';
import Button from '../Button';
import { Sparkles, ImageMinus, Eraser, Image as ImageIcon } from 'lucide-react';

interface AiPanelProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerativeEdit: (prompt: string, quality: 'speed' | 'quality') => void;
  onRemoveBackground: () => void;
  isLoading: boolean;
}

const BACKGROUND_PRESETS = [
    { label: 'Studio Trắng', prompt: 'Place the product on a professional clean infinite white studio background with soft realistic shadows.', color: 'bg-white text-black' },
    { label: 'Bàn Gỗ', prompt: 'Place the product on a rustic wooden table with soft morning sunlight and blurred nature background.', color: 'bg-amber-800 text-white' },
    { label: 'Đá Marble', prompt: 'Place the product on a luxurious white marble podium with elegant lighting.', color: 'bg-slate-200 text-slate-800' },
    { label: 'Lụa Hồng', prompt: 'Place the product on soft pink silk fabric with gentle folds and soft lighting.', color: 'bg-pink-200 text-pink-800' },
    { label: 'Thiên Nhiên', prompt: 'Place the product on a rock in a mossy forest with cinematic lighting and bokeh.', color: 'bg-green-800 text-white' },
    { label: 'Cyberpunk', prompt: 'Place the product in a futuristic cyberpunk city street with neon lights (pink and blue) reflection.', color: 'bg-purple-900 text-white' },
];

const TEXT_EDIT_PRESETS = [
    { label: 'Sửa lỗi chính tả', prompt: 'Fix any spelling mistakes in the text on the image. Keep the font and style exactly the same.' },
    { label: 'Dịch sang tiếng Anh', prompt: 'Translate all visible text in the image to English. Maintain the original layout, font style, and color.' },
    { label: 'Làm rõ chữ', prompt: 'Enhance the text clarity and sharpness. Make it easier to read while keeping the original style.' },
];

const AiPanel: React.FC<AiPanelProps> = ({ prompt, setPrompt, onGenerativeEdit, onRemoveBackground, isLoading }) => {
  const [mode, setMode] = useState<'instruct' | 'background' | 'cleanup'>('instruct');
  const [objectToRemove, setObjectToRemove] = useState('');
  const [quality, setQuality] = useState<'speed' | 'quality'>('speed');

  return (
    <div className="space-y-6 animate-fade-in text-zinc-300">
      
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

      {/* Header Tabs */}
      <div className="flex p-1 bg-zinc-800 rounded-lg border border-zinc-700">
          <button onClick={() => setMode('instruct')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${mode === 'instruct' ? 'bg-sky-600 text-white' : 'hover:bg-zinc-700 text-zinc-400'}`}>
              <Sparkles className="w-3 h-3" /> Chỉ thị
          </button>
          <button onClick={() => setMode('background')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${mode === 'background' ? 'bg-sky-600 text-white' : 'hover:bg-zinc-700 text-zinc-400'}`}>
              <ImageIcon className="w-3 h-3" /> Phông nền
          </button>
          <button onClick={() => setMode('cleanup')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${mode === 'cleanup' ? 'bg-sky-600 text-white' : 'hover:bg-zinc-700 text-zinc-400'}`}>
              <Eraser className="w-3 h-3" /> Xóa vật
          </button>
      </div>

      {/* MODE: INSTRUCTION (Deevid.ai Style) */}
      {mode === 'instruct' && (
          <div className="space-y-4">
              <div>
                  <h3 className="text-sm font-bold text-zinc-200 mb-1">Instruction (Chỉ thị AI)</h3>
                  <p className="text-xs text-zinc-500 mb-3">Mô tả thay đổi bạn muốn thực hiện trên ảnh.</p>
                  <TextArea 
                      rows={5}
                      placeholder="VD: Chuyển chữ 'từ' thành 'TỪ' viết hoa&#10;VD: Thêm hiệu ứng tuyết rơi&#10;VD: Đổi màu áo sang màu đỏ"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isLoading}
                      className="resize-none !bg-zinc-950 !border-zinc-700 focus:!border-sky-500 text-sm"
                  />
              </div>

              <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase">Gợi ý chỉnh sửa chữ:</label>
                  <div className="flex flex-wrap gap-2">
                      {TEXT_EDIT_PRESETS.map((p, i) => (
                          <button 
                              key={i}
                              onClick={() => setPrompt(p.prompt)}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-[10px] text-zinc-300 transition-colors"
                          >
                              {p.label}
                          </button>
                      ))}
                  </div>
              </div>

              <Button 
                onClick={() => onGenerativeEdit(prompt, quality)} 
                disabled={isLoading || !prompt.trim()}
                className="!py-3 shadow-lg shadow-sky-900/20"
              >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Thực hiện (Generate)
              </Button>
          </div>
      )}

      {/* MODE: BACKGROUND (Photoroom Style) */}
      {mode === 'background' && (
          <div className="space-y-4">
              <div>
                  <h3 className="text-sm font-bold text-zinc-200 mb-1">Studio Phông nền</h3>
                  <p className="text-xs text-zinc-500">Tự động tách nền và ghép vào không gian mới.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                  <button 
                      onClick={() => onGenerativeEdit('Identify the subject, remove background, and place it on a transparent background.', quality)}
                      disabled={isLoading}
                      className="h-20 rounded-lg border border-dashed border-zinc-600 hover:border-sky-500 hover:bg-zinc-800 transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                      <ImageMinus className="w-6 h-6 text-zinc-500 group-hover:text-sky-400" />
                      <span className="text-xs text-zinc-400">Xóa nền</span>
                  </button>
                  {BACKGROUND_PRESETS.map((bg, i) => (
                      <button 
                          key={i}
                          onClick={() => onGenerativeEdit(bg.prompt, quality)}
                          disabled={isLoading}
                          className={`h-20 rounded-lg border border-transparent hover:border-sky-500 transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden group`}
                      >
                          <div className={`absolute inset-0 opacity-20 ${bg.color}`}></div>
                          <span className="relative z-10 text-xs font-bold text-zinc-200 text-center px-1">{bg.label}</span>
                      </button>
                  ))}
              </div>
              
              <div className="pt-2">
                  <label className="text-xs text-zinc-400 mb-1 block">Hoặc mô tả phông nền tùy ý:</label>
                  <div className="flex gap-2">
                      <TextInput 
                          placeholder="VD: Bãi biển hoàng hôn..." 
                          value={prompt}
                          onChange={e => setPrompt(e.target.value)}
                          className="!text-xs !py-2"
                      />
                      <Button onClick={() => onGenerativeEdit(`Place the product on background: ${prompt}`, quality)} disabled={isLoading || !prompt.trim()} className="!w-auto !px-3">
                          <Sparkles className="w-4 h-4"/>
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* MODE: CLEANUP / REMOVE OBJECT */}
      {mode === 'cleanup' && (
          <div className="space-y-4">
              <div>
                  <h3 className="text-sm font-bold text-zinc-200 mb-1">Xóa đối tượng & Watermark</h3>
                  <p className="text-xs text-zinc-500">Loại bỏ các chi tiết thừa khỏi ảnh.</p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                    <label className="text-xs font-medium text-zinc-300 block mb-2">Xóa vật thể cụ thể</label>
                    <div className="flex gap-2">
                        <TextInput 
                            placeholder="VD: cái ghế, người, con mèo..."
                            value={objectToRemove}
                            onChange={(e) => setObjectToRemove(e.target.value)}
                            disabled={isLoading}
                        />
                        <Button 
                            onClick={() => onGenerativeEdit(`Identify and completely remove "${objectToRemove}" from the image. Inpaint the area naturally to match the background.`, quality)} 
                            disabled={isLoading || !objectToRemove.trim()}
                            colorScheme="slate"
                            className="!w-auto !px-3"
                        >
                            Xóa
                        </Button>
                    </div>
                </div>

                <Button 
                    onClick={() => onGenerativeEdit('Detect and remove all watermarks, logos, and text overlays from the image. Inpaint the area to match the surrounding image content seamlessly.', quality)} 
                    disabled={isLoading}
                    colorScheme="ghost"
                    className="w-full border-red-500/30 text-red-300 hover:bg-red-900/20 py-4"
                >
                    <Eraser className="w-5 h-5 mr-2" />
                    Xóa Watermark Tự động
                </Button>
              </div>
          </div>
      )}
    </div>
  );
};

export default AiPanel;
