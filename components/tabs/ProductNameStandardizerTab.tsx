
import React, { useState, useEffect, useRef } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import TextArea from '../TextArea';
import Button from '../Button';
import Spinner from '../Spinner';
import { Tag, Copy, Download, FileSpreadsheet, StopCircle, Layers, Wand2, ChevronDown, ChevronUp, History, ListChecks, Sparkles } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../src/firebase';
import { standardizeProductNames, categorizeProducts, suggestStandardizationRules, generateSeoProductNames } from '../../services/geminiService';
import { exportStandardizedNamesToCSV, exportStandardizedNamesToXLSX } from '../../utils/exportUtils';
import type { StandardizedNameResult } from '../../types';
import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';
import ExcelRemoveAccents from '../ExcelRemoveAccents';

const DEFAULT_RULES = `- **Cấu trúc chuẩn SEO:** [Loại sản phẩm] + [Thương hiệu] + [Tên dòng/Model] + [Mã sản phẩm] + [Màu sắc (nếu có thông tin)]
- **Từ khóa:** Đưa các từ khóa quan trọng (loại sản phẩm, thương hiệu) lên đầu tiêu đề.
- **Viết hoa:** Viết hoa chữ cái đầu mỗi từ quan trọng (Title Case). Không dùng toàn bộ chữ in hoa.
- **Mã sản phẩm:** Giữ nguyên các mã sản phẩm, model, SKU (ví dụ: APS204AS0E, iPhone 15 Pro Max) không được thay đổi định dạng hoặc viết thường.
- **Độ dài:** Tối ưu trong khoảng 70-100 ký tự (Google Shopping hiển thị tốt nhất).
- **Nội dung:** Không chứa ký tự đặc biệt, emoji, hoặc từ quảng cáo (Rẻ nhất, Freeship, Hot).
- **Đơn vị:** Sử dụng đơn vị đo lường chuẩn (ml, g, kg, cm, m).`;

const DEFAULT_SEO_RULES = `- **Cấu trúc Tên SEO Quảng cáo:** [Từ khóa HOT / Thương hiệu] + [Tên sản phẩm chính] + [Dung tích / Kích thước / Đặc tính nổi bật] + [Mã SP / Dòng sản phẩm]
- **Tối ưu Từ khóa:** Đặt các từ khóa tìm kiếm có lượng truy cập cao lên đầu tiêu đề để tăng tỉ lệ nhấp (CTR).
- **Viết hoa:** Viết hoa chữ cái đầu các từ chính (Title Case).
- **Độ dài lý tưởng:** Trong khoảng 60 - 90 ký tự (chuẩn hiển thị tối ưu cho Google Ads, Google Shopping, Shopee Ads, TikTok Shop).
- **Mã & Thông số:** Giữ nguyên chính xác các thông số kỹ thuật, dung tích, mã model (ví dụ: 100ml, 50g, Pro Max, 2024).
- **Tính thu hút:** Giọng văn hấp dẫn, chuyên nghiệp, tuân thủ chính sách quảng cáo của Google và các sàn thương mại điện tử.`;

const ProductNameStandardizerTab: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<'standardize' | 'seo' | 'excel-accents' | 'history'>('standardize');
    const [input, setInput] = usePersistedState<string>('standardizer_input', '');
    const [rules, setRules] = usePersistedState<string>('standardizer_rules', DEFAULT_RULES);
    const [results, setResults] = usePersistedState<StandardizedNameResult[]>('standardizer_results', []);

    // SEO Sub-tab State
    const [seoInput, setSeoInput] = usePersistedState<string>('seo_title_input', '');
    const [seoRules, setSeoRules] = usePersistedState<string>('seo_title_rules', DEFAULT_SEO_RULES);
    const [seoResults, setSeoResults] = usePersistedState<StandardizedNameResult[]>('seo_title_results', []);
    const [seoModel, setSeoModel] = usePersistedState<string>('seo_model', 'gemini-3.8-flash');
    const [showSeoRules, setShowSeoRules] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState<{total: number, current: number} | null>(null);
    const [isSuggestingRules, setIsSuggestingRules] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const stopSignal = useRef<boolean>(false);

    // History state
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        if (activeSubTab === 'history') {
            setIsLoadingHistory(true);
            const loadData = async () => {
                try {
                    let results = await listHistory(STORE_NAMES.NAME_STANDARDIZATIONS, 50);
                    if (auth.currentUser?.email !== 'tungnguyen.0612993@gmail.com') {
                        results = results.filter((item: any) => item.uid === auth.currentUser?.uid);
                    }
                    setHistoryList(results);
                } catch (err) {
                    console.error("Error loading history:", err);
                } finally {
                    setIsLoadingHistory(false);
                }
            };
            
            loadData();
            const unsubscribe = subscribeToStore(STORE_NAMES.NAME_STANDARDIZATIONS, loadData);
            return () => unsubscribe();
        }
    }, [activeSubTab, auth.currentUser]);

    const handleStop = () => {
        stopSignal.current = true;
    };

    const handleStandardize = async () => {
        const namesToProcess = input.split('\n').map(p => p.trim()).filter(Boolean);

        if (namesToProcess.length === 0) {
            setError('Vui lòng nhập ít nhất một tên sản phẩm.');
            return;
        }

        setIsLoading(true);
        setError(null);
        stopSignal.current = false;
        setProgress({ total: namesToProcess.length, current: 0 });
        
        const initialResults: StandardizedNameResult[] = namesToProcess.map(name => ({
            original: name,
            standardized: '',
            status: 'loading'
        }));
        setResults(initialResults);

        try {
            const BATCH_SIZE = 50;
            let allProcessedResults: {original: string, standardized: string}[] = [];

            for (let i = 0; i < namesToProcess.length; i += BATCH_SIZE) {
                if (stopSignal.current) break;

                const batch = namesToProcess.slice(i, i + BATCH_SIZE);
                const batchResults = await standardizeProductNames(batch, rules);
                allProcessedResults = [...allProcessedResults, ...batchResults];
                
                setProgress(p => p ? { ...p, current: Math.min(p.total, p.current + BATCH_SIZE) } : null);
                
                const processedMap = new Map(allProcessedResults.map(r => [r.original, r.standardized]));
                setResults(current => current.map(res => {
                    if (processedMap.has(res.original)) {
                        return { ...res, standardized: processedMap.get(res.original)!, status: 'success' };
                    }
                    return res;
                }));
            }
            
            const finalMap = new Map(allProcessedResults.map(r => [r.original, r.standardized]));
             setResults(current => current.map(res => {
                if (finalMap.has(res.original)) {
                    return { ...res, standardized: finalMap.get(res.original)!, status: 'success' };
                }
                if (res.status === 'loading') {
                    return { ...res, status: 'error', error: 'AI không trả về kết quả cho mục này.' };
                }
                return res;
            }));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
            setError(message);
            // Mark all loading items as error
            setResults(current => current.map(res => 
                res.status === 'loading' ? { ...res, status: 'error', error: message } : res
            ));
        } finally {
            setIsLoading(false);
            setProgress(null);
            
            // Check if we have results to save
            const successfulCount = results.filter(r => r.status === 'success' || r.standardized !== '').length;
            if (auth.currentUser && successfulCount > 0) {
                try {
                    await addHistory(STORE_NAMES.NAME_STANDARDIZATIONS, {
                        uid: auth.currentUser.uid,
                        userEmail: auth.currentUser.email || 'N/A',
                        actionType: 'Chuẩn hóa tên',
                        details: {
                            productCount: namesToProcess.length,
                            successCount: successfulCount,
                            hasCategories: false
                        },
                        status: 'success',
                        createdAt: Date.now()
                    });
                } catch (err) {
                    console.error("Failed to save history", err);
                }
            }
        }
    };

    const handleCategorize = async () => {
        const namesToCategorize = results
            .filter(r => r.status === 'success')
            .map(r => r.standardized);

        if (namesToCategorize.length === 0) {
            setError('Vui lòng chuẩn hóa tên sản phẩm trước khi phân loại.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setProgress({ total: namesToCategorize.length, current: 0 });
        
        try {
            const BATCH_SIZE = 50;
            for (let i = 0; i < namesToCategorize.length; i += BATCH_SIZE) {
                if (stopSignal.current) break;
                const batch = namesToCategorize.slice(i, i + BATCH_SIZE);
                const batchCategories = await categorizeProducts(batch);
                
                setProgress(p => p ? { ...p, current: Math.min(p.total, p.current + BATCH_SIZE) } : null);
                
                const categoryMap = new Map(batchCategories.map(c => [c.original, c.category]));
                
                setResults(current => current.map(res => {
                    if (categoryMap.has(res.standardized)) {
                        return { ...res, category: categoryMap.get(res.standardized) };
                    }
                    return res;
                }));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi phân loại sản phẩm.');
        } finally {
            setIsLoading(false);
            setProgress(null);

            if (auth.currentUser && namesToCategorize.length > 0) {
                try {
                    await addHistory(STORE_NAMES.NAME_STANDARDIZATIONS, {
                        uid: auth.currentUser.uid,
                        userEmail: auth.currentUser.email || 'N/A',
                        actionType: 'Phân loại',
                        details: {
                            productCount: namesToCategorize.length,
                            successCount: namesToCategorize.length,
                            hasCategories: true
                        },
                        status: 'success',
                        createdAt: Date.now()
                    });
                } catch (err) {
                    console.error("Failed to save history", err);
                }
            }
        }
    };

    const handleSuggestRules = async () => {
        setIsSuggestingRules(true);
        setError(null);
        try {
            const suggestion = await suggestStandardizationRules(rules);
            setRules(suggestion);
            setShowRules(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi gợi ý quy tắc.');
        } finally {
            setIsSuggestingRules(false);
        }
    };

    const handleSuggestSeoRules = async () => {
        setIsSuggestingRules(true);
        setError(null);
        try {
            const suggestion = await suggestStandardizationRules(seoRules);
            setSeoRules(suggestion);
            setShowSeoRules(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi gợi ý quy tắc.');
        } finally {
            setIsSuggestingRules(false);
        }
    };

    const handleGenerateSeoNames = async () => {
        const namesToProcess = seoInput.split('\n').map(p => p.trim()).filter(Boolean);

        if (namesToProcess.length === 0) {
            setError('Vui lòng nhập ít nhất một tên sản phẩm.');
            return;
        }

        setIsLoading(true);
        setError(null);
        stopSignal.current = false;
        setProgress({ total: namesToProcess.length, current: 0 });
        
        const initialResults: StandardizedNameResult[] = namesToProcess.map(name => ({
            original: name,
            standardized: '',
            status: 'loading'
        }));
        setSeoResults(initialResults);

        try {
            const BATCH_SIZE = 30;
            let allProcessedResults: {original: string, standardized: string}[] = [];

            for (let i = 0; i < namesToProcess.length; i += BATCH_SIZE) {
                if (stopSignal.current) break;

                const batch = namesToProcess.slice(i, i + BATCH_SIZE);
                const batchResults = await generateSeoProductNames(batch, seoRules, seoModel);
                allProcessedResults = [...allProcessedResults, ...batchResults];
                
                setProgress(p => p ? { ...p, current: Math.min(p.total, p.current + BATCH_SIZE) } : null);
                
                const processedMap = new Map(allProcessedResults.map(r => [r.original, r.standardized]));
                setSeoResults(current => current.map(res => {
                    if (processedMap.has(res.original)) {
                        return { ...res, standardized: processedMap.get(res.original)!, status: 'success' };
                    }
                    return res;
                }));
            }
            
            const finalMap = new Map(allProcessedResults.map(r => [r.original, r.standardized]));
            setSeoResults(current => current.map(res => {
                if (finalMap.has(res.original)) {
                    return { ...res, standardized: finalMap.get(res.original)!, status: 'success' };
                }
                if (res.status === 'loading') {
                    return { ...res, status: 'error', error: 'AI không trả về kết quả cho mục này.' };
                }
                return res;
            }));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
            setError(message);
            setSeoResults(current => current.map(res => 
                res.status === 'loading' ? { ...res, status: 'error', error: message } : res
            ));
        } finally {
            setIsLoading(false);
            setProgress(null);
            
            const successfulCount = seoResults.filter(r => r.status === 'success' || r.standardized !== '').length;
            if (auth.currentUser && successfulCount > 0) {
                try {
                    await addHistory(STORE_NAMES.NAME_STANDARDIZATIONS, {
                        uid: auth.currentUser.uid,
                        userEmail: auth.currentUser.email || 'N/A',
                        actionType: 'Tên SEO Quảng cáo',
                        details: {
                            productCount: namesToProcess.length,
                            successCount: successfulCount,
                            hasCategories: false
                        },
                        status: 'success',
                        createdAt: Date.now()
                    });
                } catch (err) {
                    console.error("Failed to save history", err);
                }
            }
        }
    };

    const handleCopyAll = () => {
        const textToCopy = results
            .filter(r => r.status === 'success')
            .map(r => r.standardized)
            .join('\n');
        navigator.clipboard.writeText(textToCopy).catch(err => console.error("Could not copy text: ", err));
    };

    const handleCopyAllSeo = () => {
        const textToCopy = seoResults
            .filter(r => r.status === 'success')
            .map(r => r.standardized)
            .join('\n');
        navigator.clipboard.writeText(textToCopy).catch(err => console.error("Could not copy text: ", err));
    };

    const transformSeoText = (type: 'upper' | 'lower' | 'title' | 'no-accent') => {
        if (!seoInput) return;
        const lines = seoInput.split('\n');
        const transformed = lines.map(line => {
            if (!line.trim()) return line;
            switch (type) {
                case 'upper': return line.toUpperCase();
                case 'lower': return line.toLowerCase();
                case 'title': return line.replace(/\b\w/g, l => l.toUpperCase());
                case 'no-accent':
                    return line.normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/đ/g, 'd').replace(/Đ/g, 'D');
                default: return line;
            }
        }).join('\n');
        setSeoInput(transformed);
    };

    // --- Text Utility Functions ---
    const transformText = (type: 'upper' | 'lower' | 'title' | 'no-accent') => {
        if (!input) return;
        
        const lines = input.split('\n');
        const transformed = lines.map(line => {
            if (!line.trim()) return line;
            switch (type) {
                case 'upper': return line.toUpperCase();
                case 'lower': return line.toLowerCase();
                case 'title': {
                    const isAllUpperCase = line === line.toUpperCase();
                    return line.split(/([\s\-_/]+)/).map(word => {
                        if (/^[\s\-_/]+$/.test(word)) return word; // preserve separators
                        
                        // If word contains a number, keep it but capitalize the first letter if possible
                        if (/\d/.test(word)) {
                            return word.replace(/^([^\p{L}]*)(\p{L})(.*)$/u, (m, p1, p2, p3) => {
                                return p1 + p2.toUpperCase() + p3; 
                            });
                        }
                        
                        if (isAllUpperCase) {
                            return word.replace(/^([^\p{L}]*)(\p{L})(.*)$/u, (m, p1, p2, p3) => {
                                return p1 + p2.toUpperCase() + p3.toLowerCase();
                            });
                        }
                        
                        // If word is all uppercase and length > 1 (excluding punctuation), keep it
                        const lettersOnly = word.replace(/[^\p{L}]/gu, '');
                        if (lettersOnly === lettersOnly.toUpperCase() && lettersOnly.length > 1) {
                            return word;
                        }
                        
                        return word.replace(/^([^\p{L}]*)(\p{L})(.*)$/u, (m, p1, p2, p3) => {
                            return p1 + p2.toUpperCase() + p3.toLowerCase();
                        });
                    }).join('');
                }
                case 'no-accent':
                    return line.normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/đ/g, 'd').replace(/Đ/g, 'D');
                default: return line;
            }
        }).join('\n');
        
        setInput(transformed);
    };

    const successfulResults = results.filter(r => r.status === 'success');
    const lineCount = input.split('\n').filter(l => l.trim()).length;

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-700 w-fit mx-auto overflow-x-auto max-w-full">
                <button
                    onClick={() => setActiveSubTab('standardize')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                        activeSubTab === 'standardize'
                            ? 'bg-sky-500/20 text-sky-400 shadow-sm border border-sky-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                >
                    <ListChecks className="w-4 h-4" />
                    Chuẩn hóa Tên
                </button>
                <button
                    onClick={() => setActiveSubTab('seo')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                        activeSubTab === 'seo'
                            ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Tên SEO Quảng cáo
                </button>
                <button
                    onClick={() => setActiveSubTab('excel-accents')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                        activeSubTab === 'excel-accents'
                            ? 'bg-sky-500/20 text-sky-400 shadow-sm border border-sky-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Loại bỏ Dấu Excel
                </button>
                <button
                    onClick={() => setActiveSubTab('history')}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                        activeSubTab === 'history'
                            ? 'bg-sky-500/20 text-sky-400 shadow-sm border border-sky-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                >
                    <History className="w-4 h-4" />
                    Lịch sử
                </button>
            </div>

            {activeSubTab === 'excel-accents' ? (
                <ExcelRemoveAccents />
            ) : activeSubTab === 'seo' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in max-w-7xl mx-auto w-full">
                    {/* Left Panel - Input & Settings */}
                    <div className="bg-zinc-800/50 p-6 sm:p-8 rounded-2xl border border-zinc-700 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-amber-300 flex items-center gap-3">
                                <Sparkles className="w-7 h-7 text-amber-400" />
                                Tên SEO Quảng cáo Sản phẩm
                            </h2>
                        </div>

                        {/* Rules Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <button 
                                    type="button"
                                    onClick={() => setShowSeoRules(!showSeoRules)}
                                    className="text-sm font-medium text-zinc-300 flex items-center gap-2 hover:text-amber-300 transition-colors"
                                >
                                    {showSeoRules ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    Quy tắc SEO Quảng cáo
                                </button>
                                <Button 
                                    onClick={handleSuggestSeoRules} 
                                    isLoading={isSuggestingRules}
                                    size="sm" 
                                    colorScheme="slate"
                                    className="!py-1 !px-3 !text-xs"
                                >
                                    <Wand2 className="w-3 h-3 mr-1.5" />
                                    Gợi ý AI
                                </Button>
                            </div>

                            {showSeoRules ? (
                                <div className="space-y-3 animate-slide-down">
                                    <TextArea
                                        value={seoRules}
                                        onChange={e => setSeoRules(e.target.value)}
                                        placeholder="Nhập quy tắc tạo Tên SEO Quảng cáo..."
                                        rows={6}
                                        className="text-xs font-mono bg-zinc-900/80 border-zinc-700"
                                    />
                                    <p className="text-[10px] text-zinc-500 italic">
                                        * Quy tắc này hướng dẫn AI tối ưu Tên SEO phù hợp cho Google Ads, Shopee Ads, TikTok Shop.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50 text-xs text-zinc-400 line-clamp-2">
                                    {seoRules || 'Chưa có quy tắc nào được thiết lập.'}
                                </div>
                            )}
                        </div>

                        {/* Model Selector */}
                        <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-700/50">
                            <label className="text-xs font-medium text-zinc-400">Mô hình AI:</label>
                            <select
                                value={seoModel}
                                onChange={e => setSeoModel(e.target.value)}
                                className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
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

                        {/* Input Form */}
                        <form onSubmit={e => { e.preventDefault(); handleGenerateSeoNames(); }} className="space-y-4">
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label htmlFor="seo-names-input" className="block text-sm font-medium text-zinc-300">
                                        Dán danh sách tên sản phẩm gốc
                                    </label>
                                    <span className="text-xs text-zinc-500">
                                        {seoInput.split('\n').filter(l => l.trim()).length} dòng
                                    </span>
                                </div>
                                
                                {/* Text Utilities Toolbar */}
                                <div className="flex flex-wrap gap-2 mb-2">
                                    <button type="button" onClick={() => transformSeoText('upper')} className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600" title="CHỮ IN HOA">AA</button>
                                    <button type="button" onClick={() => transformSeoText('lower')} className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600" title="chữ thường">aa</button>
                                    <button type="button" onClick={() => transformSeoText('title')} className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600" title="Viết Hoa Chữ Cái Đầu">Aa</button>
                                    <button type="button" onClick={() => transformSeoText('no-accent')} className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600" title="Xóa dấu">Không dấu</button>
                                    <button type="button" onClick={() => setSeoInput('')} className="px-2 py-1 text-xs bg-zinc-700 text-red-300 hover:bg-zinc-600 ml-auto">Xóa hết</button>
                                </div>

                                <TextArea
                                    id="seo-names-input"
                                    value={seoInput}
                                    onChange={e => setSeoInput(e.target.value)}
                                    placeholder="Nước hoa Chanel Coco Mademoiselle 100ml&#10;Áo thun nam Polo cotton co giãn..."
                                    rows={10}
                                    disabled={isLoading}
                                    className="font-mono text-sm"
                                />
                            </div>
                            
                            {progress && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-zinc-400">
                                        <span>Đang tạo Tên SEO Quảng cáo...</span>
                                        <span>{progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)</span>
                                    </div>
                                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-amber-500 transition-all duration-300 ease-out" 
                                            style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {isLoading ? (
                                <Button onClick={handleStop} colorScheme="red" className="w-full !py-3">
                                    <StopCircle className="w-5 h-5 mr-2" />
                                    Dừng lại
                                </Button>
                            ) : (
                                <Button type="submit" disabled={isLoading || !seoInput.trim()} colorScheme="yellow" className="w-full !py-3">
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Tạo Tên SEO Quảng Cáo
                                </Button>
                            )}
                        </form>
                    </div>

                    {/* Right Panel - Results */}
                    <div className="bg-zinc-800/50 p-6 sm:p-8 rounded-2xl border border-zinc-700">
                        <h2 className="text-2xl font-bold text-zinc-200 mb-4">Kết quả SEO Quảng cáo</h2>
                        {error && (
                            <div className="mb-4 bg-red-900/50 text-red-300 p-4 rounded-lg border border-red-700">
                                <p className="font-semibold">Lỗi</p>
                                <p>{error}</p>
                            </div>
                        )}
                        {seoResults.length > 0 ? (
                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={handleCopyAllSeo} disabled={seoResults.filter(r => r.status === 'success').length === 0} colorScheme="yellow">
                                        <Copy className="w-5 h-5 mr-2" />
                                        Sao chép toàn bộ
                                    </Button>
                                    <Button onClick={() => exportStandardizedNamesToCSV(seoResults.filter(r => r.status === 'success'))} disabled={seoResults.filter(r => r.status === 'success').length === 0} colorScheme="slate">
                                        <Download className="w-5 h-5 mr-2" />
                                        Xuất CSV
                                    </Button>
                                    <Button onClick={() => exportStandardizedNamesToXLSX(seoResults.filter(r => r.status === 'success'))} disabled={seoResults.filter(r => r.status === 'success').length === 0} colorScheme="green">
                                        <FileSpreadsheet className="w-5 h-5 mr-2" />
                                        Xuất Excel
                                    </Button>
                                </div>

                                <div className="overflow-auto max-h-[60vh] border border-zinc-700 rounded-lg">
                                    <table className="w-full text-sm text-left text-zinc-300">
                                        <thead className="text-xs text-amber-300 uppercase bg-zinc-700/50 sticky top-0 z-10">
                                            <tr>
                                                <th scope="col" className="px-4 py-3 w-1/3">Tên Gốc</th>
                                                <th scope="col" className="px-4 py-3 w-2/3">Tên SEO Quảng Cáo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {seoResults.map((result, index) => {
                                                const charLen = result.standardized ? result.standardized.length : 0;
                                                return (
                                                    <tr key={index} className="bg-zinc-800/60 border-b border-zinc-700 last:border-b-0">
                                                        <td className="px-4 py-3 text-zinc-400 align-top text-xs">{result.original}</td>
                                                        <td className="px-4 py-3 font-medium text-zinc-100 align-top">
                                                            {result.status === 'loading' && <Spinner />}
                                                            {result.status === 'success' && (
                                                                <div className="space-y-1">
                                                                    <div className="text-sm text-amber-200 font-semibold">{result.standardized}</div>
                                                                    <div className="flex items-center justify-between text-[11px] pt-1">
                                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                                            charLen >= 60 && charLen <= 90
                                                                                ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-500/30'
                                                                                : charLen > 90
                                                                                ? 'bg-red-900/50 text-red-300 border border-red-500/30'
                                                                                : 'bg-zinc-700 text-zinc-300'
                                                                        }`}>
                                                                            {charLen} ký tự {charLen >= 60 && charLen <= 90 ? '(Tối ưu SEO)' : charLen > 90 ? '(Dài quá)' : ''}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => navigator.clipboard.writeText(result.standardized)}
                                                                            className="text-zinc-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                                                                            title="Sao chép"
                                                                        >
                                                                            <Copy className="w-3.5 h-3.5" />
                                                                            Copy
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {result.status === 'error' && <span className="text-red-400 text-xs" title={result.error}>Lỗi</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-8 h-full">
                                <Sparkles className="w-12 h-12 text-amber-500/50 mb-4" />
                                <h3 className="text-lg font-semibold text-zinc-300">Kết quả Tên SEO Quảng cáo sẽ ở đây</h3>
                                <p className="text-zinc-400 text-xs max-w-sm mt-1">Dán danh sách tên sản phẩm vào ô bên trái và bấm nút Tạo Tên SEO Quảng Cáo.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : activeSubTab === 'standardize' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in max-w-7xl mx-auto w-full">
            <div className="bg-zinc-800/50 p-6 sm:p-8 rounded-2xl border border-zinc-700 space-y-6">
                <h2 className="text-2xl font-bold text-sky-300 flex items-center gap-3">
                    <Tag className="w-7 h-7" />
                    Chuẩn hóa Tên Sản phẩm
                </h2>
                
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <button 
                            type="button"
                            onClick={() => setShowRules(!showRules)}
                            className="text-sm font-medium text-zinc-300 flex items-center gap-2 hover:text-sky-300 transition-colors"
                        >
                            {showRules ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            Quy tắc chuẩn hóa SEO
                        </button>
                        <Button 
                            onClick={handleSuggestRules} 
                            isLoading={isSuggestingRules}
                            size="sm" 
                            colorScheme="slate"
                            className="!py-1 !px-3 !text-xs"
                        >
                            <Wand2 className="w-3 h-3 mr-1.5" />
                            Gợi ý AI
                        </Button>
                    </div>

                    {showRules ? (
                        <div className="space-y-3 animate-slide-down">
                            <TextArea
                                value={rules}
                                onChange={e => setRules(e.target.value)}
                                placeholder="Nhập quy tắc chuẩn hóa tên sản phẩm..."
                                rows={6}
                                className="text-xs font-mono bg-zinc-900/80 border-zinc-700"
                            />
                            <p className="text-[10px] text-zinc-500 italic">
                                * Quy tắc này sẽ được AI sử dụng để chuẩn hóa tên sản phẩm của bạn.
                            </p>
                        </div>
                    ) : (
                        <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-700/50 text-xs text-zinc-400 line-clamp-2">
                            {rules || 'Chưa có quy tắc nào được thiết lập.'}
                        </div>
                    )}
                </div>

                <form onSubmit={e => { e.preventDefault(); handleStandardize(); }} className="space-y-4">
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label htmlFor="product-names-input" className="block text-sm font-medium text-zinc-300">
                                Dán tên sản phẩm gốc
                            </label>
                            <span className="text-xs text-zinc-500">{lineCount} dòng</span>
                        </div>
                        
                        {/* Text Utilities Toolbar */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            <button type="button" onClick={() => transformText('upper')} className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600" title="CHỮ IN HOA">AA</button>
                            <button type="button" onClick={() => transformText('lower')} className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600" title="chữ thường">aa</button>
                            <button type="button" onClick={() => transformText('title')} className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600" title="Viết Hoa Chữ Cái Đầu">Aa</button>
                            <button type="button" onClick={() => transformText('no-accent')} className="px-2 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600" title="Xóa dấu (dùng tạo SKU)">Không dấu</button>
                            <button type="button" onClick={() => setInput('')} className="px-2 py-1 text-xs bg-zinc-700 text-red-300 hover:bg-zinc-600 ml-auto">Xóa hết</button>
                        </div>

                        <TextArea
                            id="product-names-input"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="[freeship] DẦU ĂN SIMPLY 1L\nBIA HEINEKEN THÙNG 24 LON 330ML..."
                            rows={10}
                            disabled={isLoading}
                            className="font-mono text-sm"
                        />
                    </div>
                    
                    {progress && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-zinc-400">
                                <span>Đang xử lý...</span>
                                <span>{progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)</span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-sky-500 transition-all duration-300 ease-out" 
                                    style={{ width: `${Math.max(5, (progress.current / progress.total) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <Button onClick={handleStop} colorScheme="red" className="w-full !py-3">
                            <StopCircle className="w-5 h-5 mr-2" />
                            Dừng lại
                        </Button>
                    ) : (
                        <Button type="submit" disabled={isLoading || !input.trim()} className="w-full !py-3">
                            Chuẩn hóa
                        </Button>
                    )}
                </form>
            </div>
            
            <div className="bg-zinc-800/50 p-6 sm:p-8 rounded-2xl border border-zinc-700">
                 <h2 className="text-2xl font-bold text-zinc-200 mb-4">Kết quả</h2>
                 {error && (
                    <div className="mb-4 bg-red-900/50 text-red-300 p-4 rounded-lg border border-red-700">
                        <p className="font-semibold">Lỗi</p>
                        <p>{error}</p>
                    </div>
                 )}
                 {results.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button onClick={handleCopyAll} disabled={successfulResults.length === 0} colorScheme="slate">
                                <Copy className="w-5 h-5 mr-2" />
                                Sao chép
                            </Button>
                            <Button onClick={handleCategorize} disabled={isLoading || successfulResults.length === 0} colorScheme="sky">
                                <Layers className="w-5 h-5 mr-2" />
                                Phân loại
                            </Button>
                            <Button onClick={() => exportStandardizedNamesToCSV(successfulResults)} disabled={successfulResults.length === 0}>
                                <Download className="w-5 h-5 mr-2" />
                                CSV
                            </Button>
                             <Button onClick={() => exportStandardizedNamesToXLSX(successfulResults)} disabled={successfulResults.length === 0} colorScheme="green">
                                <FileSpreadsheet className="w-5 h-5 mr-2" />
                                Excel
                            </Button>
                        </div>
                        <div className="overflow-auto max-h-[60vh] border border-zinc-700 rounded-lg">
                            <table className="w-full text-sm text-left text-zinc-300">
                                <thead className="text-xs text-sky-300 uppercase bg-zinc-700/50 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 w-1/3">Tên Gốc</th>
                                        <th scope="col" className="px-6 py-3 w-1/3">Tên Chuẩn Hóa</th>
                                        <th scope="col" className="px-6 py-3 w-1/3">Phân loại</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((result, index) => (
                                        <tr key={index} className="bg-zinc-800/60 border-b border-zinc-700 last:border-b-0">
                                            <td className="px-6 py-4 text-zinc-400 align-top">{result.original}</td>
                                            <td className="px-6 py-4 font-medium text-zinc-100 align-top">
                                                {result.status === 'loading' && <Spinner />}
                                                {result.status === 'success' && (
                                                    <div>
                                                        <div>{result.standardized}</div>
                                                        <div className={`text-[10px] mt-1 ${result.standardized.length > 120 ? 'text-red-400' : 'text-zinc-500'}`}>
                                                            {result.standardized.length} ký tự {result.standardized.length > 120 && '(Quá dài)'}
                                                        </div>
                                                    </div>
                                                )}
                                                {result.status === 'error' && <span className="text-red-400" title={result.error}>Lỗi</span>}
                                            </td>
                                            <td className="px-6 py-4 align-top">
                                                {result.category ? (
                                                    <span className="px-2 py-1 bg-sky-900/30 text-sky-400 rounded-md text-xs border border-sky-500/20">
                                                        {result.category}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-600 italic text-xs">Chưa phân loại</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 h-full">
                        <Tag className="w-12 h-12 text-zinc-500 mb-4" />
                        <h3 className="text-lg font-semibold text-zinc-300">Kết quả sẽ hiển thị ở đây</h3>
                        <p className="text-zinc-400">Dán tên sản phẩm vào ô bên trái và bắt đầu chuẩn hóa.</p>
                    </div>
                 )}
            </div>
        </div>
            ) : (
                <div className="max-w-7xl mx-auto space-y-8 w-full">
                    <div className="bg-zinc-800/40 p-6 rounded-2xl border border-zinc-700/50">
                        <h2 className="text-xl font-bold text-sky-400 mb-4 flex items-center gap-2">
                            <History className="w-6 h-6" /> Lịch sử Chuẩn hóa & Phân loại
                        </h2>
                        
                        {isLoadingHistory ? (
                            <div className="flex justify-center items-center py-12">
                                <Spinner className="w-8 h-8 text-sky-500" />
                            </div>
                        ) : historyList.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-zinc-700/50 rounded-xl">
                                <History className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                                <p className="text-zinc-400">Bạn chưa thực hiện thao tác nào.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm text-left border-collapse">
                                    <thead className="text-xs text-zinc-400 uppercase tracking-wider bg-zinc-900/50 border-b border-zinc-700">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Thời gian</th>
                                            <th className="px-4 py-3 font-medium">Tài khoản</th>
                                            <th className="px-4 py-3 font-medium">Thao tác</th>
                                            <th className="px-4 py-3 font-medium text-center">Số lượng</th>
                                            <th className="px-4 py-3 font-medium">Phân loại</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-700/50">
                                        {historyList.map((item) => (
                                            <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors group">
                                                <td className="px-4 py-3 text-zinc-300">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-sky-300 text-xs truncate max-w-[150px]" title={item.userEmail || 'N/A'}>
                                                    {item.userEmail || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-zinc-300 font-medium truncate max-w-[200px]" title={item.actionType}>
                                                    {item.actionType}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-green-400 font-bold">{item.details?.successCount || 0}</span> / <span className="text-zinc-400">{item.details?.productCount || 0}</span>
                                                </td>
                                                <td className="px-4 py-3 text-zinc-400">
                                                    {item.details?.hasCategories ? 'Có' : 'Không'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductNameStandardizerTab;
