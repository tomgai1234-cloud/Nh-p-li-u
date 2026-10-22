import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, Image as ImageIcon, Trash2, CheckCircle2, AlertCircle, Link as LinkIcon, ChevronDown, FileSpreadsheet, Layers, FileText, Video, Copy } from 'lucide-react';
import Button from '../Button';
import TextInput from '../TextInput';
import { fetchWithFallback } from '../../utils/ecommerceScraper';
import { fetchImageBlob } from '../../utils/imageProcessor';
import { ImageHoverPreview } from '../ImageHoverPreview';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { exportScrapedImagesToXLSX } from '../../utils/exportUtils';

interface ScrapeResult {
    url: string;
    status: 'loading' | 'success' | 'error';
    main: string[];
    variants: string[];
    variantNames?: Record<string, string>;
    variantGroups?: any[];
    description: string[];
    videos: string[];
    title: string;
    color: string;
    error?: string;
    isExpanded: boolean;
    activeCategory: 'all' | 'main' | 'variants' | 'description' | 'video';
    fullTextDescription?: string;
}

const RawImageScraperTab: React.FC = () => {
    const [urls, setUrls] = useState<string>('');
    const [shopifyPrefix, setShopifyPrefix] = useState<string>(() => localStorage.getItem('shopify_store_domain') || '');
    const [shopifyToken, setShopifyToken] = useState<string>(() => localStorage.getItem('shopify_access_token') || '');
    const [autoUpload, setAutoUpload] = useState<boolean>(() => localStorage.getItem('shopify_auto_upload') === 'true');
    const [results, setResults] = useState<ScrapeResult[]>([]);
    const [isScraping, setIsScraping] = useState(false);
    const [progressStats, setProgressStats] = useState({ total: 0, done: 0 });
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [realtimeValidation, setRealtimeValidation] = useState<{message: string, isError: boolean} | null>(null);
    const bookmarkletRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        let es: EventSource | null = null;
        try {
            es = new EventSource('/api/bookmarklet/stream');
            es.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'RAW' && data.images && data.images.length > 0) {
                    let processedImages = data.images;
                    
                    if (autoUpload && shopifyPrefix && shopifyToken) {
                        processedImages = await Promise.all(processedImages.map((img: string) => uploadImageToShopify(img)));
                    }

                    setResults(prev => [{
                        url: data.url || `Gửi từ Bookmarklet lúc ${new Date().toLocaleTimeString()}`,
                        status: 'success',
                        main: processedImages,
                        variants: [],
                        description: [],
                        videos: [],
                        title: data.title || 'Ảnh qua Bookmarklet',
                        color: '',
                        isExpanded: false,
                        activeCategory: 'all'
                    }, ...prev]);
                }
            };
        } catch (err) {
            console.error("SSE Error:", err);
        }
        return () => {
            if (es) es.close();
        };
    }, [autoUpload, shopifyPrefix, shopifyToken]);

    const getBookmarkletUrl = () => {
        const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `javascript:(function(){var html=document.documentElement.innerHTML;var regex=/(?:https?:)?\\/\\/[^\\s"',]+\\.(?:jpg|jpeg|png|webp)/gi;var matches=html.match(regex)||[];var uniqueImages=Array.from(new Set(matches)).filter(img=>{var l=img.toLowerCase();return!l.includes('icon')&&!l.includes('favicon')&&!l.includes('logo')&&!l.includes('tracking')&&!l.includes('transparent')&&img.length>25;}).map(img=>{return img.startsWith('//')?'https:'+img:img;});if(uniqueImages.length>0){var div=document.createElement('div');div.style.cssText='position:fixed;top:20px;right:20px;background:#0ea5e9;color:white;padding:15px;border-radius:8px;z-index:999999;font-family:sans-serif;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);';div.innerText='Đang gửi '+uniqueImages.length+' ảnh về ứng dụng...';document.body.appendChild(div);fetch('${appUrl}/api/bookmarklet/receive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'RAW',images:uniqueImages,url:window.location.href,title:document.title})}).then(r=>r.json()).then(data=>{var m=data.success?data.message:'Lỗi: '+data.error;div.innerText=m;div.style.background=data.success?'#10b981':'#ef4444';setTimeout(function(){div.remove();},4000);}).catch(e=>{div.innerText='Lỗi nối mạng! Vui lòng thử lại hoặc tắt chặn QC.';div.style.background='#ef4444';setTimeout(function(){div.remove();},4000);});}else{alert('Không tìm thấy ảnh tĩnh trên trang này!');}})();`;
    };

    useEffect(() => {
        if (bookmarkletRef.current) {
            bookmarkletRef.current.href = getBookmarkletUrl();
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('shopify_store_domain', shopifyPrefix);
        localStorage.setItem('shopify_access_token', shopifyToken);
        localStorage.setItem('shopify_auto_upload', autoUpload.toString());
    }, [shopifyPrefix, shopifyToken, autoUpload]);

    const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });

    const uploadImageToShopify = async (imageUrl: string) => {
        if (!shopifyPrefix || !shopifyToken) return imageUrl;
        try {
            let domain = shopifyPrefix.replace(/^https?:\/\//, '').split('/')[0];
            if (!domain.includes('.')) {
                domain += '.myshopify.com';
            }
            
            // Try downloading the file first locally (bypasses bot protections using proxy that sets Accept/User-Agent headers properly)
            let base64Data: string | undefined = undefined;
            let mimeType: string | undefined = undefined;
            const fetched = await fetchImageBlob(imageUrl);
            if (fetched) {
                base64Data = await blobToBase64(fetched.blob);
                mimeType = fetched.originalType;
            }

            if (!domain.includes('.')) {
                domain += '.myshopify.com';
            }
            const bodyPayload: any = { storeDomain: domain, accessToken: shopifyToken };
            if (base64Data) {
                bodyPayload.base64Data = base64Data;
                bodyPayload.mimeType = mimeType;
            } else {
                bodyPayload.imageUrl = imageUrl;
            }

            const res = await fetch('/api/shopify/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });
            let data: any = {};
            try {
               const txt = await res.text();
               data = JSON.parse(txt);
            } catch(e) {}
            
            if (res.ok && data.url && data.url !== imageUrl) {
                return data.url;
            } else {
                setRealtimeValidation({ message: `Lỗi Shopify: ${data.error || 'Server error'}. Kiểm tra lại Domain/Token của bạn nhé!`, isError: true });
            }
        } catch (e: any) {
            console.error("Upload error", e);
            setRealtimeValidation({ message: `Lỗi kết nối Shopify: ${e.message}`, isError: true });
        }
        // Fallback to original image
        return imageUrl;
    };

    const handleScrape = async () => {
        const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
        if (urlList.length === 0) return;

        const initialResults: ScrapeResult[] = urlList.map(url => ({
            url,
            status: 'loading',
            main: [],
            variants: [],
            description: [],
            videos: [],
            title: '',
            color: '',
            isExpanded: false,
            activeCategory: 'all'
        }));

        setResults(prev => [...initialResults, ...prev]);
        setIsScraping(true);
        setProgressStats({ total: urlList.length, done: 0 });

        for (const url of urlList) {
            try {
                // Attempt specialized scrape first (can detect colors/variants)
                try {
                    const { specializedScrape, splitProductIntoVariantRows } = await import('../../utils/ecommerceScraper');
                    const { groupMediaByColorWithAI } = await import('../../services/geminiService');

                    let productData = await specializedScrape(url, 'auto');
                    
                    if (productData && !Array.isArray(productData) && productData.variantGroups && productData.variantGroups.length > 1) {
                        productData = splitProductIntoVariantRows(productData, url);
                    }
                    
                    if (Array.isArray(productData) && productData.length > 1 && productData[0].fullMedia && productData[0].colorGroups) {
                        try {
                            const refinedGrouping = await groupMediaByColorWithAI(productData[0].fullMedia, productData[0].colorGroups);
                            if (Object.keys(refinedGrouping).length > 0) {
                                productData = productData.map(d => {
                                    if (d.color && refinedGrouping[d.color]) {
                                        let newMain = refinedGrouping[d.color];
                                        if (d.sizeCharts && d.sizeCharts.length > 0) {
                                            newMain = [...newMain, ...d.sizeCharts];
                                        }
                                        return { ...d, main: newMain };
                                    }
                                    return d;
                                });
                            }
                        } catch (e) {
                            console.error("AI grouping failed in raw scraper:", e);
                        }
                    }

                    if (Array.isArray(productData) && productData.length > 0) {
                        setResults(prev => {
                            const others = prev.filter(r => r.url !== url);
                            
                            const newItems = productData!.map(d => {
                                return {
                                    url: productData!.length > 1 && d.color ? `${url}#${d.color}` : url,
                                    status: 'success' as const,
                                    main: Array.from(new Set(d.main || [])),
                                    variants: Array.from(new Set(d.variants || [])),
                                    description: Array.from(new Set(d.description || [])),
                                    videos: Array.from(new Set(d.videos || [])),
                                    title: d.title || '',
                                    color: d.color || '',
                                    fullTextDescription: (d as any).fullTextDescription || '',
                                    isExpanded: false,
                                    activeCategory: 'all' as const
                                };
                            });
                            
                            // Insert in place of the loading item
                            const idx = prev.findIndex(r => r.url === url && r.status === 'loading');
                            if (idx !== -1) {
                                const newPrev = [...prev];
                                newPrev.splice(idx, 1, ...newItems);
                                return newPrev;
                            }
                            return [...newItems, ...others];
                        });
                        continue; // specialized scrape succeeded, move to next URL
                    } else if (productData && !Array.isArray(productData) && (productData.main?.length > 0 || productData.variants?.length > 0)) {
                        setResults(prev => prev.map(r => 
                            (r.url === url && r.status === 'loading') 
                                ? { 
                                    ...r, 
                                    status: 'success', 
                                    main: Array.from(new Set(productData!.main || [])), 
                                    variants: Array.from(new Set(productData!.variants || [])), 
                                    description: Array.from(new Set(productData!.description || [])), 
                                    videos: Array.from(new Set(productData!.videos || [])), 
                                    title: productData!.title || '', 
                                    color: productData!.color || '',
                                    fullTextDescription: (productData as any).fullTextDescription || ''
                                  } 
                                : r
                        ));
                        continue; // specialized scrape succeeded, move to next URL
                    }
                } catch (e) {
                    console.warn("Specialized scrape fallback:", e);
                }

                // Fallback to RAW regex if specialized scrape returned null or threw
                const html = await fetchWithFallback(url, 'text');
                
                if (!html) {
                    throw new Error("Không thể tải mã nguồn trang (bị chặn hoặc sai link).");
                }

                // Regex to find image URLs
                const regex = /(?:https?:)?\/\/[^\s"',]+\.(?:jpg|jpeg|png|webp)/gi;
                const matches: string[] = html.match(regex) || [];
                
                // Get title
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                let title = titleMatch ? titleMatch[1].trim() : '';
                // remove redundant info if any
                title = title.split('|')[0].split('-')[0].trim();

                // Deduplicate and filter out small icons/svgs or tracking images
                let uniqueImages: string[] = Array.from(new Set(matches));
                
                uniqueImages = uniqueImages.filter((img: string) => {
                    const l = img.toLowerCase();
                    return !l.includes('icon') && 
                           !l.includes('favicon') && 
                           !l.includes('logo') &&
                           !l.includes('tracking') &&
                           !l.includes('transparent') &&
                           img.length > 25;
                }).map((img: string) => {
                    let finalImg = img;
                    if (finalImg.startsWith('//')) {
                        finalImg = 'https:' + finalImg;
                    }
                    
                    // Rewrite shopify proxy CDNs to target CDN if possible
                    if (finalImg.includes('/cdn/shop/files/') && finalImg.includes('ash.vn')) {
                        finalImg = finalImg.replace(/https?:\/\/([^\/]+)\/cdn\/shop\/files\//, 'https://cdn.shopify.com/s/files/1/0572/8603/3595/files/');
                    }
                    
                    return finalImg;
                });

                let processedImages = uniqueImages;
                
                if (processedImages.length === 0) {
                    throw new Error("Không thể trích xuất được bất kỳ hình ảnh nào từ trang này qua hệ thống tự động. Có thể trang web đang chặn cào dữ liệu hoặc sử dụng kết xuất Javascript. Mẹo: Hãy lưu file dữ liệu trang web thành file HTML về máy, rồi kéo thả vào tab này.");
                }
                
                if (autoUpload && shopifyPrefix && shopifyToken) {
                     processedImages = await Promise.all(uniqueImages.map(img => uploadImageToShopify(img)));
                }

                setResults(prev => prev.map(r => 
                    (r.url === url && r.status === 'loading') 
                        ? { ...r, status: 'success', main: processedImages, title } 
                        : r
                ));
            } catch (error: any) {
                setResults(prev => prev.map(r => 
                    (r.url === url && r.status === 'loading') 
                        ? { ...r, status: 'error', error: error.message } 
                        : r
                ));
            } finally {
                setProgressStats(prev => ({ ...prev, done: prev.done + 1 }));
            }
        }

        setIsScraping(false);
        setUrls(''); // clear input after starting
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files) as File[];
        const htmlFiles = files.filter((f: File) => f.name.endsWith('.html') || f.name.endsWith('.htm') || f.type === 'text/html');
        
        if (htmlFiles.length === 0) return;

        const newResults: ScrapeResult[] = [];
        
        for (const file of htmlFiles) {
            try {
                const html = await file.text();
                let processedImages: string[] = [];
                let title = file.name.replace(/\.html?$/i, '');
                
                // For Shopee specalized check
                const fullUrlMatches = (html.match(/(?:cf\.shopee\.vn\/file\/|down-vn\.img\.susercontent\.com\/file\/)([a-zA-Z0-9-_.]{15,})/g) as string[]) || [];
                const allFoundIds = new Set<string>();
                fullUrlMatches.forEach((m) => {
                    const id = m.replace('cf.shopee.vn/file/', '')
                                .replace('down-vn.img.susercontent.com/file/', '')
                                .replace(/\"/g, '');
                    if (id && id.length > 10 && !id.includes('<') && !id.includes('>')) {
                        allFoundIds.add(id);
                    }
                });
                
                if (allFoundIds.size > 0) {
                    processedImages = Array.from(allFoundIds).map(id => `https://down-vn.img.susercontent.com/file/${id}`);
                }
                
                // Fallback to general regex
                if (processedImages.length === 0) {
                    const regex = /(?:https?:)?\/\/[^\s"',]+\.(?:jpg|jpeg|png|webp)/gi;
                    const matches: string[] = html.match(regex) || [];
                    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                    if (titleMatch) title = titleMatch[1].trim().split('|')[0].split('-')[0].trim();

                    let uniqueImages = Array.from(new Set(matches)).filter((img: string) => {
                        const l = img.toLowerCase();
                        return !l.includes('icon') && !l.includes('favicon') && !l.includes('logo') && !l.includes('tracking') && !l.includes('transparent') && img.length > 25;
                    }).map((img: string) => {
                        let finalImg = img;
                        if (finalImg.startsWith('//')) finalImg = 'https:' + finalImg;
                        // Rewrite shopify proxy CDNs if needed
                        if (finalImg.includes('/cdn/shop/files/') && finalImg.includes('ash.vn')) {
                            finalImg = finalImg.replace(/https?:\/\/([^\/]+)\/cdn\/shop\/files\//, 'https://cdn.shopify.com/s/files/1/0572/8603/3595/files/');
                        }
                        return finalImg;
                    });
                    
                    processedImages = uniqueImages;
                }
                
                if (processedImages.length > 0) {
                    // check if we auto-upload
                    if (autoUpload && shopifyPrefix && shopifyToken) {
                         // We could auto-upload here as well, but for immediate preview, let's just show it.
                         // For now we do it inline if they want:
                         processedImages = await Promise.all(processedImages.map(img => uploadImageToShopify(img)));
                    }

                    newResults.push({
                        url: `File: ${file.name}`,
                        status: 'success',
                        main: processedImages,
                        variants: [],
                        description: [],
                        videos: [],
                        title: title,
                        color: '',
                        isExpanded: false,
                        activeCategory: 'all'
                    });
                }
            } catch (err) {
                console.error("Error reading dropped file:", err);
            }
        }
        
        if (newResults.length > 0) {
            setResults(prev => [...newResults, ...prev]);
        } else {
            alert('Không tìm thấy ảnh hợp lệ trong file HTML này!');
        }
    };

    const handleRemoveResult = (urlToRemove: string) => {
        setResults(prev => prev.filter(r => r.url !== urlToRemove));
    };

    const toggleExpand = (urlToToggle: string) => {
        setResults(prev => prev.map(r => r.url === urlToToggle ? { ...r, isExpanded: !r.isExpanded } : r));
    }

    const clearAll = () => {
        if (confirm("Bạn có chắc muốn xóa tất cả kết quả?")) {
            setResults([]);
        }
    }

    const updateResultMetadata = (url: string, field: 'title' | 'color', value: string) => {
        setResults(prev => prev.map(r => r.url === url ? { ...r, [field]: value } : r));
    }

    const handleExportExcel = (mode: 'all' | 'main') => {
        if (results.length === 0) {
            alert('Không có dữ liệu để xuất');
            setIsExportMenuOpen(false);
            return;
        }

        const exportData = results.map((r, idx) => ({
            stt: idx + 1,
            url: r.url,
            title: r.title || r.url,
            color: r.color,
            main: r.main || [],
            variants: r.variants || [],
            description: r.description || [],
            videos: r.videos || [],
            fullTextDescription: r.fullTextDescription,
            status: r.status,
            error: (r as any).error
        }));

        exportScrapedImagesToXLSX(exportData, mode);
        setIsExportMenuOpen(false);
    }

    const handleCopyAllLinks = async (result: ScrapeResult) => {
        const allImages = Array.from(new Set([...result.main, ...result.variants, ...result.description]));
        const itemsToCopy = result.activeCategory === 'all' ? allImages :
                                result.activeCategory === 'main' ? result.main :
                                result.activeCategory === 'variants' ? result.variants :
                                result.activeCategory === 'description' ? result.description :
                                result.activeCategory === 'video' ? result.videos :
                                allImages;
        
        if (!itemsToCopy.length) return;
        
        try {
            await navigator.clipboard.writeText(itemsToCopy.join('\n'));
            alert('Đã copy ' + itemsToCopy.length + ' link ' + (result.activeCategory === 'video' ? 'video' : 'ảnh') + ' vào clipboard!');
        } catch (e) {
            console.error('Failed to copy', e);
            alert('Lỗi khi copy link!');
        }
    }

    const handleDownloadAll = async (result: ScrapeResult) => {
        const allImages = Array.from(new Set([...result.main, ...result.variants, ...result.description]));
        const itemsToDownload = result.activeCategory === 'all' ? allImages :
                                result.activeCategory === 'main' ? result.main :
                                result.activeCategory === 'variants' ? result.variants :
                                result.activeCategory === 'description' ? result.description :
                                result.activeCategory === 'video' ? result.videos :
                                allImages;
        
        if (!itemsToDownload.length) return;
        
        try {
            const zip = new JSZip();
            let hostname = 'unknown';
            try { hostname = new URL(result.url).hostname.replace(/\./g, '_'); } catch {}
            
            const folderName = `RAW_Media_${hostname}`;
            const folder = zip.folder(folderName);
            
            if (!folder) throw new Error("Could not create ZIP folder");

            const downloadPromises = itemsToDownload.map(async (mediaUrl, idx) => {
                try {
                    const response = await fetch(`/api/proxy?url=${encodeURIComponent(mediaUrl)}`);
                    const blob = await response.blob();
                    
                    let ext = 'jpg';
                    const lowerUrl = mediaUrl.toLowerCase();
                    if (lowerUrl.includes('.png')) ext = 'png';
                    if (lowerUrl.includes('.webp')) ext = 'webp';
                    if (lowerUrl.includes('.jpeg')) ext = 'jpeg';
                    if (lowerUrl.includes('.mp4')) ext = 'mp4';
                    
                    folder.file(`${idx.toString().padStart(3, '0')}.${ext}`, blob);
                } catch (e) {
                    console.error("Failed to download", mediaUrl, e);
                }
            });

            await Promise.allSettled(downloadPromises);
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `${folderName}.zip`);
        } catch (error) {
            console.error(error);
            alert("Có lỗi khi tạo file ZIP");
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
                    {isScraping && (
                        <motion.div 
                            className="h-full bg-sky-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${(progressStats.done / progressStats.total) * 100}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    )}
                </div>

                <div className="flex items-start gap-4 mb-6 relative">
                    <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400">
                        <LinkIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-zinc-100 mb-1">Đào Ảnh Hàng Loạt (Dạng Text)</h2>
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold uppercase tracking-wider">Mới</span>
                        </div>
                        <p className="text-sm text-zinc-400">Dán danh sách các đường link sản phẩm để phần mềm tự động quét và tải toàn bộ ảnh từ các trang đó. Có phân biệt màu và hỗ trợ xuất Excel.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative rounded-xl transition-all duration-200 border-2 ${isDragOver ? 'border-sky-500 bg-sky-500/5' : 'border-transparent'}`}
                    >
                        {isDragOver && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 rounded-xl backdrop-blur-sm pointer-events-none">
                                <div className="text-sky-400 font-bold flex flex-col items-center gap-2">
                                    <Download className="w-8 h-8 animate-bounce" />
                                    <span>Thả file .html vào đây</span>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-sm font-medium text-zinc-300">Danh sách Link, Dán Mã nguồn, HTML, Bookmarklet</label>
                            
                            <a
                                ref={bookmarkletRef}
                                onClick={(e) => { e.preventDefault(); alert('Kéo nút này lên thanh Dấu trang (Bookmarks bar) của bạn. Khi duyệt mạng (Pinterest, AliExpress, v.v.), hãy bấm vào Dấu trang đó để lấy ngay tất cả ảnh tĩnh!'); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full hover:bg-sky-500/20 transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                + Lấy Ảnh Gốc (Kéo lên Bookmarks)
                            </a>
                        </div>
                        <textarea
                            value={urls}
                            onChange={(e) => {
                                const val = e.target.value;
                                setUrls(val);
                                
                                const matchBookmarklet = val.match(/RAW_IMAGE_EXTRACT\|([^\s]+)/);
                                if (matchBookmarklet) {
                                    const imgUrls = matchBookmarklet[1].split(',');
                                    if (imgUrls.length > 0) {
                                        setTimeout(async () => {
                                            setUrls('');
                                            let finalImages = imgUrls;
                                            if (autoUpload && shopifyPrefix && shopifyToken) {
                                                finalImages = await Promise.all(finalImages.map(async img => await uploadImageToShopify(img)));
                                            }
                                            setResults(prev => [{
                                                url: `Qua Bookmarklet lúc ${new Date().toLocaleTimeString()}`,
                                                status: 'success',
                                                main: finalImages,
                                                variants: [],
                                                description: [],
                                                videos: [],
                                                title: 'Ảnh qua Bookmarklet',
                                                color: '',
                                                isExpanded: false,
                                                activeCategory: 'all'
                                            }, ...prev]);
                                        }, 500);
                                        return;
                                    }
                                }

                                if (val.length > 2000 && val.includes('<html')) {
                                    // Process raw html like we do for file drops
                                    const regex = /(?:https?:)?\/\/[^\s"',]+\.(?:jpg|jpeg|png|webp)/gi;
                                    const matches: string[] = val.match(regex) || [];
                                    let uniqueImages = Array.from(new Set(matches)).filter((img: string) => {
                                        const l = img.toLowerCase();
                                        return !l.includes('icon') && !l.includes('favicon') && !l.includes('logo') && !l.includes('tracking') && !l.includes('transparent') && img.length > 25;
                                    }).map((img: string) => {
                                        let finalImg = img;
                                        if (finalImg.startsWith('//')) finalImg = 'https:' + finalImg;
                                        return finalImg;
                                    });

                                    if (uniqueImages.length > 0) {
                                        setTimeout(async () => {
                                            setUrls('');
                                            if (autoUpload && shopifyPrefix && shopifyToken) {
                                                 uniqueImages = await Promise.all(uniqueImages.map(img => uploadImageToShopify(img)));
                                            }
                                            setResults(prev => [{
                                                url: `Mã nguồn dán lúc ${new Date().toLocaleTimeString()}`,
                                                status: 'success',
                                                main: uniqueImages,
                                                variants: [],
                                                description: [],
                                                videos: [],
                                                title: 'Sản phẩm từ Mã Nguồn',
                                                color: '',
                                                isExpanded: false,
                                                activeCategory: 'all'
                                            }, ...prev]);
                                        }, 500);
                                    }
                                }
                            }}
                            placeholder="🔗 Gợi ý nhanh: Tự tạo Dấu trang tải tự động!
1. Kéo mục '+ Lấy Ảnh Gốc' ở trên lên thanh trình duyệt.
2. Tại trang web bất kỳ chứa ảnh, click Bookmark để lấy.
3. Qua đây Paste (Ctrl+V) là tải xong!
---
HOẶC nhập danh sách link (mỗi dòng 1 link)"
                            rows={8}
                            disabled={isScraping}
                            className={`w-full bg-zinc-900/70 border rounded-md py-2 px-3 text-zinc-200 placeholder-zinc-500 focus:ring-2 outline-none transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs focus:border-sky-500/50 ${isDragOver ? 'border-sky-500/50 ring-2 ring-sky-500/50' : 'border-zinc-600 focus:ring-sky-500/50'}`}
                        />
                        {realtimeValidation && (
                            <div className={`mt-3 px-4 py-3 rounded-lg text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-2 border ${
                                realtimeValidation.isError 
                                ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                                {realtimeValidation.isError ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                                <div>
                                    <p className="font-medium leading-relaxed">{realtimeValidation.message}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-zinc-200">Tự động Upload ảnh sang Shopify</h3>
                                <p className="text-xs text-zinc-500 mt-1">Tính năng này sẽ tự động tải ảnh gốc và upload thẳng lên Shopify CDN của bạn.</p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="form-checkbox bg-zinc-900 border-zinc-700 rounded text-sky-500 focus:ring-sky-500/50"
                                    checked={autoUpload}
                                    onChange={(e) => setAutoUpload(e.target.checked)}
                                    disabled={isScraping}
                                />
                                <span className="text-xs font-semibold text-zinc-300">Kích hoạt</span>
                            </label>
                        </div>
                        {autoUpload && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/50">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Shopify Store Domain</label>
                                    <TextInput
                                        value={shopifyPrefix}
                                        onChange={(e) => setShopifyPrefix(e.target.value)}
                                        placeholder="VD: mystore.myshopify.com"
                                        disabled={isScraping}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Admin API Access Token</label>
                                    <input
                                        type="password"
                                        value={shopifyToken}
                                        onChange={(e) => setShopifyToken(e.target.value)}
                                        placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                                        disabled={isScraping}
                                        className="w-full bg-zinc-900/70 border border-zinc-600 rounded-md py-2 px-3 text-zinc-200 placeholder-zinc-500 focus:ring-2 outline-none transition duration-200 disabled:opacity-50 font-mono text-xs focus:ring-sky-500/50 focus:border-sky-500/50"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <Button 
                            onClick={handleScrape}
                            className="bg-sky-500 hover:bg-sky-600 text-white min-w-[140px]"
                            disabled={isScraping || !urls.trim()}
                        >
                            {isScraping ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Đang xử lý {progressStats.done}/{progressStats.total}
                                </>
                            ) : (
                                "Đào Ảnh Ngay"
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {results.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-3">
                    <h3 className="font-bold text-zinc-100 text-lg">Kết Quả Đào ({results.length})</h3>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button 
                            onClick={clearAll}
                            disabled={isScraping}
                            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            Xóa hết
                        </button>

                        <div className="relative flex-1 sm:flex-none">
                            <Button 
                                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
                                colorScheme="green" 
                                className="!w-full sm:!w-auto !px-4 !py-2 text-sm shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
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
                                                    <div className="font-bold">Xuất tất cả ảnh</div>
                                                    <div className="text-[10px] text-zinc-400">Tất cả ảnh đào được</div>
                                                </div>
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {results.map((result, idx) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            key={`${result.url}-${idx}`}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm"
                        >
                            <div className="p-4 flex flex-col gap-4 items-start justify-between">
                                <div className="w-full">
                                    <div className="flex items-center gap-2 mb-2">
                                        {result.status === 'loading' && <Loader2 className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />}
                                        {result.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
                                        {result.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                                        
                                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 font-medium truncate hover:text-sky-400 hover:underline transition-colors text-sm">
                                            {result.url}
                                        </a>
                                    </div>

                                    {result.status === 'success' && (
                                        <div className="flex flex-col sm:flex-row gap-3 mt-3 mb-2">
                                            <div className="flex-1">
                                                <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Tên Sản Phẩm (Tự động lấy)</label>
                                                <input 
                                                    type="text" 
                                                    value={result.title}
                                                    onChange={e => updateResultMetadata(result.url, 'title', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-sky-500/50 transition-colors"
                                                    placeholder="Điền tên..."
                                                />
                                            </div>
                                            <div className="sm:w-[150px]">
                                                <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Phân loại / Màu sắc</label>
                                                <input 
                                                    type="text" 
                                                    value={result.color}
                                                    onChange={e => updateResultMetadata(result.url, 'color', e.target.value)}
                                                    className="w-full bg-zinc-950 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-sky-500/50 transition-colors"
                                                    placeholder="VD: Đỏ, Xanh..."
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {result.status === 'error' && (
                                        <p className="text-red-400/80 text-xs mt-1">{result.error}</p>
                                    )}
                                    {result.status === 'success' && result.main.length === 0 && result.variants.length === 0 && result.description.length === 0 && result.videos.length === 0 && (
                                        <p className="text-yellow-400/80 text-xs mt-1">Không tìm thấy ảnh hợp lệ ở link này</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0 self-end">
                                    {result.status === 'success' && (result.main.length > 0 || result.variants.length > 0 || result.description.length > 0 || result.videos.length > 0) && (
                                        <>
                                            <button
                                                onClick={() => toggleExpand(result.url)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm
                                                    ${result.isExpanded ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20'}
                                                `}
                                            >
                                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${result.isExpanded ? 'rotate-180' : ''}`} />
                                                {result.isExpanded ? 'Ẩn ảnh' : `Hiện ${result.main.length + result.variants.length + result.description.length + result.videos.length} mục`}
                                            </button>
                                            
                                            <button 
                                                onClick={() => handleCopyAllLinks(result)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                            >
                                                <Copy className="w-3.5 h-3.5"/>
                                                Copy Link
                                            </button>
                                            
                                            <button 
                                                onClick={() => handleDownloadAll(result)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg text-xs font-bold transition-colors shadow-sm"
                                            >
                                                <Download className="w-3.5 h-3.5"/>
                                                Tải file ZIP
                                            </button>
                                        </>
                                    )}

                                    <button 
                                        onClick={() => handleRemoveResult(result.url)} 
                                        className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-800 transition-colors ml-1"
                                        title="Xóa khỏi danh sách"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence>
                                {result.isExpanded && (result.main.length > 0 || result.variants.length > 0 || result.description.length > 0 || result.videos.length > 0) && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden border-t border-zinc-800 bg-zinc-900/50"
                                    >
                                        <div className="p-4 sm:p-5">
                                            {/* Filter Tabs */}
                                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                                {(() => {
                                                    const allCount = result.main.length + result.variants.length + result.description.length;
                                                    
                                                    const FilterTab = ({ id, label, count, icon }: { id: 'all' | 'main' | 'variants' | 'description' | 'video', label: string, count: number, icon?: React.ReactNode }) => {
                                                        const isActive = result.activeCategory === id;
                                                        if (count === 0 && id !== 'all') return null;
                                                        
                                                        return (
                                                            <button
                                                                onClick={() => updateResultMetadata(result.url, 'activeCategory' as any, id)}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border
                                                                    ${isActive 
                                                                        ? 'bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-900/20' 
                                                                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                                                    }`}
                                                            >
                                                                {icon}
                                                                {label}
                                                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isActive ? 'bg-black/20 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                                                    {count}
                                                                </span>
                                                            </button>
                                                        );
                                                    };

                                                    return (
                                                        <>
                                                            <FilterTab id="all" label="Tất cả" count={allCount} />
                                                            <FilterTab id="main" label="Ảnh chính" count={result.main.length} icon={<ImageIcon className="w-3.5 h-3.5"/>} />
                                                            <FilterTab id="variants" label="Phân loại" count={Math.max(result.variants.length, result.variantGroups?.length || 0)} icon={<Layers className="w-3.5 h-3.5"/>} />
                                                            <FilterTab id="description" label="Mô tả" count={result.description.length} icon={<FileText className="w-3.5 h-3.5"/>} />
                                                            <FilterTab id="video" label="Video" count={result.videos.length} icon={<Video className="w-3.5 h-3.5"/>} />
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {(() => {
                                                    const getDisplayItems = () => {
                                                        switch (result.activeCategory) {
                                                            case 'main': return { images: result.main, category: 'main' };
                                                            case 'variants': return { images: result.variants, category: 'variants' };
                                                            case 'description': return { images: result.description, category: 'description' };
                                                            case 'video': return { images: result.videos, category: 'videos' };
                                                            default: return { images: Array.from(new Set([...result.main, ...result.variants, ...result.description])), category: 'all' };
                                                        }
                                                    };
                                                    
                                                    const { images: displayImages, category } = getDisplayItems();

                                                    if (result.activeCategory === 'video') {
                                                        return displayImages.map((vid, idx) => (
                                                            <div key={idx} className="aspect-square bg-zinc-800 rounded-lg overflow-hidden relative group border border-zinc-700/50">
                                                                <video src={vid} controls className="w-full h-full object-cover" />
                                                            </div>
                                                        ))
                                                    }

                                                    return displayImages.map((img, idx) => (
                                                        <ImageHoverPreview
                                                            key={idx}
                                                            src={img}
                                                            alt={`Mục ${idx+1}`}
                                                            title={result.title}
                                                            category={category === 'all' ? undefined : (category === 'main' ? 'Ảnh chính' : category === 'variants' ? 'Phân loại' : 'Mô tả')}
                                                            onDownload={(u) => {
                                                                const link = document.createElement('a');
                                                                link.href = u;
                                                                link.download = `raw_image_${idx + 1}.jpg`;
                                                                link.target = '_blank';
                                                                link.click();
                                                            }}
                                                            previewWidth={420}
                                                            previewHeight={440}
                                                        >
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setResults(prev => prev.map(r => {
                                                                        if (r.url !== result.url) return r;
                                                                        const updatedMain = r.main.filter(i => i !== img);
                                                                        const updatedVariants = r.variants.filter(i => i !== img);
                                                                        const updatedDescription = r.description.filter(i => i !== img);
                                                                        return { ...r, main: updatedMain, variants: updatedVariants, description: updatedDescription };
                                                                    }));
                                                                }}
                                                                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 z-20"
                                                                title="Loại bỏ ảnh này"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </ImageHoverPreview>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default RawImageScraperTab;
