
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import { groupMediaByColorWithAI, groupImagesByVariantsWithAI } from '../../services/geminiService';
import { fetchProductData, specializedScrape, isShopeePromotionalOverlay, type ScrapedProductData, type VariantGroup, ensureVariantGroups, splitProductIntoVariantRows, filterValidProductImagesAsync } from '../../utils/ecommerceScraper';
import TextArea from '../TextArea';
import Button from '../Button';
import Spinner from '../Spinner';
import { ImageDown, Video, X, Image as ImageIcon, FileText, Layers, Link, Trash2, Settings, Download, StopCircle, Table as TableIcon, LayoutGrid, FileSpreadsheet, ChevronDown, Check, Save, Upload, Database, Loader2, Copy, Crop, AlertTriangle, Split, Tag, Edit3, Plus, Sparkles, RefreshCw } from 'lucide-react';
import JSZip from 'jszip';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { exportScrapedImagesToXLSX, generateScrapedImagesTSV } from '../../utils/exportUtils';
import { createAndPushToGoogleSheet } from '../../utils/googleSheets';
import { db, auth } from '../../src/firebase';
import ImageCropperModal from '../modals/ImageCropperModal';
import { ImageHoverPreview } from '../ImageHoverPreview';
import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';
import { pushDataToPipeline } from '../../utils/pipelineCache';

type ScrapingResult = {
    data: ScrapedProductData;
    status: 'loading' | 'success' | 'error';
    error?: string;
    source: 'api' | 'ai';
    orderIndex?: number;
};

type Category = 'all' | 'main' | 'variants' | 'description' | 'video';

interface ScraperSettings {
    downloadAsZip: boolean;
    downloadTextInfo: boolean;
    useSubdirectories: boolean;
    convertToPng: boolean;
    filterShopeeBadges: boolean;
}

const DEFAULT_SETTINGS: ScraperSettings = {
    downloadAsZip: true,
    downloadTextInfo: false,
    useSubdirectories: true,
    convertToPng: false,
    filterShopeeBadges: true
};

// --- SETTINGS MODAL ---
const SettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    settings: ScraperSettings;
    onUpdate: (key: keyof ScraperSettings, value: boolean) => void;
    onExport: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ isOpen, onClose, settings, onUpdate, onExport, onImport }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
        <div className="flex items-center justify-between py-3 border-b border-zinc-700 last:border-0 cursor-pointer" onClick={onChange}>
            <span className="text-sm font-medium text-zinc-300">{label}</span>
            <div 
                className={`w-11 h-6 rounded-full relative transition-colors ${checked ? 'bg-sky-600' : 'bg-zinc-600'}`}
            >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${checked ? 'left-6' : 'left-1'}`}></div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-zinc-800 border border-zinc-700 w-full max-w-md rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-zinc-900 p-4 border-b border-zinc-700 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-sky-400"/>
                        <h3 className="text-white font-bold text-lg">Cài đặt Shopee Save</h3>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-700 transition-colors">
                        <X className="w-5 h-5"/>
                    </button>
                </div>
                <div className="p-6 bg-zinc-800 space-y-2">
                    <div className="flex gap-2 mb-4">
                        <Button onClick={onExport} colorScheme="zinc" className="flex-1 py-2 text-xs">
                            <Save className="w-4 h-4 mr-2" /> Lưu cấu hình
                        </Button>
                        <Button onClick={() => fileInputRef.current?.click()} colorScheme="zinc" className="flex-1 py-2 text-xs">
                            <Upload className="w-4 h-4 mr-2" /> Tải cấu hình
                        </Button>
                        <input 
                            type="file" 
                            accept=".json" 
                            ref={fileInputRef} 
                            onChange={onImport} 
                            className="hidden" 
                        />
                    </div>
                    <Toggle 
                        label="Tải xuống dạng file nén .ZIP" 
                        checked={settings.downloadAsZip} 
                        onChange={() => onUpdate('downloadAsZip', !settings.downloadAsZip)} 
                    />
                    <Toggle 
                        label="Tải kèm file thông tin sản phẩm (.txt)" 
                        checked={settings.downloadTextInfo} 
                        onChange={() => onUpdate('downloadTextInfo', !settings.downloadTextInfo)} 
                    />
                    <Toggle 
                        label="Tạo thư mục con theo tên sản phẩm" 
                        checked={settings.useSubdirectories} 
                        onChange={() => onUpdate('useSubdirectories', !settings.useSubdirectories)} 
                    />
                    <Toggle 
                        label="Chuyển đổi ảnh sang PNG (Mặc định JPG)" 
                        checked={settings.convertToPng} 
                        onChange={() => onUpdate('convertToPng', !settings.convertToPng)} 
                    />
                    <Toggle 
                        label="Tự động lọc ảnh Voucher Xtra & Khung KM Shopee" 
                        checked={settings.filterShopeeBadges ?? true} 
                        onChange={() => onUpdate('filterShopeeBadges', !(settings.filterShopeeBadges ?? true))} 
                    />
                </div>
                <div className="bg-zinc-900/50 p-4 border-t border-zinc-700 flex justify-end">
                    <Button onClick={onClose} className="!w-auto !px-6 !py-2">Đóng</Button>
                </div>
            </div>
        </div>
    );
};

// Validate if an image URL is genuine, functional, and not a dummy/tracker/placeholder
export const isValidScrapedImageUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
    if (trimmed.length < 12) return false;

    // Filter out Shopee promotional overlays (Voucher Xtra, Freeship Xtra, Shopee Mall frames)
    if (isShopeePromotionalOverlay(trimmed)) return false;

    const lower = trimmed.toLowerCase();
    
    // Ignore data URIs or blobs
    if (lower.startsWith('data:') || lower.startsWith('blob:')) return false;

    // Filter out common tracking pixels, spacers, dummy placeholders & UI icons
    const bannedPatterns = [
        'spacer.gif',
        'pixel.gif',
        'blank.gif',
        '1x1.gif',
        '1x1.png',
        '1x1.webp',
        'tracking.',
        'analytics.',
        'beacon.',
        'loading.gif',
        'spinner.',
        'example.com',
        'via.placeholder.com',
        'dummyimage.com',
        'placeholder.com',
        'default-avatar',
        'info.svg',
        'puzzle.svg',
        '/icons/',
        'site-logo',
        'favicon.',
        'payment-',
        'social-',
        'rating-',
        'badge-',
        '-thumb-',
        'thumb-',
        '/thumb/',
        '/gnb/',
        'gnb_',
        'featuredcard'
    ];
    if (bannedPatterns.some(pat => lower.includes(pat))) return false;

    try {
        const parsed = new URL(trimmed);
        if (!parsed.hostname || !parsed.hostname.includes('.')) return false;
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return false;
    } catch {
        return false;
    }

    return true;
};

// Clean and sanitize scraped product data to eliminate broken links
const sanitizeProductData = (d: ScrapedProductData): ScrapedProductData => {
    const cleanMain = (d.main || []).filter(isValidScrapedImageUrl);
    const cleanVariants = (d.variants || []).filter(isValidScrapedImageUrl);
    const cleanDesc = (d.description || []).filter(isValidScrapedImageUrl);
    const cleanVideos = (d.videos || []).filter(v => typeof v === 'string' && v.trim().startsWith('http'));

    let cleanVariantNames = d.variantNames;
    if (cleanVariantNames) {
        const updatedNames: Record<string, string> = {};
        for (const [vUrl, vName] of Object.entries(cleanVariantNames)) {
            if (isValidScrapedImageUrl(vUrl)) {
                updatedNames[vUrl] = vName;
            }
        }
        cleanVariantNames = updatedNames;
    }

    let cleanVariantGroups: VariantGroup[] = (d.variantGroups || []).map(vg => ({
        name: vg.name,
        image: isValidScrapedImageUrl(vg.image) ? vg.image : '',
        images: (vg.images || []).filter(isValidScrapedImageUrl)
    })).filter(vg => vg.image || (vg.images && vg.images.length > 0));

    if (cleanVariantGroups.length === 0 && cleanVariants.length > 0) {
        cleanVariants.forEach((vUrl, idx) => {
            cleanVariantGroups.push({
                name: cleanVariantNames?.[vUrl] || `Phân loại ${idx + 1}`,
                image: vUrl,
                images: [vUrl, ...cleanMain]
            });
        });
    }

    return {
        ...d,
        main: Array.from(new Set(cleanMain)),
        variants: Array.from(new Set(cleanVariants)),
        variantGroups: cleanVariantGroups.length > 0 ? cleanVariantGroups : undefined,
        description: Array.from(new Set(cleanDesc)),
        videos: Array.from(new Set(cleanVideos)),
        variantNames: cleanVariantNames
    };
};

const MediaItem: React.FC<{ 
    src: string; 
    type: 'image' | 'video'; 
    alt: string; 
    title?: string;
    category?: string;
    onDownload: (url: string) => void; 
    onEdit?: (url: string) => void;
    variantLabel?: string;
}> = ({ src, type, alt, title, category, onDownload, onEdit, variantLabel }) => {
    const getInitialSrc = (url: string) => {
        if (url.includes('panasonic.com') || url.includes('samsung.com') || url.includes('images.samsung.com') || url.includes('footjoy.com') || url.includes('titleist.com')) {
            return `/api/proxy?url=${encodeURIComponent(url)}`;
        }
        return url;
    };

    const [mediaSrc] = useState(() => getInitialSrc(src));
    const [isLoading, setIsLoading] = useState(true);
    const [isBroken, setIsBroken] = useState(false);

    if (type === 'video') {
        return (
            <div className="relative group aspect-square bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-700/50 flex items-center justify-center hover:border-sky-500/50 transition-colors">
                {isLoading && !isBroken && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 z-10">
                        <div className="w-5 h-5 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin"></div>
                    </div>
                )}
                {isBroken ? (
                    <div className="flex flex-col items-center justify-center p-3 text-center text-zinc-500">
                        <AlertTriangle className="w-5 h-5 text-amber-500 mb-1" />
                        <span className="text-[11px] font-semibold text-amber-400/90">Video bị lỗi</span>
                    </div>
                ) : (
                    <video 
                        src={mediaSrc} 
                        className="w-full h-full object-contain" 
                        controls 
                        onLoadedData={() => setIsLoading(false)}
                        onError={() => { setIsLoading(false); setIsBroken(true); }}
                    />
                )}
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-red-600/90 rounded text-[10px] font-bold text-white flex items-center gap-1 pointer-events-none shadow-sm z-20">
                    <Video className="w-3 h-3" /> VIDEO
                </div>
            </div>
        );
    }

    return (
        <ImageHoverPreview
            src={src}
            alt={alt}
            title={title}
            category={category}
            variantLabel={variantLabel}
            onDownload={onDownload}
            onEdit={onEdit}
            previewWidth={440}
            previewHeight={460}
        />
    );
};

const ScraperResultCard: React.FC<{ 
    url: string; 
    result: ScrapingResult; 
    indexNumber?: number;
    onDownloadSingle: (url: string) => void;
    onDownloadAll: (images: string[], videos: string[], title: string, price?: string) => void;
    onDownloadVariantGroup?: (group: VariantGroup, title: string, price?: string) => void;
    onDownloadSelectedVariantGroups?: (groups: VariantGroup[], title: string, price?: string) => void;
    onRemove: () => void;
    onRescrape?: () => void;
    onEditImage?: (url: string) => void;
    onSendToBatchFrame?: (images: string[], title: string, price?: string) => void;
    onUpdateResult?: (updatedData: ScrapedProductData) => void;
    onSplitToSeparateRows?: (items: ScrapedProductData[]) => void;
}> = ({ url, result, indexNumber, onDownloadSingle, onDownloadAll, onDownloadVariantGroup, onDownloadSelectedVariantGroups, onRemove, onRescrape, onEditImage, onSendToBatchFrame, onUpdateResult, onSplitToSeparateRows }) => {
    const [activeCategory, setActiveCategory] = useState<Category>('all');
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | 'all'>('all');
    const [selectedVariantIndices, setSelectedVariantIndices] = useState<number[]>([]);
    const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
    const [editingVariantName, setEditingVariantName] = useState<string>('');
    const [isAiDetecting, setIsAiDetecting] = useState(false);

    const PRESET_COLORS = ['Đen', 'Trắng', 'Xanh dương', 'Xanh lá', 'Hồng', 'Tím', 'Vàng', 'Đỏ', 'Bạc', 'Xám', 'Cam', 'Be'];

    // Construct robust list of variant groups unconditionally at the top of the hook chain
    const effectiveVariantGroups: VariantGroup[] = useMemo(() => {
        if (result.status !== 'success' || !result.data) return [];
        const { variantGroups, variants, variantNames, main } = result.data;
        if (variantGroups && variantGroups.length > 0) return variantGroups;
        if (variants && variants.length > 0) {
            return variants.map((vUrl, idx) => ({
                name: variantNames?.[vUrl] || `Phân loại ${idx + 1}`,
                image: vUrl,
                images: [vUrl, ...(main || [])]
            }));
        }
        return [];
    }, [result]);

    if (result.status === 'loading') {
        return (
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-6 flex flex-col items-center justify-center animate-pulse">
                {indexNumber !== undefined && (
                    <span className="mb-2 px-2.5 py-0.5 rounded-full bg-zinc-700/80 border border-zinc-600 text-zinc-300 text-xs font-bold font-mono">
                        #{indexNumber}
                    </span>
                )}
                <Spinner />
                <span className="mt-3 text-zinc-400 text-sm font-medium">Đang cào dữ liệu từ URL...</span>
                <p className="text-xs text-zinc-600 mt-1 truncate max-w-full">{url}</p>
            </div>
        );
    }

    if (result.status === 'error') {
        return (
            <div className="bg-red-900/10 border border-red-800/50 rounded-xl p-4 flex items-start gap-4">
                <div className="flex items-center gap-2">
                    {indexNumber !== undefined && (
                        <span className="w-7 h-7 rounded-lg bg-red-950/80 border border-red-800/60 text-red-300 text-xs font-bold flex items-center justify-center shrink-0 font-mono">
                            #{indexNumber}
                        </span>
                    )}
                    <div className="p-2 bg-red-900/20 rounded-lg text-red-400">
                        <X className="w-5 h-5" />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-red-300 mb-1 truncate">{url}</h3>
                    <p className="text-xs text-red-400/80">{result.error || 'Cào thất bại'}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {onRescrape && (
                        <button 
                            onClick={onRescrape} 
                            className="p-1.5 rounded-lg bg-red-900/30 text-red-300 hover:bg-red-900/50 transition-colors"
                            title="Thử cào lại"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={onRemove} className="text-zinc-500 hover:text-red-400 transition-colors p-1.5">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    const { main, variants, variantNames, description, videos, title, price } = result.data;

    const allImages = [...main, ...variants, ...description];
    const allCount = allImages.length + videos.length;

    const handleCopyCardTSV = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!result.data) return;

        const headers = ['STT', 'Tên sản phẩm', 'Giá', 'Phân loại/Màu', 'Link gốc', 'Ảnh chính', 'Tất cả link ảnh'];
        const mainImg = (result.data.main && result.data.main[0]) || '';
        const allImgsStr = displayImages.join(' ; ');
        const colorStr = result.data.color || (effectiveVariantGroups.map(g => g.name).join(', ')) || '';

        const row = [
            indexNumber || 1,
            `"${(title || '').replace(/"/g, '""')}"`,
            `"${(price || '').replace(/"/g, '""')}"`,
            `"${colorStr.replace(/"/g, '""')}"`,
            url.split('#')[0],
            mainImg,
            `"${allImgsStr.replace(/"/g, '""')}"`
        ];

        const tsvText = `${headers.join('\t')}\n${row.join('\t')}`;
        navigator.clipboard.writeText(tsvText).then(() => {
            toast.success(`Đã copy dữ liệu "${title.substring(0, 30)}..."! Dán (Ctrl+V) ngay vào Excel.`);
        }).catch(() => {
            toast.error('Không thể copy vào clipboard.');
        });
    };

    const handlePromoteToVariant = (imgUrl: string, customName?: string) => {
        if (!result.data) return;
        const currentMain = result.data.main || [];
        const currentVariants = result.data.variants || [];
        const currentGroups = result.data.variantGroups || [];
        const currentNames = { ...(result.data.variantNames || {}) };

        const defaultName = customName || `Phân loại ${currentVariants.length + 1}`;
        const newVariants = Array.from(new Set([...currentVariants, imgUrl]));
        currentNames[imgUrl] = defaultName;

        const remainingMain = currentMain.filter(u => u !== imgUrl);
        const updatedMain = remainingMain.length > 0 ? remainingMain : currentMain;

        const existingGroupIndex = currentGroups.findIndex(g => g.image === imgUrl);
        let updatedGroups: VariantGroup[] = [...currentGroups];
        if (existingGroupIndex >= 0) {
            updatedGroups[existingGroupIndex] = {
                ...updatedGroups[existingGroupIndex],
                name: defaultName
            };
        } else {
            updatedGroups.push({
                name: defaultName,
                image: imgUrl,
                images: [imgUrl, ...updatedMain]
            });
        }

        const updatedData: ScrapedProductData = {
            ...result.data,
            main: updatedMain,
            variants: newVariants,
            variantNames: currentNames,
            variantGroups: updatedGroups
        };

        onUpdateResult?.(updatedData);
        setActiveCategory('variants');
        toast.success(`Đã thêm ảnh vào phân loại: "${defaultName}"`);
    };

    const handleQuickAutoSplitVariants = () => {
        if (!result.data) return;
        const currentMain = result.data.main || [];
        if (currentMain.length <= 1) {
            toast.error("Cần ít nhất 2 ảnh để tách phân loại tự động");
            return;
        }

        const heroImage = currentMain[0];
        const candidateVariants = currentMain.slice(1);
        const currentNames = { ...(result.data.variantNames || {}) };
        const baseTitle = result.data.title || 'Sản phẩm';

        if (onSplitToSeparateRows && candidateVariants.length > 0) {
            const itemsToSplit: ScrapedProductData[] = candidateVariants.map((imgUrl, idx) => {
                const vName = currentNames[imgUrl] || `Phân loại ${idx + 1}`;
                return {
                    ...result.data!,
                    title: baseTitle.toLowerCase().includes(vName.toLowerCase()) ? baseTitle : `${baseTitle} - ${vName}`,
                    color: vName,
                    main: [imgUrl, heroImage],
                    variants: [imgUrl],
                    variantNames: { [imgUrl]: vName },
                    variantGroups: [{ name: vName, image: imgUrl, images: [imgUrl, heroImage] }]
                };
            });
            onSplitToSeparateRows(itemsToSplit);
            return;
        }

        const currentVariants = result.data.variants || [];
        const currentGroups: VariantGroup[] = [...(result.data.variantGroups || [])];

        candidateVariants.forEach((imgUrl, idx) => {
            const vName = currentNames[imgUrl] || `Phân loại ${currentGroups.length + idx + 1}`;
            currentNames[imgUrl] = vName;
            if (!currentGroups.some(g => g.image === imgUrl)) {
                currentGroups.push({
                    name: vName,
                    image: imgUrl,
                    images: [imgUrl, heroImage]
                });
            }
        });

        const newVariants = Array.from(new Set([...currentVariants, ...candidateVariants]));

        const updatedData: ScrapedProductData = {
            ...result.data,
            main: [heroImage],
            variants: newVariants,
            variantNames: currentNames,
            variantGroups: currentGroups
        };

        onUpdateResult?.(updatedData);
        setActiveCategory('variants');
        toast.success(`Đã tách ${candidateVariants.length} ảnh thành ${candidateVariants.length} phân loại! Bạn có thể sửa tên màu sắc ngay bên dưới.`);
    };

    const handleSaveRename = (gIdx: number, newName?: string) => {
        const targetName = (newName !== undefined ? newName : editingVariantName).trim();
        if (!targetName) {
            setEditingVariantIndex(null);
            return;
        }
        const targetGroup = effectiveVariantGroups[gIdx];
        if (!targetGroup) return;

        const currentNames = { ...(result.data?.variantNames || {}) };
        if (targetGroup.image) {
            currentNames[targetGroup.image] = targetName;
        }

        const updatedGroups = (result.data?.variantGroups || effectiveVariantGroups).map((g, idx) => {
            if (idx === gIdx) {
                return { ...g, name: targetName };
            }
            return g;
        });

        const updatedData: ScrapedProductData = {
            ...result.data!,
            variantNames: currentNames,
            variantGroups: updatedGroups
        };

        onUpdateResult?.(updatedData);
        setEditingVariantIndex(null);
        setEditingVariantName('');
        toast.success(`Đã đổi tên phân loại thành "${targetName}"`);
    };

    const handleMoveVariantToMain = (imgUrl: string) => {
        if (!result.data) return;
        const currentMain = result.data.main || [];
        const currentVariants = (result.data.variants || []).filter(u => u !== imgUrl);
        const currentNames = { ...(result.data.variantNames || {}) };
        delete currentNames[imgUrl];

        const currentGroups = (result.data.variantGroups || []).filter(g => g.image !== imgUrl);
        const updatedMain = Array.from(new Set([...currentMain, imgUrl]));

        const updatedData: ScrapedProductData = {
            ...result.data,
            main: updatedMain,
            variants: currentVariants,
            variantNames: currentNames,
            variantGroups: currentGroups.length > 0 ? currentGroups : undefined
        };

        onUpdateResult?.(updatedData);
        toast.success("Đã chuyển ảnh về lại Album Ảnh chính");
    };

    const handleAiDetectVariants = async () => {
        if (!result.data) return;
        const allCandidateImages = Array.from(new Set([...(result.data.main || []), ...(result.data.variants || [])]));
        if (allCandidateImages.length <= 1) {
            toast.error("Cần ít nhất 2 ảnh để nhận diện phân loại");
            return;
        }

        setIsAiDetecting(true);
        const toastId = toast.loading("Đang dùng AI tra cứu tên màu và phân loại chuẩn từ link Shopee...");
        try {
            const res = await fetch('/api/shopee/ai-detect-variants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    title,
                    images: allCandidateImages
                })
            });
            const json = await res.json();
            if (!res.ok || !json.success || !json.data) {
                throw new Error(json.error || "Không thể nhận diện phân loại");
            }

            const parsed = json.data;
            if (parsed.hasVariants && Array.isArray(parsed.variants) && parsed.variants.length > 0) {
                const aiVariantImages: string[] = [];
                const aiVariantNames: Record<string, string> = {};
                const aiVariantGroups: VariantGroup[] = [];
                const usedIndices = new Set<number>();

                const mainIndices: number[] = Array.isArray(parsed.mainIndices) && parsed.mainIndices.length > 0 
                    ? parsed.mainIndices 
                    : [1];
                const newMain = mainIndices.map((idx: number) => allCandidateImages[idx - 1]).filter(Boolean);

                parsed.variants.forEach((v: { name: string; imageIndex?: number }) => {
                    const cleanName = typeof v.name === 'string' ? v.name.trim() : '';
                    if (cleanName) {
                        let imgUrl = '';
                        if (typeof v.imageIndex === 'number' && allCandidateImages[v.imageIndex - 1]) {
                            imgUrl = allCandidateImages[v.imageIndex - 1];
                            usedIndices.add(v.imageIndex);
                        }
                        if (imgUrl) {
                            aiVariantImages.push(imgUrl);
                            aiVariantNames[imgUrl] = cleanName;
                        }
                        aiVariantGroups.push({
                            name: cleanName,
                            image: imgUrl,
                            images: Array.from(new Set([imgUrl, ...newMain])).filter(Boolean)
                        });
                    }
                });

                if (aiVariantGroups.length > 0) {
                    const finalMain = newMain.length > 0 ? newMain : allCandidateImages.filter((_, idx) => !usedIndices.has(idx + 1));
                    const updatedData: ScrapedProductData = {
                        ...result.data,
                        main: finalMain.length > 0 ? finalMain : [allCandidateImages[0]],
                        variants: aiVariantImages,
                        variantNames: aiVariantNames,
                        variantGroups: aiVariantGroups
                    };

                    onUpdateResult?.(updatedData);
                    setActiveCategory('variants');
                    toast.success(`Đã tự động nhận diện chuẩn ${aiVariantGroups.length} màu phân loại!`, { id: toastId });
                    return;
                }
            }
            toast.error("Không tìm thấy thông tin màu sắc phù hợp trên sàn.", { id: toastId });
        } catch (e: any) {
            console.error("AI Detect Variants Error:", e);
            toast.error(e.message || "Lỗi khi nhận diện biến thể", { id: toastId });
        } finally {
            setIsAiDetecting(false);
        }
    };

    const getDisplayItems = () => {
        switch (activeCategory) {
            case 'main': return { images: main, videos: [] };
            case 'variants': {
                if (selectedVariantIndex !== 'all' && effectiveVariantGroups[selectedVariantIndex]) {
                    const grp = effectiveVariantGroups[selectedVariantIndex];
                    const grpImages = grp.images && grp.images.length > 0 ? grp.images : [grp.image].filter(Boolean);
                    return { images: grpImages, videos: [] };
                }
                if (variants.length > 0) {
                    return { images: variants, videos: [] };
                }
                // If variants are 0, return main images so user can see and pick them into variants!
                return { images: main, videos: [] };
            }
            case 'description': return { images: description, videos: [] };
            case 'video': return { images: [], videos: videos };
            default: return { images: allImages, videos: videos };
        }
    };

    const { images: displayImages, videos: displayVideos } = getDisplayItems();

    const getVariantLabel = (imgUrl: string) => {
        if (variantNames && variantNames[imgUrl]) return variantNames[imgUrl];
        const grp = effectiveVariantGroups.find(g => g.image === imgUrl);
        if (grp) return grp.name;
        if (selectedVariantIndex !== 'all' && effectiveVariantGroups[selectedVariantIndex]) {
            return effectiveVariantGroups[selectedVariantIndex].name;
        }
        return undefined;
    };

    const FilterTab = ({ id, label, count, icon, alwaysShow }: { id: Category, label: string, count: number, icon?: React.ReactNode, alwaysShow?: boolean }) => {
        const isActive = activeCategory === id;
        if (count === 0 && id !== 'all' && !alwaysShow) return null;
        
        return (
            <button
                onClick={() => {
                    setActiveCategory(id);
                    if (id !== 'variants') {
                        setSelectedVariantIndex('all');
                    }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border
                    ${isActive 
                        ? 'bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-900/20' 
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }
                `}
            >
                {icon}
                {label} <span className={`ml-0.5 opacity-70 ${isActive ? 'text-sky-100' : 'text-zinc-500'}`}>{count}</span>
            </button>
        );
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-800/40 border border-zinc-700 rounded-2xl overflow-hidden shadow-lg"
        >
            {/* Card Header Top: Title & Badges */}
            <div className="p-4 sm:p-5 border-b border-zinc-700/50 bg-zinc-900/40 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {indexNumber !== undefined && (
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                #{indexNumber}
                            </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border tracking-wider ${result.source === 'api' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' : 'bg-purple-900/30 text-purple-400 border-purple-800/50'}`}>
                            {result.source === 'api' ? 'Shopee API' : 'AI Scan'}
                        </span>
                        {price && (
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                                {Number(price).toLocaleString('vi-VN')}₫
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        {onRescrape && (
                            <button 
                                onClick={onRescrape} 
                                className="text-zinc-500 hover:text-sky-400 p-1.5 rounded-lg hover:bg-sky-500/10 transition-colors shrink-0" 
                                title="Cào lại và cập nhật phân loại mới nhất"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        )}
                        <button 
                            onClick={onRemove} 
                            className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0" 
                            title="Xóa kết quả này"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-bold text-zinc-100 leading-snug mb-1" title={title}>{title}</h3>
                    <a href={url.split('#')[0]} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1 max-w-full truncate">
                        <Link className="w-3 h-3 shrink-0" />
                        <span className="truncate">{url.split('#')[0]}</span>
                    </a>
                </div>

                {/* Dedicated Action Toolbar with High-Performance Hierarchy */}
                {(displayVideos.length > 0 || displayImages.length > 0) && (
                    <div className="pt-3 border-t border-zinc-800/80 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
                        {/* Group A: Smart Tools & Variant Utilities */}
                        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    isExpanded 
                                        ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' 
                                        : 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30'
                                }`}
                                title={isExpanded ? "Thu gọn danh sách ảnh" : "Mở rộng hiển thị danh sách ảnh"}
                            >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                <span>{isExpanded ? 'Ẩn ảnh' : 'Xem ảnh'}</span>
                            </button>

                            {/* 1-Click Auto Split Button in header toolbar */}
                            {main.length > 1 && (
                                <button
                                    onClick={handleQuickAutoSplitVariants}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-lg text-xs font-medium transition-all"
                                    title="Tự động giữ ảnh 1 làm ảnh chính và chuyển các ảnh màu lẻ còn lại thành từng phân loại riêng"
                                >
                                    <Split className="w-3.5 h-3.5 text-sky-400" />
                                    <span>Tách {main.length - 1} phân loại</span>
                                </button>
                            )}

                            {/* AI Color Detection Button */}
                            <button
                                onClick={handleAiDetectVariants}
                                disabled={isAiDetecting}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium transition-all"
                                title="Tự động tra cứu tên màu sắc chuẩn (Đen, Xanh dương, Tím, Hồng...) từ link Shopee bằng AI"
                            >
                                {isAiDetecting ? <Spinner className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                                <span>{isAiDetecting ? 'Đang dò...' : 'AI Màu'}</span>
                            </button>

                            {/* Split existing variant groups to separate rows */}
                            {effectiveVariantGroups.length > 1 && onSplitToSeparateRows && (
                                <button
                                    onClick={() => {
                                        if (result.data) {
                                            const splitItems = splitProductIntoVariantRows(result.data, url);
                                            onSplitToSeparateRows(splitItems);
                                        }
                                    }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition-all"
                                    title="Tách sản phẩm này thành nhiều dòng phân loại riêng biệt trong danh sách"
                                >
                                    <Split className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Tách {effectiveVariantGroups.length} dòng</span>
                                </button>
                            )}

                            {/* Re-scrape Button */}
                            {onRescrape && (
                                <button
                                    onClick={onRescrape}
                                    className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-sky-400 hover:bg-zinc-800 rounded-lg text-xs transition-colors"
                                    title="Cào lại từ sàn Shopee để cập nhật biến thể mới nhất"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                                    <span className="hidden sm:inline">Cào lại</span>
                                </button>
                            )}
                        </div>

                        {/* Group B: High-Priority Primary Flow & Fast Copy Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Fast Copy for Excel Button */}
                            <button
                                onClick={handleCopyCardTSV}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/40 rounded-lg text-xs font-bold transition-all shadow-sm"
                                title="Sao chép toàn bộ dữ liệu sản phẩm dạng bảng (TSV). Nhấn Ctrl+V để dán trực tiếp vào cột file Excel của bạn."
                            >
                                <Copy className="w-3.5 h-3.5 text-teal-400" />
                                <span>Copy Excel (Ctrl+V)</span>
                            </button>

                            {/* Send to Batch Frame */}
                            {onSendToBatchFrame && displayImages.length > 0 && (
                                <button 
                                    onClick={() => onSendToBatchFrame(displayImages, title, price)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-950/30 active:scale-95"
                                    title="Chuyển toàn bộ ảnh sản phẩm này sang công cụ Tạo khung & Ghép quà tặng"
                                >
                                    🎁 Ghép Khung
                                </button>
                            )}

                            {/* Push to 1-Step Pipeline */}
                            <button 
                                onClick={() => {
                                    pushDataToPipeline({
                                        title,
                                        url,
                                        price,
                                        images: displayImages,
                                        sourceTabLabel: 'Đào Ảnh'
                                    });
                                    toast.success("Đã đẩy dữ liệu sang Luồng 1-Step!");
                                }}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-950/30 active:scale-95"
                                title="Chuyển dữ liệu sang Luồng 1-Step (Pipeline)"
                            >
                                <Layers className="w-3.5 h-3.5 text-white" />
                                <span>⚡ Đẩy 1-Step</span>
                            </button>

                            {/* Download Buttons */}
                            {effectiveVariantGroups.length > 0 && onDownloadSelectedVariantGroups && (
                                <button 
                                    onClick={() => {
                                        const targets = selectedVariantIndices.length > 0 
                                            ? selectedVariantIndices.map(i => effectiveVariantGroups[i]).filter(Boolean)
                                            : effectiveVariantGroups;
                                        onDownloadSelectedVariantGroups(targets, title, price);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all"
                                    title="Tải ảnh theo từng nhóm biến thể (Tự động chia thư mục ZIP theo tên phân loại)"
                                >
                                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Tải biến thể</span>
                                </button>
                            )}

                            <button 
                                onClick={() => onDownloadAll(displayImages, displayVideos, title, price)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg text-xs font-bold transition-all shadow-sm"
                                title="Tải toàn bộ ảnh & video của sản phẩm này dạng file nén ZIP"
                            >
                                <Download className="w-3.5 h-3.5"/>
                                <span>Tải ZIP ({displayVideos.length + displayImages.length})</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 sm:p-5">
                            {/* Filter Toolbar - Phân loại ALWAYS visible */}
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                <FilterTab id="all" label="Tất cả" count={allCount} />
                                <FilterTab id="main" label="Ảnh chính" count={main.length} icon={<ImageIcon className="w-3.5 h-3.5"/>} />
                                <FilterTab id="variants" label="Phân loại" count={Math.max(variants.length, effectiveVariantGroups.length)} icon={<Layers className="w-3.5 h-3.5"/>} alwaysShow />
                                <FilterTab id="description" label="Mô tả" count={description.length} icon={<FileText className="w-3.5 h-3.5"/>} />
                                <FilterTab id="video" label="Video" count={videos.length} icon={<Video className="w-3.5 h-3.5"/>} />
                            </div>

                            {/* Helper Banner when in 'variants' tab but 0 variants exist yet */}
                            {effectiveVariantGroups.length === 0 && activeCategory === 'variants' && (
                                <div className="mb-4 bg-gradient-to-r from-sky-950/40 via-zinc-900/60 to-indigo-950/40 border border-sky-600/40 rounded-xl p-4 shadow-lg">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-4 h-4 text-sky-400" />
                                                <span className="text-sm font-bold text-sky-200">Chưa có phân loại tự động từ sàn</span>
                                            </div>
                                            <p className="text-xs text-zinc-400">
                                                Sản phẩm này có <strong className="text-zinc-200">{main.length} ảnh</strong> trong Album chính. Bạn có thể nhanh chóng tách các ảnh màu lẻ thành phân loại riêng:
                                            </p>
                                        </div>
                                        {main.length > 1 && (
                                            <button
                                                onClick={handleQuickAutoSplitVariants}
                                                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-sky-900/30 flex items-center gap-2 shrink-0"
                                            >
                                                <Split className="w-4 h-4" />
                                                ⚡ 1-Click: Tách {main.length - 1} ảnh thành phân loại
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-zinc-500 mt-2.5 pt-2 border-t border-zinc-800/80">
                                        💡 Mẹo: Bạn cũng có thể di chuột vào từng ảnh chuột/màu lẻ bên dưới và bấm nút <span className="text-sky-300 font-bold">+ Phân loại</span> để tự chỉ định biến thể.
                                    </p>
                                </div>
                            )}

                            {/* Variant Groups Panel (Interactive Selection, Inline Rename & Batch Download) */}
                            {effectiveVariantGroups.length > 0 && (
                                <div className="mb-4 bg-zinc-900/60 border border-zinc-700/80 rounded-xl p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                                                <Layers className="w-4 h-4 text-sky-400" />
                                                Biến thể sản phẩm ({effectiveVariantGroups.length} phân loại):
                                            </span>
                                            <span className="text-[11px] text-zinc-400">
                                                {selectedVariantIndices.length > 0 
                                                    ? `Đã chọn ${selectedVariantIndices.length}/${effectiveVariantGroups.length} nhóm` 
                                                    : 'Nhấp để lọc xem, sửa tên hoặc tải từng nhóm'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {main.length > 1 && (
                                                <button
                                                    onClick={handleQuickAutoSplitVariants}
                                                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/50 border border-sky-800/50"
                                                    title="Tách lại toàn bộ ảnh lẻ từ album chính"
                                                >
                                                    <Split className="w-3 h-3" />
                                                    Tách lại
                                                </button>
                                            )}
                                            {selectedVariantIndices.length > 0 ? (
                                                <button
                                                    onClick={() => setSelectedVariantIndices([])}
                                                    className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                                                >
                                                    Bỏ chọn hết
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setSelectedVariantIndices(effectiveVariantGroups.map((_, i) => i))}
                                                    className="text-[11px] text-sky-400 hover:text-sky-300 underline"
                                                >
                                                    Chọn tất cả ({effectiveVariantGroups.length})
                                                </button>
                                            )}
                                            {onDownloadSelectedVariantGroups && (
                                                <button
                                                    onClick={() => {
                                                        const targets = selectedVariantIndices.length > 0 
                                                            ? selectedVariantIndices.map(i => effectiveVariantGroups[i]).filter(Boolean)
                                                            : effectiveVariantGroups;
                                                        onDownloadSelectedVariantGroups(targets, title, price);
                                                    }}
                                                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] font-bold transition-all shadow-sm"
                                                    title="Tải các nhóm biến thể được chọn vào file ZIP chia theo thư mục"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    {selectedVariantIndices.length > 0 
                                                        ? `Tải ${selectedVariantIndices.length} biến thể chọn (ZIP)` 
                                                        : `Tải trọn bộ ${effectiveVariantGroups.length} biến thể (ZIP)`}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Variant Pills with Thumbnails & Inline Quick Edit */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <button
                                            onClick={() => {
                                                setSelectedVariantIndex('all');
                                                setActiveCategory('variants');
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                                selectedVariantIndex === 'all' && activeCategory === 'variants'
                                                    ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
                                                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                            }`}
                                        >
                                            <span>Tất cả biến thể ({effectiveVariantGroups.length})</span>
                                        </button>
                                        {effectiveVariantGroups.map((grp, gIdx) => {
                                            const isSelected = selectedVariantIndex === gIdx && activeCategory === 'variants';
                                            const isChecked = selectedVariantIndices.includes(gIdx);
                                            const isEditing = editingVariantIndex === gIdx;
                                            const grpImages = grp.images && grp.images.length > 0 ? grp.images : [grp.image].filter(Boolean);

                                            return (
                                                <div
                                                    key={`vg-${gIdx}`}
                                                    className={`relative flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg text-xs border transition-all ${
                                                        isSelected
                                                            ? 'bg-sky-950/70 border-sky-500 text-sky-200 shadow-sm shadow-sky-900/20'
                                                            : isChecked
                                                            ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                                                            : 'bg-zinc-800/70 border-zinc-700/70 text-zinc-300 hover:border-zinc-500'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedVariantIndices(prev => 
                                                                prev.includes(gIdx) ? prev.filter(i => i !== gIdx) : [...prev, gIdx]
                                                            );
                                                        }}
                                                        className="w-3.5 h-3.5 rounded border-zinc-600 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                                        title="Chọn nhóm biến thể này để tải hàng loạt"
                                                    />

                                                    {grp.image && (
                                                        <img
                                                            src={grp.image}
                                                            alt={grp.name}
                                                            className="w-5 h-5 rounded object-cover border border-zinc-600 shrink-0"
                                                            loading="lazy"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    )}

                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                value={editingVariantName}
                                                                onChange={e => setEditingVariantName(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleSaveRename(gIdx);
                                                                    if (e.key === 'Escape') setEditingVariantIndex(null);
                                                                }}
                                                                className="bg-zinc-900 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white w-24 focus:outline-none"
                                                                autoFocus
                                                                placeholder="Tên màu..."
                                                            />
                                                            <button
                                                                onClick={() => handleSaveRename(gIdx)}
                                                                className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50 rounded"
                                                                title="Lưu tên phân loại"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingVariantIndex(null)}
                                                                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded"
                                                                title="Hủy"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedVariantIndex(gIdx);
                                                                setActiveCategory('variants');
                                                            }}
                                                            className="flex items-center gap-1 font-medium hover:underline text-left"
                                                            title={`Xem ${grpImages.length} ảnh của ${grp.name}`}
                                                        >
                                                            <span className="truncate max-w-[120px] font-semibold">{grp.name}</span>
                                                            <span className="text-[10px] opacity-70">({grpImages.length})</span>
                                                        </button>
                                                    )}

                                                    {/* Quick Rename Button */}
                                                    {!isEditing && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingVariantIndex(gIdx);
                                                                setEditingVariantName(grp.name);
                                                            }}
                                                            className="p-1 text-zinc-400 hover:text-sky-300 hover:bg-zinc-700/60 rounded transition-colors"
                                                            title="Đổi tên phân loại này (như Đen, Xanh, Hồng...)"
                                                        >
                                                            <Edit3 className="w-3 h-3" />
                                                        </button>
                                                    )}

                                                    {/* Move Back to Main Album */}
                                                    {grp.image && !isEditing && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMoveVariantToMain(grp.image);
                                                            }}
                                                            className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                            title="Bỏ phân loại này (chuyển về lại Album Ảnh chính)"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}

                                                    {onDownloadVariantGroup && !isEditing && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDownloadVariantGroup(grp, title, price);
                                                            }}
                                                            className="p-1 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 rounded transition-colors"
                                                            title={`Tải riêng nhóm biến thể "${grp.name}" (${grpImages.length} ảnh)`}
                                                        >
                                                            <Download className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Fast Preset Color Selector when editing */}
                                    {editingVariantIndex !== null && (
                                        <div className="mt-2.5 pt-2 border-t border-zinc-800 flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Chọn nhanh màu:</span>
                                            {PRESET_COLORS.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => handleSaveRename(editingVariantIndex, c)}
                                                    className="px-2 py-0.5 rounded text-[11px] bg-zinc-800 hover:bg-sky-600 text-zinc-200 hover:text-white border border-zinc-700 transition-colors"
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Media Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                {displayVideos.map((vidUrl, idx) => (
                                    <MediaItem 
                                        key={`vid-${idx}`} 
                                        src={vidUrl} 
                                        type="video" 
                                        alt="Product Video" 
                                        onDownload={onDownloadSingle}
                                    />
                                ))}
                                {displayImages.map((imgUrl, idx) => {
                                    const isVar = variants.includes(imgUrl) || effectiveVariantGroups.some(g => g.image === imgUrl);
                                    const vLabel = getVariantLabel(imgUrl);

                                    return (
                                        <div key={`img-wrap-${idx}`} className="relative group/card">
                                            <MediaItem 
                                                key={`img-${idx}`} 
                                                src={imgUrl} 
                                                type="image" 
                                                alt={`Product Image ${idx}`} 
                                                title={title}
                                                category={activeCategory === 'all' ? undefined : activeCategory}
                                                onDownload={onDownloadSingle}
                                                onEdit={onEditImage}
                                                variantLabel={vLabel}
                                            />

                                            {/* Quick 1-click variant action button on thumbnail */}
                                            <div className="absolute bottom-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-20 flex items-center gap-1">
                                                {isVar ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMoveVariantToMain(imgUrl);
                                                        }}
                                                        className="px-2 py-1 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-md text-[10px] font-bold border border-zinc-700/80 shadow-md backdrop-blur-md flex items-center gap-1 transition-all"
                                                        title="Chuyển ảnh này về lại Album ảnh chính"
                                                    >
                                                        <X className="w-3 h-3 text-red-400" />
                                                        <span>Bỏ phân loại</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePromoteToVariant(imgUrl);
                                                        }}
                                                        className="px-2 py-1 bg-sky-600/90 hover:bg-sky-500 text-white rounded-md text-[10px] font-bold border border-sky-400/50 shadow-md backdrop-blur-md flex items-center gap-1 transition-all"
                                                        title="Tạo phân loại mới từ ảnh này"
                                                    >
                                                        <Layers className="w-3 h-3 text-sky-200" />
                                                        <span>+ Phân loại</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                {displayVideos.length === 0 && displayImages.length === 0 && (
                                    <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-800 rounded-xl">
                                        <p className="text-zinc-500 text-sm">Không có nội dung trong mục này.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const ImageScraperTab: React.FC = () => {
    const [urlsInput, setUrlsInput] = usePersistedState<string>('scraper_urlsInput', '');
    const [scrapingResults, setScrapingResults] = usePersistedState<Record<string, ScrapingResult>>('scraper_results', {});
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'table'>('scraper_viewMode', 'table');
    const [selectedPlatform, setSelectedPlatform] = usePersistedState<string>('scraper_selectedPlatform', 'auto');
    const [isLoading, setIsLoading] = useState(false);
    const [totalToProcess, setTotalToProcess] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<ScraperSettings>(DEFAULT_SETTINGS);
    const [isDownloading, setIsDownloading] = useState(false);
    
    // Visual Picker States
    const [isVisualPickerOpen, setIsVisualPickerOpen] = useState(false);
    const [visualPickerUrl, setVisualPickerUrl] = useState('');
    const [visualSelector, setVisualSelector] = useState('');
    const [variantSelector, setVariantSelector] = useState('');
    const [visualPickerTarget, setVisualPickerTarget] = useState<'main' | 'variant'>('main');
    const [pickerMode, setPickerMode] = useState<'pick' | 'navigate'>('pick');
    const [showAllPlatforms, setShowAllPlatforms] = useState(false);
    const pickerIframeRef = useRef<HTMLIFrameElement>(null);
    
    const stopSignal = useRef<boolean>(false);

    // Load settings
    useEffect(() => {
        const saved = localStorage.getItem('shopee_save_settings');
        if (saved) {
            try { setSettings(JSON.parse(saved)); } catch(e){}
        }
    }, []);

    useEffect(() => {
        if (isVisualPickerOpen) {
            setPickerMode('pick');
        }
    }, [isVisualPickerOpen]);

    const handleToggleMode = (mode: 'pick' | 'navigate') => {
        setPickerMode(mode);
        pickerIframeRef.current?.contentWindow?.postMessage({ type: 'SET_MODE', mode }, '*');
    };

    // Listen for Visual Picker messages
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data && e.data.type === 'PICKER_RESULT') {
                if (visualPickerTarget === 'main') {
                    setVisualSelector(e.data.selector);
                } else {
                    setVariantSelector(e.data.selector);
                }
                toast.success(`Đã chọn: ${e.data.selector}. Nhấn nút "Xong" để lưu!`);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [visualPickerTarget]);

    const updateSettings = (key: keyof ScraperSettings, value: boolean) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        localStorage.setItem('shopee_save_settings', JSON.stringify(newSettings));
    };

    const handleStop = () => {
        stopSignal.current = true;
    };

    const handleExportSettings = () => {
        const exportData = {
            platform: selectedPlatform,
            viewMode: viewMode,
            settings: settings
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scraper_settings_${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data.platform) setSelectedPlatform(data.platform);
                if (data.viewMode) setViewMode(data.viewMode);
                if (data.settings) {
                    setSettings(data.settings);
                    localStorage.setItem('shopee_save_settings', JSON.stringify(data.settings));
                }
                alert('Tải cấu hình thành công!');
            } catch (err) {
                alert('File cấu hình không hợp lệ!');
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        e.target.value = '';
    };

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isPushingSheet, setIsPushingSheet] = useState(false);
    const [sheetResultUrl, setSheetResultUrl] = useState<string | null>(null);

    const [cropperState, setCropperState] = useState<{
        isOpen: boolean;
        imgUrl: string;
        resultUrl: string;
    } | null>(null);

    const handleEditImage = (resultUrl: string, imgUrl: string) => {
        setCropperState({
            isOpen: true,
            imgUrl,
            resultUrl
        });
    };

    const handleSaveCrop = (newUrl: string) => {
        if (!cropperState) return;
        const { resultUrl, imgUrl: oldUrl } = cropperState;
        
        setScrapingResults(prev => {
            const result = prev[resultUrl];
            if (!result || result.status !== 'success') return prev;
            
            const data = { ...result.data };
            if (data.main) data.main = data.main.map(url => url === oldUrl ? newUrl : url);
            if (data.variants) data.variants = data.variants.map(url => url === oldUrl ? newUrl : url);
            if (data.description) data.description = data.description.map(url => url === oldUrl ? newUrl : url);
            
            return {
                ...prev,
                [resultUrl]: { ...result, data }
            };
        });
        setCropperState(null);
    };

    const handleSendToBatchFrame = (images: string[], title: string, price?: string) => {
        const importData = {
            productName: title,
            giftText: '🎁 TẶNG QUÀ XỊN',
            images: images,
            price: price
        };
        localStorage.setItem('batchFrame_importData', JSON.stringify(importData));
        toast.success('Đang chuyển dữ liệu sang Tạo Khung Hàng Loạt...');
        window.dispatchEvent(new CustomEvent('change-active-tab', { detail: 'batch-frame' }));
    };

    const handleExportExcel = (mode: 'all' | 'main' = 'all') => {
        if (resultsArray.length === 0) {
            toast.error('Chưa có dữ liệu để xuất Excel!');
            setIsExportMenuOpen(false);
            return;
        }

        const exportData = resultsArray.map((r, idx) => ({
            stt: idx + 1,
            url: r.url.split('#')[0],
            title: r.data?.title || r.url,
            color: r.data?.color || '',
            main: r.data?.main || [],
            variants: r.data?.variants || [],
            variantNames: r.data?.variantNames || {},
            variantGroups: r.data?.variantGroups || [],
            description: r.data?.description || [],
            videos: r.data?.videos || [],
            status: r.status,
            error: r.error
        }));

        exportScrapedImagesToXLSX(exportData, mode);
        setIsExportMenuOpen(false);
    };

    const handleCopyExcelData = async (mode: 'all' | 'main' = 'all') => {
        if (resultsArray.length === 0) {
            toast.error('Không có dữ liệu để copy!');
            setIsExportMenuOpen(false);
            return;
        }
        
        const exportData = resultsArray.map((r, idx) => ({
            stt: idx + 1,
            url: r.url.split('#')[0],
            title: r.data?.title || r.url,
            color: r.data?.color || '',
            main: r.data?.main || [],
            variants: r.data?.variants || [],
            variantNames: r.data?.variantNames || {},
            variantGroups: r.data?.variantGroups || [],
            description: r.data?.description || [],
            videos: r.data?.videos || [],
            status: r.status,
            error: r.error
        }));

        const tsv = generateScrapedImagesTSV(exportData, mode);
        try {
            await navigator.clipboard.writeText(tsv);
            toast.success(`Đã copy ${exportData.length} dòng dữ liệu dạng bảng! Nhấn Ctrl+V để dán trực tiếp vào Excel.`);
        } catch (e) {
            toast.error('Lỗi khi copy dữ liệu, vui lòng thử lại.');
        }
        setIsExportMenuOpen(false);
    };

    const handlePushToSheets = async (mode: 'all' | 'main' = 'all') => {
        const token = localStorage.getItem('googleAccessToken');
        if (!token) {
            alert("Chưa đăng nhập với Google Workspace. Vui lòng đăng nhập lại ở Dashboard để cấp quyền Google Drive & Sheets.");
            return;
        }

        if (resultsArray.length === 0) {
             alert('Không có dữ liệu để đồng bộ!');
             setIsExportMenuOpen(false);
             return;
        }

        const exportData: any[] = [];
        let currentRow = 1;
        resultsArray.forEach((r) => {
            const hasVariants = (r.data?.variants && r.data.variants.length > 0) || (r.data?.variantGroups && r.data.variantGroups.length > 0);
            if (hasVariants && mode !== 'main') {
                const vList = r.data?.variantGroups && r.data.variantGroups.length > 0 
                    ? r.data.variantGroups 
                    : (r.data?.variants || []).map((vUrl, vIdx) => ({
                        name: r.data?.variantNames?.[vUrl] || `Phân loại ${vIdx + 1}`,
                        image: vUrl,
                        images: [vUrl, ...(r.data?.main || [])]
                    }));
                vList.forEach(v => {
                    const vImages = Array.isArray(v.images) && v.images.length > 0 ? v.images : [v.image].filter(Boolean);
                    exportData.push({
                        'STT': currentRow++,
                        'Tên Sản Phẩm': `${r.data?.title || r.url} - ${v.name}`,
                        'Link web': r.url.split('#')[0],
                        'Trạng thái': r.status === 'success' ? 'Thành công' : (r.error ? `Thất bại: ${r.error}` : 'Thất bại'),
                        'Phân loại màu': v.name,
                        'Số lượng ảnh': vImages.length,
                        'Link ảnh tổng': vImages.join('\n'),
                        'Tổng media': vImages.length + (r.data?.description?.length || 0) + (r.data?.videos?.length || 0)
                    });
                });
            } else {
                exportData.push({
                    'STT': currentRow++,
                    'Tên Sản Phẩm': r.data?.title || r.url,
                    'Link web': r.url.split('#')[0],
                    'Trạng thái': r.status === 'success' ? 'Thành công' : (r.error ? `Thất bại: ${r.error}` : 'Thất bại'),
                    'Phân loại màu': r.data?.color || 'Mặc định',
                    'Số lượng ảnh': r.data?.main?.length || 0,
                    'Link ảnh chính': mode === 'main' ? (r.data?.main || []).join('\n') : '',
                    'Tổng media': (r.data?.main?.length || 0) + (r.data?.variants?.length || 0) + (r.data?.description?.length || 0) + (r.data?.videos?.length || 0)
                });
            }
        });

        setIsPushingSheet(true);
        setSheetResultUrl(null);
        setIsExportMenuOpen(false);
        try {
            const link = await createAndPushToGoogleSheet(`Scraper_Sync_${new Date().getTime()}`, exportData, token);
            setSheetResultUrl(link);
        } catch (e: any) {
            alert(e.message || "Đã xảy ra lỗi khi đồng bộ lên Google Sheets.");
        } finally {
            setIsPushingSheet(false);
        }
    };

    const handleRemoveResult = (url: string) => {
        const newResults = { ...scrapingResults };
        delete newResults[url];
        setScrapingResults(newResults);
    };

    const handleRescrapeUrl = async (url: string) => {
        const cleanU = url.split('#')[0];
        const toastId = toast.loading(`Đang cào lại và cập nhật phân loại: ${cleanU.substring(0, 45)}...`);
        try {
            setScrapingResults(prev => ({
                ...prev,
                [url]: {
                    ...prev[url],
                    status: 'loading'
                }
            }));

            const rawData = await fetchProductData(cleanU, selectedPlatform, visualSelector, variantSelector);
            if (rawData && !Array.isArray(rawData)) {
                const sanitized = sanitizeProductData(rawData);
                setScrapingResults(prev => ({
                    ...prev,
                    [url]: {
                        data: sanitized,
                        status: 'success',
                        source: 'api',
                        orderIndex: prev[url]?.orderIndex ?? 1
                    }
                }));
                const vCount = Math.max(sanitized.variantGroups?.length || 0, sanitized.variants?.length || 0);
                toast.success(`Đã cập nhật xong! Lấy được ${vCount} phân loại.`, { id: toastId });
            } else if (Array.isArray(rawData) && rawData.length > 0) {
                const sanitizedList = rawData.map(sanitizeProductData);
                setScrapingResults(prev => {
                    const updated = { ...prev };
                    delete updated[url];
                    sanitizedList.forEach((d, idx) => {
                        const subUrl = `${cleanU}#${d.color || idx}`;
                        updated[subUrl] = {
                            data: d,
                            status: 'success',
                            source: 'api',
                            orderIndex: 1 + idx * 0.001
                        };
                    });
                    return updated;
                });
                toast.success(`Đã cập nhật ${rawData.length} phân loại!`, { id: toastId });
            } else {
                toast.error("Không lấy được dữ liệu mới từ sàn.", { id: toastId });
                setScrapingResults(prev => ({
                    ...prev,
                    [url]: {
                        ...prev[url],
                        status: 'error',
                        error: 'Không lấy được dữ liệu phân loại mới.'
                    }
                }));
            }
        } catch (e: any) {
            toast.error(`Lỗi: ${e.message}`, { id: toastId });
            setScrapingResults(prev => ({
                ...prev,
                [url]: {
                    ...prev[url],
                    status: 'error',
                    error: e.message
                }
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const rawList = urlsInput.split('\n').map(u => u.trim()).filter(Boolean);

        // Deduplicate URLs (keep only unique links, ignore trailing slash differences)
        const seenUrls = new Set<string>();
        const urlsToProcess: string[] = [];
        rawList.forEach(raw => {
            const normalized = raw.replace(/\/+$/, '');
            if (!seenUrls.has(normalized)) {
                seenUrls.add(normalized);
                urlsToProcess.push(raw);
            }
        });

        if (urlsToProcess.length < rawList.length) {
            toast.success(`Đã tự động lọc trùng ${rawList.length - urlsToProcess.length} liên kết!`);
        }

        if (urlsToProcess.length === 0) {
            setError('Vui lòng nhập ít nhất một URL.');
            return;
        }

        setIsLoading(true);
        setError(null);
        stopSignal.current = false;
        setTotalToProcess(urlsToProcess.length);
        setProcessedCount(0);
        
        // Initialize placeholders
        const newResults: Record<string, ScrapingResult> = { ...scrapingResults };
        let maxOrderIndex = 0;
        Object.values(newResults).forEach(r => {
            if (r.orderIndex && r.orderIndex > maxOrderIndex) {
                maxOrderIndex = Math.ceil(r.orderIndex);
            }
        });
        
        let currentOrder = maxOrderIndex;
        urlsToProcess.forEach(url => {
            currentOrder += 1;
            const existing = newResults[url];
            const hasExistingVariants = ((existing?.data?.variants?.length || 0) > 0) || ((existing?.data?.variantGroups?.length || 0) > 0);
            if (existing && existing.status === 'success' && hasExistingVariants) {
                newResults[url] = {
                    ...newResults[url],
                    orderIndex: currentOrder
                };
            } else {
                newResults[url] = { 
                    data: { title: url, main: [], variants: [], description: [], videos: [] }, 
                    status: 'loading', 
                    source: 'api',
                    orderIndex: currentOrder
                };
            }
        });
        setScrapingResults(newResults);
        setUrlsInput(''); // Clear input after adding to queue

        for (const url of urlsToProcess) {
            if (stopSignal.current) break;
            
            const initialOrder = newResults[url]?.orderIndex ?? 1;

            // Skip only if already successfully loaded AND already has extracted variants
            const itemInCache = scrapingResults[url];
            const hasVariantsInCache = ((itemInCache?.data?.variants?.length || 0) > 0) || ((itemInCache?.data?.variantGroups?.length || 0) > 0);
            if (itemInCache?.status === 'success' && hasVariantsInCache) {
                setProcessedCount(prev => prev + 1);
                continue;
            }

            const resultsToUpdate: { url: string, data: any, source: 'api' | 'ai', status: 'success' | 'error', error?: string }[] = [];

            try {
                let data: ScrapedProductData | ScrapedProductData[] | null = await fetchProductData(url, selectedPlatform, visualSelector, variantSelector);
                let source: 'api' | 'ai' = 'api';

                // AI Refinement for Shopify multi-color results (Fixes mixed colors issue)
                if (Array.isArray(data) && data.length > 1 && data[0].fullMedia && data[0].colorGroups) {
                    try {
                        const refinedGrouping = await groupMediaByColorWithAI(data[0].fullMedia, data[0].colorGroups);
                        if (Object.keys(refinedGrouping).length > 0) {
                            data = data.map(d => {
                                if (d.color && refinedGrouping[d.color]) {
                                    let newMain = refinedGrouping[d.color];
                                    // Re-append size charts because AI grouping doesn't know about them (they are scraped from HTML)
                                    if (d.sizeCharts && d.sizeCharts.length > 0) {
                                        newMain = [...newMain, ...d.sizeCharts];
                                    }
                                    return { ...d, main: newMain };
                                }
                                return d;
                            });
                        }
                    } catch (e) {
                        console.error("AI grouping refinement failed:", e);
                    }
                }

                // AI Refinement for visual variants (Grouping mixed images by color swatches)
                if (data && !Array.isArray(data) && data.variants && data.variants.length > 0 && data.main && data.main.length > 0 && selectedPlatform !== 'titleist' && !url.includes('titleist.') && selectedPlatform !== 'shopee' && !url.includes('shopee.')) {
                    try {
                        const refinedGrouping = await groupImagesByVariantsWithAI(data.main, data.variants);
                        if (Object.keys(refinedGrouping).length > 0) {
                            const singleData = data as ScrapedProductData;
                            // Convert single product into multiple products based on variants
                            const newDataArray: ScrapedProductData[] = [];
                            for (const [variantUrl, images] of Object.entries(refinedGrouping)) {
                                if (images.length > 0) {
                                    // Make color readable for UI grouping preview if possible
                                    let colorNames = ['Phân loại'];
                                    if (singleData.variantNames && singleData.variantNames[variantUrl]) {
                                        colorNames = singleData.variantNames[variantUrl].split('|||');
                                    } else {
                                        const match = variantUrl.match(/([^\/]+)\.[a-z]+(\?|$)/i);
                                        if (match) colorNames = [match[1]];
                                    }
                                    
                                    colorNames.forEach(cName => {
                                        let finalName = cName;
                                        if (finalName.length > 30) finalName = finalName.substring(0, 30) + '...';
                                        
                                        newDataArray.push({
                                            ...singleData,
                                            title: `${singleData.title} - ${finalName}`,
                                            color: finalName,
                                            main: images,
                                            variants: [variantUrl],
                                        });
                                    });
                                }
                            }
                            if (newDataArray.length > 0) {
                                data = newDataArray;
                                source = 'ai';
                            }
                        }
                    } catch (e) {
                        console.error("AI grouping by variant failed:", e);
                    }
                }

                // Strict Validation: Ensure no broken links, check actual dimensions (>200x200) and aspect ratio to filter logos
                const processProduct = async (d: ScrapedProductData): Promise<ScrapedProductData> => {
                    const sanitized = sanitizeProductData(d);
                    const validMain = await filterValidProductImagesAsync(sanitized.main || []);
                    const validVariants = await filterValidProductImagesAsync(sanitized.variants || []);
                    const validDesc = await filterValidProductImagesAsync(sanitized.description || []);
                    return {
                        ...sanitized,
                        main: validMain,
                        variants: validVariants,
                        description: validDesc
                    };
                };

                if (Array.isArray(data)) {
                    const processedList = await Promise.all(data.map(processProduct));
                    const sanitizedList = processedList.filter(d => (d.main.length + d.variants.length + d.description.length + d.videos.length) > 0);

                    if (sanitizedList.length === 0) {
                        // Failed to scrape genuine images -> Report Failure
                        setScrapingResults(prev => ({
                            ...prev,
                            [url]: {
                                data: { title: url, main: [], variants: [], description: [], videos: [] },
                                status: 'error',
                                error: 'Không lấy được hình ảnh hợp lệ (ảnh không đạt kích thước tối thiểu 200x200 hoặc bị chặn).',
                                source: source,
                                orderIndex: prev[url]?.orderIndex ?? initialOrder
                            }
                        }));
                    } else {
                        setScrapingResults(prev => {
                            const updated = { ...prev };
                            const originalOrderIndex = updated[url]?.orderIndex ?? initialOrder;
                            if (sanitizedList.length > 1) {
                                delete updated[url]; // Remove original generic loading URL
                            }
                            
                            sanitizedList.forEach((d, index) => {
                                let uniqueSuffix = d.color || '';
                                if (!uniqueSuffix && d.variants && d.variants.length > 0) {
                                    const match = d.variants[0].match(/([^\/]+)\.[a-z]+(\?|$)/i);
                                    uniqueSuffix = match ? match[1] : `variant-${index}`;
                                } else if (!uniqueSuffix) {
                                    uniqueSuffix = `part-${index}`;
                                }
                                
                                const uniqueUrl = sanitizedList.length > 1 ? `${url}#${uniqueSuffix}` : url;
                                updated[uniqueUrl] = {
                                    data: d,
                                    status: 'success',
                                    source: source,
                                    orderIndex: originalOrderIndex + (index * 0.001)
                                };
                            });
                            return updated;
                        });
                    }
                } else if (data) {
                    const sanitized = await processProduct(data as ScrapedProductData);
                    const totalMedia = sanitized.main.length + sanitized.variants.length + sanitized.description.length + sanitized.videos.length;

                    if (totalMedia === 0) {
                        // No valid media found -> Report Failure
                        setScrapingResults(prev => ({
                            ...prev,
                            [url]: {
                                data: { title: sanitized.title || url, main: [], variants: [], description: [], videos: [] },
                                status: 'error',
                                error: 'Không tìm thấy hình ảnh sản phẩm hợp lệ từ trang web này hoặc bị chặn truy cập.',
                                source: source,
                                orderIndex: prev[url]?.orderIndex ?? initialOrder
                            }
                        }));
                    } else {
                        setScrapingResults(prev => ({
                            ...prev,
                            [url]: {
                                data: sanitized,
                                status: 'success',
                                source: source,
                                orderIndex: prev[url]?.orderIndex ?? initialOrder
                            }
                        }));
                    }
                } else {
                    // Data is null/undefined -> Report Failure
                    setScrapingResults(prev => ({
                        ...prev,
                        [url]: {
                            data: { title: url, main: [], variants: [], description: [], videos: [] },
                            status: 'error',
                            error: 'Không thể cào dữ liệu từ trang web này (liên kết không hỗ trợ hoặc máy chủ từ chối kết nối).',
                            source: 'api',
                            orderIndex: prev[url]?.orderIndex ?? initialOrder
                        }
                    }));
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định.';
                let displayError = `Thất bại: ${errMsg}`;
                if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
                    displayError = 'Lỗi hết hạn ngạch API (429 - Quota Exceeded). Vui lòng thử lại sau.';
                } else if (errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED')) {
                    displayError = 'Lỗi bị từ chối truy cập (403 - Permission Denied / Trang web chặn IP).';
                }

                setScrapingResults(prev => ({
                    ...prev,
                    [url]: {
                        data: { title: url, main: [], variants: [], description: [], videos: [] },
                        status: 'error',
                        error: displayError,
                        source: 'api',
                        orderIndex: prev[url]?.orderIndex ?? initialOrder
                    }
                }));
            } finally {
                setProcessedCount(prev => prev + 1);
            }
        }

        setIsLoading(false);

        // Save history
        if (auth.currentUser && urlsToProcess.length > 0) {
            try {
                await addHistory(STORE_NAMES.SCRAPINGS, {
                    uid: auth.currentUser.uid,
                    userEmail: auth.currentUser.email || 'N/A',
                    actionType: 'Đào Ảnh',
                    details: {
                        urls: urlsToProcess.length,
                        target: urlsToProcess[0] || ''
                    },
                    status: 'success',
                    createdAt: Date.now()
                });
            } catch (err) {
                console.error("Failed to save history", err);
            }
        }
    };

    const fetchAndProcessImage = async (url: string, toPng: boolean): Promise<{ blob: Blob, ext: string }> => {
        try {
            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=${toPng ? 'png' : 'jpg'}`;
            const res = await fetch(proxyUrl);
            if (res.ok) {
                const blob = await res.blob();
                return { blob, ext: toPng ? 'png' : 'jpg' };
            }
        } catch (e) {
            // fallback below
        }

        // Fallback to internal /api/proxy
        const internalProxy = `/api/proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(internalProxy);
        if (!res.ok) throw new Error('Fetch failed');
        const blob = await res.blob();
        return { blob, ext: toPng ? 'png' : 'jpg' };
    };

    const handleDownloadSingle = async (mediaUrl: string) => {
        try {
            const isVideo = mediaUrl.includes('.mp4');
            const shouldConvert = !isVideo && settings.convertToPng;
            
            if (shouldConvert) {
                const { blob, ext } = await fetchAndProcessImage(mediaUrl, true);
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `image.${ext}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                const link = document.createElement('a');
                link.href = mediaUrl;
                link.download = isVideo ? 'video.mp4' : 'image.jpg';
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error(err);
            window.open(mediaUrl, '_blank');
        }
    };

    const handleDownloadAll = async (images: string[], videos: string[], title: string, price?: string) => {
        if (images.length === 0 && videos.length === 0) return;
        
        setIsDownloading(true);
        const safeTitle = title.replace(/[^a-z0-9_\-\s\u00C0-\u1EF9]/gi, '_').substring(0, 50);

        try {
            if (settings.downloadAsZip) {
                const zip = new JSZip();
                const root = settings.useSubdirectories ? zip.folder(safeTitle) : zip;
                if (!root) throw new Error("Could not create zip folder");

                if (settings.downloadTextInfo) {
                    const infoContent = `Product: ${title}\nPrice: ${price || 'N/A'}\n\nImages:\n${images.join('\n')}\n\nVideos:\n${videos.join('\n')}`;
                    root.file(`${safeTitle}_info.txt`, infoContent);
                }

                for (let i = 0; i < videos.length; i++) {
                    try {
                        const res = await fetch(videos[i]); 
                        const blob = await res.blob();
                        root.file(`video_${i + 1}.mp4`, blob);
                    } catch (e) {}
                }

                for (let i = 0; i < images.length; i++) {
                    try {
                        const { blob, ext } = await fetchAndProcessImage(images[i], settings.convertToPng);
                        root.file(`image_${i + 1}.${ext}`, blob);
                    } catch (e) {}
                }

                const content = await zip.generateAsync({ type: "blob" });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = `${safeTitle}.zip`;
                link.click();
                URL.revokeObjectURL(link.href);

            } else {
                // Download One by One
                if (settings.downloadTextInfo) {
                    const infoContent = `Product: ${title}\nPrice: ${price || 'N/A'}\n\nImages:\n${images.join('\n')}`;
                    const blob = new Blob([infoContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${safeTitle}_info.txt`;
                    a.click();
                }

                const allMedia = [...videos, ...images];
                for (let i = 0; i < allMedia.length; i++) {
                    await handleDownloadSingle(allMedia[i]);
                    await new Promise(r => setTimeout(r, 300));
                }
            }
        } catch (e) {
            console.error("Bulk download failed", e);
            alert("Đã xảy ra lỗi khi tải xuống.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadVariantGroup = async (group: VariantGroup, title: string, price?: string) => {
        const groupImages = group.images && group.images.length > 0 ? group.images : [group.image].filter(Boolean);
        if (groupImages.length === 0) {
            toast.error("Nhóm biến thể này không có ảnh");
            return;
        }
        const fullTitle = `${title} - ${group.name}`;
        toast.loading(`Đang tải biến thể: ${group.name}...`, { duration: 1500 });
        await handleDownloadAll(groupImages, [], fullTitle, price);
    };

    const handleDownloadSelectedVariantGroups = async (groups: VariantGroup[], title: string, price?: string) => {
        if (!groups || groups.length === 0) {
            toast.error("Vui lòng chọn ít nhất 1 nhóm biến thể để tải");
            return;
        }

        if (groups.length === 1) {
            await handleDownloadVariantGroup(groups[0], title, price);
            return;
        }

        setIsDownloading(true);
        const safeTitle = title.replace(/[^a-z0-9_\-\s\u00C0-\u1EF9]/gi, '_').substring(0, 50);

        try {
            const zip = new JSZip();
            const root = zip.folder(safeTitle) || zip;

            for (const grp of groups) {
                const safeGrpName = grp.name.replace(/[^a-z0-9_\-\s\u00C0-\u1EF9]/gi, '_').trim() || 'Phan_loai';
                const grpFolder = root.folder(safeGrpName) || root;
                const images = grp.images && grp.images.length > 0 ? grp.images : [grp.image].filter(Boolean);

                for (let i = 0; i < images.length; i++) {
                    try {
                        const { blob, ext } = await fetchAndProcessImage(images[i], settings.convertToPng);
                        grpFolder.file(`image_${i + 1}.${ext}`, blob);
                    } catch (e) {
                        console.warn(`Failed downloading image ${images[i]}`, e);
                    }
                }
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${safeTitle}_bien_the.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
            toast.success(`Đã tải thành công ${groups.length} nhóm biến thể (đã phân thư mục)!`);
        } catch (e) {
            console.error("Download variant groups failed", e);
            toast.error("Lỗi khi tải nhóm biến thể.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleUpdateResultData = (targetUrl: string, updatedData: ScrapedProductData) => {
        setScrapingResults(prev => {
            const existing = prev[targetUrl];
            if (!existing) return prev;
            return {
                ...prev,
                [targetUrl]: {
                    ...existing,
                    data: updatedData
                }
            };
        });
    };

    const handleSplitToSeparateRows = (originalUrl: string, items: ScrapedProductData[]) => {
        if (!items || items.length === 0) return;
        setScrapingResults(prev => {
            const updated = { ...prev };
            const original = updated[originalUrl];
            const baseOrder = original?.orderIndex ?? 1;
            delete updated[originalUrl];

            items.forEach((item, idx) => {
                const cleanBaseUrl = originalUrl.split('#')[0];
                const suffix = item.color ? encodeURIComponent(item.color) : `variant-${idx + 1}`;
                const uniqueUrl = `${cleanBaseUrl}#${suffix}`;
                updated[uniqueUrl] = {
                    data: item,
                    status: 'success',
                    source: original?.source || 'api',
                    orderIndex: baseOrder + (idx * 0.001)
                };
            });
            return updated;
        });
        toast.success(`Đã tách thành ${items.length} dòng phân loại riêng biệt!`);
    };
    
    const resultsArray = useMemo(() => {
        const keys = Object.keys(scrapingResults);
        return keys
            .map((url, idx) => {
                const item = scrapingResults[url];
                return {
                    url,
                    ...item,
                    orderIndex: typeof item?.orderIndex === 'number' ? item.orderIndex : (idx + 1)
                };
            })
            .sort((a, b) => a.orderIndex - b.orderIndex);
    }, [scrapingResults]);

    const flatImages = useMemo(() => {
        const list: { item: any, imgUrl: string, category: string, variantName?: string }[] = [];
        resultsArray.forEach(item => {
            if (item.status === 'success') {
                item.data.main.forEach((url: string) => list.push({ item, imgUrl: url, category: 'Ảnh chính' }));
                item.data.variants.forEach((url: string) => {
                    const vName = item.data.color || item.data.variantNames?.[url] || (item.data.variantGroups?.find((g: any) => g.image === url || g.images?.includes(url))?.name);
                    list.push({ item, imgUrl: url, category: 'Phân loại', variantName: vName });
                });
                item.data.description.forEach((url: string) => list.push({ item, imgUrl: url, category: 'Mô tả' }));
                item.data.videos.forEach((url: string) => list.push({ item, imgUrl: url, category: 'Video' }));
            }
        });
        return list;
    }, [resultsArray]);

    return (
        <div className="max-w-7xl mx-auto animate-fade-in space-y-8">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-1">
                <div>
                    <h2 className="text-2xl font-bold text-sky-300 flex items-center gap-3">
                        <ImageDown className="w-8 h-8" />
                        Đào Ảnh (Shopee Save)
                    </h2>
                    <p className="text-zinc-400 text-sm mt-1">Tải ảnh gốc, video và phân loại từ Shopee, Tiki, Lazada.</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        onClick={() => setScrapingResults({})}
                        disabled={resultsArray.length === 0}
                        colorScheme="ghost" 
                        className="!w-auto !px-4"
                    >
                        <Trash2 className="w-5 h-5 mr-2"/> Xóa hết
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Column: Input & Settings */}
                <div className="lg:col-span-4 space-y-6 sticky top-4 max-h-[calc(100vh-5rem)] overflow-y-auto custom-scrollbar min-w-0">
                    <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-zinc-200">Nhập liên kết sản phẩm</h3>
                            <button 
                                onClick={() => setIsSettingsOpen(true)}
                                className="text-zinc-400 hover:text-sky-400 transition-colors p-2 hover:bg-zinc-700/50 rounded-lg"
                                title="Cài đặt tải xuống"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Chọn trang web nguồn</label>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowAllPlatforms(!showAllPlatforms)}
                                        className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
                                    >
                                        {showAllPlatforms ? 'Thu gọn' : '+ 8 Sàn khác'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'auto', name: 'Tự động', icon: '✨', active: 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.1)]' },
                                        { id: 'shopee', name: 'Shopee', icon: '🟠', active: 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]' },
                                        { id: 'cellphones', name: 'CellphoneS', icon: '📱', active: 'bg-red-600/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(220,38,38,0.1)]' },
                                        { id: 'samsung', name: 'Samsung', icon: '📱', active: 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.1)]' },
                                        { id: 'tiki', name: 'Tiki', icon: '🔵', active: 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' },
                                        { id: 'lazada', name: 'Lazada', icon: '🟣', active: 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]' },
                                        ...(showAllPlatforms ? [
                                            { id: 'ash.vn', name: 'Ash.vn', icon: '🛒', active: 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]' },
                                            { id: 'nagakawa', name: 'Nagakawa', icon: '❄️', active: 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]' },
                                            { id: 'aristino', name: 'Aristino', icon: '👔', active: 'bg-stone-500/10 border-stone-500 text-stone-400 shadow-[0_0_15px_rgba(120,113,108,0.1)]' },
                                            { id: 'titleist', name: 'Titleist', icon: '⛳', active: 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]' },
                                            { id: 'footjoy', name: 'FootJoy', icon: '👟', active: 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]' },
                                            { id: 'sunhouse', name: 'Sunhouse', icon: '🏠', active: 'bg-amber-600/10 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(217,119,6,0.1)]' },
                                            { id: 'nuochoarosa', name: 'Nước Hoa Rosa', icon: '🌹', active: 'bg-rose-500/10 border-rose-500 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]' },
                                            { id: 'greencook', name: 'Green Cook', icon: '🍳', active: 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' }
                                        ] : [])
                                    ].map((platform) => (
                                        <button
                                            key={platform.id}
                                            type="button"
                                            onClick={() => setSelectedPlatform(platform.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                                                selectedPlatform === platform.id 
                                                ? platform.active 
                                                : 'bg-zinc-900/50 border-zinc-700/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                                            }`}
                                        >
                                            <span className="text-sm">{platform.icon}</span>
                                            {platform.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <TextArea
                                value={urlsInput}
                                onChange={(e) => setUrlsInput(e.target.value)}
                                placeholder={`https://shopee.vn/product-abc...\nhttps://tiki.vn/san-pham...`}
                                disabled={isLoading}
                                rows={6}
                                className="font-mono text-sm resize-none !bg-zinc-900/80"
                            />
                            
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Vùng Cào (CSS Selector)</label>
                                <div className="flex flex-col xl:flex-row gap-2">
                                    <input 
                                        type="text" 
                                        value={visualSelector} 
                                        onChange={e => setVisualSelector(e.target.value)} 
                                        placeholder="Để trống để cào toàn bộ trang, hoặc nhập selector (vd: #gallery)"
                                        className="flex-1 bg-zinc-900/80 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 min-w-0"
                                    />
                                    <Button 
                                        type="button"
                                        colorScheme="zinc"
                                        onClick={() => {
                                            const urls = urlsInput.split('\n').map(u => u.trim()).filter(Boolean);
                                            if(urls.length > 0) {
                                                setVisualPickerTarget('main');
                                                setVisualPickerUrl(urls[0]);
                                                setIsVisualPickerOpen(true);
                                            } else {
                                                alert("Vui lòng nhập ít nhất 1 link để mở Chọn vùng cào.");
                                            }
                                        }}
                                        className="whitespace-nowrap shadow-lg xl:w-auto w-full justify-center"
                                        title="Mở giao diện chọn vùng cào ảnh chính"
                                    >
                                        <LayoutGrid className="w-4 h-4 mr-2"/>
                                        Chọn Vùng Chính
                                    </Button>
                                </div>
                                <p className="text-[10px] text-zinc-500 ml-1">Tính năng này giúp lấy ảnh/video chính xác từ một vùng cụ thể (thích hợp cho các web cấu trúc phức tạp).</p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Vùng Biến Thể (Tùy Chọn)</label>
                                <div className="flex flex-col xl:flex-row gap-2">
                                    <input 
                                        type="text" 
                                        value={variantSelector} 
                                        onChange={e => setVariantSelector(e.target.value)} 
                                        placeholder="Nhập selector vùng chọn màu/biến thể (vd: .swatch-container)"
                                        className="flex-1 bg-zinc-900/80 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 min-w-0"
                                    />
                                    <Button 
                                        type="button"
                                        colorScheme="zinc"
                                        onClick={() => {
                                            const urls = urlsInput.split('\n').map(u => u.trim()).filter(Boolean);
                                            if(urls.length > 0) {
                                                setVisualPickerTarget('variant');
                                                setVisualPickerUrl(urls[0]);
                                                setIsVisualPickerOpen(true);
                                            } else {
                                                alert("Vui lòng nhập ít nhất 1 link để mở Chọn vùng cào.");
                                            }
                                        }}
                                        className="whitespace-nowrap shadow-lg xl:w-auto w-full justify-center"
                                        title="Mở giao diện chọn vùng cào ảnh biến thể màu"
                                    >
                                        <LayoutGrid className="w-4 h-4 mr-2"/>
                                        Chọn Vùng Biến Thể
                                    </Button>
                                </div>
                                <p className="text-[10px] text-zinc-500 ml-1">Khoanh vùng các ảnh màu/swatch để tự động nhóm chúng thành biến thể.</p>
                            </div>
                            
                            <div className="flex gap-3">
                                {isLoading ? (
                                    <div className="w-full space-y-3">
                                        <div className="relative h-2.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(processedCount / totalToProcess) * 100}%` }}
                                                className="absolute inset-y-0 left-0 bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                                            <span className="text-zinc-500 animate-pulse">Đang đào: {processedCount}/{totalToProcess} link</span>
                                            <span className="text-sky-400">{Math.round((processedCount / totalToProcess) * 100)}%</span>
                                        </div>
                                        <Button onClick={handleStop} colorScheme="red" className="w-full">
                                            <StopCircle className="w-5 h-5 mr-2" />
                                            Dừng lại
                                        </Button>
                                    </div>
                                ) : (
                                    <Button type="submit" disabled={!urlsInput.trim()} className="w-full shadow-lg shadow-sky-900/20">
                                        Tìm dữ liệu
                                    </Button>
                                )}
                            </div>
                        </form>

                        {error && (
                            <div className="mt-4 bg-red-900/20 text-red-300 p-3 rounded-lg border border-red-800/50 text-sm">
                                <p className="font-semibold flex items-center gap-2"><X className="w-4 h-4"/> Lỗi</p>
                                <p className="mt-1">{error}</p>
                            </div>
                        )}
                        
                        <div className="mt-6 pt-6 border-t border-zinc-700/50 text-xs text-zinc-500 space-y-2">
                            <p className="font-semibold text-zinc-400">Mẹo sử dụng:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Dán nhiều link cùng lúc (mỗi link một dòng).</li>
                                <li>Hỗ trợ tốt nhất: <span className="text-sky-400">Ash.vn</span> (tự động nhận diện bảng size, phân loại).</li>
                                <li>Cũng hỗ trợ: Shopee (Lấy video, ảnh phân loại).</li>
                                <li>Các trang khác sẽ dùng AI để quét ảnh tự động.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 space-y-6 min-w-0">
                    {resultsArray.length === 0 ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-center p-8 bg-zinc-800/30 rounded-2xl border border-zinc-700/50 border-dashed">
                            <ImageDown className="w-16 h-16 text-zinc-600 mb-4" />
                            <h3 className="text-lg font-semibold text-zinc-400">Chưa có dữ liệu</h3>
                            <p className="text-zinc-500 mt-2 max-w-sm">Nhập link sản phẩm vào cột bên trái để bắt đầu tải ảnh và video.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 backdrop-blur-md">
                                <div className="flex items-center gap-1 bg-zinc-800/80 p-1 rounded-lg border border-zinc-700 w-full sm:w-auto shadow-sm">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${viewMode === 'grid' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'}`}
                                    >
                                        <LayoutGrid className="w-4 h-4" /> Tải Xuống Lẻ
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${viewMode === 'table' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'}`}
                                    >
                                        <TableIcon className="w-4 h-4" /> Bảng Hàng Loạt
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => handleCopyExcelData('all')}
                                        className="w-full sm:w-auto px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                                        title="Sao chép toàn bộ kết quả đã cào dạng bảng (TSV). Nhấn Ctrl+V để dán trực tiếp vào file Excel của bạn."
                                    >
                                        <Copy className="w-4 h-4 text-teal-400" />
                                        <span>📋 Copy bảng Excel (Ctrl+V)</span>
                                    </button>

                                    <div className="relative w-full sm:w-auto">
                                        <Button 
                                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
                                            colorScheme="green" 
                                            className="!w-full sm:!w-auto !px-5 !py-2 text-sm shadow-lg shadow-green-900/20 flex items-center justify-between gap-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <FileSpreadsheet className="w-4 h-4" /> Xuất Excel Hàng Loạt
                                            </div>
                                            <ChevronDown className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                                        </Button>

                                    <AnimatePresence>
                                        {isExportMenuOpen && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-10" 
                                                    onClick={() => setIsExportMenuOpen(false)}
                                                />
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute right-0 mt-2 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-20 py-1 overflow-hidden"
                                                >
                                                    <button
                                                        onClick={() => handleExportExcel('all')}
                                                        className="w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                                                    >
                                                        <Layers className="w-4 h-4 text-sky-400" />
                                                        <div>
                                                            <div className="font-bold">Xuất tất cả nội dung</div>
                                                            <div className="text-[10px] text-zinc-400">Ảnh chính, phân loại, mô tả & video</div>
                                                        </div>
                                                    </button>
                                                    <div className="h-px bg-zinc-700 mx-2" />
                                                    <button
                                                        onClick={() => handleExportExcel('main')}
                                                        className="w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                                                    >
                                                        <ImageIcon className="w-4 h-4 text-green-400" />
                                                        <div>
                                                            <div className="font-bold">Chỉ xuất ảnh chính</div>
                                                            <div className="text-[10px] text-zinc-400">Không bao gồm ảnh phân loại / mô tả</div>
                                                        </div>
                                                    </button>
                                                    <div className="h-px bg-zinc-700 mx-2" />
                                                    <button
                                                        onClick={() => handleCopyExcelData('all')}
                                                        className="w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                                                    >
                                                        <Copy className="w-4 h-4 text-yellow-400" />
                                                        <div>
                                                            <div className="font-bold">Copy bảng dữ liệu</div>
                                                            <div className="text-[10px] text-zinc-400">Copy toàn bộ bảng để dán vào Excel</div>
                                                        </div>
                                                    </button>
                                                    <div className="h-px bg-zinc-700 mx-2" />
                                                    <button
                                                        onClick={() => handlePushToSheets('all')}
                                                        disabled={isPushingSheet}
                                                        className="w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center gap-3 disabled:opacity-50"
                                                    >
                                                        {isPushingSheet ? <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" /> : <Database className="w-4 h-4 text-indigo-400" />}
                                                        <div>
                                                            <div className="font-bold">Đồng bộ Google Sheets</div>
                                                            <div className="text-[10px] text-zinc-400">Tự động tạo bảng trên server Drive</div>
                                                        </div>
                                                    </button>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                            {sheetResultUrl && (
                                <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 flex items-center justify-between text-sm text-emerald-400 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <Check className="w-4 h-4" />
                                        <span>Đã đồng bộ lên Google Sheets thành công!</span>
                                    </div>
                                    <a href={sheetResultUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-emerald-300">
                                        Mở Bảng Sheet
                                    </a>
                                </div>
                            )}

                            {viewMode === 'grid' ? (
                                <div className="space-y-8">
                                    {resultsArray.map((item, idx) => (
                                        <ScraperResultCard 
                                            key={`${item.url}-${idx}`} 
                                            url={item.url} 
                                            result={item} 
                                            indexNumber={idx + 1}
                                            onDownloadSingle={handleDownloadSingle}
                                            onDownloadAll={handleDownloadAll}
                                            onDownloadVariantGroup={handleDownloadVariantGroup}
                                            onDownloadSelectedVariantGroups={handleDownloadSelectedVariantGroups}
                                            onRemove={() => handleRemoveResult(item.url)}
                                            onRescrape={() => handleRescrapeUrl(item.url)}
                                            onEditImage={(imgUrl) => handleEditImage(item.url, imgUrl)}
                                            onSendToBatchFrame={handleSendToBatchFrame}
                                            onUpdateResult={(updatedData) => handleUpdateResultData(item.url, updatedData)}
                                            onSplitToSeparateRows={(items) => handleSplitToSeparateRows(item.url, items)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-zinc-800/40 border border-zinc-700 rounded-2xl overflow-hidden shadow-lg overflow-x-auto max-h-[600px] custom-scrollbar relative">
                                    <table className="w-full text-sm text-left text-zinc-300">
                                        <thead className="text-xs text-zinc-400 uppercase bg-zinc-900 sticky top-0 z-20 shadow-md">
                                            <tr>
                                                <th className="px-4 py-3 min-w-[200px]">Sản phẩm</th>
                                                <th className="px-4 py-3 min-w-[120px]">Phân loại</th>
                                                <th className="px-4 py-3 min-w-[150px]">Tên tệp</th>
                                                <th className="px-4 py-3 min-w-[80px]">Định dạng</th>
                                                <th className="px-4 py-3 min-w-[100px]">Kích thước</th>
                                                <th className="px-4 py-3 min-w-[100px]">Dung lượng</th>
                                                <th className="px-4 py-3 min-w-[250px]">URL Tệp</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-700/50">
                                            {flatImages.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                                                        Chưa có tệp ảnh nào
                                                    </td>
                                                </tr>
                                            ) : (
                                                flatImages.map((flatItem, idx) => (
                                                    <ImageRowItem 
                                                        key={`${flatItem.item.url}-${flatItem.imgUrl}-${idx}`} 
                                                        item={flatItem.item} 
                                                        imgUrl={flatItem.imgUrl} 
                                                        category={flatItem.category} 
                                                        variantName={flatItem.variantName}
                                                        onEdit={(imgUrl) => handleEditImage(flatItem.item.url, imgUrl)}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isDownloading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-zinc-800 p-6 rounded-xl border border-zinc-600 flex flex-col items-center shadow-2xl">
                        <Spinner />
                        <p className="mt-4 text-white font-medium">Đang xử lý tải xuống...</p>
                        <p className="text-xs text-zinc-400 mt-1">Vui lòng không tắt trình duyệt</p>
                    </div>
                </div>
            )}

            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                settings={settings}
                onUpdate={updateSettings}
                onExport={handleExportSettings}
                onImport={handleImportSettings}
            />

            {/* Visual Selector Modal */}
            <AnimatePresence>
                {isVisualPickerOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsVisualPickerOpen(false)}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-zinc-900 border border-zinc-700 w-[95vw] h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden" 
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="bg-zinc-800 p-4 border-b border-zinc-700 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shrink-0">
                                <div className="flex flex-col">
                                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                        <LayoutGrid className="w-5 h-5 text-sky-400" />
                                        {visualPickerTarget === 'main' ? 'Chọn vùng ảnh chính' : 'Chọn vùng ảnh biến thể (màu sắc)'}
                                    </h3>
                                    <p className="text-xs text-zinc-400 mt-1">Di chuột qua vùng chứa ảnh trên trang và click để chọn.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                    <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-700">
                                        <button
                                            onClick={() => handleToggleMode('navigate')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${pickerMode === 'navigate' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                                            title="Click duyệt trang, đổi ảnh, click qua nút/popup thoải mái trước khi chọn"
                                        >
                                            🔍 Duyệt trang (Mở ảnh to)
                                        </button>
                                        <button
                                            onClick={() => handleToggleMode('pick')}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${pickerMode === 'pick' ? 'bg-sky-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                                            title="Bật di chuột chọn ảnh"
                                        >
                                            🎯 Chọn phần tử
                                        </button>
                                    </div>
                                    {(visualPickerTarget === 'main' ? visualSelector : variantSelector) && (
                                        <div className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/50 px-3 py-1.5 rounded-lg text-sm text-sky-300">
                                            <span className="font-semibold text-xs uppercase text-sky-500">Selector:</span>
                                            <code className="text-xs max-w-sm truncate" title={visualPickerTarget === 'main' ? visualSelector : variantSelector}>{visualPickerTarget === 'main' ? visualSelector : variantSelector}</code>
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
                                        (e.target as HTMLIFrameElement).contentWindow?.postMessage({ type: 'SET_MODE', mode: pickerMode }, '*');
                                    }}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {cropperState && (
                <ImageCropperModal
                    isOpen={cropperState.isOpen}
                    imgUrl={cropperState.imgUrl}
                    onClose={() => setCropperState(null)}
                    onSave={handleSaveCrop}
                />
            )}
        </div>
    );
};

const ImageRowItem = memo(({ item, imgUrl, category, variantName, onEdit }: { item: any, imgUrl: string, category: string, variantName?: string, onEdit?: (url: string) => void }) => {
    const [dimensions, setDimensions] = useState<string>('Đang tải...');
    const [fileSize, setFileSize] = useState<string>('Đang tải...');

    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        let isMounted = true;

        if (category === 'Video') {
            setDimensions('Video');
            fetch(imgUrl, { method: 'HEAD' })
                .then(res => {
                    const size = res.headers.get('content-length');
                    if (size && isMounted) setFileSize((parseInt(size) / 1024).toFixed(1) + ' KB');
                    else if (isMounted) setFileSize('N/A');
                })
                .catch(() => isMounted && setFileSize('N/A'));
            return () => { isMounted = false; };
        }

        const img = new Image();
        img.onload = () => {
             if (isMounted) setDimensions(`${img.width}x${img.height}`);
        };
        img.onerror = () => {
             if (isMounted) setDimensions('N/A');
        };
        img.src = imgUrl;

        fetch(imgUrl, { method: 'HEAD' })
            .then(res => {
                const size = res.headers.get('content-length');
                if (size && isMounted) {
                    const kb = parseInt(size) / 1024;
                    if (kb > 1024) {
                        setFileSize((kb / 1024).toFixed(2) + ' MB');
                    } else {
                        setFileSize(kb.toFixed(1) + ' KB');
                    }
                }
                else if (isMounted) setFileSize('N/A');
            })
            .catch(() => isMounted && setFileSize('N/A'));

         return () => { isMounted = false; };
    }, [imgUrl]);

    const title = item.data.title || 'Sản phẩm';
    const color = item.data.color ? ` - ${item.data.color}` : '';
    const name = title + color;
    
    let filename = imgUrl.split('/').pop()?.split('?')[0] || 'unknown';
    let format = filename.split('.').pop()?.toUpperCase() || '';
    if (format === filename.toUpperCase()) format = 'UNKNOWN'; // no extension

    const handleCopy = () => {
        navigator.clipboard.writeText(imgUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <tr className="border-b border-zinc-700/50 hover:bg-zinc-800/50 transition-colors">
            <td className="px-4 py-3 p-1 flex items-center gap-3">
                 {category !== 'Video' ? (
                     <div className="w-10 h-10 shrink-0 mt-1">
                         <ImageHoverPreview 
                             src={imgUrl} 
                             alt={name} 
                             title={name}
                             variantLabel={variantName}
                             category={category}
                             onEdit={onEdit}
                             showActionsOnThumbnail={false}
                             previewWidth={380}
                             previewHeight={400}
                             className="w-10 h-10 rounded-lg"
                         />
                     </div>
                 ) : (
                     <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center shrink-0 mt-1 border border-zinc-700">
                         <Video className="w-5 h-5 text-zinc-500" />
                     </div>
                 )}
                 <div className="font-medium text-white line-clamp-2 text-xs max-w-[200px]" title={name}>
                     {name}
                 </div>
            </td>
            <td className="px-4 py-3 text-xs text-zinc-400">
                <span className={`px-2 py-1 rounded text-[10px] font-bold ${variantName ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-zinc-700/50 text-zinc-300'}`}>
                    {variantName ? `Phân loại: ${variantName}` : category}
                </span>
            </td>
            <td className="px-4 py-3 text-xs text-zinc-300 max-w-[150px] truncate" title={filename}>{filename}</td>
            <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{format}</td>
            <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{dimensions}</td>
            <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{fileSize}</td>
            <td className="px-4 py-3 text-xs">
                <div className="flex items-center gap-2">
                    <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 hover:underline max-w-[160px] block truncate" title={imgUrl}>
                        {imgUrl}
                    </a>
                    {category !== 'Video' && onEdit && (
                        <button 
                            onClick={() => onEdit(imgUrl)}
                            className="p-1.5 rounded-md bg-zinc-800 hover:bg-sky-600 text-zinc-400 hover:text-white transition-colors"
                            title="Sửa ảnh (Crop)"
                        >
                            <Crop className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button 
                        onClick={handleCopy}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                        title="Sao chép URL"
                    >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </td>
        </tr>
    );
});

export default ImageScraperTab;
