import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, FileImage, Settings, Play, Loader2, DownloadCloud, AlertCircle, Copy, CheckCircle, Plus, Trash2, Database, X } from 'lucide-react';
import Markdown from 'react-markdown';
import Button from '../Button';
import { createAndPushToGoogleSheet } from '../../utils/googleSheets';

interface ExtractionField {
  id: string;
  name: string;
  description: string;
}

export default function DocumentExtractorTab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState('Trích xuất dạng bảng hoặc JSON bao gồm các thông tin chính yếu (Tên, Số tiền, Thời gian, Mặt hàng...).');
  const [model, setModel] = useState('gemini-3.8-flash');
  
  const [fields, setFields] = useState<ExtractionField[]>([
    { id: '1', name: 'Mã hóa đơn/ID', description: 'Mã số định danh của tài liệu' },
    { id: '2', name: 'Tổng tiền', description: 'Tổng số tiền hoặc giá trị cuối cùng' },
    { id: '3', name: 'Chữ ký/Xác nhận', description: 'Kiểm tra xem có chữ ký hay đóng dấu không' },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPushingSheet, setIsPushingSheet] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const extractJsonFromMarkdown = (text: string): any[] | null => {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = match ? match[1] : text;
      
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed !== null) {
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
      const link = await createAndPushToGoogleSheet(`OCR_Sync_${new Date().getTime()}`, dataToPush, token);
      setSheetUrl(link);
    } catch (err: any) {
      setError(err.message || 'Lỗi đồng bộ dữ liệu vào Google Sheets.');
    } finally {
      setIsPushingSheet(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.type.match('image.*') && file.type !== 'application/pdf') {
      setError('Chỉ hỗ trợ file ảnh (JPG, PNG) và PDF.');
      return;
    }
    setError(null);
    setSelectedFile(file);
    if (file.type.match('image.*')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null); // PDF preview can be handled differently
    }
    setResult(null);
  };

  const addField = () => {
    setFields([...fields, { id: Date.now().toString(), name: '', description: '' }]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, key: keyof ExtractionField, value: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const startExtraction = async () => {
    if (!selectedFile) {
      setError('Vui lòng chọn hoặc tải lên một file tài liệu.');
      return;
    }
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
            const base64Data = (e.target?.result as string).split(',')[1];
            
            // Build dynamic prompt based on fields definition
            const fieldReqs = fields.map(f => `- ${f.name}: ${f.description}`).join('\n');
            const fullPrompt = `${prompt}\n\nYêu cầu cấu trúc dữ liệu trích xuất (Ưu tiên JSON):\n${fieldReqs}`;
            
            // Note: Currently mimicking the gemini api call directly or via a mock since server implementation 
            // for raw file processing per endpoint is needed. For now, proxying a prompt.
            // In a real app we'd post to /api/document-ocr
            
            // Simulate API request to backend (this needs to be configured in server.ts if really processing)
            const response = await fetch('/api/document-ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  base64Data: base64Data,
                  mimeType: selectedFile.type,
                  prompt: fullPrompt,
                  model: model
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Server error during extraction.');
            }

            const data = await response.json();
            
            setResult(data.result);
            setIsLoading(false);
        } catch (err: any) {
             setError(err.message);
             setIsLoading(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (err: any) {
      setError(err.message);
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

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-8 text-slate-300">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-1">
          <div>
              <h2 className="text-2xl font-bold text-emerald-400 flex items-center gap-3">
                  <FileText className="w-8 h-8" />
                  Document OCR & Rút Trích Dữ Liệu
              </h2>
              <p className="text-zinc-400 text-sm mt-1">Tải lên hóa đơn, PDF hoặc ảnh để trích xuất dữ liệu có cấu trúc tự động (JSON, Số liệu).</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Config & Input */}
          <div className="lg:col-span-4 space-y-6 sticky top-6">
              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700 shadow-xl">
                 
                 <div className="space-y-5">
                    {/* File Upload Box */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Tài liệu đầu vào</label>
                        <div 
                            className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                                isDragging ? 'border-sky-500 bg-sky-500/5' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={handleFileChange}
                                accept="image/jpeg,image/png,application/pdf"
                            />
                            {selectedFile ? (
                                <div className="flex flex-col items-center gap-3">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Preview" className="h-20 w-auto max-w-full object-contain rounded-lg border border-zinc-700 shadow-md" />
                                    ) : (
                                        <FileText className="w-10 h-10 text-sky-400" />
                                    )}
                                    <div className="text-center w-full min-w-0">
                                        <p className="text-emerald-400 font-bold truncate text-sm">{selectedFile.name}</p>
                                        <p className="text-zinc-500 text-xs">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    <Button colorScheme="zinc" variant="outline" className="!w-full !py-1.5 !text-xs mt-1" onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFile(null);
                                        setPreviewUrl(null);
                                        setResult(null);
                                    }}>
                                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Gỡ tài liệu
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-2">
                                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                                        <UploadCloud className="w-5 h-5 text-zinc-400" />
                                    </div>
                                    <p className="text-zinc-300 font-medium text-sm">Chạm hoặc Kéo PDF/Ảnh vào đây</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI Model */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Model AI Xử Lý</label>
                        <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                        >
                          <option value="gemini-3.8-flash">Default (Gemini 3.8 Flash)</option>
                          <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                          <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                          <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                          <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                          <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                        </select>
                    </div>

                    {/* Prompt Instruction */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Chỉ dẫn (Prompt)</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500/50 resize-none h-20"
                            placeholder="Chỉ dẫn lấy dữ liệu..."
                        />
                    </div>

                    {/* Fields Definitions */}
                    <div>
                         <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Khai báo cấu trúc JSON</label>
                            <button onClick={addField} className="text-emerald-400 hover:text-emerald-300 p-1 bg-emerald-500/10 rounded-md">
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                         </div>
                         <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                             {fields.map((field) => (
                                <div key={field.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 relative group">
                                    <button onClick={() => removeField(field.id)} className="absolute top-2.5 right-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                        type="text"
                                        value={field.name}
                                        onChange={(e) => updateField(field.id, 'name', e.target.value)}
                                        placeholder="Tên trường (VD: name)"
                                        className="w-[90%] bg-transparent text-sm font-semibold text-zinc-200 mb-1 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={field.description}
                                        onChange={(e) => updateField(field.id, 'description', e.target.value)}
                                        placeholder="Kiểu dữ liệu và mô tả..."
                                        className="w-[90%] bg-transparent text-xs text-zinc-500 focus:outline-none"
                                    />
                                </div>
                             ))}
                         </div>
                    </div>

                    <Button 
                        onClick={startExtraction}
                        disabled={isLoading || !selectedFile}
                        colorScheme="emerald"
                        className="w-full shadow-lg shadow-emerald-500/20"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2 fill-current" />}
                        {isLoading ? 'Đang đọc tài liệu...' : 'Bắt đầu Trích xuất'}
                    </Button>
                 </div>
              </div>
          </div>

          {/* Right Column: Execution View */}
          <div className="lg:col-span-8">
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-2xl p-6 min-h-[550px] flex flex-col">
                 
                {error && (
                  <div className="mb-6 p-4 bg-red-900/20 border border-red-800/50 rounded-xl text-red-300 text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                    <div className="flex-1">
                       <p className="font-bold mb-1">Lỗi thực thi</p>
                       <p className="font-mono text-xs text-red-400/80">{error}</p>
                    </div>
                  </div>
                )}

                {isLoading && !error && !result && (
                  <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
                      <div className="relative mb-6">
                        <div className="w-16 h-16 border-4 border-zinc-800 rounded-full"></div>
                        <div className="absolute inset-0 border-t-4 border-emerald-500 rounded-full animate-spin"></div>
                        <FileImage className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400" />
                      </div>
                      <p className="text-sm font-bold text-zinc-300 mb-1">AI đang dùng Vision Core để đọc tài liệu...</p>
                      <p className="text-xs text-zinc-500">Tiến trình có thể mất vài giây tuỳ thuôc vào số lượng trang báo cáo.</p>
                  </div>
                )}

                {!isLoading && result && (
                  <div className="flex-1 flex flex-col min-h-0 bg-zinc-950/80 border border-zinc-700/80 rounded-xl overflow-hidden shadow-inner">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-700">
                      <div className="flex items-center gap-2">
                         <Database className="w-4 h-4 text-emerald-400" />
                         <span className="font-bold text-sm text-emerald-100">KẾT QUẢ ĐẦU RA</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={pushToSheets}
                            disabled={isPushingSheet}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isPushingSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                            Đồng bộ Google Sheets
                        </button>
                        <button
                            onClick={copyResult}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                isCopied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 hover:bg-zinc-700 text-sky-400'
                            }`}
                        >
                            {isCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? 'Đã chép' : 'Sao chép RAW'}
                        </button>
                      </div>
                    </div>
                    {sheetUrl && (
                        <div className="bg-emerald-900/20 border-b border-emerald-800/50 px-4 py-2.5 flex items-center justify-between text-xs text-emerald-300">
                           <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Đã tạo bảng Sheet thành công.</div>
                           <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-white hover:underline bg-emerald-600 px-2.5 py-1 rounded">Mở trang tính</a>
                        </div>
                    )}
                    <div className="flex-1 p-5 overflow-auto custom-scrollbar">
                       <div className="prose prose-invert prose-sm max-w-none markdown-body prose-emerald font-mono">
                          <Markdown>{result}</Markdown>
                       </div>
                    </div>
                  </div>
                )}

                {!isLoading && !error && !result && (
                   <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                     <FileText className="w-16 h-16 text-zinc-700 mb-4" />
                     <h3 className="text-lg font-bold text-zinc-400 mb-2">Chưa có kết quả</h3>
                     <p className="text-zinc-500 max-w-sm text-sm">Upload file và cấu hình thông tin định dạng JSON mục tiêu ở cột bên trái để bắt đầu trích xuất tài liệu!</p>
                   </div>
                )}

              </div>
          </div>
      </div>
    </div>
  );
}
