
// ... existing imports ...
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ImageState, CustomSizePreset, ActiveTool, Crop as CropType } from '../../types';
import { blobToBase64, fetchImageFromUrl, normalizeImageFile } from '../../utils/imageUtils';
import { editImageWithPrompt } from '../../services/geminiService';
import Spinner from '../Spinner';
import Button from '../Button';
import { 
    Sparkles, Image as ImageIcon, Palette, Crop, SlidersHorizontal, ImageMinus, PenTool, Type, Frame, Droplet, 
    Maximize, Upload, X, Eye, MousePointer2, Move, Eraser, ZoomIn, Search, Wand2, Undo, Save, Info,
    Layers, History, ChevronRight, ChevronLeft, ImagePlus, ZoomOut, Check
} from 'lucide-react';
import ImageInfoModal from '../ImageInfoModal';
import ManageCustomSizesModal from '../ManageCustomSizesModal';
import CropRotatePanel from '../image-editor/CropRotatePanel';
import AiPanel from '../image-editor/AiPanel';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop as ReactCropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import ColorAdjustmentPanel from '../image-editor/ColorAdjustmentPanel';
import SaveModal from '../SaveModal';
import FramePanel from '../image-editor/FramePanel';
import WatermarkPanel from '../image-editor/WatermarkPanel';
import UpscalePanel from '../image-editor/UpscalePanel';
import AdjustmentPanel from '../image-editor/AdjustmentPanel';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_CUSTOM_SIZES: CustomSizePreset[] = [
    { id: 'yt-thumb', name: 'Youtube Thumbnail', width: 1280, height: 720, lockType: 'unlocked' },
    { id: 'fb-post', name: 'Facebook Post', width: 1200, height: 630, lockType: 'unlocked' },
    { id: 'insta-square', name: 'Instagram Post (1:1)', width: 1080, height: 1080, lockType: 'unlocked' },
];

const TOOLS = [
    { id: 'move', icon: Move, label: 'Move (V)' },
    { id: 'crop-rotate', icon: Crop, label: 'Crop (C)' },
    { id: 'adjustments', icon: SlidersHorizontal, label: 'Adjustments' },
    { id: 'color', icon: Palette, label: 'Color & Filter' },
    { id: 'ai-magic', icon: Sparkles, label: 'AI Magic' },
    { id: 'upscale', icon: Maximize, label: 'Upscale' },
    { id: 'frame', icon: Frame, label: 'Frame' },
    { id: 'watermark', icon: Droplet, label: 'Watermark' },
];

const ImageEditorTab: React.FC = () => {
    const [images, setImages] = useState<ImageState[]>([]);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [activeTool, setActiveTool] = useState<ActiveTool | 'move' | null>('move');
    const [isBatchEdit, setIsBatchEdit] = useState<boolean>(false);
    const [zoom, setZoom] = useState<number>(1);
    const [loadingTool, setLoadingTool] = useState<ActiveTool | 'ai-magic' | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    // Compare Mode
    const [isComparing, setIsComparing] = useState(false);
    
    // Modals
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isManagePresetsModalOpen, setIsManagePresetsModalOpen] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [customSizePresets, setCustomSizePresets] = useState<CustomSizePreset[]>(DEFAULT_CUSTOM_SIZES);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    // AI Chat
    const [aiPrompt, setAiPrompt] = useState('');

    // Crop / Adjustments
    const [crop, setCrop] = useState<ReactCropType>();
    const [aspect, setAspect] = useState<number | undefined>();
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saturation, setSaturation] = useState(100);

    const imgRef = useRef<HTMLImageElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    
    const isToolLoading = loadingTool !== null || isLoading;
    const activeImage = activeIndex !== null ? images[activeIndex] : null;

    const displayUrl = isComparing && activeImage && activeImage.history.length > 0 
        ? activeImage.history[0] 
        : activeImage?.url;

    const processAndSetImages = useCallback(async (files: File[]) => {
        setIsLoading(true); setLoadingMessage('Đang xử lý ảnh...');
        const newImages: ImageState[] = [];
        try {
            for (const rawFile of files) {
                let file = rawFile;
                if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
                    setLoadingMessage(`Đang chuyển đổi ${file.name}...`);
                    file = await normalizeImageFile(file);
                }
                if (!file.type.startsWith('image/')) continue;
                const url = URL.createObjectURL(file);
                const dimensions = await new Promise<{ width: number, height: number }>(resolve => {
                    const img = new Image(); img.onload = () => resolve({ width: img.width, height: img.height }); img.onerror = () => resolve({ width: 0, height: 0 }); img.src = url;
                });
                if (dimensions.width > 0) {
                     newImages.push({
                        id: `${file.name}-${Date.now()}-${Math.random()}`,
                        file, url, dimensions, history: [url], isSelected: false,
                    });
                }
            }
            if (newImages.length > 0) setImages(prev => [...prev, ...newImages]);
        } catch (err) { setError(err instanceof Error ? err.message : "Lỗi khi xử lý ảnh"); } finally { setIsLoading(false); setLoadingMessage(''); }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processAndSetImages(Array.from(e.target.files));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerFileInput = () => fileInputRef.current?.click();

    const handleDeleteImage = (index: number) => {
        const newImages = images.filter((_, i) => i !== index);
        setImages(newImages);
        if (newImages.length === 0) setActiveIndex(null);
        else if (index === activeIndex) setActiveIndex(Math.max(0, index - 1));
        else if (activeIndex !== null && index < activeIndex) setActiveIndex(activeIndex - 1);
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; if (!isDraggingOver) setIsDraggingOver(true); };
    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOver(false); };
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false);
        const files: File[] = [];
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (let i = 0; i < e.dataTransfer.files.length; i++) files.push(e.dataTransfer.files[i]);
        }
        if (files.length > 0) processAndSetImages(files);
    };

    const handleToggleSelection = (toggledIndex: number) => { setImages(prev => prev.map((image, index) => index === toggledIndex ? { ...image, isSelected: !image.isSelected } : image)); };
    const handleToggleSelectAll = () => { const areAllSelected = images.every(img => img.isSelected); setImages(prev => prev.map(image => ({ ...image, isSelected: !areAllSelected }))); };

    const handleUndo = () => {
        if (!activeImage || activeImage.history.length <= 1 || activeIndex === null) return;
        const currentHistory = activeImage.history;
        const prevUrl = currentHistory[currentHistory.length - 2];
        fetch(prevUrl).then(res => res.blob()).then(blob => {
            const newFile = new File([blob], activeImage.file.name, { type: blob.type });
            const imgElement = new Image();
            imgElement.onload = () => {
                const newDimensions = { width: imgElement.width, height: imgElement.height };
                setImages(prev => {
                    const newImages = [...prev];
                    if (prev[activeIndex] && prev[activeIndex].id === activeImage.id) {
                        newImages[activeIndex] = { ...prev[activeIndex], url: prevUrl, file: newFile, dimensions: newDimensions, history: currentHistory.slice(0, -1) };
                    }
                    return newImages;
                });
            };
            imgElement.src = prevUrl;
        }).catch(err => console.error("Undo failed", err));
    };

    const applyCanvasEdit = useCallback(async (imageIndex: number, editFunction: (image: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void | Promise<void>): Promise<ImageState> => {
        const originalImage = images[imageIndex]; const image = new Image(); image.crossOrigin = "anonymous"; image.src = originalImage.url;
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas error');
        await editFunction(image, canvas, ctx);
        const newBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, originalImage.file.type)); if (!newBlob) throw new Error('Blob error');
        const newFile = new File([newBlob], originalImage.file.name, { type: newBlob.type }); const newUrl = URL.createObjectURL(newFile);
        return { ...originalImage, url: newUrl, file: newFile, dimensions: { width: canvas.width, height: canvas.height }, history: [...originalImage.history, newUrl] };
    }, [images]);

    const executeEdit = useCallback(async (tool: ActiveTool, messages: { single: string; batch: string; progress: string }, editFunction: (image: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void | Promise<void>) => {
        if (activeIndex === null) return; setLoadingTool(tool); setLoadingMessage(isBatchEdit ? messages.batch : messages.single); setError(null);
        try {
            const indicesToUpdate = isBatchEdit ? images.map((img, i) => img.isSelected ? i : -1).filter(i => i !== -1) : [activeIndex];
            if (isBatchEdit && indicesToUpdate.length === 0) { setError("Chọn ít nhất một ảnh."); setLoadingTool(null); setLoadingMessage(''); return; }
            if (isBatchEdit && indicesToUpdate.length > 0) {
                let currentImages = [...images];
                for (let i = 0; i < indicesToUpdate.length; i++) {
                    const index = indicesToUpdate[i];
                    if (indicesToUpdate.length > 1) setLoadingMessage(`${messages.progress} ${i + 1}/${indicesToUpdate.length}...`);
                    currentImages[index] = await applyCanvasEdit(index, editFunction);
                    setImages([...currentImages]);
                }
            } else {
                const updatedImage = await applyCanvasEdit(activeIndex, editFunction);
                setImages(prev => { const newImgs = [...prev]; newImgs[activeIndex] = updatedImage; return newImgs; });
            }
        } catch (err) { setError(err instanceof Error ? err.message : 'Error'); } finally { setLoadingTool(null); setLoadingMessage(''); }
    }, [activeIndex, isBatchEdit, images, applyCanvasEdit]);

    const handleGenerativeEdit = async (editPrompt: string, quality: 'speed' | 'quality' = 'speed') => {
        const targetIndices = isBatchEdit ? images.map((img, i) => img.isSelected ? i : -1).filter(i => i !== -1) : (activeIndex !== null ? [activeIndex] : []);
        if (targetIndices.length === 0) { setError("Vui lòng chọn ít nhất một ảnh để xử lý."); return; }
        setLoadingTool('ai-magic'); setError(null); setAiPrompt(''); // Clear prompt
        try {
            for (let i = 0; i < targetIndices.length; i++) {
                const index = targetIndices[i];
                const imageState = images[index];
                setLoadingMessage(targetIndices.length > 1 ? `AI đang xử lý ảnh ${i + 1}/${targetIndices.length}...` : 'AI đang thực hiện chỉ thị...');
                const base64 = await blobToBase64(imageState.file);
                const newBase64 = await editImageWithPrompt(base64, imageState.file.type, editPrompt, quality);
                const byteString = atob(newBase64); const ab = new ArrayBuffer(byteString.length); const ia = new Uint8Array(ab);
                for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);
                const newBlob = new Blob([ab], { type: imageState.file.type });
                const newFile = new File([newBlob], imageState.file.name, { type: imageState.file.type });
                const newUrl = URL.createObjectURL(newFile);
                const dimensions = await new Promise<{ width: number, height: number }>(resolve => { const img = new Image(); img.onload = () => resolve({ width: img.width, height: img.height }); img.src = newUrl; });
                setImages(prev => {
                    const newImages = [...prev]; if (!newImages[index]) return prev;
                    newImages[index] = { ...newImages[index], url: newUrl, file: newFile, dimensions, history: [...newImages[index].history, newUrl] };
                    return newImages;
                });
            }
        } catch (err) { setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.'); } finally { setLoadingTool(null); setLoadingMessage(''); }
    };

    const handleCropApply = useCallback(async () => {
        if (!activeImage || !crop || !imgRef.current || activeIndex === null) return;
        const image = imgRef.current; const scaleX = image.naturalWidth / image.width; const scaleY = image.naturalHeight / image.height;
        const pixelCrop = { x: crop.x * scaleX, y: crop.y * scaleY, width: crop.width * scaleX, height: crop.height * scaleY };
        const editFunction = (img: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
            canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
            ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
        };
        await executeEdit('crop-rotate', { single: 'Cutting...', batch: '', progress: '' }, editFunction);
        setActiveTool('move'); setCrop(undefined); setAspect(undefined);
    }, [activeImage, crop, activeIndex, executeEdit]);

    const handleResize = useCallback(async (newWidth: number, newHeight: number) => {
        await executeEdit('adjustments', { single: 'Resizing...', batch: 'Batch resizing...', progress: 'Resizing image' }, (img, canvas, ctx) => {
            canvas.width = newWidth; canvas.height = newHeight;
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
        });
    }, [executeEdit]);

    const handleRecanvas = useCallback(async (newWidth: number, newHeight: number) => {
        await executeEdit('adjustments', { single: 'Changing canvas...', batch: 'Batch changing canvas...', progress: 'Recanvasing image' }, (img, canvas, ctx) => {
            canvas.width = newWidth; canvas.height = newHeight;
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, newWidth, newHeight);
            const x = (newWidth - img.width) / 2; const y = (newHeight - img.height) / 2;
            ctx.drawImage(img, x, y);
        });
    }, [executeEdit]);

    const handleAutoResize = useCallback(async () => {
        await executeEdit('adjustments', { single: 'Auto Cropping...', batch: 'Batch auto cropping...', progress: 'Cropping image' }, (img, canvas, ctx) => {
            // Very simple auto-crop logic (just trim transparent/white borders if any, otherwise do nothing)
            // As a placeholder, we'll just draw it as is
            canvas.width = img.width; canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        });
    }, [executeEdit]);

    const handleApplyFrame = useCallback(async (
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
    ) => {
        const loadImage = (fileOrUrl: File | string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = (e) => reject(e);
                img.src = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
            });
        };

        const frameImg = frameFile ? await loadImage(frameFile) : null;
        const giftImg = giftFile ? await loadImage(giftFile) : null;
        const comboImg = (comboSettings?.comboFile) ? await loadImage(comboSettings.comboFile) : null;

        const editFunction = (baseImg: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
            const targetW = use1000x1000 ? 1000 : baseImg.width;
            const targetH = use1000x1000 ? 1000 : baseImg.height;
            canvas.width = targetW;
            canvas.height = targetH;

            // White canvas background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetW, targetH);

            if (mode === 'combo' && comboImg) {
                // Combo Mode: Draw Main product on left half, Secondary product on right half
                const halfW = targetW / 2;
                
                // Main image on left
                const scaleMain = Math.min(halfW / baseImg.width, targetH / baseImg.height);
                const wMain = baseImg.width * scaleMain;
                const hMain = baseImg.height * scaleMain;
                const xMain = (halfW - wMain) / 2;
                const yMain = (targetH - hMain) / 2;
                ctx.drawImage(baseImg, xMain, yMain, wMain, hMain);

                // Combo image on right
                const scaleUser = (comboSettings?.scale || 100) / 100;
                const scaleCombo = Math.min(halfW / comboImg.width, targetH / comboImg.height) * scaleUser;
                const wCombo = comboImg.width * scaleCombo;
                const hCombo = comboImg.height * scaleCombo;
                const xCombo = halfW + (halfW - wCombo) / 2;
                
                const offsetYPercent = (comboSettings?.offsetY ?? 50) / 100;
                const yCombo = Math.max(0, Math.min(targetH - hCombo, (targetH - hCombo) * offsetYPercent));
                
                ctx.drawImage(comboImg, xCombo, yCombo, wCombo, hCombo);
            } else {
                // Template/Overlay mode
                const scale = Math.min(targetW / baseImg.width, targetH / baseImg.height);
                const w = baseImg.width * scale;
                const h = baseImg.height * scale;
                const x = (targetW - w) / 2;
                const y = (targetH - h) / 2;
                ctx.drawImage(baseImg, x, y, w, h);
            }

            // Gift Image (Top-Right)
            if (giftImg) {
                const giftSize = Math.min(targetW, targetH) * 0.25;
                const gx = targetW - giftSize - (targetW * 0.03);
                const gy = targetH * 0.03;
                ctx.drawImage(giftImg, gx, gy, giftSize, giftSize);
            }

            // Gift Text Badge
            if (giftText.trim()) {
                ctx.save();
                const fontSize = Math.max(12, Math.round((giftTextStyle.size || 18) * (targetW / 800)));
                ctx.font = `bold ${fontSize}px ${giftTextStyle.font || 'sans-serif'}`;
                
                const textMetrics = ctx.measureText(giftText);
                const paddingX = fontSize * 0.6;
                const paddingY = fontSize * 0.3;
                const badgeW = textMetrics.width + (paddingX * 2);
                const badgeH = fontSize + (paddingY * 2);
                
                const bx = giftImg ? (targetW - badgeW - (targetW * 0.03)) : (targetW - badgeW - (targetW * 0.04));
                const by = giftImg ? (targetH * 0.29) : (targetH * 0.04);

                ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bx, by, badgeW, badgeH, 8);
                } else {
                    ctx.rect(bx, by, badgeW, badgeH);
                }
                ctx.fill();

                ctx.fillStyle = giftTextStyle.color || '#ffffff';
                ctx.textBaseline = 'middle';
                ctx.fillText(giftText, bx + paddingX, by + (badgeH / 2));
                ctx.restore();
            }

            // Frame Overlay over whole image
            if (frameImg) {
                ctx.drawImage(frameImg, 0, 0, targetW, targetH);
            }
        };

        await executeEdit('frame', { single: 'Lồng khung...', batch: 'Lồng khung hàng loạt...', progress: 'Lồng khung...' }, editFunction);
        setActiveTool('move');
    }, [executeEdit]);

    const handleRemoveBgForFile = useCallback(async (file: File): Promise<File> => {
        const base64 = await blobToBase64(file);
        const newBase64 = await editImageWithPrompt(
            base64, 
            file.type, 
            'Identify the subject, remove background completely, and return the subject on a transparent background.', 
            'speed'
        );
        const byteString = atob(newBase64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);
        const newBlob = new Blob([ab], { type: 'image/png' });
        return new File([newBlob], `nobg_${file.name.replace(/\.[^/.]+$/, "")}.png`, { type: 'image/png' });
    }, []);

    const handleUpscale = useCallback(async (targetWidth: number, targetHeight: number, quality: 'speed' | 'quality') => {
        const prompt = `Upscale and enhance image resolution to high definition ${targetWidth}x${targetHeight}. Sharpen details, restore textures, and remove compression noise while preserving exact proportions.`;
        await handleGenerativeEdit(prompt, quality);
    }, [handleGenerativeEdit]);

    const handleWatermarkApply = useCallback(async (
        file: File | null, 
        text: string, 
        position: number, 
        opacity: number, 
        scale: number
    ) => {
        const watermarkImg = file ? await (async () => {
            return new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        })() : null;

        const editFunction = (baseImg: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
            canvas.width = baseImg.width;
            canvas.height = baseImg.height;
            ctx.drawImage(baseImg, 0, 0);

            ctx.save();
            ctx.globalAlpha = opacity / 100;

            const getXY = (w: number, h: number) => {
                const margin = baseImg.width * 0.03;
                let x = margin;
                let y = margin;

                if ([2, 5, 8].includes(position)) x = (baseImg.width - w) / 2;
                else if ([3, 6, 9].includes(position)) x = baseImg.width - w - margin;

                if ([4, 5, 6].includes(position)) y = (baseImg.height - h) / 2;
                else if ([7, 8, 9].includes(position)) y = baseImg.height - h - margin;

                return { x, y };
            };

            if (watermarkImg) {
                const wmWidth = (baseImg.width * scale) / 100;
                const wmHeight = watermarkImg.height * (wmWidth / watermarkImg.width);
                const { x, y } = getXY(wmWidth, wmHeight);
                ctx.drawImage(watermarkImg, x, y, wmWidth, wmHeight);
            } else if (text.trim()) {
                const fontSize = Math.max(14, Math.round((baseImg.width * scale) / 100 * 0.3));
                ctx.font = `bold ${fontSize}px sans-serif`;
                const metrics = ctx.measureText(text);
                const { x, y } = getXY(metrics.width, fontSize);
                
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = Math.max(1, fontSize / 10);
                ctx.strokeText(text, x, y + fontSize);
                ctx.fillText(text, x, y + fontSize);
            }

            ctx.restore();
        };

        await executeEdit('watermark', { single: 'Thêm watermark...', batch: 'Thêm watermark hàng loạt...', progress: 'Thêm watermark...' }, editFunction);
        setActiveTool('move');
    }, [executeEdit]);

    const handleSaveImage = useCallback(async (options: { format: 'png' | 'jpeg' | 'webp'; quality: number; filename: string }) => {
        const targets = isBatchEdit ? images.filter(i => i.isSelected) : (activeImage ? [activeImage] : []);
        if (targets.length === 0) return;

        for (let i = 0; i < targets.length; i++) {
            const imgState = targets[i];
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((res) => { img.onload = res; img.src = imgState.url; });

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            if (options.format === 'jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);

            const mime = `image/${options.format}`;
            const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, options.quality));
            if (!blob) continue;

            const downloadName = targets.length > 1 
                ? `${options.filename}-${i + 1}.${options.format === 'jpeg' ? 'jpg' : options.format}`
                : `${options.filename}.${options.format === 'jpeg' ? 'jpg' : options.format}`;

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = downloadName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }, [isBatchEdit, images, activeImage]);

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        requestAnimationFrame(() => {
            setCrop(undefined);
            if (aspect) setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height));
        });
    };

    const handleAIChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (aiPrompt.trim()) {
            handleGenerativeEdit(aiPrompt.trim(), 'speed');
        }
    };

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const container = canvasContainerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.altKey) {
                e.preventDefault();
                const zoomChange = e.deltaY < 0 ? 0.1 : -0.1;
                setZoom(prev => Math.max(0.1, Math.min(10, prev + (prev * zoomChange))));
            }
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    const checkeredStyle = {
        backgroundImage: `url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgvwEAAMv4zMDD8R1bIhoU/o8gIhhUDYFADRgaG/yhiYcQ9o8gIDxkAlP8bY0E9Bw0AAAAASUVORK5CYII=')`,
        backgroundRepeat: 'repeat'
    };

    return (
        <div className="flex flex-col w-full h-full bg-zinc-950 text-zinc-200 font-sans text-sm overflow-hidden select-none absolute inset-0">
            <input ref={fileInputRef} type="file" multiple accept="image/png, image/jpeg, image/webp, image/heic, .heic" className="hidden" onChange={handleFileChange} />
            
            {/* Loading Overlay */}
            {isToolLoading && (
                <div className="absolute inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Spinner className="w-10 h-10 text-sky-500" />
                    <p className="mt-4 font-medium animate-pulse text-sky-100">{loadingMessage}</p>
                </div>
            )}

            {/* Top Bar */}
            <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                        <Palette className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-zinc-100 tracking-tight">Studio Ảnh</span>
                    
                    {images.length > 0 && (
                        <div className="ml-4 flex items-center gap-2">
                            <button onClick={() => triggerFileInput()} className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors flex items-center gap-1.5">
                                <ImagePlus className="w-3.5 h-3.5" /> Thêm ảnh
                            </button>
                        </div>
                    )}
                </div>

                {images.length > 0 && (
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors">
                            <input type="checkbox" checked={isBatchEdit} onChange={(e) => setIsBatchEdit(e.target.checked)} className="rounded bg-zinc-900 border-zinc-600 text-sky-500 focus:ring-sky-500 focus:ring-offset-zinc-900" />
                            <span className="text-xs font-medium">Chỉnh sửa hàng loạt</span>
                        </label>

                        <div className="w-px h-6 bg-zinc-800 mx-1"></div>

                        <button onClick={handleUndo} disabled={!activeImage || activeImage.history.length <= 1} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:hover:bg-zinc-800 transition-colors" title="Hoàn tác (Ctrl+Z)">
                            <Undo className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsInfoModalOpen(true)} disabled={!activeImage} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg disabled:opacity-30 disabled:hover:bg-zinc-800 transition-colors" title="Thông tin ảnh">
                            <Info className="w-4 h-4" />
                        </button>
                        <Button onClick={() => setIsSaveModalOpen(true)} disabled={images.length === 0} className="!w-auto !py-1.5 px-4 !text-xs shadow-lg shadow-sky-500/20">
                            <Save className="w-4 h-4 mr-1.5" />
                            Lưu ảnh
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Left Sidebar (Narrow Tools) */}
                <div className="w-20 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 shrink-0 z-20 shadow-2xl space-y-4">
                    <button onClick={() => setActiveTool('move')} className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeTool === 'move' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`} title="Move">
                        <Move className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase">Move</span>
                    </button>
                    <button onClick={() => setActiveTool('crop-rotate')} className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeTool === 'crop-rotate' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`} title="Crop & Rotate">
                        <Crop className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase">Crop</span>
                    </button>
                    <button onClick={() => setActiveTool('adjustments')} className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeTool === 'adjustments' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`} title="Resize">
                        <SlidersHorizontal className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase">Resize</span>
                    </button>
                    <button onClick={() => setActiveTool('color')} className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeTool === 'color' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`} title="Color & Filters">
                        <Palette className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase">Color</span>
                    </button>
                    <button onClick={() => setActiveTool('ai-magic')} className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeTool === 'ai-magic' ? 'bg-purple-600 text-white' : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/20'}`} title="AI Magic">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase">Magic</span>
                    </button>
                    <button onClick={() => setActiveTool('upscale')} className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeTool === 'upscale' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`} title="Upscale">
                        <Maximize className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase">HD</span>
                    </button>
                    <button onClick={() => setActiveTool('frame')} className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeTool === 'frame' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`} title="Frame">
                        <Frame className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase">Frame</span>
                    </button>
                    <button onClick={() => setActiveTool('watermark')} className={`p-3 rounded-xl transition-colors flex flex-col items-center gap-1 ${activeTool === 'watermark' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`} title="Watermark">
                        <Droplet className="w-5 h-5" />
                        <span className="text-[9px] font-medium uppercase">Mark</span>
                    </button>
                </div>

                {/* Main Canvas Area */}
                <div className="flex-1 flex flex-col relative overflow-hidden bg-zinc-950">
                    <div 
                        ref={canvasContainerRef}
                        className="flex-1 overflow-hidden relative p-8 flex items-center justify-center pb-32"
                        style={checkeredStyle}
                        onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    >
                        {/* Zoom Controls */}
                        {images.length > 0 && (
                            <div className="absolute top-4 right-4 bg-zinc-900/80 backdrop-blur-md border border-zinc-700/50 rounded-xl flex items-center p-1 shadow-2xl z-20">
                                <button onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"><ZoomOut className="w-4 h-4" /></button>
                                <span className="text-xs font-medium text-zinc-300 w-12 text-center select-none">{Math.round(zoom * 100)}%</span>
                                <button onClick={() => setZoom(prev => Math.min(10, prev + 0.1))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"><ZoomIn className="w-4 h-4" /></button>
                            </div>
                        )}

                        {isDraggingOver && (
                            <div className="absolute inset-0 z-40 bg-sky-500/20 border-2 border-sky-500 m-4 rounded-2xl flex items-center justify-center backdrop-blur-sm pointer-events-none">
                                <div className="bg-zinc-900 text-sky-400 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-2xl">
                                    <ImagePlus className="w-6 h-6" />
                                    Thả ảnh vào đây
                                </div>
                            </div>
                        )}
                        
                        {images.length === 0 ? (
                            <div className="text-center text-zinc-500 max-w-sm">
                                <div className="w-24 h-24 rounded-full bg-zinc-900/50 flex items-center justify-center mx-auto mb-6">
                                    <ImageIcon className="w-12 h-12 opacity-50" />
                                </div>
                                <h2 className="text-xl font-bold text-zinc-300 mb-2">Bắt đầu chỉnh sửa</h2>
                                <p className="mb-8 text-sm text-zinc-500 leading-relaxed">Kéo thả ảnh vào đây hoặc bấm tải lên để sử dụng các công cụ AI mạnh mẽ như xóa nền, đổi phông, và nâng cấp chất lượng.</p>
                                <Button onClick={triggerFileInput} className="!w-auto px-8 !py-3 bg-sky-600 hover:bg-sky-500 text-white border-0 shadow-lg shadow-sky-900/20 rounded-xl">
                                    <ImagePlus className="w-5 h-5 mr-2" />
                                    Tải ảnh lên
                                </Button>
                            </div>
                        ) : (
                            activeImage && (
                                <div className="relative shadow-2xl transition-transform duration-75" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
                                    {activeTool === 'crop-rotate' ? (
                                        <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={(c) => setCrop(c)} aspect={aspect}>
                                            <img ref={imgRef} src={activeImage.url} alt="Editing" className="block max-w-[80vw] max-h-[70vh] object-contain rounded-lg shadow-2xl ring-1 ring-zinc-800" onLoad={onImageLoad} />
                                        </ReactCrop>
                                    ) : (
                                        <div className="relative group">
                                            <img src={displayUrl} alt="Preview" className="block max-w-[80vw] max-h-[70vh] object-contain rounded-lg shadow-2xl ring-1 ring-zinc-800" 
                                                 style={activeTool === 'color' ? { filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` } : {}} />
                                            
                                            {/* Compare Button */}
                                            {activeImage.history.length > 1 && (
                                                <button
                                                    className="absolute bottom-4 right-4 bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-zinc-200 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-colors z-20 shadow-xl"
                                                    onMouseDown={() => setIsComparing(true)} onMouseUp={() => setIsComparing(false)} onMouseLeave={() => setIsComparing(false)}
                                                >
                                                    <Eye className="w-4 h-4" /> Bấm giữ để xem ảnh gốc
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>

                    {/* Bottom Filmstrip */}
                    {images.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-28 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800 flex items-center px-4 gap-3 overflow-x-auto custom-scrollbar z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
                            {isBatchEdit && (
                                <div className="shrink-0 flex flex-col justify-center px-2 border-r border-zinc-800 mr-2 h-16">
                                    <button onClick={handleToggleSelectAll} className="text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 px-3 py-1.5 rounded-lg transition-colors">
                                        {images.every(img => img.isSelected) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                    </button>
                                </div>
                            )}
                            {images.map((img, idx) => (
                                <div 
                                    key={img.id}
                                    onClick={() => setActiveIndex(idx)}
                                    className={`relative h-20 min-w-[80px] w-20 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shrink-0 group ${activeIndex === idx ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-zinc-900 scale-105 mx-1' : 'opacity-60 hover:opacity-100 ring-1 ring-zinc-700'}`}
                                    style={checkeredStyle}
                                >
                                    <img src={img.url} className="w-full h-full object-cover" />
                                    {isBatchEdit && (
                                        <div className="absolute top-1 left-1">
                                            <input 
                                                type="checkbox" 
                                                checked={img.isSelected} 
                                                onChange={() => handleToggleSelection(idx)}
                                                onClick={e => e.stopPropagation()}
                                                className="w-4 h-4 rounded-md bg-zinc-900/80 border-zinc-500 text-sky-500 focus:ring-sky-500 cursor-pointer backdrop-blur-sm"
                                            />
                                        </div>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteImage(idx); }}
                                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Sidebar (Properties Panel) */}
                {activeTool !== 'move' && (
                    <div className="w-[320px] bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0 z-20 shadow-2xl">
                        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 bg-zinc-950">
                            <span className="font-bold text-zinc-200 capitalize">
                                {activeTool === 'crop-rotate' ? 'Cắt & Xoay' : 
                                 activeTool === 'ai-magic' ? 'AI Magic' : 
                                 activeTool === 'adjustments' ? 'Kích thước' : 
                                 activeTool === 'color' ? 'Màu sắc' : 
                                 activeTool === 'upscale' ? 'Nâng cấp sắc nét' : 
                                 activeTool === 'frame' ? 'Khung ảnh' : 'Watermark'}
                            </span>
                            
                            <div className="flex items-center gap-2">
                                {activeTool === 'crop-rotate' && (
                                    <button onClick={handleCropApply} className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors">Áp dụng</button>
                                )}
                                <button onClick={() => setActiveTool('move')} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-zinc-900/50">
                            {activeTool === 'color' && <ColorAdjustmentPanel brightness={brightness} contrast={contrast} saturation={saturation} setBrightness={setBrightness} setContrast={setContrast} setSaturation={setSaturation} onApply={() => setActiveTool('move')} onCancel={() => { setBrightness(100); setContrast(100); setSaturation(100); setActiveTool('move'); }} />}
                            {activeTool === 'adjustments' && <AdjustmentPanel currentDimensions={activeImage?.dimensions || {width:0, height:0}} isBatchEdit={isBatchEdit} customSizePresets={customSizePresets} onManagePresets={() => setIsManagePresetsModalOpen(true)} onResize={handleResize} onRecanvas={handleRecanvas} onAutoResize={handleAutoResize} />}
                            {activeTool === 'upscale' && <UpscalePanel currentDimensions={activeImage?.dimensions || {width:0, height:0}} onUpscale={handleUpscale} isLoading={isToolLoading} />}
                            {activeTool === 'frame' && <FramePanel onApplyFrame={handleApplyFrame} onCancel={() => setActiveTool('move')} onRemoveBg={handleRemoveBgForFile} />}
                            {activeTool === 'watermark' && <WatermarkPanel onApply={handleWatermarkApply} onCancel={() => setActiveTool('move')} />}
                            {activeTool === 'ai-magic' && <AiPanel prompt={aiPrompt} setPrompt={setAiPrompt} onGenerativeEdit={(p, q) => handleGenerativeEdit(p, q)} onRemoveBackground={() => handleGenerativeEdit('Identify the subject, remove background, and place it on a transparent background.', 'speed')} isLoading={isToolLoading} />}
                        </div>
                    </div>
                )}
            </div>

            <ImageInfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} image={activeImage} />
            <ManageCustomSizesModal isOpen={isManagePresetsModalOpen} onClose={() => setIsManagePresetsModalOpen(false)} presets={customSizePresets} onSave={setCustomSizePresets} />
            <SaveModal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} onSave={handleSaveImage} image={activeImage} imageCount={isBatchEdit ? images.filter(i => i.isSelected).length : 1} />
        </div>
    );
};

export default ImageEditorTab;