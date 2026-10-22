
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import Button from '../Button';
import toast from 'react-hot-toast';
import { Download, LayoutTemplate, FileSpreadsheet, Image as ImageIcon, ChevronDown, Palette, Settings, X, Check, Trash2, Upload, Maximize2, Plus, Info } from 'lucide-react';
import Spinner from '../Spinner';
import Modal from '../Modal';

// --- TYPES ---

interface FrameData {
    sku: string;
    name?: string;
    topFrame?: string;
    rightFrame?: string[];
    giftText?: string; // Column G
    backupFrame?: string; // Column H (New)
    exclusiveColors?: string; // Column I (New)
    basicColors?: string; // Column J (New)
    [key: string]: any;
}

interface ElementConfig {
    visible: boolean;
    x: number;
    y: number;
    color: string;
    bg?: string; // Solid color
    borderColor?: string;
    borderWidth?: number;
    size: number;
    width?: number;
    height?: number;
    align?: 'left' | 'center' | 'right';
    font?: string;
    borderRadius?: number;
    padding?: number;
    gap?: number;
    shadow?: boolean;
}

interface ImageConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    fit: 'contain' | 'cover';
    removeWhiteBg?: boolean;
}

interface ExtraImageConfig {
    id: string;
    file: File;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ColorPaletteConfig extends ElementConfig {
    title: string;
    titleBg: string;
    titleColor: string;
}

interface FrameConfig {
    id: string;
    name: string; // The preset name
    canvasBg: string;
    bgImage?: string; // New field for background image
    productName: ElementConfig; 
    topFrame: ElementConfig;
    rightFrame: ElementConfig;
    giftFrame: ElementConfig;
    backupFrame: ElementConfig; // New field
    exclusiveColors: ColorPaletteConfig; // New field
    basicColors: ColorPaletteConfig; // New field
    image: ImageConfig;
    extraImages: ExtraImageConfig[]; // New field for stickers/combo items
}

const removeWhiteBgFromImage = (imgSrc: string, tolerance: number = 240): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(imgSrc);
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] >= tolerance && data[i + 1] >= tolerance && data[i + 2] >= tolerance) {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(imgSrc);
        img.src = imgSrc;
    });
};

// --- PRESETS (STYLES) ---

const PRESETS: FrameConfig[] = [
    {
        id: 'samsung-default',
        name: 'Mẫu Samsung (Mặc định)',
        canvasBg: '#ffffff',
        bgImage: '',
        productName: { 
            visible: true, x: 500, y: 120, color: '#000000', size: 28, width: 900, align: 'center', font: 'Arial', shadow: false 
        },
        topFrame: { 
            visible: true, x: 500, y: 35, color: '#ffffff', bg: '#000000', size: 24, width: 1000, padding: 20, borderRadius: 0, align: 'center', shadow: false 
        },
        rightFrame: { 
            visible: false, x: 640, y: 350, color: '#0000ff', bg: 'rgba(255,255,255,0)', borderColor: '', borderWidth: 0, size: 28, width: 320, padding: 10, gap: 30, borderRadius: 0, align: 'left', shadow: false
        },
        giftFrame: {
            visible: false, x: 820, y: 800, color: '#ffffff', bg: '#d0011b', size: 20, width: 150, height: 150, borderRadius: 10, padding: 10
        },
        backupFrame: {
             visible: false, x: 150, y: 50, color: '#ffffff', bg: '#000000', size: 20, width: 200, padding: 10, borderRadius: 5, align: 'center', shadow: false
        },
        exclusiveColors: {
            visible: false, x: 400, y: 500, color: '#000000', bg: '#ffffff', borderColor: '#f3e8e0', borderWidth: 2, size: 10, width: 200, padding: 15, borderRadius: 10, align: 'center', shadow: false,
            title: 'Màu độc quyền', titleBg: '#f3e8e0', titleColor: '#000000'
        },
        basicColors: {
            visible: false, x: 650, y: 500, color: '#000000', bg: '#ffffff', borderColor: '#5b6279', borderWidth: 2, size: 10, width: 280, padding: 15, borderRadius: 10, align: 'center', shadow: false,
            title: 'Màu cơ bản', titleBg: '#5b6279', titleColor: '#ffffff'
        },
        image: { 
            x: 200, y: 200, width: 600, height: 600, fit: 'contain', removeWhiteBg: false
        },
        extraImages: []
    },
    {
        id: 'shopee-red',
        name: 'Shopee Mall (Đỏ)',
        canvasBg: '#ffffff',
        productName: { 
            visible: true, x: 500, y: 50, color: '#ee4d2d', size: 42, width: 900, align: 'center', font: 'Arial', shadow: false 
        },
        topFrame: { 
            visible: true, x: 850, y: 50, color: '#ffffff', bg: '#d0011b', size: 20, width: 220, padding: 12, borderRadius: 4, align: 'center', shadow: true 
        },
        rightFrame: { 
            visible: true, x: 700, y: 250, color: '#d0011b', bg: '#fff0f1', borderColor: '#d0011b', borderWidth: 1, size: 24, width: 280, padding: 20, gap: 20, borderRadius: 8, align: 'left', shadow: false
        },
        giftFrame: {
            visible: true, x: 750, y: 700, color: '#ffffff', bg: '#d0011b', size: 18, width: 200, height: 200, borderRadius: 10, padding: 10
        },
        backupFrame: {
             visible: false, x: 150, y: 50, color: '#ffffff', bg: '#000000', size: 20, width: 200, padding: 10, borderRadius: 5, align: 'center', shadow: false
        },
        exclusiveColors: {
            visible: false, x: 400, y: 500, color: '#000000', bg: '#ffffff', borderColor: '#f3e8e0', borderWidth: 2, size: 10, width: 200, padding: 15, borderRadius: 10, align: 'center', shadow: false,
            title: 'Màu độc quyền', titleBg: '#f3e8e0', titleColor: '#000000'
        },
        basicColors: {
            visible: false, x: 650, y: 500, color: '#000000', bg: '#ffffff', borderColor: '#5b6279', borderWidth: 2, size: 10, width: 280, padding: 15, borderRadius: 10, align: 'center', shadow: false,
            title: 'Màu cơ bản', titleBg: '#5b6279', titleColor: '#ffffff'
        },
        image: { 
            x: 50, y: 200, width: 600, height: 650, fit: 'contain' 
        },
        extraImages: []
    }
];

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;

// Helper Components
const ControlInput = ({ label, value, onChange, type = "number", className = "" }: any) => (
    <div className={className}>
        <label className="text-[10px] text-zinc-500 uppercase block mb-1">{label}</label>
        <div className="relative">
            <input 
                type={type} 
                value={value} 
                onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} 
                className={`w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-sky-500 outline-none ${type === 'color' ? 'h-8 p-1 cursor-pointer' : ''}`}
            />
        </div>
    </div>
);

const SectionHeader = ({ title, isOpen, toggle }: { title: string, isOpen: boolean, toggle: () => void }) => (
    <button onClick={toggle} className="flex justify-between items-center w-full p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md mb-2 transition-colors">
        <span className="text-xs font-bold text-zinc-300 uppercase">{title}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
    </button>
);

const BatchFrameTab: React.FC = () => {
    // Inputs
    const [excelFile, setExcelFile] = useState<File | null>(null);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    
    // Drag States
    const [isDraggingExcel, setIsDraggingExcel] = useState(false);
    const [isDraggingImages, setIsDraggingImages] = useState(false);
    
    // Data
    const [frameData, setFrameData] = useState<FrameData[]>([]);
    const [config, setConfig] = usePersistedState<FrameConfig>('batchFrameConfig', PRESETS[0]);
    
    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [previewPage, setPreviewPage] = useState(1);
    const PREVIEW_PAGE_SIZE = 50;
    
    // Editor State
    const [activeConfigSection, setActiveConfigSection] = useState<string>('general');
    const [matchedSku, setMatchedSku] = useState<string>('');
    const [matchData, setMatchData] = useState<FrameData | null>(null);
    const [matchFile, setMatchFile] = useState<File | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [processedPreviewImage, setProcessedPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        if (previewImageUrl && config.image.removeWhiteBg) {
            removeWhiteBgFromImage(previewImageUrl).then(setProcessedPreviewImage);
        } else {
            setProcessedPreviewImage(previewImageUrl);
        }
    }, [previewImageUrl, config.image.removeWhiteBg]);

    useEffect(() => {
        const importDataRaw = localStorage.getItem('batchFrame_importData');
        if (importDataRaw) {
            localStorage.removeItem('batchFrame_importData');
            try {
                const importData = JSON.parse(importDataRaw);
                if (importData && Array.isArray(importData.images) && importData.images.length > 0) {
                    setIsProcessing(true);
                    setStatusMessage('Đang tải ảnh từ công cụ cào...');
                    setProgress(10);
                    
                    const mappedData: FrameData[] = importData.images.map((url: string, index: number) => {
                        const filename = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || `image_${index + 1}.jpg`;
                        const sku = filename.substring(0, filename.lastIndexOf('.')) || `SP_${index + 1}`;
                        return {
                            sku: sku,
                            name: importData.productName || 'Sản phẩm',
                            topFrame: '',
                            rightFrame: [],
                            giftText: importData.giftText || 'Tặng ngay quà xịn',
                            backupFrame: '',
                            exclusiveColors: '',
                            basicColors: ''
                        };
                    });
                    setFrameData(mappedData);
                    
                    // Enable gift layer
                    setConfig(prev => ({
                        ...prev,
                        giftFrame: {
                            ...prev.giftFrame,
                            visible: true
                        }
                    }));
                    
                    const loadFiles = async () => {
                        const files: File[] = [];
                        for (let i = 0; i < importData.images.length; i++) {
                            const url = importData.images[i];
                            try {
                                const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
                                const res = await fetch(proxyUrl);
                                if (!res.ok) throw new Error('Fetch status ' + res.status);
                                const blob = await res.blob();
                                const filename = url.substring(url.lastIndexOf('/') + 1).split('?')[0] || `image_${i + 1}.jpg`;
                                const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
                                files.push(file);
                            } catch (err) {
                                console.error('Failed to load image:', url, err);
                            }
                            setProgress(Math.round(10 + (90 * (i + 1) / importData.images.length)));
                        }
                        
                        if (files.length > 0) {
                            setImageFiles(files);
                            setIsEditorOpen(true);
                            toast.success(`Đã nhận thành công ${files.length} ảnh sản phẩm để ghép quà tặng!`);
                        } else {
                            toast.error('Không thể tải được ảnh nào. Hãy thử tải lên thủ công.');
                        }
                        setIsProcessing(false);
                        setStatusMessage('');
                    };
                    loadFiles();
                }
            } catch (e) {
                console.error("Error importing batch frame data:", e);
                setIsProcessing(false);
                setStatusMessage('');
            }
        }
    }, []);

    const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const url = URL.createObjectURL(e.target.files[0]);
            setConfig(prev => ({ ...prev, bgImage: url }));
        }
    };

    // Interaction (Drag n Drop on Canvas)
    const containerRef = useRef<HTMLDivElement>(null);
    const [draggingElement, setDraggingElement] = useState<string | null>(null);
    const [isResizing, setIsResizing] = useState(false); 
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    
    // Alignment Guides
    const [showGuideX, setShowGuideX] = useState(false);
    const [showGuideY, setShowGuideY] = useState(false);

    // Extra Images Logic
    const extraImageInputRef = useRef<HTMLInputElement>(null);

    // --- LOGIC: Excel Processing ---
    const processExcelFile = (file: File) => {
        setExcelFile(file);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                
                const mappedData: FrameData[] = [];
                for (let i = 1; i < data.length; i++) {
                    const row = data[i];
                    if (!row || row.length === 0) continue;
                    const sku = row[0] ? String(row[0]).trim() : '';
                    if (!sku) continue;

                    const name = row[1] ? String(row[1]).trim() : '';
                    const rightFeatures: string[] = [];
                    if (row[2]) rightFeatures.push(String(row[2]).trim());
                    if (row[3]) rightFeatures.push(String(row[3]).trim());
                    if (row[4]) rightFeatures.push(String(row[4]).trim());
                    const topFrame = row[5] ? String(row[5]).trim() : '';
                    const giftText = row[6] ? String(row[6]).trim() : '';
                    const backupFrame = row[7] ? String(row[7]).trim() : '';
                    const exclusiveColors = row[8] ? String(row[8]).trim() : '';
                    const basicColors = row[9] ? String(row[9]).trim() : '';

                    mappedData.push({ sku, name, topFrame, rightFrame: rightFeatures, giftText, backupFrame, exclusiveColors, basicColors });
                }
                setFrameData(mappedData);
            } catch (error) {
                alert("Lỗi đọc file Excel.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const downloadSampleExcel = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['SKU', 'Tên sản phẩm', 'Đặc điểm 1', 'Đặc điểm 2', 'Đặc điểm 3', 'Badge (Góc trên)', 'Quà tặng', 'Badge (Dự phòng)', 'Màu độc quyền', 'Màu cơ bản'],
            ['SP001', 'Sản phẩm mẫu 1', 'Màn hình 4K', 'Bảo hành 2 năm', 'Trả góp 0%', 'GIẢM 50%', 'Tặng Chuột', 'FREESHIP', '#FAD6C3:Vàng Hồng, #C0C0C0:Bạc Shadow', '#8B8C9A:Tím Cobalt, #000000:Đen Classic'],
            ['SP002', 'Sản phẩm mẫu 2', 'Pin trâu', 'Camera 108MP', 'Sạc nhanh', 'MỚI', 'Tặng Tai nghe', 'HOT', '', '']
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, "Mau_Nhap_Lieu.xlsx");
    };

    // --- LOGIC: Drag & Drop Files ---
    const handleExcelDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingExcel(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                processExcelFile(file);
            } else {
                alert('Vui lòng chỉ thả file Excel (.xlsx, .xls)');
            }
        }
    };

    const handleImagesDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingImages(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter((f: any) => f.type.startsWith('image/')) as File[];
            if (files.length > 0) {
                setImageFiles(prev => [...prev, ...files]);
            }
        }
    };

    const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && processExcelFile(e.target.files[0]);
    const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => e.target.files && setImageFiles(prev => [...prev, ...Array.from(e.target.files!)]);

    const handleRemoveImage = (index: number) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
    };

    // --- LOGIC: Setup Preview Data ---
    const preparePreviewData = useCallback(() => {
        let mFile: File | null = null;
        let mData: FrameData = frameData[0] || { 
            sku: 'DEMO-SKU-001', 
            name: 'TI VI CRYSTAL UHD UE100F SAMSUNG 4K SMART TV 55 INCH (2025)', 
            topFrame: 'Samsung Official Store',
            rightFrame: ['UE100F Màn hình 4K 55 inch', 'Khung viền kim loại mỏng', 'Hệ điều hành One UI Tizen'],
            giftText: 'Tặng ngay Loa Bluetooth',
            backupFrame: 'FREESHIP',
            exclusiveColors: '#FAD6C3:Vàng Hồng, #C0C0C0:Bạc Shadow',
            basicColors: '#8B8C9A:Tím Cobalt, #A9C2D9:Xanh Sky Blue, #000000:Đen Classic, #FFFFFF:Trắng Classic'
        };
        let foundSku = '';

        if (imageFiles.length > 0 && frameData.length > 0) {
            for (const file of imageFiles) {
                const name = file.name.substring(0, file.name.lastIndexOf('.'));
                const data = frameData.find(d => d.sku === name || d.sku === file.name);
                if (data) {
                    mFile = file;
                    mData = data;
                    foundSku = data.sku;
                    break;
                }
            }
            if (!mFile && imageFiles.length > 0) {
                 mFile = imageFiles[0];
                 foundSku = `(Chưa khớp: ${mFile.name})`;
                 if (frameData.length > 0) mData = frameData[0];
            }
        } else if (imageFiles.length > 0) {
            mFile = imageFiles[0];
            foundSku = '(Chưa có dữ liệu Excel)';
        } else if (frameData.length > 0) {
            foundSku = frameData[0].sku;
            mData = frameData[0];
        }

        setMatchData(mData);
        setMatchFile(mFile);
        setMatchedSku(foundSku || mData.sku);

        if (mFile) {
            const url = URL.createObjectURL(mFile);
            setPreviewImageUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewImageUrl(null);
        }
    }, [imageFiles, frameData]);

    useEffect(() => {
        if (isEditorOpen) {
            const cleanup = preparePreviewData();
            return cleanup;
        }
    }, [isEditorOpen, preparePreviewData]);

    const [savedPresets, setSavedPresets] = useState<FrameConfig[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('batchFramePresets');
        if (saved) {
            try {
                setSavedPresets(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load saved presets", e);
            }
        }
    }, []);

    const handleSavePreset = () => {
        setIsSavePresetModalOpen(true);
        setNewPresetName('Bố cục của tôi');
    };

    const confirmSavePreset = () => {
        if (!newPresetName.trim()) return;

        const newPreset: FrameConfig = {
            ...config,
            id: `custom-${Date.now()}`,
            name: newPresetName.trim()
        };

        const updatedPresets = [...savedPresets, newPreset];
        setSavedPresets(updatedPresets);
        localStorage.setItem('batchFramePresets', JSON.stringify(updatedPresets));
        setIsSavePresetModalOpen(false);
    };

    const handleDeletePreset = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Bạn có chắc muốn xóa bố cục này?")) {
            const updatedPresets = savedPresets.filter(p => p.id !== id);
            setSavedPresets(updatedPresets);
            localStorage.setItem('batchFramePresets', JSON.stringify(updatedPresets));
        }
    };

    // --- LOGIC: Configuration ---
    const handleConfigChange = (section: keyof FrameConfig, field: string, value: any) => {
        if (field === '') {
            setConfig(prev => ({ ...prev, [section]: value }));
            return;
        }
        setConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section as any],
                [field]: value
            }
        }));
    };

    const handlePresetChange = (id: string) => {
        const preset = PRESETS.find(p => p.id === id) || savedPresets.find(p => p.id === id);
        if (preset) {
            setConfig(preset);
        }
    };

    // --- LOGIC: Extra Images (Stickers/Combo) ---
    const handleAddExtraImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const newExtra: ExtraImageConfig = {
                    id: `extra-${Date.now()}`,
                    file,
                    url,
                    x: 600, // Default bottom right-ish
                    y: 600,
                    width: 300,
                    height: (300 / img.width) * img.height
                };
                setConfig(prev => ({
                    ...prev,
                    extraImages: [...(prev.extraImages || []), newExtra]
                }));
            };
            img.src = url;
        }
    };

    const handleRemoveExtraImage = (id: string) => {
        setConfig(prev => ({
            ...prev,
            extraImages: prev.extraImages.filter(img => img.id !== id)
        }));
    };

    const updateExtraImage = (id: string, updates: Partial<ExtraImageConfig>) => {
        setConfig(prev => ({
            ...prev,
            extraImages: prev.extraImages.map(img => img.id === id ? { ...img, ...updates } : img)
        }));
    };

    // --- INTERACTION: Drag n Drop ---
    const handleMouseDown = (e: React.MouseEvent, type: string, action: 'move' | 'resize' = 'move') => {
        e.stopPropagation(); // Stop bubbling
        if (!containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const scale = 1000 / rect.width; 
        const mouseX = (e.clientX - rect.left) * scale;
        const mouseY = (e.clientY - rect.top) * scale;

        setDraggingElement(type);
        
        let currentX = 0;
        let currentY = 0;

        if (type.startsWith('extra-')) {
            const extraImg = config.extraImages.find(img => img.id === type);
            if (extraImg) {
                currentX = extraImg.x;
                currentY = extraImg.y;
            }
        } else {
            // @ts-ignore
            if (config[type]) { currentX = config[type].x; currentY = config[type].y; }
        }

        if (action === 'resize') {
            setIsResizing(true);
            setDragOffset({ x: mouseX, y: mouseY });
        } else {
            setIsResizing(false);
            setDragOffset({ x: mouseX - currentX, y: mouseY - currentY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggingElement || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const scale = 1000 / rect.width;
        const mouseX = (e.clientX - rect.left) * scale;
        const mouseY = (e.clientY - rect.top) * scale;

        // --- Logic cho Resize ---
        if (isResizing) {
            const deltaX = mouseX - dragOffset.x;
            const deltaY = mouseY - dragOffset.y;
            setDragOffset({ x: mouseX, y: mouseY }); // Reset anchor for next move

            if (draggingElement === 'image') {
                const currentW = config.image.width;
                const currentH = config.image.height;
                handleConfigChange('image', 'width', Math.max(50, Math.round(currentW + deltaX)));
                handleConfigChange('image', 'height', Math.max(50, Math.round(currentH + deltaY)));
            } else if (draggingElement.startsWith('extra-')) {
                const extraImg = config.extraImages.find(img => img.id === draggingElement);
                if (extraImg) {
                    const newW = Math.max(20, Math.round(extraImg.width + deltaX));
                    const newH = Math.max(20, Math.round(extraImg.height + deltaY));
                    updateExtraImage(draggingElement, { width: newW, height: newH });
                }
            }
        } 
        // --- Logic cho Move ---
        else {
            let newX = Math.round(mouseX - dragOffset.x);
            let newY = Math.round(mouseY - dragOffset.y);

            // Alignment Logic (simplified)
            const CANVAS_CENTER = 500;
            const THRESHOLD = 15;
            let width = 0, height = 0;

            if (draggingElement === 'image') {
                width = config.image.width; height = config.image.height;
            } else if (draggingElement.startsWith('extra-')) {
                const ex = config.extraImages.find(img => img.id === draggingElement);
                if (ex) { width = ex.width; height = ex.height; }
            } else {
                // @ts-ignore
                const el = config[draggingElement];
                if (el) { width = el.width || 200; height = el.height || 50; }
            }

            if (Math.abs((newX + width/2) - CANVAS_CENTER) < THRESHOLD) {
                newX = CANVAS_CENTER - width/2;
                setShowGuideX(true);
            } else {
                setShowGuideX(false);
            }
            
            if (draggingElement.startsWith('extra-')) {
                updateExtraImage(draggingElement, { x: newX, y: newY });
            } else {
                // @ts-ignore
                handleConfigChange(draggingElement, 'x', newX);
                // @ts-ignore
                handleConfigChange(draggingElement, 'y', newY);
            }
        }
    };

    const handleMouseUp = () => {
        setDraggingElement(null);
        setIsResizing(false);
        setShowGuideX(false);
        setShowGuideY(false);
    };

    // --- LOGIC: Drawing for Export (Canvas) ---
    const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    };

    const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
        const words = text.split(' ');
        let lines = [];
        let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    };

    const drawToCanvas = async (imgFile: File | null, rowData: FrameData, canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Background
        if (config.bgImage) {
            try {
                const bgImg = new Image();
                bgImg.crossOrigin = "anonymous";
                await new Promise((resolve, reject) => {
                    bgImg.onload = resolve;
                    bgImg.onerror = reject;
                    bgImg.src = config.bgImage!;
                });
                ctx.drawImage(bgImg, 0, 0, 1000, 1000);
            } catch (e) {
                ctx.fillStyle = config.canvasBg;
                ctx.fillRect(0, 0, 1000, 1000);
            }
        } else {
            ctx.fillStyle = config.canvasBg;
            ctx.fillRect(0, 0, 1000, 1000);
        }

        // 2. Product Image (Main)
        if (imgFile) {
            try {
                let imgUrl = URL.createObjectURL(imgFile);
                if (config.image.removeWhiteBg) {
                    imgUrl = await removeWhiteBgFromImage(imgUrl);
                }
                const img = new Image();
                img.crossOrigin = "anonymous";
                await new Promise<void>((resolve, reject) => {
                    img.onload = () => {
                        const { x, y, width, height, fit } = config.image;
                        const scale = fit === 'contain' ? Math.min(width / img.width, height / img.height) : Math.max(width / img.width, height / img.height);
                        const w = img.width * scale;
                        const h = img.height * scale;
                        const dx = x + (width - w) / 2;
                        const dy = y + (height - h) / 2;
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(x, y, width, height);
                        ctx.clip();
                        ctx.drawImage(img, dx, dy, w, h);
                        ctx.restore();
                        URL.revokeObjectURL(img.src);
                        resolve();
                    };
                    img.onerror = reject;
                    img.src = imgUrl;
                });
            } catch (e) {
                console.error("Error drawing product image", e);
            }
        }

        // 2.5 Extra Images (Stickers, Combo) - Draw BEFORE text but AFTER main image
        if (config.extraImages && config.extraImages.length > 0) {
            for (const exImg of config.extraImages) {
                const img = new Image();
                img.src = exImg.url;
                await new Promise<void>(resolve => {
                    img.onload = () => {
                        const { x, y, width, height } = exImg;
                        const scale = Math.min(width / img.width, height / img.height);
                        const w = img.width * scale;
                        const h = img.height * scale;
                        const dx = x + (width - w) / 2;
                        const dy = y + (height - h) / 2;
                        ctx.drawImage(img, dx, dy, w, h);
                        resolve();
                    };
                    img.onerror = () => resolve();
                });
            }
        }

        // 3. Name (Title)
        if (config.productName.visible && rowData.name) {
            ctx.fillStyle = config.productName.color;
            ctx.font = `bold ${config.productName.size}px ${config.productName.font || 'Arial'}`;
            ctx.textAlign = config.productName.align || 'center';
            // FIX: Align vertical anchor to TOP to match CSS
            ctx.textBaseline = 'top'; 
            
            const lines = wrapText(ctx, rowData.name.toUpperCase(), config.productName.width || 900);
            const lineHeight = config.productName.size * 1.2;
            let y = config.productName.y;
            
            lines.forEach(line => {
                if (config.productName.shadow) {
                    ctx.shadowColor = "rgba(255, 255, 255, 1)"; ctx.shadowBlur = 4; ctx.lineWidth = 4; ctx.strokeStyle = "white";
                    ctx.strokeText(line, config.productName.x, y);
                    ctx.shadowColor = "transparent";
                }
                ctx.fillText(line, config.productName.x, y);
                y += lineHeight;
            });
        }

        // 4. Top Frame
        if (config.topFrame.visible && rowData.topFrame) {
            const text = rowData.topFrame;
            ctx.font = `bold ${config.topFrame.size}px Arial`;
            const padding = config.topFrame.padding || 10;
            
            let w = config.topFrame.width;
            let lines = [text];
            if (w) {
                const maxWidth = w - (padding * 2);
                lines = wrapText(ctx, text, maxWidth);
            } else {
                const metrics = ctx.measureText(text);
                w = metrics.width + (padding * 2);
            }
            
            const lh = config.topFrame.size * 1.2;
            const totalTextHeight = lines.length * lh;
            const h = totalTextHeight + (padding * 2);

            let x = config.topFrame.x;
            // Center the rect drawing if alignment is center
            if (config.topFrame.align === 'center') x = x - w/2;
            const y = config.topFrame.y;

            ctx.save();
            if (config.topFrame.shadow) {
                ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
                ctx.shadowBlur = 5;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }
            drawRoundedRect(ctx, x, y, w, h, config.topFrame.borderRadius || 5);
            ctx.fillStyle = config.topFrame.bg || '#fff';
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = config.topFrame.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const startY = y + padding + (lh - config.topFrame.size) / 2;

            lines.forEach((line, i) => {
                ctx.fillText(line, x + w/2, startY + i * lh);
            });
        }

        // 5. Right Frame (Updated with Wrapping)
        if (config.rightFrame.visible && rowData.rightFrame && rowData.rightFrame.length > 0) {
            let currentY = config.rightFrame.y;
            const w = config.rightFrame.width || 300;
            const padding = config.rightFrame.padding || 10; // Default padding increased
            let x = config.rightFrame.x;
            
            ctx.font = `bold ${config.rightFrame.size}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle'; 

            rowData.rightFrame.forEach((feature) => {
                // Calculate wrapping with padding
                const maxWidth = w - (padding * 2);
                const lines = wrapText(ctx, feature, maxWidth);
                const lineHeight = config.rightFrame.size * 1.4; // Increased line height
                const blockHeight = (lines.length * lineHeight) + (padding * 2);

                // Background Box
                if (config.rightFrame.bg && config.rightFrame.bg !== 'transparent' && config.rightFrame.bg !== 'rgba(255,255,255,0)') {
                    ctx.save();
                    if (config.rightFrame.shadow) {
                        ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
                        ctx.shadowBlur = 5;
                        ctx.shadowOffsetX = 2;
                        ctx.shadowOffsetY = 2;
                    }
                    drawRoundedRect(ctx, x, currentY, w, blockHeight, config.rightFrame.borderRadius || 0);
                    ctx.fillStyle = config.rightFrame.bg;
                    ctx.fill();
                    ctx.restore();
                }

                ctx.fillStyle = config.rightFrame.color;
                
                // Draw each line
                // Center text block vertically within the blockHeight if needed, but here we just pad
                const startTextY = currentY + padding + (config.rightFrame.size * 0.6); // Approximate baseline adjustment
                lines.forEach((line, i) => {
                    ctx.fillText(line, x + padding, startTextY + (i * lineHeight));
                });

                currentY += blockHeight + (config.rightFrame.gap || 10);
            });
        }

        // 6. Gift Frame
        if (config.giftFrame.visible && rowData.giftText) {
            const w = config.giftFrame.width || 200;
            const h = config.giftFrame.height || 200;
            const x = config.giftFrame.x;
            const y = config.giftFrame.y;
            const padding = config.giftFrame.padding || 10;

            ctx.save();
            drawRoundedRect(ctx, x, y, w, h, config.giftFrame.borderRadius || 10);
            ctx.fillStyle = config.giftFrame.bg || '#fff';
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = config.giftFrame.color;
            ctx.font = `bold ${config.giftFrame.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top'; // Easier for multi-line
            
            const maxWidth = w - (padding * 2);
            const lines = wrapText(ctx, rowData.giftText, maxWidth);
            const lh = config.giftFrame.size * 1.2;
            const totalTextHeight = lines.length * lh;
            const startY = y + (h - totalTextHeight) / 2; // Center vertically

            lines.forEach((line, i) => {
                ctx.fillText(line, x + w/2, startY + i * lh);
            });
        }

        // 7. Backup Frame (New)
        if (config.backupFrame.visible && rowData.backupFrame) {
            const text = rowData.backupFrame;
            ctx.font = `bold ${config.backupFrame.size}px Arial`;
            const padding = config.backupFrame.padding || 10;
            
            let w = config.backupFrame.width;
            let lines = [text];
            if (w) {
                const maxWidth = w - (padding * 2);
                lines = wrapText(ctx, text, maxWidth);
            } else {
                const metrics = ctx.measureText(text);
                w = metrics.width + (padding * 2);
            }
            
            const lh = config.backupFrame.size * 1.2;
            const totalTextHeight = lines.length * lh;
            const h = totalTextHeight + (padding * 2);

            let x = config.backupFrame.x;
            if (config.backupFrame.align === 'center') x = x - w/2;
            const y = config.backupFrame.y;

            ctx.save();
            if (config.backupFrame.shadow) {
                ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
                ctx.shadowBlur = 5;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }
            drawRoundedRect(ctx, x, y, w, h, config.backupFrame.borderRadius || 5);
            ctx.fillStyle = config.backupFrame.bg || '#fff';
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = config.backupFrame.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const startY = y + padding + (lh - config.backupFrame.size) / 2;

            lines.forEach((line, i) => {
                ctx.fillText(line, x + w/2, startY + i * lh);
            });
        }

        // 8 & 9. Color Palettes
        const drawColorPalette = (paletteConfig: ColorPaletteConfig, dataStr: string) => {
            if (!paletteConfig.visible || !dataStr) return;
            
            const items = dataStr.split(',').map(s => {
                const [color, name] = s.split(':');
                return { color: color?.trim(), name: name?.trim() };
            }).filter(i => i.color && i.name);
            
            if (items.length === 0) return;
            
            const x = paletteConfig.x;
            const y = paletteConfig.y;
            const w = paletteConfig.width || 250;
            const padding = paletteConfig.padding || 15;
            const circleRadius = 12;
            
            ctx.font = `bold ${paletteConfig.size}px Arial`;
            const itemWidth = w / items.length;
            let maxLines = 1;
            items.forEach(item => {
                const lines = wrapText(ctx, item.name, itemWidth - 10);
                if (lines.length > maxLines) maxLines = lines.length;
            });
            
            const h = padding * 2 + circleRadius * 2 + 5 + (maxLines * paletteConfig.size * 1.2);
            
            ctx.save();
            ctx.beginPath();
            drawRoundedRect(ctx, x - w/2, y, w, h, paletteConfig.borderRadius || 10);
            ctx.fillStyle = paletteConfig.bg || '#ffffff';
            ctx.fill();
            if (paletteConfig.borderWidth) {
                ctx.lineWidth = paletteConfig.borderWidth;
                ctx.strokeStyle = paletteConfig.borderColor || '#000000';
                ctx.stroke();
            }
            if (paletteConfig.shadow) {
                ctx.shadowColor = "rgba(0, 0, 0, 0.1)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetY = 5;
            }
            ctx.restore();
            
            ctx.save();
            ctx.font = `bold ${paletteConfig.size + 2}px Arial`;
            const titleMetrics = ctx.measureText(paletteConfig.title);
            const titleW = titleMetrics.width + 30;
            const titleH = paletteConfig.size + 14;
            const titleX = x - titleW/2;
            const titleY = y - titleH/2;
            
            ctx.beginPath();
            drawRoundedRect(ctx, titleX, titleY, titleW, titleH, titleH/2);
            ctx.fillStyle = paletteConfig.titleBg || '#000000';
            ctx.fill();
            
            ctx.fillStyle = paletteConfig.titleColor || '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(paletteConfig.title, x, y);
            ctx.restore();
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = `bold ${paletteConfig.size}px Arial`;
            
            items.forEach((item, idx) => {
                const itemX = (x - w/2) + (idx * itemWidth) + itemWidth/2;
                const itemY = y + padding + 5;
                
                ctx.beginPath();
                ctx.arc(itemX, itemY + circleRadius, circleRadius, 0, 2 * Math.PI);
                ctx.fillStyle = item.color;
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#e0e0e0';
                ctx.stroke();
                
                ctx.fillStyle = paletteConfig.color || '#000000';
                const lines = wrapText(ctx, item.name, itemWidth - 5);
                lines.forEach((line, i) => {
                    ctx.fillText(line, itemX, itemY + circleRadius * 2 + 5 + (i * paletteConfig.size * 1.2));
                });
            });
        };

        if (config.exclusiveColors) drawColorPalette(config.exclusiveColors, rowData.exclusiveColors || '');
        if (config.basicColors) drawColorPalette(config.basicColors, rowData.basicColors || '');
    };

    const processBatch = async (asZip: boolean) => {
        if (frameData.length === 0 || imageFiles.length === 0) return;
        setIsProcessing(true);
        setProgress(0);
        setStatusMessage(asZip ? 'Đang nén file...' : 'Đang tải từng ảnh...');
        
        const zip = new JSZip();
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1000;
        tempCanvas.height = 1000;

        let count = 0;
        for (let i = 0; i < imageFiles.length; i++) {
            const imgFile = imageFiles[i];
            const name = imgFile.name.substring(0, imgFile.name.lastIndexOf('.'));
            const data = frameData.find(d => d.sku === name || d.sku === imgFile.name);
            
            if (data) {
                await drawToCanvas(imgFile, data, tempCanvas);
                const blob = await new Promise<Blob | null>(r => tempCanvas.toBlob(r, 'image/jpeg', 0.9));
                if (blob) {
                    if (asZip) {
                        zip.file(imgFile.name, blob);
                    } else {
                        // Tải trực tiếp (individual)
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = imgFile.name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        // Nhấp từng ảnh nên cần delay nhẹ tránh browser chặn popups hàng loạt
                        if (imageFiles.length > 1) {
                            await new Promise(r => setTimeout(r, 400));
                        }
                    }
                    count++;
                }
            }
            setProgress(Math.round(((i + 1) / imageFiles.length) * 100));
            // Small delay to prevent UI freeze
            await new Promise(r => setTimeout(r, 10));
        }
        
        if (count > 0 && asZip) {
            setStatusMessage('Đang nén ZIP...');
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BatchFrames_${Date.now()}.zip`;
            a.click();
            setStatusMessage(`Xong! Đã xử lý ${count} ảnh.`);
        } else if (count > 0) {
            setStatusMessage(`Đã tải xong ${count} ảnh.`);
        } else {
            setStatusMessage('Không tìm thấy ảnh khớp mã SKU.');
        }
        setIsProcessing(false);
    };

    return (
        <div className="animate-fade-in max-w-6xl mx-auto space-y-8">
            {/* --- DASHBOARD VIEW --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. Input Data */}
                <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 shadow-lg space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-sky-300 flex items-center gap-2">
                            <LayoutTemplate className="w-6 h-6" />
                            1. Nhập Dữ liệu
                        </h2>
                        <button 
                            onClick={() => setIsGuideOpen(true)}
                            className="text-xs text-zinc-400 hover:text-sky-400 flex items-center gap-1 transition-colors"
                        >
                            <Info className="w-4 h-4" /> Hướng dẫn
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        <label 
                            className={`block p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${isDraggingExcel ? 'border-green-500 bg-green-900/20' : 'border-zinc-600 hover:border-green-500 hover:bg-zinc-800/80'}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingExcel(true); }}
                            onDragLeave={() => setIsDraggingExcel(false)}
                            onDrop={handleExcelDrop}
                        >
                            <FileSpreadsheet className={`w-10 h-10 ${excelFile ? 'text-green-500' : 'text-zinc-500'}`}/>
                            <div className="text-center">
                                <p className="text-sm font-medium text-zinc-200">{excelFile ? excelFile.name : 'Kéo thả hoặc Chọn file Excel'}</p>
                                <p className="text-xs text-zinc-500 mt-1">Cột: SKU, Tên, 3 dòng mô tả, Tag, Quà tặng</p>
                                <button 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadSampleExcel(); }}
                                    className="mt-2 text-[10px] text-sky-400 hover:text-sky-300 underline"
                                >
                                    Tải file mẫu
                                </button>
                            </div>
                            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelChange}/>
                        </label>

                        {/* Image Drop Zone - Optimized for "Adding" */}
                        <label 
                            className={`block p-4 border-2 border-dashed rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${isDraggingImages ? 'border-sky-500 bg-sky-900/20' : 'border-zinc-600 hover:border-sky-500 hover:bg-zinc-800/80'}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingImages(true); }}
                            onDragLeave={() => setIsDraggingImages(false)}
                            onDrop={handleImagesDrop}
                        >
                            <ImageIcon className="w-8 h-8 text-zinc-500"/>
                            <div className="text-center">
                                <p className="text-sm font-medium text-zinc-200">
                                    {imageFiles.length > 0 ? 'Thêm ảnh khác...' : 'Chọn hoặc Kéo thả ảnh sản phẩm'}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">Hỗ trợ JPG, PNG (Tên ảnh = SKU)</p>
                            </div>
                            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImagesChange}/>
                        </label>

                        {/* Option: Remove White Background Toggle */}
                        <div id="batch-remove-bg-option" className="bg-zinc-900/70 p-3 rounded-xl border border-zinc-700/80 flex items-start gap-3 hover:border-zinc-600 transition-colors">
                            <input 
                                type="checkbox" 
                                id="chk-remove-white-bg"
                                checked={config.image?.removeWhiteBg || false} 
                                onChange={e => handleConfigChange('image', 'removeWhiteBg', e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded border-zinc-600 text-sky-500 focus:ring-sky-500 bg-zinc-800 cursor-pointer accent-sky-500"
                            />
                            <label htmlFor="chk-remove-white-bg" className="text-xs select-none cursor-pointer flex-1">
                                <span className="font-semibold text-zinc-200 block">Tự động xóa nền trắng của ảnh sản phẩm</span>
                                <span className="text-[11px] text-zinc-400 block mt-0.5 leading-relaxed">
                                    {config.image?.removeWhiteBg 
                                        ? 'Đang bật: Hệ thống sẽ tự động tách nền trắng khi lồng khung.' 
                                        : 'Đang tắt: Giữ nguyên 100% ảnh gốc (không xóa nền). Tích chọn nếu muốn tách nền trắng.'}
                                </span>
                            </label>
                        </div>

                        {/* New Image Gallery/Manager */}
                        {imageFiles.length > 0 && (() => {
                            const totalPreviewPages = Math.ceil(imageFiles.length / PREVIEW_PAGE_SIZE);
                            const validPreviewPage = Math.min(previewPage, totalPreviewPages || 1);
                            const previewImages = imageFiles.slice((validPreviewPage - 1) * PREVIEW_PAGE_SIZE, validPreviewPage * PREVIEW_PAGE_SIZE);
                            
                            return (
                                <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-700 animate-fade-in">
                                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-800">
                                        <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                                            <ImageIcon className="w-3 h-3"/> {imageFiles.length} ảnh đã chọn
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {totalPreviewPages > 1 && (
                                                <div className="flex items-center gap-1 text-[10px] text-zinc-400 mr-2">
                                                    <button 
                                                        onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                                                        disabled={validPreviewPage === 1}
                                                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                                                    >
                                                        &lt;
                                                    </button>
                                                    <span>Trang {validPreviewPage}/{totalPreviewPages}</span>
                                                    <button 
                                                        onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                                                        disabled={validPreviewPage === totalPreviewPages}
                                                        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                                                    >
                                                        &gt;
                                                    </button>
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => setImageFiles([])} 
                                                className="text-[10px] text-red-400 hover:bg-red-900/30 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3"/> Xóa hết
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                        {previewImages.map((file, localIdx) => {
                                            const idx = (validPreviewPage - 1) * PREVIEW_PAGE_SIZE + localIdx;
                                            return (
                                                <div key={`${file.name}-${idx}`} className="relative group aspect-square bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 hover:border-sky-500 transition-colors">
                                                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                                                    
                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); handleRemoveImage(idx); }}
                                                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                                        title="Xóa ảnh này"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                    
                                                    {/* Filename tooltip/overlay */}
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1">
                                                        <p className="text-[9px] text-zinc-300 break-words text-center font-mono">
                                                            {file.name}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-500 bg-zinc-900/50 p-3 rounded-lg border border-zinc-700">
                        <span>Trạng thái:</span>
                        <span className={frameData.length > 0 && imageFiles.length > 0 ? "text-green-400 font-bold" : "text-yellow-500"}>
                            {frameData.length > 0 && imageFiles.length > 0 ? "Sẵn sàng" : "Chờ dữ liệu"}
                        </span>
                    </div>
                </div>

                {/* 2. Actions */}
                <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 shadow-lg flex flex-col justify-center items-center text-center space-y-6">
                    <h2 className="text-xl font-bold text-zinc-200">2. Thiết kế & Xuất</h2>
                    <p className="text-zinc-400 text-sm">Chỉnh sửa vị trí, màu sắc trực quan trước khi xuất hàng loạt.</p>
                    
                    <div className="grid grid-cols-1 w-full gap-4 max-w-xs">
                        <Button 
                            onClick={() => setIsEditorOpen(true)}
                            disabled={!excelFile && imageFiles.length === 0}
                            colorScheme="primary"
                            className="!py-3 shadow-lg shadow-indigo-900/20"
                        >
                            <Settings className="w-5 h-5 mr-2" />
                            Chỉnh sửa Bố cục
                        </Button>

                        <div className="flex gap-2">
                             <Button 
                                onClick={() => processBatch(true)}
                                disabled={!excelFile || imageFiles.length === 0 || isProcessing}
                                colorScheme="green"
                                className="!py-3 shadow-lg shadow-green-900/20 flex-1"
                            >
                                <Download className="w-5 h-5 mr-2" />
                                Tải ZIP
                            </Button>
                            <Button 
                                onClick={() => processBatch(false)}
                                disabled={!excelFile || imageFiles.length === 0 || isProcessing}
                                colorScheme="slate"
                                className="!py-3 shadow-lg flex-1 !text-xs"
                                title="Tải lẻ phù hợp khi số lượng ảnh ít"
                            >
                                Tải Lẻ
                            </Button>
                        </div>
                    </div>

                    {isProcessing && (
                        <div className="w-full">
                            <p className="text-xs text-sky-400 mb-1">{statusMessage} {progress}%</p>
                            <div className="w-full bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}
                    {!isProcessing && statusMessage && (
                        <p className="text-xs text-green-400 font-medium">{statusMessage}</p>
                    )}
                </div>
            </div>

            {/* --- EDITOR MODAL (FULL SCREEN) --- */}
            {isEditorOpen && (
                <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex animate-fade-in">
                    {/* Left Sidebar: Controls */}
                    <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                            <h3 className="font-bold text-zinc-100 flex items-center gap-2"><Settings className="w-4 h-4 text-sky-500"/> Thiết kế</h3>
                            <button onClick={() => setIsEditorOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                            {/* Preset Selector */}
                            <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] uppercase font-bold text-zinc-500">Mẫu có sẵn</label>
                                    <button onClick={handleSavePreset} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Lưu bố cục
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {PRESETS.map(p => (
                                        <button 
                                            key={p.id} onClick={() => handlePresetChange(p.id)}
                                            className={`text-xs p-2 rounded border ${config.id === p.id ? 'bg-sky-900/50 border-sky-500 text-sky-300' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                    {savedPresets.map(p => (
                                        <div key={p.id} className="relative group">
                                            <button 
                                                onClick={() => handlePresetChange(p.id)}
                                                className={`w-full text-xs p-2 rounded border text-left truncate pr-6 ${config.id === p.id ? 'bg-emerald-900/50 border-emerald-500 text-emerald-300' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
                                            >
                                                {p.name}
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeletePreset(p.id, e)}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                                title="Xóa bố cục"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Extra Images (Stickers/Combo) Section */}
                            <div className="bg-indigo-900/20 p-3 rounded-lg border border-indigo-700/50 mb-2">
                                <label className="text-[10px] uppercase font-bold text-indigo-300 mb-2 flex items-center gap-2">
                                    <ImageIcon className="w-3 h-3"/> Ảnh phụ / Sticker
                                </label>
                                <div className="space-y-2">
                                    <Button onClick={() => extraImageInputRef.current?.click()} colorScheme="ghost" className="!w-full !py-1.5 !text-xs border-indigo-500/50 text-indigo-200 hover:bg-indigo-900/50">
                                        <Plus className="w-3 h-3 mr-1"/> Thêm ảnh phụ
                                    </Button>
                                    <input type="file" ref={extraImageInputRef} className="hidden" accept="image/*" onChange={handleAddExtraImage} />
                                    
                                    {config.extraImages && config.extraImages.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            {config.extraImages.map((img, idx) => (
                                                <div key={img.id} className="relative group bg-zinc-800 rounded border border-zinc-700 p-1 aspect-square flex items-center justify-center">
                                                    <img src={img.url} className="w-full h-full object-contain" alt="" />
                                                    <button 
                                                        onClick={() => handleRemoveExtraImage(img.id)}
                                                        className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3"/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Config Sections */}
                            <SectionHeader title="Chung" isOpen={activeConfigSection === 'general'} toggle={() => setActiveConfigSection(activeConfigSection === 'general' ? '' : 'general')} />
                            {activeConfigSection === 'general' && (
                                <div className="space-y-3 p-2 border-l-2 border-zinc-700 ml-2 mb-4">
                                    <ControlInput label="Màu nền Canvas" type="color" value={config.canvasBg} onChange={v => setConfig({...config, canvasBg: v})} />
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Ảnh nền Canvas</label>
                                        <input type="file" accept="image/*" onChange={handleBgImageUpload} className="text-xs text-zinc-300 w-full" />
                                        {config.bgImage && <button onClick={() => handleConfigChange('bgImage', '', undefined)} className="text-xs text-red-400 mt-1">Xóa ảnh nền</button>}
                                    </div>
                                </div>
                            )}

                            <SectionHeader title="Hình ảnh Sản phẩm" isOpen={activeConfigSection === 'image'} toggle={() => setActiveConfigSection(activeConfigSection === 'image' ? '' : 'image')} />
                            {activeConfigSection === 'image' && (
                                <div className="space-y-3 p-2 border-l-2 border-zinc-700 ml-2 mb-4">
                                    <label className="flex items-start gap-2.5 text-xs text-zinc-300 p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={config.image.removeWhiteBg || false} 
                                            onChange={e => handleConfigChange('image', 'removeWhiteBg', e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-zinc-600 text-sky-500 focus:ring-sky-500 bg-zinc-800 cursor-pointer accent-sky-500"
                                        /> 
                                        <div>
                                            <span className="font-semibold text-zinc-200 block">Xóa nền trắng (Tự động)</span>
                                            <span className="text-[10px] text-zinc-400 block mt-0.5">Mặc định tắt (giữ nguyên ảnh gốc). Tích chọn nếu muốn tách phông trắng.</span>
                                        </div>
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <ControlInput label="Rộng (px)" value={config.image.width} onChange={v => handleConfigChange('image', 'width', v)} />
                                        <ControlInput label="Cao (px)" value={config.image.height} onChange={v => handleConfigChange('image', 'height', v)} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-zinc-500 uppercase">Chế độ hiển thị</label>
                                        <select 
                                            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 outline-none"
                                            value={config.image.fit}
                                            onChange={e => handleConfigChange('image', 'fit', e.target.value)}
                                        >
                                            <option value="contain">Chứa vừa (Contain)</option>
                                            <option value="cover">Lấp đầy (Cover)</option>
                                        </select>
                                    </div>
                                    <div className="text-[10px] text-zinc-500 italic">Mẹo: Bạn có thể kéo góc dưới phải ảnh để chỉnh nhanh.</div>
                                </div>
                            )}

                            <SectionHeader title="Tên Sản phẩm" isOpen={activeConfigSection === 'name'} toggle={() => setActiveConfigSection(activeConfigSection === 'name' ? '' : 'name')} />
                            {activeConfigSection === 'name' && (
                                <div className="space-y-3 p-2 border-l-2 border-zinc-700 ml-2 mb-4">
                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={config.productName.visible} onChange={e => handleConfigChange('productName', 'visible', e.target.checked)}/> Hiển thị</label>
                                    <ControlInput label="Cỡ chữ" value={config.productName.size} onChange={v => handleConfigChange('productName', 'size', v)} />
                                    <ControlInput label="Màu chữ" type="color" value={config.productName.color} onChange={v => handleConfigChange('productName', 'color', v)} />
                                    <ControlInput label="Chiều rộng (max)" value={config.productName.width} onChange={v => handleConfigChange('productName', 'width', v)} />
                                </div>
                            )}

                            <SectionHeader title="Badge (Góc Trên)" isOpen={activeConfigSection === 'top'} toggle={() => setActiveConfigSection(activeConfigSection === 'top' ? '' : 'top')} />
                            {activeConfigSection === 'top' && (
                                <div className="space-y-3 p-2 border-l-2 border-zinc-700 ml-2 mb-4">
                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={config.topFrame.visible} onChange={e => handleConfigChange('topFrame', 'visible', e.target.checked)}/> Hiển thị</label>
                                    <ControlInput label="Cỡ chữ" value={config.topFrame.size} onChange={v => handleConfigChange('topFrame', 'size', v)} />
                                    <ControlInput label="Màu nền" type="color" value={config.topFrame.bg || '#ffffff'} onChange={v => handleConfigChange('topFrame', 'bg', v)} />
                                    <ControlInput label="Màu chữ" type="color" value={config.topFrame.color} onChange={v => handleConfigChange('topFrame', 'color', v)} />
                                    <ControlInput label="Chiều rộng" value={config.topFrame.width || 220} onChange={v => handleConfigChange('topFrame', 'width', v)} />
                                    <ControlInput label="Bo góc" value={config.topFrame.borderRadius} onChange={v => handleConfigChange('topFrame', 'borderRadius', v)} />
                                </div>
                            )}

                            <SectionHeader title="Thông tin (Bên Phải)" isOpen={activeConfigSection === 'right'} toggle={() => setActiveConfigSection(activeConfigSection === 'right' ? '' : 'right')} />
                            {activeConfigSection === 'right' && (
                                <div className="space-y-3 p-2 border-l-2 border-zinc-700 ml-2 mb-4">
                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={config.rightFrame.visible} onChange={e => handleConfigChange('rightFrame', 'visible', e.target.checked)}/> Hiển thị</label>
                                    <ControlInput label="Cỡ chữ" value={config.rightFrame.size} onChange={v => handleConfigChange('rightFrame', 'size', v)} />
                                    <ControlInput label="Màu nền box" type="color" value={config.rightFrame.bg || '#ffffff'} onChange={v => handleConfigChange('rightFrame', 'bg', v)} />
                                    <ControlInput label="Màu chữ" type="color" value={config.rightFrame.color} onChange={v => handleConfigChange('rightFrame', 'color', v)} />
                                    <ControlInput label="Chiều rộng" value={config.rightFrame.width} onChange={v => handleConfigChange('rightFrame', 'width', v)} />
                                    <ControlInput label="Padding" value={config.rightFrame.padding} onChange={v => handleConfigChange('rightFrame', 'padding', v)} />
                                    <ControlInput label="Bo góc" value={config.rightFrame.borderRadius} onChange={v => handleConfigChange('rightFrame', 'borderRadius', v)} />
                                    <ControlInput label="Khoảng cách dòng" value={config.rightFrame.gap} onChange={v => handleConfigChange('rightFrame', 'gap', v)} />
                                </div>
                            )}

                            <SectionHeader title="Quà tặng (Mới)" isOpen={activeConfigSection === 'gift'} toggle={() => setActiveConfigSection(activeConfigSection === 'gift' ? '' : 'gift')} />
                            {activeConfigSection === 'gift' && (
                                <div className="space-y-3 p-2 border-l-2 border-zinc-700 ml-2 mb-4">
                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={config.giftFrame.visible} onChange={e => handleConfigChange('giftFrame', 'visible', e.target.checked)}/> Hiển thị</label>
                                    <ControlInput label="Cỡ chữ" value={config.giftFrame.size} onChange={v => handleConfigChange('giftFrame', 'size', v)} />
                                    <ControlInput label="Màu nền" type="color" value={config.giftFrame.bg || '#ffffff'} onChange={v => handleConfigChange('giftFrame', 'bg', v)} />
                                    <ControlInput label="Màu chữ" type="color" value={config.giftFrame.color} onChange={v => handleConfigChange('giftFrame', 'color', v)} />
                                    <ControlInput label="Rộng" value={config.giftFrame.width} onChange={v => handleConfigChange('giftFrame', 'width', v)} />
                                    <ControlInput label="Cao" value={config.giftFrame.height} onChange={v => handleConfigChange('giftFrame', 'height', v)} />
                                    <ControlInput label="Padding" value={config.giftFrame.padding} onChange={v => handleConfigChange('giftFrame', 'padding', v)} />
                                    <ControlInput label="Bo góc" value={config.giftFrame.borderRadius} onChange={v => handleConfigChange('giftFrame', 'borderRadius', v)} />
                                </div>
                            )}

                            <SectionHeader title="Badge Dự Phòng (Mới)" isOpen={activeConfigSection === 'backup'} toggle={() => setActiveConfigSection(activeConfigSection === 'backup' ? '' : 'backup')} />
                            {activeConfigSection === 'backup' && (
                                <div className="space-y-3 p-2 border-l-2 border-zinc-700 ml-2 mb-4">
                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={config.backupFrame.visible} onChange={e => handleConfigChange('backupFrame', 'visible', e.target.checked)}/> Hiển thị</label>
                                    <ControlInput label="Cỡ chữ" value={config.backupFrame.size} onChange={v => handleConfigChange('backupFrame', 'size', v)} />
                                    <ControlInput label="Màu nền" type="color" value={config.backupFrame.bg || '#ffffff'} onChange={v => handleConfigChange('backupFrame', 'bg', v)} />
                                    <ControlInput label="Màu chữ" type="color" value={config.backupFrame.color} onChange={v => handleConfigChange('backupFrame', 'color', v)} />
                                    <ControlInput label="Chiều rộng" value={config.backupFrame.width || 220} onChange={v => handleConfigChange('backupFrame', 'width', v)} />
                                    <ControlInput label="Padding" value={config.backupFrame.padding} onChange={v => handleConfigChange('backupFrame', 'padding', v)} />
                                    <ControlInput label="Bo góc" value={config.backupFrame.borderRadius} onChange={v => handleConfigChange('backupFrame', 'borderRadius', v)} />
                                </div>
                            )}

                            <SectionHeader title="Màu Độc Quyền" isOpen={activeConfigSection === 'exclusiveColors'} toggle={() => setActiveConfigSection(activeConfigSection === 'exclusiveColors' ? '' : 'exclusiveColors')} />
                            {activeConfigSection === 'exclusiveColors' && (
                                <div className="space-y-3 p-2 border-l-2 border-zinc-700 ml-2 mb-4">
                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={config.exclusiveColors?.visible} onChange={e => handleConfigChange('exclusiveColors', 'visible', e.target.checked)}/> Hiển thị</label>
                                    <ControlInput label="Tiêu đề" type="text" value={config.exclusiveColors?.title} onChange={v => handleConfigChange('exclusiveColors', 'title', v)} />
                                    <ControlInput label="Màu nền tiêu đề" type="color" value={config.exclusiveColors?.titleBg} onChange={v => handleConfigChange('exclusiveColors', 'titleBg', v)} />
                                    <ControlInput label="Màu chữ tiêu đề" type="color" value={config.exclusiveColors?.titleColor} onChange={v => handleConfigChange('exclusiveColors', 'titleColor', v)} />
                                    <ControlInput label="Màu nền Box" type="color" value={config.exclusiveColors?.bg} onChange={v => handleConfigChange('exclusiveColors', 'bg', v)} />
                                    <ControlInput label="Màu viền Box" type="color" value={config.exclusiveColors?.borderColor} onChange={v => handleConfigChange('exclusiveColors', 'borderColor', v)} />
                                    <ControlInput label="Màu chữ" type="color" value={config.exclusiveColors?.color} onChange={v => handleConfigChange('exclusiveColors', 'color', v)} />
                                    <ControlInput label="Chiều rộng" value={config.exclusiveColors?.width} onChange={v => handleConfigChange('exclusiveColors', 'width', v)} />
                                    <ControlInput label="Cỡ chữ" value={config.exclusiveColors?.size} onChange={v => handleConfigChange('exclusiveColors', 'size', v)} />
                                </div>
                            )}

                            <SectionHeader title="Màu Cơ Bản" isOpen={activeConfigSection === 'basicColors'} toggle={() => setActiveConfigSection(activeConfigSection === 'basicColors' ? '' : 'basicColors')} />
                            {activeConfigSection === 'basicColors' && (
                                <div className="space-y-3 p-2 border-l-2 border-zinc-700 ml-2 mb-4">
                                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={config.basicColors?.visible} onChange={e => handleConfigChange('basicColors', 'visible', e.target.checked)}/> Hiển thị</label>
                                    <ControlInput label="Tiêu đề" type="text" value={config.basicColors?.title} onChange={v => handleConfigChange('basicColors', 'title', v)} />
                                    <ControlInput label="Màu nền tiêu đề" type="color" value={config.basicColors?.titleBg} onChange={v => handleConfigChange('basicColors', 'titleBg', v)} />
                                    <ControlInput label="Màu chữ tiêu đề" type="color" value={config.basicColors?.titleColor} onChange={v => handleConfigChange('basicColors', 'titleColor', v)} />
                                    <ControlInput label="Màu nền Box" type="color" value={config.basicColors?.bg} onChange={v => handleConfigChange('basicColors', 'bg', v)} />
                                    <ControlInput label="Màu viền Box" type="color" value={config.basicColors?.borderColor} onChange={v => handleConfigChange('basicColors', 'borderColor', v)} />
                                    <ControlInput label="Màu chữ" type="color" value={config.basicColors?.color} onChange={v => handleConfigChange('basicColors', 'color', v)} />
                                    <ControlInput label="Chiều rộng" value={config.basicColors?.width} onChange={v => handleConfigChange('basicColors', 'width', v)} />
                                    <ControlInput label="Cỡ chữ" value={config.basicColors?.size} onChange={v => handleConfigChange('basicColors', 'size', v)} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center: Interactive Preview */}
                    <div className="flex-1 flex flex-col relative bg-zinc-950" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                        {/* Toolbar */}
                        <div className="absolute top-4 left-4 right-4 z-20 flex justify-between pointer-events-none">
                            <div className="bg-black/70 backdrop-blur border border-white/10 px-4 py-2 rounded-full text-white text-sm font-medium shadow-xl pointer-events-auto">
                                Preview: {matchedSku}
                            </div>
                            <Button onClick={() => setIsEditorOpen(false)} className="!w-auto !py-2 pointer-events-auto shadow-xl">
                                <Check className="w-4 h-4 mr-2" /> Xong
                            </Button>
                        </div>

                        <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://transparenttextures.com/patterns/cubes.png')] overflow-hidden" ref={containerRef}>
                            <div 
                                className="relative bg-white shadow-2xl"
                                style={{ 
                                    width: '100%', 
                                    maxWidth: 'min(650px, calc(100vh - 100px))', 
                                    aspectRatio: '1/1',
                                    backgroundColor: config.canvasBg,
                                    containerType: 'inline-size' // Enable Container Queries for exact scaling
                                }}
                            >
                                {/* Alignment Guides */}
                                {showGuideX && <div className="absolute top-0 bottom-0 left-1/2 w-0.5 border-l border-dashed border-red-500 z-50 pointer-events-none transform -translate-x-1/2"></div>}
                                {showGuideY && <div className="absolute left-0 right-0 top-1/2 h-0.5 border-t border-dashed border-red-500 z-50 pointer-events-none transform -translate-y-1/2"></div>}

                                {/* 0. Background Image Layer */}
                                {config.bgImage && (
                                    <div 
                                        className="absolute inset-0 bg-cover bg-center pointer-events-none"
                                        style={{ backgroundImage: `url(${config.bgImage})` }}
                                    />
                                )}

                                {/* 1. Image Layer */}
                                {processedPreviewImage ? (
                                    <div
                                        className="absolute group pointer-events-auto"
                                        style={{
                                            left: `${config.image.x * 0.1}cqw`,
                                            top: `${config.image.y * 0.1}cqw`,
                                            width: `${config.image.width * 0.1}cqw`,
                                            height: `${config.image.height * 0.1}cqw`,
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'image')}
                                    >
                                        <img 
                                            src={processedPreviewImage} 
                                            alt="Product" 
                                            className="w-full h-full cursor-move border-2 border-transparent hover:border-green-400/50"
                                            style={{
                                                objectFit: config.image.fit
                                            }}
                                        />
                                        {/* Resize Handle */}
                                        <div 
                                            className="absolute bottom-0 right-0 w-6 h-6 bg-white/50 hover:bg-white rounded-full cursor-se-resize flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                            onMouseDown={(e) => handleMouseDown(e, 'image', 'resize')}
                                        >
                                            <Maximize2 className="w-3 h-3 text-black"/>
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        className="absolute border-2 border-dashed border-zinc-300 flex items-center justify-center text-zinc-400 pointer-events-auto cursor-move"
                                        style={{
                                            left: `${config.image.x * 0.1}cqw`,
                                            top: `${config.image.y * 0.1}cqw`,
                                            width: `${config.image.width * 0.1}cqw`,
                                            height: `${config.image.height * 0.1}cqw`,
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'image')}
                                    >
                                        ẢNH SẢN PHẨM
                                        {/* Resize Handle Placeholder */}
                                        <div 
                                            className="absolute bottom-0 right-0 w-6 h-6 bg-white/50 hover:bg-white rounded-full cursor-se-resize flex items-center justify-center shadow-md z-20"
                                            onMouseDown={(e) => handleMouseDown(e, 'image', 'resize')}
                                        >
                                            <Maximize2 className="w-3 h-3 text-black"/>
                                        </div>
                                    </div>
                                )}

                                {/* 1.5 Extra Images Layers */}
                                {config.extraImages && config.extraImages.map(img => (
                                    <div
                                        key={img.id}
                                        className="absolute group pointer-events-auto"
                                        style={{
                                            left: `${img.x * 0.1}cqw`,
                                            top: `${img.y * 0.1}cqw`,
                                            width: `${img.width * 0.1}cqw`,
                                            height: `${img.height * 0.1}cqw`,
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, img.id)}
                                    >
                                        <img 
                                            src={img.url} 
                                            alt="Extra" 
                                            className="w-full h-full cursor-move border-2 border-transparent hover:border-indigo-400/50 object-contain"
                                        />
                                        {/* Resize Handle */}
                                        <div 
                                            className="absolute bottom-0 right-0 w-6 h-6 bg-white/50 hover:bg-white rounded-full cursor-se-resize flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                            onMouseDown={(e) => handleMouseDown(e, img.id, 'resize')}
                                        >
                                            <Maximize2 className="w-3 h-3 text-black"/>
                                        </div>
                                    </div>
                                ))}

                                {/* 2. Name Layer */}
                                {config.productName.visible && matchData?.name && (
                                    <div 
                                        className="absolute pointer-events-auto cursor-move border-2 border-transparent hover:border-sky-400/50 flex items-center justify-center"
                                        style={{
                                            left: `${config.productName.x * 0.1}cqw`,
                                            top: `${config.productName.y * 0.1}cqw`,
                                            width: `${(config.productName.width || 900) * 0.1}cqw`,
                                            transform: 'translate(-50%, 0)', // Center Anchor
                                            color: config.productName.color,
                                            fontSize: `${config.productName.size * 0.1}cqw`, 
                                            fontFamily: config.productName.font,
                                            fontWeight: 'bold',
                                            textAlign: 'center',
                                            textShadow: config.productName.shadow ? '0 0 0.4cqw white' : 'none',
                                            whiteSpace: 'normal',
                                            lineHeight: 1.2
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'productName')}
                                    >
                                        {matchData.name.toUpperCase()}
                                    </div>
                                )}

                                {/* 3. Top Frame Layer */}
                                {config.topFrame.visible && matchData?.topFrame && (
                                    <div 
                                        className="absolute pointer-events-auto cursor-move border-2 border-transparent hover:border-red-400/50 flex items-center justify-center"
                                        style={{
                                            left: `${config.topFrame.x * 0.1}cqw`,
                                            top: `${config.topFrame.y * 0.1}cqw`,
                                            width: `${(config.topFrame.width || 200) * 0.1}cqw`,
                                            transform: config.topFrame.align === 'center' ? 'translate(-50%, 0)' : 'none',
                                            backgroundColor: config.topFrame.bg,
                                            color: config.topFrame.color,
                                            padding: `${(config.topFrame.padding || 10) * 0.1}cqw`,
                                            borderRadius: `${config.topFrame.borderRadius}px`,
                                            fontWeight: 'bold',
                                            fontSize: `${config.topFrame.size * 0.1}cqw`,
                                            textAlign: 'center',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            lineHeight: 1.2,
                                            boxShadow: config.topFrame.shadow ? '0.2cqw 0.2cqw 0.5cqw rgba(0,0,0,0.2)' : 'none',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'topFrame')}
                                    >
                                        {matchData.topFrame}
                                    </div>
                                )}

                                {/* 4. Right Frame Layer */}
                                {config.rightFrame.visible && matchData?.rightFrame && (
                                    <div 
                                        className="absolute pointer-events-auto cursor-move border-2 border-transparent hover:border-blue-400/50 flex flex-col"
                                        style={{
                                            left: `${config.rightFrame.x * 0.1}cqw`,
                                            top: `${config.rightFrame.y * 0.1}cqw`,
                                            width: `${(config.rightFrame.width || 300) * 0.1}cqw`,
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'rightFrame')}
                                    >
                                        {matchData.rightFrame.map((feat, idx) => (
                                            <div 
                                                key={idx}
                                                style={{
                                                    display: 'flex', // IMPORTANT: Match vertical alignment with Canvas middle baseline
                                                    alignItems: 'center',
                                                    backgroundColor: config.rightFrame.bg === 'transparent' ? 'transparent' : config.rightFrame.bg,
                                                    color: config.rightFrame.color,
                                                    padding: `${(config.rightFrame.padding || 10) * 0.1}cqw`,
                                                    marginBottom: `${(config.rightFrame.gap || 10) * 0.1}cqw`,
                                                    borderRadius: `${config.rightFrame.borderRadius}px`,
                                                    boxShadow: config.rightFrame.shadow ? '0.2cqw 0.2cqw 0.5cqw rgba(0,0,0,0.2)' : 'none',
                                                    fontWeight: 'bold',
                                                    fontSize: `${config.rightFrame.size * 0.1}cqw`,
                                                    lineHeight: 1.4,
                                                    whiteSpace: 'pre-wrap'
                                                }}
                                            >
                                                {feat}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 5. Gift Frame Layer */}
                                {config.giftFrame.visible && matchData?.giftText && (
                                    <div 
                                        className="absolute pointer-events-auto cursor-move border-2 border-transparent hover:border-purple-400/50 flex items-center justify-center text-center shadow-lg"
                                        style={{
                                            left: `${config.giftFrame.x * 0.1}cqw`,
                                            top: `${config.giftFrame.y * 0.1}cqw`,
                                            width: `${(config.giftFrame.width || 200) * 0.1}cqw`,
                                            height: `${(config.giftFrame.height || 200) * 0.1}cqw`,
                                            backgroundColor: config.giftFrame.bg,
                                            color: config.giftFrame.color,
                                            borderRadius: `${config.giftFrame.borderRadius}px`,
                                            padding: `${(config.giftFrame.padding || 10) * 0.1}cqw`,
                                            fontWeight: 'bold',
                                            fontSize: `${config.giftFrame.size * 0.1}cqw`,
                                            overflow: 'hidden',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            lineHeight: 1.2,
                                            whiteSpace: 'pre-wrap'
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'giftFrame')}
                                    >
                                        {matchData.giftText}
                                    </div>
                                )}

                                {/* 6. Backup Frame Layer */}
                                {config.backupFrame.visible && matchData?.backupFrame && (
                                    <div 
                                        className="absolute pointer-events-auto cursor-move border-2 border-transparent hover:border-orange-400/50 flex items-center justify-center"
                                        style={{
                                            left: `${config.backupFrame.x * 0.1}cqw`,
                                            top: `${config.backupFrame.y * 0.1}cqw`,
                                            width: `${(config.backupFrame.width || 200) * 0.1}cqw`,
                                            transform: config.backupFrame.align === 'center' ? 'translate(-50%, 0)' : 'none',
                                            backgroundColor: config.backupFrame.bg,
                                            color: config.backupFrame.color,
                                            padding: `${(config.backupFrame.padding || 10) * 0.1}cqw`,
                                            borderRadius: `${config.backupFrame.borderRadius}px`,
                                            fontWeight: 'bold',
                                            fontSize: `${config.backupFrame.size * 0.1}cqw`,
                                            textAlign: 'center',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            lineHeight: 1.2,
                                            boxShadow: config.backupFrame.shadow ? '0.2cqw 0.2cqw 0.5cqw rgba(0,0,0,0.2)' : 'none',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'backupFrame')}
                                    >
                                        {matchData.backupFrame}
                                    </div>
                                )}

                                {/* 8. Exclusive Colors Layer */}
                                {config.exclusiveColors?.visible && matchData?.exclusiveColors && (
                                    <div 
                                        className="absolute pointer-events-auto cursor-move border-2 border-transparent hover:border-pink-400/50"
                                        style={{
                                            left: `${config.exclusiveColors.x * 0.1}cqw`,
                                            top: `${config.exclusiveColors.y * 0.1}cqw`,
                                            width: `${(config.exclusiveColors.width || 250) * 0.1}cqw`,
                                            transform: 'translate(-50%, 0)',
                                            backgroundColor: config.exclusiveColors.bg,
                                            border: `${config.exclusiveColors.borderWidth}px solid ${config.exclusiveColors.borderColor}`,
                                            borderRadius: `${config.exclusiveColors.borderRadius}px`,
                                            padding: `${(config.exclusiveColors.padding || 15) * 0.1}cqw`,
                                            paddingTop: `${((config.exclusiveColors.padding || 15) + 10) * 0.1}cqw`,
                                            boxShadow: config.exclusiveColors.shadow ? '0.2cqw 0.2cqw 0.5cqw rgba(0,0,0,0.1)' : 'none',
                                            display: 'flex',
                                            justifyContent: 'space-around',
                                            alignItems: 'flex-start'
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'exclusiveColors')}
                                    >
                                        <div 
                                            className="absolute"
                                            style={{
                                                top: 0,
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                backgroundColor: config.exclusiveColors.titleBg,
                                                color: config.exclusiveColors.titleColor,
                                                padding: '0.2cqw 1cqw',
                                                borderRadius: '2cqw',
                                                fontSize: `${(config.exclusiveColors.size + 2) * 0.1}cqw`,
                                                fontWeight: 'bold',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {config.exclusiveColors.title}
                                        </div>
                                        {matchData.exclusiveColors.split(',').map((s: string, idx: number) => {
                                            const [color, name] = s.split(':');
                                            if (!color || !name) return null;
                                            return (
                                                <div key={idx} className="flex flex-col items-center gap-1" style={{ width: `${100 / matchData.exclusiveColors.split(',').length}%` }}>
                                                    <div style={{ width: '2.4cqw', height: '2.4cqw', borderRadius: '50%', backgroundColor: color.trim(), border: '1px solid #e0e0e0' }} />
                                                    <div style={{ color: config.exclusiveColors.color, fontSize: `${config.exclusiveColors.size * 0.1}cqw`, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>
                                                        {name.trim()}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* 9. Basic Colors Layer */}
                                {config.basicColors?.visible && matchData?.basicColors && (
                                    <div 
                                        className="absolute pointer-events-auto cursor-move border-2 border-transparent hover:border-teal-400/50"
                                        style={{
                                            left: `${config.basicColors.x * 0.1}cqw`,
                                            top: `${config.basicColors.y * 0.1}cqw`,
                                            width: `${(config.basicColors.width || 250) * 0.1}cqw`,
                                            transform: 'translate(-50%, 0)',
                                            backgroundColor: config.basicColors.bg,
                                            border: `${config.basicColors.borderWidth}px solid ${config.basicColors.borderColor}`,
                                            borderRadius: `${config.basicColors.borderRadius}px`,
                                            padding: `${(config.basicColors.padding || 15) * 0.1}cqw`,
                                            paddingTop: `${((config.basicColors.padding || 15) + 10) * 0.1}cqw`,
                                            boxShadow: config.basicColors.shadow ? '0.2cqw 0.2cqw 0.5cqw rgba(0,0,0,0.1)' : 'none',
                                            display: 'flex',
                                            justifyContent: 'space-around',
                                            alignItems: 'flex-start'
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, 'basicColors')}
                                    >
                                        <div 
                                            className="absolute"
                                            style={{
                                                top: 0,
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                backgroundColor: config.basicColors.titleBg,
                                                color: config.basicColors.titleColor,
                                                padding: '0.2cqw 1cqw',
                                                borderRadius: '2cqw',
                                                fontSize: `${(config.basicColors.size + 2) * 0.1}cqw`,
                                                fontWeight: 'bold',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {config.basicColors.title}
                                        </div>
                                        {matchData.basicColors.split(',').map((s: string, idx: number) => {
                                            const [color, name] = s.split(':');
                                            if (!color || !name) return null;
                                            return (
                                                <div key={idx} className="flex flex-col items-center gap-1" style={{ width: `${100 / matchData.basicColors.split(',').length}%` }}>
                                                    <div style={{ width: '2.4cqw', height: '2.4cqw', borderRadius: '50%', backgroundColor: color.trim(), border: '1px solid #e0e0e0' }} />
                                                    <div style={{ color: config.basicColors.color, fontSize: `${config.basicColors.size * 0.1}cqw`, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>
                                                        {name.trim()}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-3 bg-zinc-900 border-t border-zinc-800 text-center text-xs text-zinc-500">
                            Kéo thả các thành phần để sắp xếp. Nhấn "Xong" để lưu bố cục.
                        </div>
                    </div>
                </div>
            )}
            {/* --- GUIDE MODAL --- */}
            <Modal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} title="Hướng dẫn Tạo Khung Hàng Loạt">
                <div className="space-y-4 text-zinc-300 text-sm">
                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-700">
                        <h4 className="font-bold text-sky-400 mb-2">1. Chuẩn bị File Excel</h4>
                        <p className="mb-2">Tạo file Excel (.xlsx) với các cột theo thứ tự sau (không cần tiêu đề cột, nhưng nên có để dễ nhớ):</p>
                        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-2">
                            <li><strong className="text-zinc-200">Cột A (SKU):</strong> Mã sản phẩm (Dùng để khớp với tên ảnh).</li>
                            <li><strong className="text-zinc-200">Cột B (Tên):</strong> Tên hiển thị trên khung.</li>
                            <li><strong className="text-zinc-200">Cột C, D, E:</strong> 3 dòng đặc điểm nổi bật (hiển thị bên phải).</li>
                            <li><strong className="text-zinc-200">Cột F (Top Badge):</strong> Chữ hiển thị ở góc trên (VD: GIẢM 50%, MỚI...).</li>
                            <li><strong className="text-zinc-200">Cột G (Quà tặng):</strong> Thông tin quà tặng (hiển thị ở góc dưới).</li>
                            <li><strong className="text-zinc-200">Cột H (Dự phòng):</strong> Badge phụ hoặc thông tin thêm (VD: FREESHIP, HOT...).</li>
                            <li><strong className="text-zinc-200">Cột I, J (Bảng màu):</strong> Nhập theo định dạng <code>#MãMàu:TênMàu, #MãMàu:TênMàu</code>. VD: <code>#FAD6C3:Vàng Hồng, #C0C0C0:Bạc Shadow</code>.</li>
                        </ul>
                        <div className="mt-3">
                            <button 
                                onClick={downloadSampleExcel}
                                className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded border border-zinc-600 flex items-center gap-2 transition-colors"
                            >
                                <Download className="w-3 h-3"/> Tải file Excel mẫu
                            </button>
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-700">
                        <h4 className="font-bold text-sky-400 mb-2">2. Chuẩn bị Ảnh Sản Phẩm</h4>
                        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-2">
                            <li>Tên file ảnh phải trùng với mã SKU trong file Excel.</li>
                            <li>Ví dụ: SKU là <code className="bg-zinc-800 px-1 rounded">SP001</code> thì tên ảnh phải là <code className="bg-zinc-800 px-1 rounded">SP001.jpg</code> hoặc <code className="bg-zinc-800 px-1 rounded">SP001.png</code>.</li>
                            <li>Hỗ trợ kéo thả nhiều ảnh cùng lúc.</li>
                        </ul>
                    </div>

                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-700">
                        <h4 className="font-bold text-sky-400 mb-2">3. Quy trình Xử lý</h4>
                        <ol className="list-decimal list-inside space-y-1 text-zinc-400 ml-2">
                            <li>Tải file Excel và Ảnh lên.</li>
                            <li>Nhấn <strong>"Chỉnh sửa Bố cục"</strong> để xem trước và điều chỉnh vị trí các thành phần.</li>
                            <li>Nhấn <strong>"Tải ZIP"</strong> để hệ thống tự động ghép khung và tải về toàn bộ ảnh đã xử lý.</li>
                        </ol>
                    </div>
                </div>
            </Modal>

            {/* Save Preset Modal */}
            {isSavePresetModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsSavePresetModalOpen(false)}>
                    <div className="bg-zinc-800 border border-zinc-700 w-full max-w-md rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-zinc-900 p-4 border-b border-zinc-700 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg">Lưu bố cục</h3>
                            <button onClick={() => setIsSavePresetModalOpen(false)} className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-700 transition-colors">
                                <X className="w-5 h-5"/>
                            </button>
                        </div>
                        <div className="p-6 bg-zinc-800">
                            <label className="block text-sm font-medium text-zinc-300 mb-2">Tên bố cục</label>
                            <input
                                type="text"
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="Nhập tên bố cục..."
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmSavePreset();
                                }}
                            />
                        </div>
                        <div className="bg-zinc-900/50 p-4 border-t border-zinc-700 flex justify-end gap-3">
                            <Button onClick={() => setIsSavePresetModalOpen(false)} variant="secondary" className="!w-auto !px-6 !py-2">Hủy</Button>
                            <Button onClick={confirmSavePreset} className="!w-auto !px-6 !py-2">Lưu</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchFrameTab;
