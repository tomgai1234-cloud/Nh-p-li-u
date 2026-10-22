import React, { useState } from 'react';
import { Globe, Settings, Terminal, Play, Loader2, Maximize2, AlertCircle, Copy, CheckCircle, Database } from 'lucide-react';
import Markdown from 'react-markdown';
import { createAndPushToGoogleSheet } from '../../utils/googleSheets';

export default function WebTarsScraperTab() {
  const [url, setUrl] = useState('');
  const [prompt, setPrompt] = useState('Hãy phân tích giao diện và trích xuất dữ liệu của toàn bộ sản phẩm/nội dung trên trang (Tên, Giá, Link ảnh, v.v) thành dạng bảng hoặc JSON.');
  const [waitTime, setWaitTime] = useState('3000');
  const [model, setModel] = useState('gemini-3.8-flash');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPushingSheet, setIsPushingSheet] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  const startScraping = async () => {
    if (!url.trim()) {
      setError('Vui lòng nhập URL hợp lệ.');
      return;
    }
    setError(null);
    setResult(null);
    setSheetUrl(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/web-vision-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          prompt,
          waitTime: parseInt(waitTime) || 0,
          model
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Server error occurred while scraping');
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const extractJsonFromMarkdown = (text: string): any[] | null => {
    try {
      // Find content between ```json and ```
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = match ? match[1] : text;
      
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed !== null) {
        // Try to find an array property
        const arrays = Object.values(parsed).filter(v => Array.isArray(v));
        if (arrays.length > 0) return arrays[0] as any[];
        return [parsed];
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const pushToSheets = async () => {
    if (!result) return;
    const dataToPush = extractJsonFromMarkdown(result);
    if (!dataToPush || dataToPush.length === 0) {
       setError("Không tìm thấy dữ liệu JSON hợp lệ trong kết quả để đồng bộ lên Sheets.");
       return;
    }

    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
       setError("Chưa đăng nhập với Google Workspace. Vui lòng đăng nhập lại ở Dashboard để cấp quyền Google Drive & Sheets.");
       return;
    }

    setIsPushingSheet(true);
    setError(null);
    try {
      const link = await createAndPushToGoogleSheet(`TARS_Sync_${new Date().getTime()}`, dataToPush, token);
      setSheetUrl(link);
    } catch (err: any) {
      setError(err.message || 'Lỗi đồng bộ dữ liệu vào Google Sheets.');
    } finally {
      setIsPushingSheet(false);
    }
  };


  return (
    <div className="flex h-full min-h-[600px] border border-zinc-800/50 rounded-2xl overflow-hidden bg-zinc-950 text-slate-300">
      {/* Side Config Panel */}
      <div className="w-80 border-r border-zinc-800 bg-zinc-900/50 p-6 flex flex-col gap-6 overflow-y-auto hidden md:flex">
        <div className="flex items-center gap-3 text-sky-400">
          <div className="p-2 bg-sky-500/10 rounded-lg">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100">Web TARS Scraper</h2>
            <p className="text-[10px] text-zinc-500 font-medium">Headless Crawler + Vision AI</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2">Model Xử Lý</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-sky-500/50 font-medium"
            >
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Tối ưu nhất)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Siêu tốc)</option>
            </select>
            <p className="mt-1.5 text-[10px] text-zinc-500 leading-tight">Mặc định sử dụng Gemini 3.8 Flash để tối ưu chất lượng trích xuất và độ ổn định.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2">Độ delay chờ trang tải (ms)</label>
            <input
              type="number"
              value={waitTime}
              onChange={(e) => setWaitTime(e.target.value)}
              step="1000"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-sky-500/50"
              placeholder="Ví dụ: 3000"
            />
            <p className="mt-1.5 text-[10px] text-zinc-500 leading-tight">Tăng độ trễ nếu web tải quá nhiều Dynamic components (React/Vue/Angular).</p>
          </div>
          
          <div className="pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-amber-400/80 mb-3 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <p className="text-[10px] sm:text-xs">
                 Browser mô phỏng chạy ngầm dưới nền tảng Node.js có thể bypass nhiều Bot Protection thông thường nhờ Headless Chrome.
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Execution View */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/50">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/30">
          <div className="max-w-4xl mx-auto space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">Target URL</label>
              <div className="flex gap-3">
                <div className="form-control flex-1 flex items-center bg-zinc-900 border border-zinc-700/50 rounded-xl overflow-hidden shadow-inner focus-within:border-sky-500/50 focus-within:ring-1 focus-within:ring-sky-500/50 transition-all">
                  <span className="pl-4 text-zinc-500"><Globe className="w-4 h-4" /></span>
                  <input 
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/products"
                    className="flex-1 bg-transparent px-3 py-3 text-sm text-slate-200 focus:outline-none placeholder:text-zinc-600 font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && startScraping()}
                  />
                </div>
                <button
                  onClick={startScraping}
                  disabled={isLoading || !url}
                  className="flex items-center gap-2 px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:hover:bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 transition-all whitespace-nowrap"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {isLoading ? 'Đang cào...' : 'Execute TARS'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">GenAI Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/50 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:border-sky-500/50 min-h-[80px] resize-y placeholder:text-zinc-600"
                placeholder="Chỉ dẫn AI khai thác dữ liệu từ hình ảnh screenshot trang web..."
              />
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div className="flex-1">
                   <p className="font-bold mb-1">Lỗi thực thi</p>
                   <p className="font-mono text-xs">{error}</p>
                </div>
              </div>
            )}

            {isLoading && !error && !result && (
              <div className="w-full h-48 flex items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/10">
                <div className="flex flex-col items-center gap-3 text-zinc-500">
                  <div className="relative">
                    <div className="absolute inset-0 border-t-2 border-sky-500 rounded-full animate-spin"></div>
                    <div className="w-12 h-12 border-2 border-zinc-800 rounded-full"></div>
                    <Globe className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-400 animate-pulse" />
                  </div>
                  <p className="text-sm font-medium animate-pulse">Running Headless Chrome & Extracting Vision Data...</p>
                </div>
              </div>
            )}

            {!isLoading && result && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-full min-h-[400px]">
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Terminal className="w-4 h-4" />
                    <span className="text-xs font-bold font-mono">VISION_EXTRACTED_DATA</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <button
                        onClick={pushToSheets}
                        disabled={isPushingSheet}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                     >
                        {isPushingSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                        Push to Sheets
                     </button>
                    <button
                      onClick={copyResult}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                      title="Sao chép kết quả"
                    >
                      {isCopied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {sheetUrl && (
                    <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-400">
                       <span>Đã đồng bộ lên Google Sheets thành công!</span>
                       <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">Mở Bảng</a>
                    </div>
                )}
                <div className="flex-1 p-5 overflow-auto relative">
                   <div className="prose prose-invert prose-sm max-w-none markdown-body">
                      <Markdown>{result}</Markdown>
                   </div>
                </div>
              </div>
            )}

            {!isLoading && !error && !result && (
               <div className="w-full text-center py-20 text-zinc-500">
                 <Maximize2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                 <p className="text-sm font-medium">Nhập URL và bấm Execute để bắt đầu phân tích Vision AI</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
