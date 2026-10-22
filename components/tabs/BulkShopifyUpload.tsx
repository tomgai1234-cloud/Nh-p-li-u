import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Loader2, StopCircle, Download, Check, AlertCircle, Sparkles } from 'lucide-react';
import Button from '../Button';
import { ProviderConfig } from '../ProviderConfig';
import { useProviderAccounts } from '../../src/hooks/useProviderAccounts';
import TextInput from '../TextInput';
import { fetchWithFallback } from '../../utils/ecommerceScraper';
import { fetchImageBlob, processImage } from '../../utils/imageProcessor';
import { db, auth } from '../../src/firebase';
import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';
import { getDeviceId } from '../../services/trialClient';

interface ExcelRow {
    _rowIndex: number;
    [key: string]: any;
}

export const BulkShopifyUpload: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [rows, setRows] = useState<ExcelRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    
    const [sourceColumn, setSourceColumn] = useState<string>('');
    const [destColumn, setDestColumn] = useState<string>('');
    
    const { shopifyAccounts, cloudinaryAccounts, imgbbAccounts } = useProviderAccounts();
    const [activeConfigId, setActiveConfigId] = useState('default');

    const [provider, setProvider] = useState<string>(() => localStorage.getItem('bulk_upload_provider') || 'shopify');
    const shopifyConfig = shopifyAccounts.find(a => a.id === activeConfigId) || shopifyAccounts[0];
    const shopifyDomain = shopifyConfig?.storeDomain || '';
    const shopifyToken = shopifyConfig?.accessToken || '';
    
    const cloudinaryConfig = cloudinaryAccounts.find(a => a.id === activeConfigId) || cloudinaryAccounts[0];
    const cloudName = cloudinaryConfig?.cloudName || '';
    const apiKey = cloudinaryConfig?.apiKey || '';
    const apiSecret = cloudinaryConfig?.apiSecret || '';
    
    
    const imgbbConfig = imgbbAccounts.find(a => a.id === activeConfigId) || imgbbAccounts[0];
    const imgbbKey = imgbbConfig?.apiKey || '';
    
    // NEW SETTINGS
    const [outputFormat, setOutputFormat] = useState<'jpg'|'png'|'webp'>('jpg');
    const [resizeMode, setResizeMode] = useState<'original'|'fill'>('original');
    const [optimizeQuality, setOptimizeQuality] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const stopSignal = useRef(false);

    useEffect(() => { localStorage.setItem('bulk_upload_provider', provider); }, [provider]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) parseExcel(e.dataTransfer.files[0]);
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) parseExcel(e.target.files[0]);
    };

    const parseExcel = async (file: File) => {
        setFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
                
                if (jsonData.length === 0) return alert("File Excel trống.");
                
                const rawHeaders = jsonData[0] || [];
                // Ensure all headers are strings and unique
                const seenHeaders = new Map<string, number>();
                const hdrs = rawHeaders.map((h, i) => {
                    let baseName = h ? String(h).trim() : `Column ${i + 1}`;
                    if (seenHeaders.has(baseName)) {
                        const count = seenHeaders.get(baseName)! + 1;
                        seenHeaders.set(baseName, count);
                        return `${baseName} (${count})`;
                    } else {
                        seenHeaders.set(baseName, 1);
                        return baseName;
                    }
                });
                setHeaders(hdrs);

                const dataRows: ExcelRow[] = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const rowArr = jsonData[i];
                    if (!rowArr || rowArr.length === 0) continue;
                    
                    const rowObj: ExcelRow = { _rowIndex: i };
                    for (let c = 0; c < hdrs.length; c++) {
                        rowObj[hdrs[c]] = rowArr[c] !== undefined ? String(rowArr[c]) : '';
                    }
                    dataRows.push(rowObj);
                }
                
                setRows(dataRows);
                // Auto-select columns based on common names if possible
                const nameCol = hdrs.find(h => h.toLowerCase().includes('name'));
                const linkCol = hdrs.find(h => h.toLowerCase().includes('tổng') || h.toLowerCase().includes('link'));
                const destCol = hdrs.find(h => h.toLowerCase().includes('upload') || h.toLowerCase().includes('kết quả'));
                
                if (linkCol) setSourceColumn(linkCol);
                if (destCol) setDestColumn(destCol);
                if (!destCol && hdrs.length > 0) setDestColumn(hdrs[hdrs.length - 1]); // default to last col

            } catch (error) {
                console.error(error);
                alert("Không thể đọc file Excel.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });

    const uploadImageToShopify = async (payload: string | Blob) => {
        if (!shopifyDomain || !shopifyToken) return typeof payload === 'string' ? payload : '';
        let domain = shopifyDomain.replace(/^https?:\/\//, '').split('/')[0];
        if (!domain.includes('.')) domain += '.myshopify.com';

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const bodyPayload: any = { storeDomain: domain, accessToken: shopifyToken };
                if (typeof payload === 'string') {
                    bodyPayload.imageUrl = payload;
                } else {
                    bodyPayload.base64Data = await blobToBase64(payload);
                    bodyPayload.mimeType = payload.type;
                }
                const res = await fetch('/api/shopify/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyPayload)
                });
                
                let data: any;
                const textResponse = await res.text();
                try {
                    data = JSON.parse(textResponse);
                } catch (e) {
                    throw new Error("Lỗi Upload Shopify: Invalid JSON response");
                }
                
                if (res.ok && data.url && data.url !== payload) {
                    return data.url;
                } else {
                    if (data.error) throw new Error(`Lỗi Shopify: ${data.error}${data.details ? ` | ${data.details}` : ''}`);
                    throw new Error("Lỗi Upload Shopify");
                }
            } catch (e: any) {
                console.warn(`Shopify upload attempt ${attempt + 1} failed:`, e?.message || e);
                if (attempt === 2) throw new Error(e.message || "Upload Shopify failed");
                await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
            }
        }
        return typeof payload === 'string' ? payload : '';
    };

    const uploadImageToCloudinary = async (payload: string | Blob) => {
        if (!cloudName || !apiKey || !apiSecret) return typeof payload === 'string' ? payload : '';
        const cName = cloudName.replace(/\s+/g, '');
        const cKey = apiKey.trim();
        const cSecret = apiSecret.trim();

        // 1. Try direct upload from browser first (with 2 attempts)
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const timestamp = Math.floor(Date.now() / 1000);
                const params = { timestamp, unique_filename: 'true', use_filename: 'true' };
                const stringToSign = Object.keys(params).sort().map(k => `${k}=${(params as any)[k]}`).join('&') + cSecret;
                const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(stringToSign));
                const signature = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');

                const fd = new FormData();
                if (payload instanceof Blob) {
                    const ext = payload.type.includes('png') ? 'png' : payload.type.includes('webp') ? 'webp' : 'jpg';
                    fd.append('file', payload, `upload_${timestamp}.${ext}`);
                } else {
                    fd.append('file', payload);
                }
                fd.append('api_key', cKey);
                fd.append('timestamp', String(timestamp));
                fd.append('use_filename', 'true');
                fd.append('unique_filename', 'true');
                fd.append('signature', signature);

                const res = await fetch(`https://api.cloudinary.com/v1_1/${cName}/image/upload`, { method: 'POST', body: fd });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error?.message || `Cloudinary upload failed (${res.status})`);
                }
                const data = await res.json();
                if (data.secure_url) return data.secure_url;
                throw new Error("Missing secure_url from Cloudinary response");
            } catch (e: any) {
                console.warn(`Direct Cloudinary upload attempt ${attempt + 1} failed:`, e?.message || e);
                if (attempt < 1) await new Promise(r => setTimeout(r, 600));
            }
        }

        // 2. Fallback to server proxy for Cloudinary upload
        try {
            let imageStr = '';
            if (payload instanceof Blob) {
                imageStr = await blobToBase64(payload);
            } else {
                imageStr = payload;
            }

            const res = await fetch('/api/cloudinary/upload', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-device-id': getDeviceId()
                },
                body: JSON.stringify({
                    cloudName: cName,
                    apiKey: cKey,
                    apiSecret: cSecret,
                    image: imageStr
                })
            });

            const data = await res.json();
            if (res.ok && data.secure_url) return data.secure_url;
            throw new Error(data.message || data.error?.message || data.error || "Server Cloudinary upload proxy failed");
        } catch (e: any) {
            console.error("Cloudinary upload error (all attempts failed)", e);
            throw new Error(e.message || "Failed to upload to Cloudinary");
        }
    };

    const uploadImageToImgBB = async (payload: string | Blob) => {
        if (!imgbbKey) return typeof payload === 'string' ? payload : '';
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                let base64Data = '';
                let imageStr = typeof payload === 'string' ? payload : '';
                if (payload instanceof Blob) {
                    base64Data = await blobToBase64(payload);
                }
                
                const res = await fetch('/api/imgbb/upload', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key: imgbbKey,
                        image: imageStr,
                        base64Data: base64Data,
                        mimeType: payload instanceof Blob ? payload.type : ''
                    })
                });
                const data = await res.json();
                if (data?.data?.url) return data.data.url;
                throw new Error(data.error?.message || "Upload error ImgBB");
            } catch (e: any) {
                console.warn(`ImgBB upload attempt ${attempt + 1} failed:`, e?.message || e);
                if (attempt === 2) throw new Error(e.message || "Upload ImgBB failed");
                await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
            }
        }
        return typeof payload === 'string' ? payload : '';
    };

    const startProcessing = async () => {
        if (rows.length === 0) return alert("Không có dữ liệu.");
        if (!sourceColumn) return alert("Vui lòng chọn cột chứa Link ảnh tổng.");
        if (!destColumn) return alert("Vui lòng chọn cột chứa Link upload.");
        if (provider === 'shopify' && (!shopifyDomain || !shopifyToken)) return alert("Vui lòng nhập đầy đủ thông tin Shopify.");
        if (provider === 'cloudinary' && (!cloudName || !apiKey || !apiSecret)) return alert("Vui lòng nhập đầy đủ thông tin Cloudinary.");
        if (provider === 'imgbb' && !imgbbKey) return alert("Vui lòng nhập API Key ImgBB.");

        setIsProcessing(true);
        setStatusMessage("Đang tính toán link cần upload...");
        setProgress(0);
        stopSignal.current = false;

        const updatedRows = rows.map(r => ({ ...r }));
        
        let totalLinks = 0;
        const processingTasks: { rowIndex: number, lineIndex: number, url: string }[] = [];

        for (let r = 0; r < updatedRows.length; r++) {
            const cellValue = updatedRows[r][sourceColumn] || '';
            const urls = cellValue.split(/[\r\n]+/).map((u: string) => u.trim()).filter(Boolean);
            for (let i = 0; i < urls.length; i++) {
                if (urls[i].startsWith('http') && urls[i].length > 9) {
                    processingTasks.push({ rowIndex: r, lineIndex: i, url: urls[i] });
                    totalLinks++;
                }
            }
        }

        if (totalLinks === 0) {
            setIsProcessing(false);
            return alert("Không tìm thấy link ảnh (bắt đầu bằng http/https) trong cột đã chọn.");
        }

        const resultsMap = new Map<string, string>(); // key: rowIndex_lineIndex, value: resultingUrl
        let completed = 0;

        const concurrency = 4;
        let pIndex = 0;

        const worker = async () => {
            while (pIndex < processingTasks.length && !stopSignal.current) {
                const currentIndex = pIndex;
                pIndex++;
                const task = processingTasks[currentIndex];

                try {
                    let taskUrl = task.url.trim();
                    if (taskUrl.startsWith('//')) taskUrl = 'https:' + taskUrl;
                    
                    // Clean up double slashes in the path
                    taskUrl = taskUrl.replace(/([^:]\/)\/+/g, "$1");
                    
                    let payload: string | Blob = taskUrl;
                    
                    // Fetch image blob via processors & proxies
                    let fetchResult = await fetchImageBlob(taskUrl);
                    
                    // Fallback to direct server proxy if standard fetch fails
                    if (!fetchResult) {
                        try {
                            const directProxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(taskUrl)}&type=image`);
                            if (directProxyRes.ok) {
                                const b = await directProxyRes.blob();
                                if (b && b.size > 100 && !b.type.includes('text/') && !b.type.includes('application/json')) {
                                    fetchResult = { blob: b, originalType: b.type || 'image/jpeg' };
                                }
                            }
                        } catch (pErr) {
                            console.warn("Direct proxy fallback failed for", taskUrl, pErr);
                        }
                    }

                    if (fetchResult) {
                        try {
                            const processed = await processImage(fetchResult.blob, outputFormat, 90, resizeMode === 'original', optimizeQuality);
                            payload = processed.blob;
                        } catch (procErr: any) {
                            console.warn("Image canvas processing error, using raw blob instead:", procErr?.message);
                            payload = fetchResult.blob;
                        }
                    } else {
                        if (taskUrl.includes('drive.google.com')) {
                            throw new Error("Không thể tải ảnh gốc từ Google Drive (Proxy error hoặc file quá lớn)");
                        }
                    }

                    setStatusMessage(`Đang Upload ${currentIndex + 1}/${totalLinks}...`);
                    let newUrl = typeof payload === 'string' ? payload : '';
                    if (payload instanceof Blob) {
                        if (provider === 'shopify') newUrl = await uploadImageToShopify(payload);
                        else if (provider === 'cloudinary') newUrl = await uploadImageToCloudinary(payload);
                        else if (provider === 'imgbb') newUrl = await uploadImageToImgBB(payload);
                    } else {
                        // Image was not downloadable from source (e.g. 404/403 or non-existent asset)
                        console.warn(`[Giữ nguyên link gốc] Ảnh không tồn tại hoặc không thể tải từ nguồn: ${taskUrl}`);
                        newUrl = taskUrl;
                    }
                    resultsMap.set(`${task.rowIndex}_${task.lineIndex}`, newUrl || task.url);
                } catch (e: any) {
                    console.warn('Lỗi xử lý hàng, giữ nguyên link ban đầu:', task.url, e?.message || e);
                    resultsMap.set(`${task.rowIndex}_${task.lineIndex}`, task.url); // original on fail
                }

                completed++;
                setProgress(Math.round((completed / totalLinks) * 100));
                setStatusMessage(`Đang xử lý: ${completed}/${totalLinks} ảnh...`);
            }
        };

        const workers = [];
        for (let w = 0; w < concurrency; w++) workers.push(worker());
        await Promise.all(workers);

        if (stopSignal.current) {
            setStatusMessage("Đã hủy.");
        } else {
            setStatusMessage("Đang tạo file Excel...");
            
            // Reconstruct rows
            for (let r = 0; r < updatedRows.length; r++) {
                const cellValue = updatedRows[r][sourceColumn] || '';
                const urls = cellValue.split(/[\r\n]+/).map((u: string) => u.trim());
                const outUrls = [];
                for (let i = 0; i < urls.length; i++) {
                    const trimmed = urls[i];
                    if (trimmed.startsWith('http')) {
                        outUrls.push(resultsMap.get(`${r}_${i}`) || trimmed);
                    } else if (trimmed) {
                        outUrls.push(trimmed); // preserve non-link text
                    }
                }
                updatedRows[r][destColumn] = outUrls.join('\r\n');
            }

            setRows(updatedRows);
            exportToExcel(updatedRows);
            setStatusMessage("Hoàn tất.");

            if (auth.currentUser) {
                try {
                    await addHistory(STORE_NAMES.BULK_DOWNLOADS, {
                        uid: auth.currentUser.uid,
                        userEmail: auth.currentUser.email || 'N/A',
                        actionType: 'Excel -> Upload Ảnh',
                        details: {
                            successCount: resultsMap.size,
                            totalCount: processingTasks.length,
                            provider
                        },
                        status: 'success',
                        createdAt: Date.now()
                    });
                } catch (err) {
                    console.error("Failed to save history", err);
                }
            }
        }
        setIsProcessing(false);
    };

    const exportToExcel = (dataRows: ExcelRow[]) => {
        if (dataRows.length === 0) return;
        
        // Remove internal _rowIndex
        const exportData = dataRows.map(r => {
            const obj = { ...r };
            delete obj._rowIndex;
            return obj;
        });

        const ws = XLSX.utils.json_to_sheet(exportData, { header: headers });

        // Set wrapText style and formatting for cells containing multi-line strings
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cell_address]) continue;
                if (!ws[cell_address].s) ws[cell_address].s = {};
                ws[cell_address].s.alignment = { wrapText: true, vertical: 'top' };
            }
        }

        // Set column widths
        const colWidths = headers.map(h => ({ wch: Math.max(30, h.length + 5) }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Results");
        XLSX.writeFile(wb, `Shopify_Upload_Kết_quả_${Date.now()}.xlsx`);
    };

    return (
        <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-sky-300 mb-2">Excel {'->'} URL ảnh tổng</h1>
                <p className="text-zinc-400 text-sm">Upload ảnh từ Excel lên Shopify, Cloudinary hoặc ImgBB (hỗ trợ nhiều link / 1 ô, cách nhau bằng xuống dòng).</p>
            </header>

            {!file && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all ${
                        isDragging ? 'border-sky-500 bg-sky-500/10' : 'border-zinc-700 hover:border-sky-500/50 hover:bg-zinc-800/80'
                    }`}
                >
                    <FileSpreadsheet className="w-12 h-12 text-sky-400 mb-4" />
                    <p className="text-zinc-300 mb-2 font-medium">Kéo thả file Excel (.xlsx) vào đây</p>
                    <p className="text-zinc-500 text-sm mb-6">hoặc</p>
                    <label className="cursor-pointer bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors">
                        Chọn File
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                    </label>
                </div>
            )}

            {file && (
                <div className="space-y-6">
                    {/* SETTINGS BAR */}
                    <div className="bg-zinc-900/50 border border-zinc-700 p-4 rounded-lg flex flex-wrap gap-6 items-center flex-shrink-0 overflow-x-auto">
                        <div className="flex items-center gap-2 min-w-fit">
                            <span className="text-xs text-zinc-400">Định dạng:</span>
                            <div className="flex bg-zinc-800 rounded p-1 border border-zinc-700">
                                {(['jpg', 'png', 'webp'] as const).map(f => (
                                    <button key={f} onClick={() => setOutputFormat(f)} className={`px-3 py-1 text-xs rounded ${outputFormat === f ? 'bg-sky-600 text-white' : 'text-zinc-400'}`}>{f.toUpperCase()}</button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 min-w-fit">
                            <span className="text-xs text-zinc-400">Kích thước:</span>
                            <div className="flex bg-zinc-800 rounded p-1 border border-zinc-700">
                                <button onClick={() => setResizeMode('fill')} className={`px-3 py-1 text-xs rounded ${resizeMode === 'fill' ? 'bg-sky-600 text-white' : 'text-zinc-400'}`}>800x800</button>
                                <button onClick={() => setResizeMode('original')} className={`px-3 py-1 text-xs rounded ${resizeMode === 'original' ? 'bg-sky-600 text-white' : 'text-zinc-400'}`}>Gốc</button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 min-w-fit ml-auto">
                            <label className="flex items-center gap-2 cursor-pointer bg-zinc-800 p-1.5 px-3 rounded border border-zinc-700 select-none hover:bg-zinc-700 transition-colors">
                                <input type="checkbox" checked={optimizeQuality} onChange={e => setOptimizeQuality(e.target.checked)} className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-sky-500 focus:ring-sky-500"/>
                                <span className="text-xs text-zinc-300 flex items-center gap-1"><Sparkles className="w-3 h-3 text-yellow-400" /> Làm nét (Giữ nguyên độ bóng)</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-lg border border-zinc-700">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="w-8 h-8 text-green-500" />
                            <div>
                                <p className="text-sm font-bold text-zinc-200">{file.name}</p>
                                <p className="text-xs text-zinc-500">{rows.length} dòng dữ liệu</p>
                            </div>
                        </div>
                        {!isProcessing && (
                            <button onClick={() => setFile(null)} className="text-xs text-rose-400 hover:text-rose-300">
                                Đổi file khác
                            </button>
                        )}
                    </div>

                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-bold text-zinc-200 border-b border-zinc-800 pb-2">Cấu hình Cột</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-1">Cột chứa Link ảnh tổng (đọc)</label>
                                <select 
                                    value={sourceColumn} 
                                    onChange={(e) => setSourceColumn(e.target.value)}
                                    disabled={isProcessing}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-200 focus:ring-sky-500 focus:border-sky-500 outline-none"
                                >
                                    <option value="">-- Chọn cột --</option>
                                    {headers.map((h, i) => <option key={`${h}-${i}`} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-1">Cột để ghi Kết quả Upload (ghi)</label>
                                <select 
                                    value={destColumn} 
                                    onChange={(e) => setDestColumn(e.target.value)}
                                    disabled={isProcessing}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md py-2 px-3 text-sm text-zinc-200 focus:ring-sky-500 focus:border-sky-500 outline-none"
                                >
                                    <option value="">-- Chọn cột --</option>
                                    {headers.map((h, i) => <option key={`${h}-${i}`} value={h}>{h}</option>)}
                                </select>
                                <p className="text-[10px] text-zinc-500 mt-1">Lưu ý: Dữ liệu cũ trong cột này sẽ bị ghi đè.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-zinc-800 pb-2">
                            <h3 className="text-sm font-bold text-zinc-200">Thông tin Upload</h3>
                            <div className="flex space-x-3">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                                    <input type="radio" value="shopify" checked={provider === 'shopify'} onChange={(e) => setProvider(e.target.value)} disabled={isProcessing} />
                                    Shopify
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                                    <input type="radio" value="cloudinary" checked={provider === 'cloudinary'} onChange={(e) => setProvider(e.target.value)} disabled={isProcessing} />
                                    Cloudinary
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                                    <input type="radio" value="imgbb" checked={provider === 'imgbb'} onChange={(e) => setProvider(e.target.value)} disabled={isProcessing} />
                                    ImgBB
                                </label>
                            </div>
                        </div>

                        <ProviderConfig provider={provider} activeId={activeConfigId} onActiveIdChange={setActiveConfigId} disabled={isProcessing} />
                    </div>

                    {isProcessing && (
                        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700">
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-zinc-300 font-medium">{statusMessage}</span>
                                <span className="text-sky-400 font-bold">{progress}%</span>
                            </div>
                            <div className="w-full bg-black/50 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-sky-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                        {isProcessing ? (
                            <Button variant="danger" icon={<StopCircle className="w-4 h-4"/>} onClick={() => stopSignal.current = true}>
                                Dừng lại
                            </Button>
                        ) : (
                            <Button 
                                variant="primary" 
                                icon={<Upload className="w-4 h-4"/>} 
                                onClick={startProcessing}
                            >
                                Bắt đầu Upload & Xuất File
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
