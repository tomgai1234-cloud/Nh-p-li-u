import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Maximize2, 
    Download, 
    Crop, 
    ExternalLink, 
    Copy, 
    Check, 
    AlertTriangle, 
    Sparkles, 
    Layers, 
    Image as ImageIcon,
    X,
    ZoomIn
} from 'lucide-react';

export interface ImageHoverPreviewProps {
    src: string;
    alt?: string;
    title?: string;
    variantLabel?: string;
    category?: string;
    onDownload?: (url: string) => void;
    onEdit?: (url: string) => void;
    className?: string;
    imageClassName?: string;
    showActionsOnThumbnail?: boolean;
    previewWidth?: number;
    previewHeight?: number;
    disableHoverPreview?: boolean;
    aspectRatio?: string;
    children?: React.ReactNode;
}

export const ImageHoverPreview: React.FC<ImageHoverPreviewProps> = ({
    src,
    alt = 'Scraped image',
    title,
    variantLabel,
    category,
    onDownload,
    onEdit,
    className = '',
    imageClassName = '',
    showActionsOnThumbnail = true,
    previewWidth = 420,
    previewHeight = 440,
    disableHoverPreview = false,
    aspectRatio = 'aspect-square',
    children
}) => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const getInitialSrc = (url: string) => {
        if (!url) return '';
        if (
            url.includes('panasonic.com') || 
            url.includes('samsung.com') || 
            url.includes('images.samsung.com') || 
            url.includes('cellphones.com.vn') ||
            url.includes('footjoy.com') || 
            url.includes('titleist.com')
        ) {
            return `/api/proxy?url=${encodeURIComponent(url)}`;
        }
        return url;
    };

    const [currentSrc, setCurrentSrc] = useState(() => getInitialSrc(src));
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isBroken, setIsBroken] = useState(false);
    
    // Hover Preview State
    const [isHovered, setIsHovered] = useState(false);
    const [previewPos, setPreviewPos] = useState<{ top: number; left: number; placement: 'right' | 'left' | 'top' | 'bottom' }>({
        top: 0,
        left: 0,
        placement: 'right'
    });
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
    const [copied, setCopied] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    useEffect(() => {
        setCurrentSrc(getInitialSrc(src));
        setIsLoading(true);
        setHasError(false);
        setIsBroken(false);
        setNaturalSize(null);
    }, [src]);

    const handleError = () => {
        if (!hasError) {
            setHasError(true);
            if (src.includes('panasonic.com') || src.includes('samsung.com')) {
                setIsLoading(false);
                setIsBroken(true);
            } else {
                // Fallback to wsrv.nl or proxy
                const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(src)}`;
                setCurrentSrc(proxyUrl);
            }
        } else if (hasError && currentSrc.includes('wsrv.nl')) {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(src)}`;
            setCurrentSrc(proxyUrl);
        } else {
            setIsLoading(false);
            setIsBroken(true);
        }
    };

    const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
        setIsLoading(false);
        const img = e.currentTarget;
        if (img.naturalWidth && img.naturalHeight) {
            setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        }
    };

    // Calculate smart positioning for floating full preview card
    const calculatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 16;
        const cardW = previewWidth;
        const cardH = previewHeight;

        let left = rect.right + 12;
        let placement: 'right' | 'left' | 'top' | 'bottom' = 'right';

        // Check if fits on the right
        if (left + cardW + padding > viewportWidth) {
            // Try left side
            const leftCandidate = rect.left - cardW - 12;
            if (leftCandidate >= padding) {
                left = leftCandidate;
                placement = 'left';
            } else {
                // Not enough room on either horizontal side, center horizontally
                left = Math.max(padding, Math.min(viewportWidth - cardW - padding, (viewportWidth - cardW) / 2));
                placement = rect.top > cardH + padding ? 'top' : 'bottom';
            }
        }

        // Align vertically with trigger center, but keep inside viewport bounds
        let top = rect.top + (rect.height / 2) - (cardH / 2);
        if (placement === 'top') {
            top = Math.max(padding, rect.top - cardH - 12);
        } else if (placement === 'bottom') {
            top = Math.min(viewportHeight - cardH - padding, rect.bottom + 12);
        } else {
            // Clamped top
            top = Math.max(padding, Math.min(viewportHeight - cardH - padding, top));
        }

        setPreviewPos({ top, left, placement });
    }, [previewWidth, previewHeight]);

    const handleMouseEnter = () => {
        if (disableHoverPreview || isBroken) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        // Slight debounce to avoid rapid flashing when moving cursor across grid
        timeoutRef.current = setTimeout(() => {
            calculatePosition();
            setIsHovered(true);
        }, 120);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 80);
    };

    const handleCopyUrl = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(src);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const filename = src.split('/').pop()?.split('?')[0] || 'image.jpg';

    return (
        <>
            <div 
                ref={triggerRef}
                className={`relative group ${aspectRatio} bg-zinc-900/60 rounded-xl overflow-hidden border border-zinc-700/60 flex items-center justify-center hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-500/10 transition-all duration-200 cursor-pointer select-none ${className}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={() => !isBroken && setIsLightboxOpen(true)}
            >
                {/* Lazy Skeleton Spinner */}
                {isLoading && !isBroken && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/80 backdrop-blur-xs z-10 animate-pulse">
                        <div className="w-5 h-5 border-2 border-zinc-600 border-t-sky-400 rounded-full animate-spin"></div>
                    </div>
                )}

                {/* Broken state */}
                {isBroken ? (
                    <div className="flex flex-col items-center justify-center p-3 text-center text-zinc-500">
                        <AlertTriangle className="w-5 h-5 text-amber-500 mb-1" />
                        <span className="text-[11px] font-semibold text-amber-400/90">Ảnh không tải được</span>
                        <span className="text-[10px] text-zinc-500 truncate max-w-[110px]" title={src}>Link bị hỏng</span>
                    </div>
                ) : (
                    <img 
                        src={currentSrc} 
                        alt={alt} 
                        className={`w-full h-full object-contain transition-all duration-300 group-hover:scale-105 ${isLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} ${imageClassName}`}
                        onError={handleError}
                        onLoad={handleImageLoaded}
                        loading="lazy" 
                        decoding="async"
                        referrerPolicy="no-referrer"
                    />
                )}

                {/* Hover hint badge */}
                {!isBroken && !isLoading && (
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 pointer-events-none">
                        <span className="px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md text-[9px] font-bold text-zinc-300 border border-zinc-700/60 flex items-center gap-1 shadow-sm">
                            <ZoomIn className="w-2.5 h-2.5 text-sky-400" />
                            Xem ảnh lớn
                        </span>
                    </div>
                )}

                {/* Thumbnail Action Buttons */}
                {!isBroken && showActionsOnThumbnail && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 flex gap-1" onClick={e => e.stopPropagation()}>
                        {onEdit && (
                            <button 
                                onClick={() => onEdit(src)}
                                className="p-1.5 bg-black/75 hover:bg-sky-600 text-white rounded-lg transition-colors backdrop-blur-md shadow-md border border-white/10"
                                title="Sửa ảnh (Crop)"
                            >
                                <Crop className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {onDownload && (
                            <button 
                                onClick={() => onDownload(src)}
                                className="p-1.5 bg-black/75 hover:bg-sky-600 text-white rounded-lg transition-colors backdrop-blur-md shadow-md border border-white/10"
                                title="Tải xuống"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Variant / Category Badge */}
                {variantLabel && !isLoading && !isBroken && (
                    <div className="absolute bottom-2 left-2 max-w-[85%] truncate px-2 py-0.5 bg-black/85 backdrop-blur-md rounded-lg text-[10px] font-bold text-sky-300 border border-sky-500/40 flex items-center gap-1 shadow-md z-20 pointer-events-none" title={variantLabel}>
                        <Layers className="w-3 h-3 flex-shrink-0 text-sky-400" />
                        <span className="truncate">{variantLabel}</span>
                    </div>
                )}

                {children}
            </div>

            {/* FLOATING HOVER PREVIEW CARD (PORTAL) */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isHovered && !isBroken && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 2 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            style={{
                                position: 'fixed',
                                top: previewPos.top,
                                left: previewPos.left,
                                width: previewWidth,
                                zIndex: 999999,
                            }}
                            className="pointer-events-auto bg-zinc-950/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col p-3 ring-1 ring-white/10"
                            onMouseEnter={() => {
                                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                                setIsHovered(true);
                            }}
                            onMouseLeave={handleMouseLeave}
                        >
                            {/* Header Info */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-xs">
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                    <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                    <span className="font-bold text-zinc-100 truncate text-[11px]" title={title || filename}>
                                        {title ? title : filename}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {naturalSize && (
                                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-700">
                                            {naturalSize.width} × {naturalSize.height}px
                                        </span>
                                    )}
                                    {category && (
                                        <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-semibold border border-sky-500/30">
                                            {category}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Full Image Container */}
                            <div className="relative w-full h-[320px] bg-zinc-900/80 rounded-xl overflow-hidden border border-zinc-800/80 flex items-center justify-center group/preview">
                                <img
                                    src={currentSrc}
                                    alt={alt}
                                    className="w-full h-full object-contain select-none"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                />

                                {variantLabel && (
                                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/85 backdrop-blur-md rounded-md text-[10px] font-bold text-sky-300 border border-sky-500/40 flex items-center gap-1.5 shadow-lg">
                                        <Layers className="w-3 h-3 text-sky-400" />
                                        <span>{variantLabel}</span>
                                    </div>
                                )}

                                {/* Quick zoom click overlay */}
                                <button
                                    onClick={() => {
                                        setIsHovered(false);
                                        setIsLightboxOpen(true);
                                    }}
                                    className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 hover:bg-sky-600 text-white rounded-lg text-[11px] font-medium backdrop-blur-md border border-white/10 transition-colors flex items-center gap-1 shadow-lg"
                                >
                                    <Maximize2 className="w-3 h-3" />
                                    <span>Toàn màn hình</span>
                                </button>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between pt-2.5 mt-1 text-xs">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleCopyUrl}
                                        className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-800 transition-colors flex items-center gap-1 text-[11px]"
                                        title="Sao chép link ảnh"
                                    >
                                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                        <span>{copied ? 'Đã chép' : 'Copy link'}</span>
                                    </button>

                                    <a
                                        href={src}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-800 transition-colors flex items-center gap-1 text-[11px]"
                                        title="Mở ảnh gốc trong tab mới"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        <span>Mở tab mới</span>
                                    </a>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {onEdit && (
                                        <button
                                            onClick={() => {
                                                setIsHovered(false);
                                                onEdit(src);
                                            }}
                                            className="px-2.5 py-1 bg-zinc-800 hover:bg-sky-600 text-zinc-200 hover:text-white rounded-lg transition-colors font-medium flex items-center gap-1 text-[11px]"
                                        >
                                            <Crop className="w-3 h-3" />
                                            <span>Sửa</span>
                                        </button>
                                    )}
                                    {onDownload && (
                                        <button
                                            onClick={() => onDownload(src)}
                                            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition-colors flex items-center gap-1 text-[11px] shadow-sm shadow-sky-600/30"
                                        >
                                            <Download className="w-3 h-3" />
                                            <span>Tải ảnh</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* FULLSCREEN LIGHTBOX MODAL */}
            {typeof document !== 'undefined' && isLightboxOpen && createPortal(
                <div 
                    className="fixed inset-0 z-[9999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsLightboxOpen(false)}
                >
                    <div 
                        className="relative max-w-5xl max-h-[92vh] w-full flex flex-col items-center"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Top Bar */}
                        <div className="w-full flex items-center justify-between p-3 bg-zinc-900/90 border border-zinc-800 rounded-t-xl backdrop-blur-md text-white">
                            <div className="flex items-center gap-2 min-w-0 pr-4">
                                <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />
                                <span className="text-sm font-semibold truncate">{title || filename}</span>
                                {naturalSize && (
                                    <span className="text-xs text-zinc-400 font-mono bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 shrink-0">
                                        {naturalSize.width} × {naturalSize.height}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {onEdit && (
                                    <button
                                        onClick={() => {
                                            setIsLightboxOpen(false);
                                            onEdit(src);
                                        }}
                                        className="px-3 py-1.5 bg-zinc-800 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                    >
                                        <Crop className="w-3.5 h-3.5" />
                                        <span>Sửa ảnh</span>
                                    </button>
                                )}
                                {onDownload && (
                                    <button
                                        onClick={() => onDownload(src)}
                                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Tải ảnh</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsLightboxOpen(false)}
                                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors ml-2"
                                    title="Đóng (ESC)"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Full Resolution Image Frame */}
                        <div className="w-full bg-zinc-950 border-x border-b border-zinc-800 rounded-b-xl flex items-center justify-center p-4 max-h-[80vh] overflow-auto">
                            <img
                                src={currentSrc}
                                alt={alt}
                                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
