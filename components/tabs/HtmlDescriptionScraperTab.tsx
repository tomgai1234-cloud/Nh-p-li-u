import React, { useState, useEffect, useRef } from 'react';
import { Globe, Play, Copy, Check, FileCode, AlertCircle, Settings2, LayoutGrid, X, Trash2, StopCircle, Plus, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { usePersistedState } from '../../hooks/usePersistedState';
import { ResultCard } from '../ResultCard';

interface ScrapeResult {
    name: string;
    url: string;
    html: string;
    status: 'loading' | 'success' | 'error';
    error?: string;
}

export default function HtmlDescriptionScraperTab() {
  // Input entries: name + url
  const parseEntries = (query: string): { name: string, url: string }[] => {
      const lines = query.split('\n').filter(l => l.trim());
      if (lines.length === 0) return [{ name: '', url: '' }];
      return lines.map(line => {
        if (line.includes('|')) {
          const parts = line.split('|');
          return { name: parts[0] ? parts[0].trim() : '', url: parts[1] ? parts[1].trim() : '' };
        }
        return { name: '', url: line.trim() };
      });
  };

  const [inputQuery, setInputQuery] = usePersistedState<string>('htmlScraper_inputQuery', '');
  const [entries, setEntries] = useState<{ name: string, url: string }[]>(() => parseEntries(inputQuery));

  useEffect(() => {
      const newEntries = parseEntries(inputQuery);
      if (JSON.stringify(newEntries) !== JSON.stringify(entries)) {
          setEntries(newEntries);
      }
  }, [inputQuery]);

  const updateQueryFromEntries = (newEntries: { name: string, url: string }[]) => {
      const query = newEntries
        .filter(e => e.name.trim() || e.url.trim())
        .map(e => `${e.name.trim()} | ${e.url.trim()}`)
        .join('\n');
      setInputQuery(query);
  };

  const handleEntryChange = (index: number, field: 'name' | 'url', value: string) => {
      const newEntries = [...entries];
      newEntries[index][field] = value;
      setEntries(newEntries);
      updateQueryFromEntries(newEntries);
  };

  
  const handlePaste = (e: React.ClipboardEvent, index: number, field: 'name' | 'url') => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;
    
    // Check if it's multiple lines or tabs
    if (!pasteData.includes('\t') && !pasteData.includes('\n')) {
        return; // Let default paste handle simple text
    }

    e.preventDefault();
    
    const parseExcelPaste = (text: string): string[][] => {
        const result: string[][] = [];
        let row: string[] = [];
        let col = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i+1];
            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    col += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    col += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === '\t') {
                    row.push(col.trim());
                    col = '';
                } else if (char === '\n' || char === '\r') {
                    row.push(col.trim());
                    result.push(row);
                    row = [];
                    col = '';
                    if (char === '\r' && nextChar === '\n') i++;
                } else {
                    col += char;
                }
            }
        }
        if (col || row.length > 0) {
            row.push(col.trim());
            result.push(row);
        }
        return result;
    };

    const parsedRows = parseExcelPaste(pasteData);
    const newEntries = [...entries];
    
    parsedRows.forEach((columns, rowIndex) => {
        if (columns.length === 0 || (columns.length === 1 && columns[0] === '')) return;
        
        const targetIndex = index + rowIndex;
        if (targetIndex >= newEntries.length) {
            newEntries.push({ name: '', url: '' });
        }
        
        if (field === 'name') {
            newEntries[targetIndex].name = columns[0] || newEntries[targetIndex].name;
            if (columns[1]) newEntries[targetIndex].url = columns[1];
        } else if (field === 'url') {
            newEntries[targetIndex].url = columns[0] || newEntries[targetIndex].url;
            if (columns[1]) newEntries[targetIndex].name = columns[1];
        }
    });
    
    setEntries(newEntries);
    updateQueryFromEntries(newEntries);
  };

  const handleAddEntry = () => {
      const newEntries = [...entries, { name: '', url: '' }];
      setEntries(newEntries);
      updateQueryFromEntries(newEntries);
  };

  const handleRemoveEntry = (index: number) => {
      const newEntries = entries.filter((_, i) => i !== index);
      if (newEntries.length === 0) newEntries.push({ name: '', url: '' });
      setEntries(newEntries);
      updateQueryFromEntries(newEntries);
  };

  const handleClearAllEntries = () => {
      setInputQuery('');
      setEntries([{ name: '', url: '' }]);
      setResults([]);
      toast.success('Đã xóa tất cả danh sách và kết quả');
  };

  // Scraper Settings
  const [containerSelector, setContainerSelector] = usePersistedState<string>('htmlScraper_container', '');
  const [clickSelector, setClickSelector] = usePersistedState<string>('htmlScraper_click', '');
  const [waitTime, setWaitTime] = usePersistedState<string>('htmlScraper_wait', '2000');
  
  // HTML Template
  const [htmlTemplate, setHtmlTemplate] = usePersistedState<string>('htmlScraper_template', '[html]');

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isVisualPickerOpen, setIsVisualPickerOpen] = useState(false);
  const [interactMode, setInteractMode] = useState<'pick' | 'navigate'>('pick');
  const pickerIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
      if (isVisualPickerOpen) {
          setInteractMode('pick');
      }
  }, [isVisualPickerOpen]);

  const handleToggleMode = (mode: 'pick' | 'navigate') => {
      setInteractMode(mode);
      pickerIframeRef.current?.contentWindow?.postMessage({ type: 'SET_MODE', mode }, '*');
  };
  const [visualPickerUrl, setVisualPickerUrl] = useState('');
  const [visualPickerTarget, setVisualPickerTarget] = useState<'container' | 'click'>('container');

  useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'PICKER_RESULT' && event.data?.selector) {
              if (visualPickerTarget === 'container') {
                  setContainerSelector(event.data.selector);
              } else if (visualPickerTarget === 'click') {
                  setClickSelector(event.data.selector);
              }
              toast.success(`Đã chọn: ${event.data.selector}. Nhấn nút "Xong" để lưu!`);
          }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
  }, [visualPickerTarget]);

  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setIsLoading(false);
      toast('Đã dừng trích xuất', { icon: '🛑' });
  };

  const handleScrape = async () => {
    const validEntries = entries.filter(e => e.url.trim());
    if (validEntries.length === 0) {
      toast.error('Vui lòng nhập ít nhất 1 URL!');
      return;
    }
    
    setIsLoading(true);
    const initialResults = validEntries.map(e => ({
        name: e.name.trim(),
        url: e.url.trim(),
        html: '',
        status: 'loading' as const
    }));
    setResults(initialResults);

    abortControllerRef.current = new AbortController();

    try {
        for (let i = 0; i < validEntries.length; i++) {
            if (abortControllerRef.current?.signal.aborted) break;
            
            const currentEntry = validEntries[i];
            
            try {
                const res = await fetch('/api/html-description-scraper', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: currentEntry.url, containerSelector, clickSelector, waitTime }),
                    signal: abortControllerRef.current.signal
                });
                
                const data = await res.json();
                
                if (!res.ok) {
                    setResults(prev => prev.map(r => 
                        r.url === currentEntry.url 
                            ? { ...r, status: 'error', error: data.error || 'Lỗi khi cào dữ liệu' }
                            : r
                    ));
                    continue;
                }

                let finalHtml = htmlTemplate;
                // Simple template replacement
                finalHtml = finalHtml.replace(/\[html\]/g, data.result || '');
                finalHtml = finalHtml.replace(/\[tên\]/gi, currentEntry.name);
                finalHtml = finalHtml.replace(/\[tên sản phẩm\]/gi, currentEntry.name);
                finalHtml = finalHtml.replace(/\[url\]/gi, currentEntry.url);

                setResults(prev => prev.map(r => 
                    r.url === currentEntry.url 
                        ? { ...r, status: 'success', html: finalHtml }
                        : r
                ));
            } catch (e: any) {
                if (e.name === 'AbortError') throw e;
                setResults(prev => prev.map(r => 
                    r.url === currentEntry.url 
                        ? { ...r, status: 'error', error: e.message }
                        : r
                ));
            }
        }
    } catch (e: any) {
        if (e.name !== 'AbortError') {
            toast.error(e.message);
        }
    } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
    }
  };

  const removeResult = (index: number) => {
      setResults(prev => prev.filter((_, i) => i !== index));
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success('Đã copy!');
  };


  const exportToExcel = () => {
      const successResults = results.filter(r => r.status === 'success');
      if (successResults.length === 0) {
          toast.error('Không có dữ liệu thành công để xuất!');
          return;
      }
      
      const dataToExport = successResults.map(r => ({
          'Tên sản phẩm': r.name,
          'Link tham khảo': r.url,
          'HTML Result': r.html
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "HTML_Data");
      
      XLSX.writeFile(workbook, "Danh_Sach_Mo_Ta.xlsx");
      toast.success('Đã xuất file Excel!');
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 space-y-6 animate-fade-in text-zinc-200">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
        <div className="w-12 h-12 bg-sky-500/20 text-sky-400 flex items-center justify-center rounded-xl shadow-inner border border-sky-500/30">
          <FileCode className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Đào Mô Tả (HTML)</h2>
          <p className="text-sm text-zinc-400">Tự động lấy HTML của phần mô tả từ nhiều trang, mở "View More" nếu cần.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-0">
        
        {/* Left Column - Config */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
            
            <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-300 flex justify-between items-center">
                    <span>Danh sách URL & Tên sản phẩm</span>
                    {entries.length > 0 && (entries.length > 1 || entries[0].name !== '' || entries[0].url !== '') && (
                        <button 
                            onClick={handleClearAllEntries}
                            className="text-[10px] text-red-400 hover:bg-red-900/30 px-2 py-1 rounded transition-colors flex items-center gap-1"
                        >
                            <Trash2 className="w-3 h-3" /> Xóa hết
                        </button>
                    )}
                </label>
                <div className="overflow-x-auto relative shadow-inner rounded-lg border border-zinc-700 bg-zinc-950/50 max-h-[300px]">
                    <table className="w-full text-sm text-left text-zinc-300">
                        <thead className="text-xs text-sky-300 uppercase bg-zinc-800/80 backdrop-blur sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="px-3 py-2 w-10 text-center">#</th>
                                <th className="px-3 py-2">Tên sản phẩm</th>
                                <th className="px-3 py-2">Link tham khảo (URL)</th>
                                <th className="px-3 py-2 w-10 text-center">
                                    <button onClick={handleAddEntry} className="text-sky-400 hover:text-sky-300"><Plus className="w-4 h-4" /></button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, index) => (
                                <tr key={index} className="border-b border-zinc-700/50 hover:bg-zinc-800/50">
                                    <td className="px-3 py-2 text-center text-zinc-500 font-mono">{index + 1}</td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="text"
                                            value={entry.name}
                                            onChange={(e) => handleEntryChange(index, 'name', e.target.value)}
                                            onPaste={(e) => handlePaste(e, index, 'name')}
                                            className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-sky-500 rounded px-2 py-1"
                                            placeholder="Nhập tên..."
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="text"
                                            value={entry.url}
                                            onChange={(e) => handleEntryChange(index, 'url', e.target.value)}
                                            onPaste={(e) => handlePaste(e, index, 'url')}
                                            className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-sky-500 rounded px-2 py-1 font-mono text-xs text-sky-400"
                                            placeholder="https://..."
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button onClick={() => handleRemoveEntry(index)} className="text-zinc-500 hover:text-red-400">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                <label className="text-sm font-semibold text-zinc-300 flex justify-between uppercase tracking-wider mb-2">
                    <span>Quy tắc bổ sung HTML (Template)</span>
                </label>
                <p className="text-xs text-zinc-400 mb-2">
                    Sử dụng biến: <code className="text-sky-400 bg-sky-900/30 px-1 rounded">[html]</code> (nội dung cào được), <code className="text-sky-400 bg-sky-900/30 px-1 rounded">[tên]</code> hoặc <code className="text-sky-400 bg-sky-900/30 px-1 rounded">[tên sản phẩm]</code> (tên sản phẩm đã nhập).
                </p>
                <textarea
                    value={htmlTemplate}
                    onChange={(e) => setHtmlTemplate(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-mono"
                    placeholder="<h3>Giới thiệu [tên]</h3>\n\n[html]"
                />
            </div>
            
            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                <button 
                    onClick={() => setShowAdvanced(!showAdvanced)} 
                    className="flex items-center gap-2 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                >
                    <Settings2 className="w-3.5 h-3.5" />
                    {showAdvanced ? 'Ẩn cài đặt Selector & Timeout' : 'Hiện cài đặt Selector & Timeout'}
                </button>
            </div>
            
            {showAdvanced && (
                <div className="space-y-4 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800 animate-fade-in">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 flex justify-between uppercase tracking-wider">
                            <span>CSS Selector Vùng HTML</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={containerSelector}
                                onChange={(e) => setContainerSelector(e.target.value)}
                                placeholder="Để trống hệ thống sẽ tự tìm (vd: .product-desc)"
                                className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-4 py-2 outline-none focus:ring-1 focus:ring-sky-500 transition-all"
                            />
                            <button
                                onClick={() => {
                                    const firstUrl = entries.find(e => e.url.trim())?.url;
                                    if(firstUrl) {
                                        setVisualPickerTarget('container');
                                        setVisualPickerUrl(firstUrl);
                                        setIsVisualPickerOpen(true);
                                    } else {
                                        toast.error("Vui lòng nhập ít nhất 1 URL trước khi chọn vùng");
                                    }
                                }}
                                className="bg-zinc-800 hover:bg-sky-600 text-zinc-300 hover:text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-zinc-700 hover:border-sky-500 text-xs shadow-sm whitespace-nowrap"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Chọn trên web
                            </button>
                        </div>
                    </div>
                    
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 flex justify-between uppercase tracking-wider">
                            <span>CSS Selector Nút View More</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={clickSelector}
                                onChange={(e) => setClickSelector(e.target.value)}
                                placeholder="Mặc định: Tự tìm nút Xem thêm (vd: #show-more)"
                                className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-4 py-2 outline-none focus:ring-1 focus:ring-sky-500 transition-all"
                            />
                            <button
                                onClick={() => {
                                    const firstUrl = entries.find(e => e.url.trim())?.url;
                                    if(firstUrl) {
                                        setVisualPickerTarget('click');
                                        setVisualPickerUrl(firstUrl);
                                        setIsVisualPickerOpen(true);
                                    } else {
                                        toast.error("Vui lòng nhập ít nhất 1 URL trước khi chọn vùng");
                                    }
                                }}
                                className="bg-zinc-800 hover:bg-sky-600 text-zinc-300 hover:text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-zinc-700 hover:border-sky-500 text-xs shadow-sm whitespace-nowrap"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Chọn trên web
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-400 flex justify-between">
                            <span>Thời gian chờ tải trang (ms)</span>
                        </label>
                        <input
                            type="number"
                            value={waitTime}
                            onChange={(e) => setWaitTime(e.target.value)}
                            placeholder="2000"
                            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-md px-3 py-2 outline-none focus:border-sky-500"
                        />
                    </div>
                </div>
            )}
            
            <div className="mt-auto pt-4 flex gap-4">
                {isLoading ? (
                    <button onClick={handleStop} className="flex-1 bg-red-900/50 hover:bg-red-900/70 border border-red-700 text-red-200 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-900/20">
                        <StopCircle className="w-5 h-5" />
                        Dừng lại
                    </button>
                ) : (
                    <button
                        onClick={handleScrape}
                        disabled={isLoading || entries.filter(e => e.url.trim()).length === 0}
                        className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-sky-900/20"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        Bắt đầu Đào HTML
                    </button>
                )}
            </div>
        </div>
        
        {/* Right Column - Results (Table mode) */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 flex flex-col overflow-hidden relative">
            <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-sky-400" /> Kết quả HTML
                </h3>
                {results.some(r => r.status === 'success') && (
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-xs font-medium text-green-400 transition-colors"
                        title="Xuất ra file Excel (.xlsx)"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Xuất Excel
                    </button>
                )}
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 relative">
                {results.length === 0 && !isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                        <FileCode className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">Kết quả sẽ hiển thị tại đây</p>
                    </div>
                )}
                
                {results.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {results.map((result, index) => (
                            <div key={index} className="relative group">
                                <ResultCard
                                    productName={result.name || result.url || 'Kết quả ' + (index + 1)}
                                    descriptionText={result.html ? result.html.replace(/<[^>]*>?/gm, '') : ''}
                                    descriptionHtml={result.html}
                                    sources={[{ uri: result.url || '', title: result.name || result.url || '' }]}
                                    status={result.status}
                                    error={result.error}
                                    totalResultsCount={results.length}
                                />
                                <button
                                     onClick={() => removeResult(index)}
                                     className="absolute top-4 right-4 z-10 text-zinc-500 hover:text-red-400 p-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100 backdrop-blur-sm shadow-sm"
                                     title="Xóa dòng này"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>
      
        <AnimatePresence>
            {isVisualPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsVisualPickerOpen(false)}>
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-zinc-900 w-[95vw] h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                                    <LayoutGrid className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">
                                    {visualPickerTarget === 'container' ? 'Chọn vùng HTML (Container)' : 'Chọn nút bấm (Click Selector)'}
                                    </h3>
                                    <p className="text-[10px] text-zinc-400">Click vào phần tử trên trang web để lấy CSS Selector</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-700">
                                    <button
                                        onClick={() => handleToggleMode('navigate')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${interactMode === 'navigate' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                                        title="Click duyệt trang, đổi ảnh, click qua nút/popup thoải mái trước khi chọn"
                                    >
                                        🔍 Duyệt trang
                                    </button>
                                    <button
                                        onClick={() => handleToggleMode('pick')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${interactMode === 'pick' ? 'bg-sky-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                                        title="Bật di chuột chọn phần tử"
                                    >
                                        🎯 Chọn phần tử
                                    </button>
                                </div>
                                {(visualPickerTarget === 'container' ? containerSelector : clickSelector) && (
                                    <div className="flex items-center bg-zinc-800 rounded-lg px-3 py-1.5 border border-zinc-700">
                                        <span className="text-xs text-zinc-400 mr-2">Đã chọn:</span>
                                        <code className="text-xs max-w-sm truncate" title={visualPickerTarget === 'container' ? containerSelector : clickSelector}>{visualPickerTarget === 'container' ? containerSelector : clickSelector}</code>
                                        <button 
                                            onClick={() => setIsVisualPickerOpen(false)}
                                            className="ml-2 bg-sky-600 hover:bg-sky-500 text-white text-xs px-2 py-1 rounded"
                                        >
                                            Xong
                                        </button>
                                    </div>
                                )}
                                <button onClick={() => setIsVisualPickerOpen(false)} className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-700 transition-colors">
                                    <X className="w-6 h-6"/>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-white relative">
                            <iframe 
                                ref={pickerIframeRef}
                                src={`/api/proxy-visual?url=${encodeURIComponent(visualPickerUrl)}`}
                                className="w-full h-full border-0"
                                title="Visual Scraper Picker"
                                sandbox="allow-scripts allow-same-origin allow-forms"
                                onLoad={(e) => {
                                    // Tell the iframe to start the picker
                                    (e.target as HTMLIFrameElement).contentWindow?.postMessage({ type: 'START_PICKER' }, '*');
                                    (e.target as HTMLIFrameElement).contentWindow?.postMessage({ type: 'SET_MODE', mode: interactMode }, '*');
                                }}
                            />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
  );
}
