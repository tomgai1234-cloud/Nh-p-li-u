
import React, { useState, useEffect, useRef } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import TextArea from '../TextArea';
import Button from '../Button';
import { extractProductAttributesForSingleItem } from '../../services/geminiService';
import type { ExtractedResult, AttributeDefinition, ExtractionResultRow } from '../../types';
import AttributeConfigModal from '../modals/AttributeConfigModal';
import Spinner from '../Spinner';
import { exportExtractorResultsToCSV, exportExtractorResultsToXLSX } from '../../utils/exportUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Download, FileSpreadsheet, StopCircle, History, ListChecks, LayoutGrid, X } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../src/firebase';
import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';

const ProductExtractorTab: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<'extract' | 'history'>('extract');
    const [attributes, setAttributes] = usePersistedState<AttributeDefinition[]>('extractor_attributes', []);
    const [attributeSetName, setAttributeSetName] = usePersistedState<string>('extractor_attributeSetName', '');
    const [products, setProducts] = usePersistedState<string>('extractor_products', '');
    const [timeout, setTimeout] = usePersistedState<number>('extractor_timeout', 30);
    const [results, setResults] = usePersistedState<ExtractionResultRow[]>('extractor_results', []);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
    
    // History state
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    
    // New state for model selection
    const [useProModel, setUseProModel] = usePersistedState<boolean>('extractor_useProModel', true);
    const [isCompareMode, setIsCompareMode] = usePersistedState<boolean>('extractor_compareMode', false);
    const [compareUrlInput, setCompareUrlInput] = usePersistedState<string>('extractor_compareUrl', '');
    const [activeCompareUrl, setActiveCompareUrl] = useState('');
    
    useEffect(() => {
        if (compareUrlInput && isCompareMode) {
            setActiveCompareUrl(compareUrlInput);
        }
    }, []);


        const [isVisualPickerOpen, setIsVisualPickerOpen] = useState(false);
    const [visualPickerUrl, setVisualPickerUrl] = useState('');
    const [visualPickerResult, setVisualPickerResult] = useState('');
    const [pickerMode, setPickerMode] = useState<'single' | 'list' | 'container'>('single');
    const [availableSelectors, setAvailableSelectors] = useState<{single?: string, list?: string, container?: string}>({});
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

    // When mode changes, update the result if we have selectors
    useEffect(() => {
        if (availableSelectors[pickerMode]) {
            setVisualPickerResult(availableSelectors[pickerMode]!);
        }
    }, [pickerMode, availableSelectors]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'PICKER_RESULT' && event.data?.selector) {
                if (event.data.selectors) {
                    setAvailableSelectors(event.data.selectors);
                    // Set current result based on active mode
                    setVisualPickerResult(event.data.selectors[pickerMode] || event.data.selector);
                } else {
                    setVisualPickerResult(event.data.selector);
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [pickerMode]);

    const resultsRef = useRef<HTMLDivElement>(null);
    const stopSignal = useRef<boolean>(false);

    const handleSaveConfig = (newAttributes: AttributeDefinition[], newTimeout: number, newSetName: string) => {
        setAttributes(newAttributes);
        setTimeout(newTimeout);
        setAttributeSetName(newSetName);
        setIsConfigModalOpen(false);
    };
    
    useEffect(() => {
        if (results.length > 0 && !isLoading) {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [results, isLoading]);

    useEffect(() => {
        if (activeSubTab === 'history') {
            setIsLoadingHistory(true);
            const loadData = async () => {
                try {
                    let results = await listHistory(STORE_NAMES.ATTRIBUTES_EXTRACTIONS, 50);
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
            const unsubscribe = subscribeToStore(STORE_NAMES.ATTRIBUTES_EXTRACTIONS, loadData);
            return () => unsubscribe();
        }
    }, [activeSubTab, auth.currentUser]);

    const handleStop = () => {
        stopSignal.current = true;
    };

    const handleExtract = async () => {
        const productsToProcess = products.split('\n').map(p => p.trim()).filter(Boolean);

        if (productsToProcess.length === 0) {
            setError('Vui lòng nhập ít nhất một sản phẩm.');
            return;
        }
        if (attributes.length === 0) {
            setError('Vui lòng chọn hoặc nhập ít nhất một thuộc tính để trích xuất.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setProgress(0);
        stopSignal.current = false;
        
        const initialResults: ExtractionResultRow[] = productsToProcess.map(p => ({
            status: 'loading',
            input: p,
            modelUsed: '',
            data: { productName: p },
            error: undefined
        }));
        setResults(initialResults);
        
        const updatedResults = [...initialResults];

        for (let i = 0; i < productsToProcess.length; i++) {
            if (stopSignal.current) break;

            const product = productsToProcess[i];
            try {
                // Pass useProModel to the service
                const { modelUsed, data } = await extractProductAttributesForSingleItem(product, attributes, useProModel);
                updatedResults[i] = { status: 'success', input: product, modelUsed, data, error: undefined };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
                updatedResults[i] = { status: 'error', input: product, modelUsed: 'N/A', data: { productName: product }, error: message };
            }
            setResults([...updatedResults]);
            setProgress(((i + 1) / productsToProcess.length) * 100);
        }

        setIsLoading(false);

        // Save history
        if (auth.currentUser && updatedResults.some(r => r.status === 'success')) {
            try {
                await addHistory(STORE_NAMES.ATTRIBUTES_EXTRACTIONS, {
                    uid: auth.currentUser.uid,
                    userEmail: auth.currentUser.email || 'N/A',
                    actionType: 'Trích xuất thuộc tính',
                    details: {
                        productCount: productsToProcess.length,
                        successCount: updatedResults.filter(r => r.status === 'success').length,
                        attributeSetName: attributeSetName || 'Tùy chỉnh'
                    },
                    status: 'success',
                    createdAt: Date.now()
                });
            } catch (err) {
                console.error("Failed to save history", err);
            }
        }
    };
    
    const handleNewExtraction = () => {
        setResults([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const StatusBadge: React.FC<{ status: 'success' | 'error' | 'loading', error?: string }> = ({ status, error }) => {
        switch (status) {
            case 'success':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-800 text-green-200">Thành công</span>;
            case 'error':
                return <span title={error} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-800 text-red-200 cursor-help">Thất bại</span>;
            case 'loading':
                return <div className="flex justify-center items-center"><Spinner /></div>;
            default:
                return null;
        }
    };

    const successfulResults = results.filter(r => r.status === 'success').map(r => r.data);

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex justify-between items-center max-w-7xl mx-auto w-full mb-2">
                <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-700 w-fit">
                <button
                    onClick={() => setActiveSubTab('extract')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                        activeSubTab === 'extract'
                            ? 'bg-sky-500/20 text-sky-400 shadow-sm border border-sky-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                >
                    <ListChecks className="w-4 h-4" />
                    Trích xuất Thuộc tính
                </button>
                <button
                    onClick={() => setActiveSubTab('history')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                        activeSubTab === 'history'
                            ? 'bg-sky-500/20 text-sky-400 shadow-sm border border-sky-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                >
                    <History className="w-4 h-4" />
                    Lịch sử
                </button>
            </div>
            {activeSubTab === 'extract' && (
                <label className="flex items-center gap-2 cursor-pointer bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors">
                    <input 
                        type="checkbox"
                        checked={isCompareMode}
                        onChange={(e) => setIsCompareMode(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-500 bg-zinc-700 text-sky-600 focus:ring-sky-500 focus:ring-offset-zinc-900"
                    />
                    <span className="text-sm font-medium text-zinc-300">Chế độ so sánh (Split-screen)</span>
                </label>
            )}
        </div>

            {activeSubTab === 'extract' ? (
                <>
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={isCompareMode ? "w-full grid grid-cols-1 xl:grid-cols-2 gap-6 items-start" : "max-w-7xl mx-auto space-y-8 w-full"}
                >
                    <div className="space-y-8 flex flex-col min-h-0 min-w-0">
                <div className="bg-zinc-800/50 p-6 sm:p-8 rounded-2xl border border-zinc-700 shadow-xl space-y-8">
                    {error && (
                        <div className="bg-red-900/50 text-red-300 p-4 rounded-lg border border-red-700">
                            <p className="font-semibold">Lỗi</p>
                            <p>{error}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold text-zinc-200">1. Các thuộc tính đã chọn</h3>
                                <Button
                                    onClick={() => setIsConfigModalOpen(true)}
                                    colorScheme="ghost"
                                    className="!w-auto !py-1.5 !px-4 !text-sm"
                                >
                                    Chọn / Chỉnh sửa
                                </Button>
                            </div>
                            <div className={`w-full bg-zinc-900/70 border border-zinc-600 rounded-lg p-4 text-zinc-300 min-h-[100px] text-sm ${!attributeSetName && attributes.length > 0 ? '' : 'flex items-center'}`}>
                                {attributeSetName ? (
                                    <div className="w-full">
                                        <p className="font-semibold text-sky-400 text-base mb-1">{attributeSetName}</p>
                                        <p className="text-zinc-500 text-xs">{attributes.length} thuộc tính</p>
                                    </div>
                                ) : attributes.length > 0 ? (
                                    <ul className="space-y-1 font-sans list-none p-0 m-0 w-full">
                                        {attributes.map((attr, index) => (
                                            attr.name.trim() && (
                                                <li key={index} className="flex justify-between border-b border-zinc-800/50 last:border-0 py-1">
                                                    <span>{attr.name}</span>
                                                    <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{attr.type === 'fixed' ? 'Cố định' : 'Tự do'}</span>
                                                </li>
                                            )
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-zinc-500 text-center w-full">Chưa có thuộc tính nào được chọn.</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold text-zinc-200">2. Danh sách sản phẩm</h3>
                            </div>
                            <TextArea
                                value={products}
                                onChange={(e) => setProducts(e.target.value)}
                                placeholder={`Máy sấy tóc Philips 3000 BHD321/50\nSúng massage fascial gun PPM7323\nhttps://example.com/product-page`}
                                rows={8}
                                disabled={isLoading}
                                className="font-mono text-sm"
                            />
                             
                             <p className="text-xs text-zinc-400 mt-2">Nhập tên, model hoặc URL (mỗi dòng một mục).</p>
                             
                            <div className="mt-4 p-4 bg-zinc-800/40 rounded-lg border border-zinc-700/50">
                                <h4 className="text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wider">Tiện ích: Lấy Selector CSS</h4>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="text" 
                                        placeholder="Nhập URL trang web..." 
                                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-md text-sm px-3 py-2 text-zinc-300 outline-none focus:border-sky-500"
                                        value={visualPickerUrl}
                                        onChange={e => setVisualPickerUrl(e.target.value)}
                                    />
                                    <Button 
                                        onClick={() => {
                                            if(visualPickerUrl) {
                                                setIsVisualPickerOpen(true);
                                                setVisualPickerResult('');
                                            } else {
                                                alert('Vui lòng nhập URL');
                                            }
                                        }}
                                        className="!w-auto !py-2 !px-3 !text-xs whitespace-nowrap"
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                                        Chọn vùng
                                    </Button>
                                </div>
                                {visualPickerResult && (
                                    <div className="mt-2 text-xs text-sky-400 bg-sky-900/20 p-2.5 rounded-md border border-sky-800/50 flex justify-between items-center">
                                        <code className="truncate max-w-[200px]" title={visualPickerResult}>{visualPickerResult}</code>
                                        <button className="hover:text-white transition-colors" onClick={() => {
                                            navigator.clipboard.writeText(visualPickerResult);
                                            alert('Đã copy selector!');
                                        }}>
                                           Copy
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    <div className="pt-4 flex flex-col items-center gap-4">
                        {/* Model Selection Checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer bg-zinc-900/50 p-2 rounded-lg border border-zinc-600 hover:bg-zinc-800 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={useProModel} 
                                onChange={(e) => setUseProModel(e.target.checked)}
                                className="w-5 h-5 rounded border-zinc-500 bg-zinc-700 text-sky-600 focus:ring-sky-500 focus:ring-offset-zinc-900"
                            />
                            <span className="text-sm font-medium text-zinc-200">
                                Dùng Model Pro (Chính xác hơn)
                            </span>
                        </label>

                        {isLoading ? (
                            <Button onClick={handleStop} colorScheme="red" className="!w-auto !px-10">
                                <StopCircle className="w-5 h-5 mr-2" />
                                Dừng lại
                            </Button>
                        ) : (
                            <Button
                                onClick={handleExtract}
                                disabled={isLoading}
                                className="!w-auto !px-10 !py-3 !text-base shadow-lg shadow-sky-900/20"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                Bắt đầu Trích xuất
                            </Button>
                        )}
                    </div>
                </div>

                {isLoading && (
                     <div className="text-center p-4 space-y-4">
                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                            <motion.div 
                                className="bg-sky-500 h-full rounded-full" 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ type: "spring", stiffness: 50 }}
                            />
                        </div>
                        <p className="text-zinc-400 font-medium">Đang xử lý {results.filter(r => r.status !== 'loading').length} / {results.length} mục...</p>
                    </div>
                )}

                <AnimatePresence>
                {results.length > 0 && (
                    <motion.div 
                        ref={resultsRef}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-zinc-800/50 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-2xl border border-zinc-700"
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                        <h2 className="text-2xl font-bold text-zinc-200">Kết quả</h2>
                        {!isLoading && <Button onClick={handleNewExtraction} colorScheme="slate" className="!w-full sm:!w-auto !py-2 !px-4">Làm mới</Button>}
                      </div>
                      
                      {!isLoading && successfulResults.length > 0 && (
                        <div className="mb-6 flex flex-col sm:flex-row gap-4">
                            <Button onClick={() => exportExtractorResultsToCSV(successfulResults, attributes.map(a => a.name))} className="flex-1">
                                <Download className="w-5 h-5 mr-2" />
                                Xuất CSV
                            </Button>
                            <Button onClick={() => exportExtractorResultsToXLSX(successfulResults, attributes.map(a => a.name))} colorScheme="green" className="flex-1">
                                <FileSpreadsheet className="w-5 h-5 mr-2" />
                                Xuất Excel
                            </Button>
                        </div>
                      )}

                      <div className="overflow-x-auto relative shadow-inner rounded-lg border border-zinc-700 bg-zinc-900/30">
                        <table className="w-full text-sm text-left text-zinc-300">
                          <thead className="text-xs text-sky-300 uppercase bg-zinc-800/80 backdrop-blur sticky top-0 z-20 shadow-sm">
                            <tr>
                              <th scope="col" className="px-4 py-3 whitespace-nowrap">Trạng thái</th>
                              <th scope="col" className="px-6 py-3 min-w-[250px] sticky left-0 bg-zinc-800/90 backdrop-blur-sm z-10 shadow-[2px_0_5_rgba(0,0,0,0.3)]">Đầu vào</th>
                              <th scope="col" className="px-4 py-3 whitespace-nowrap">AI Model</th>
                              {attributes.map(attr => (
                                <th key={attr.name} scope="col" className="px-6 py-3 whitespace-nowrap font-bold text-zinc-400">{attr.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {results.map((result, index) => (
                              <motion.tr 
                                key={index} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-zinc-800/40 border-b border-zinc-700/50 hover:bg-zinc-700/40 transition-colors"
                              >
                                <td className="px-4 py-4 text-center"><StatusBadge status={result.status} error={result.error} /></td>
                                <th scope="row" className="px-6 py-4 font-medium text-zinc-100 sticky left-0 bg-zinc-800/95 backdrop-blur-sm z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)] border-r border-zinc-700">
                                  {result.input}
                                </th>
                                <td className="px-4 py-4 text-zinc-500 font-mono text-xs">{result.modelUsed}</td>
                                {attributes.map(attr => (
                                  <td key={attr.name} className="px-6 py-4 min-w-[150px] whitespace-pre-wrap text-zinc-300">
                                    {result.data[attr.name] || (result.status !== 'loading' ? <span className="text-zinc-600">-</span> : '')}
                                  </td>
                                ))}
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                )}
                </AnimatePresence>
                    </div>
                    {isCompareMode && (
                        <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl shadow-xl flex flex-col h-[calc(100vh-12rem)] sticky top-6 overflow-hidden">
                            <div className="p-3 border-b border-zinc-800 flex gap-2 items-center bg-zinc-900/95 backdrop-blur z-10">
                                <input
                                    type="text"
                                    placeholder="Nhập URL để xem trang (ví dụ: https://example.com)"
                                    value={compareUrlInput}
                                    onChange={(e) => setCompareUrlInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && setActiveCompareUrl(compareUrlInput)}
                                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-md text-sm px-3 py-1.5 text-zinc-300 outline-none focus:border-sky-500"
                                />
                                <Button
                                    onClick={() => setActiveCompareUrl(compareUrlInput)}
                                    className="!w-auto !py-1.5 !px-4 !text-xs whitespace-nowrap"
                                >
                                    Tải trang
                                </Button>
                            </div>
                            <div className="flex-1 bg-white relative">
                                {activeCompareUrl ? (
                                    <iframe
                                        key={activeCompareUrl}
                                        src={`/api/proxy-visual?url=${encodeURIComponent(activeCompareUrl)}`}
                                        className="w-full h-full border-0"
                                        title="Compare View"
                                        sandbox="allow-scripts allow-same-origin allow-forms"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950 p-6 text-center">
                                        <LayoutGrid className="w-12 h-12 mb-4 opacity-20" />
                                        <p className="text-sm font-medium text-zinc-400">Chế độ so sánh</p>
                                        <p className="text-xs mt-2">Nhập URL của trang web bạn đang trích xuất để xem và đối chiếu trực tiếp dữ liệu ở đây.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
            </motion.div>
            
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
                                        Chọn vùng trên trang (CSS Selector)
                                        </h3>
                                        <p className="text-[10px] text-zinc-400">Click vào phần tử trên trang web để trích xuất ID hoặc Class</p>
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
                                    <button onClick={() => setIsVisualPickerOpen(false)} className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-700 transition-colors">
                                        <X className="w-6 h-6"/>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Floating Toolbar inside the modal */}
                            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
                                <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 p-1.5 rounded-xl shadow-2xl flex items-center gap-1">
                                    <button 
                                        onClick={() => setPickerMode('single')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${pickerMode === 'single' ? 'bg-sky-500 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                                    >
                                        Phần tử đơn
                                    </button>
                                    <button 
                                        onClick={() => setPickerMode('list')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${pickerMode === 'list' ? 'bg-sky-500 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                                    >
                                        Danh sách (List)
                                    </button>
                                    <button 
                                        onClick={() => setPickerMode('container')}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${pickerMode === 'container' ? 'bg-sky-500 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                                    >
                                        Toàn bộ khối
                                    </button>
                                </div>
                                
                                {visualPickerResult && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-zinc-900/95 backdrop-blur-md border border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.3)] rounded-xl p-3 flex items-center gap-3 max-w-2xl"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-sky-400 font-medium mb-1 uppercase tracking-wider">Selector đã chọn ({pickerMode}):</p>
                                            <code className="text-xs text-white block truncate" title={visualPickerResult}>{visualPickerResult}</code>
                                        </div>
                                        <div className="flex items-center gap-2 border-l border-zinc-700 pl-3">
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(visualPickerResult);
                                                    setIsVisualPickerOpen(false);
                                                }}
                                                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap border border-zinc-700"
                                            >
                                                Copy
                                            </button>
                                            <button 
                                                onClick={() => setIsVisualPickerOpen(false)}
                                                className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors shadow-lg shadow-sky-900/20 whitespace-nowrap"
                                            >
                                                Xong
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
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
            
            
                    <AttributeConfigModal

                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                onSave={handleSaveConfig}
                initialAttributes={attributes}
                initialTimeout={timeout}
            />
            </>
            ) : (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-7xl mx-auto space-y-8 w-full"
                >
                    <div className="bg-zinc-800/40 p-6 rounded-2xl border border-zinc-700/50">
                        <h2 className="text-xl font-bold text-sky-400 mb-4 flex items-center gap-2">
                            <History className="w-6 h-6" /> Lịch sử Trích xuất Thuộc tính
                        </h2>
                        
                        {isLoadingHistory ? (
                            <div className="flex justify-center items-center py-12">
                                <Spinner className="w-8 h-8 text-sky-500" />
                            </div>
                        ) : historyList.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-zinc-700/50 rounded-xl">
                                <History className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                                <p className="text-zinc-400">Bạn chưa thực hiện trích xuất nào.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm text-left border-collapse">
                                    <thead className="text-xs text-zinc-400 uppercase tracking-wider bg-zinc-900/50 border-b border-zinc-700">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Thời gian</th>
                                            <th className="px-4 py-3 font-medium">Tài khoản</th>
                                            <th className="px-4 py-3 font-medium">Thao tác</th>
                                            <th className="px-4 py-3 font-medium text-center">SL Sản phẩm</th>
                                            <th className="px-4 py-3 font-medium">Bộ thuộc tính</th>
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
                                                    {item.details?.attributeSetName}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default ProductExtractorTab;
