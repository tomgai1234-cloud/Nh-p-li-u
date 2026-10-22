import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Loader2, StopCircle, Download, Check, AlertCircle, HardDrive, Sparkles } from 'lucide-react';
import Button from '../Button';
import { ProviderConfig } from '../ProviderConfig';
import { useProviderAccounts } from '../../src/hooks/useProviderAccounts';
import TextInput from '../TextInput';
import { fetchImageBlob, processImage } from '../../utils/imageProcessor';
import { fetchWithFallback } from '../../utils/ecommerceScraper';
import { db, auth } from '../../src/firebase';
import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';
import { getDeviceId } from '../../services/trialClient';

interface ExcelRow {
    _rowIndex: number;
    [key: string]: any;
}

export const BulkDriveUpload: React.FC = () => {
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
    const [googleApiKey, setGoogleApiKey] = useState(() => localStorage.getItem('google_api_key') || '');
    
    // NEW SETTINGS
    const [outputFormat, setOutputFormat] = useState<'jpg'|'png'|'webp'>('jpg');
    const [resizeMode, setResizeMode] = useState<'original'|'fill'>('original');
    const [optimizeQuality, setOptimizeQuality] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const stopSignal = useRef(false);

    useEffect(() => { localStorage.setItem('bulk_upload_provider', provider); localStorage.setItem('google_api_key', googleApiKey); }, [provider, googleApiKey]);

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
                const linkCol = hdrs.find(h => h.toLowerCase().includes('drive') || h.toLowerCase().includes('folder'));
                const destCol = hdrs.find(h => h.toLowerCase().includes('upload') || h.toLowerCase().includes('kết quả') || h.toLowerCase().includes('link'));
                
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

    const extractDriveFolderId = (url: string) => {
        const match1 = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (match1) return match1[1];
        const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match2) return match2[1];
        return null;
    };

    const fetchDriveImages = async (folderId: string): Promise<{ id: string; name: string; url: string }[]> => {
        let allFiles: { id: string; name: string; url: string }[] = [];

        // 1. Try Google Drive v3 API if Key is provided
        if (googleApiKey && googleApiKey.trim()) {
            try {
                let pageToken = '';
                do {
                    const pageParam = pageToken ? `&pageToken=${pageToken}` : '';
                    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false+and+mimeType+contains+'image/'&orderBy=name&key=${googleApiKey}&fields=nextPageToken,files(id,name,webContentLink,mimeType)&pageSize=1000${pageParam}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    if (!data.error && data.files && Array.isArray(data.files)) {
                        data.files.forEach((f: any) => {
                            allFiles.push({
                                id: f.id,
                                name: f.name || `Drive Image ${f.id}`,
                                url: `https://drive.google.com/thumbnail?id=${f.id}&sz=w2500`
                            });
                        });
                    }
                    pageToken = data.nextPageToken || '';
                } while (pageToken);
            } catch (apiErr) {
                console.warn("Google Drive API fetch failed, falling back to public web scraper:", apiErr);
            }
        }

        // 2. Fallback / Default: Public Folder Web Scraper (No API Key Required!)
        if (allFiles.length === 0) {
            try {
                const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
                const htmlText = await fetchWithFallback(folderUrl, 'text', {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                });

                if (htmlText && typeof htmlText === 'string') {
                    const fileMap = new Map<string, { id: string; name: string; url: string }>();

                    // Match data-id="..." from Google Drive DOM items
                    const dataIdRegex = /data-id="([a-zA-Z0-9_-]{25,45})"/g;
                    let dIdMatch;
                    while ((dIdMatch = dataIdRegex.exec(htmlText)) !== null) {
                        const id = dIdMatch[1];
                        if (id && !folderId.includes(id) && !fileMap.has(id)) {
                            fileMap.set(id, {
                                id,
                                name: `Drive Image ${fileMap.size + 1}`,
                                url: `https://drive.google.com/thumbnail?id=${id}&sz=w2500`
                            });
                        }
                    }

                    // Match Google Drive file ID + Filename in AF_initDataCallback
                    const itemRegex = /\[\[null,"([a-zA-Z0-9_-]{25,45})"\][\s\S]*?\[\[\["([^"]+\.(?:jpg|jpeg|png|webp|gif|svg|mp4|mov))"/gi;
                    let m;
                    while ((m = itemRegex.exec(htmlText)) !== null) {
                        const id = m[1];
                        const name = m[2];
                        if (id && name && !fileMap.has(id)) {
                            fileMap.set(id, {
                                id,
                                name,
                                url: `https://drive.google.com/thumbnail?id=${id}&sz=w2500`
                            });
                        }
                    }

                    // Fallback scan for uc/file download links
                    const downloadRegex = /(?:https:\/\/drive\.google\.com\/uc\?id=|https:\/\/drive\.google\.com\/file\/d\/)([a-zA-Z0-9_-]{25,45})/gi;
                    let dMatch;
                    while ((dMatch = downloadRegex.exec(htmlText)) !== null) {
                        const id = dMatch[1];
                        if (id && !folderId.includes(id) && !fileMap.has(id)) {
                            fileMap.set(id, {
                                id,
                                name: `Drive Image ${fileMap.size + 1}`,
                                url: `https://drive.google.com/thumbnail?id=${id}&sz=w2500`
                            });
                        }
                    }

                    allFiles = Array.from(fileMap.values());
                }
            } catch (scrapeErr) {
                console.warn("Public Google Drive web scraper error:", scrapeErr);
            }
        }

        if (!allFiles.length) return [];
        
        // Natural alphanumeric sort on file name (e.g., 1.jpg, 2.jpg, ..., 9.jpg, 10.jpg)
        allFiles.sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        });

        return allFiles;
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
        if (!sourceColumn) return alert("Vui lòng chọn cột chứa Link Drive Folder.");
        if (!destColumn) return alert("Vui lòng chọn cột chứa Link kết quả.");
        if (provider === 'shopify' && (!shopifyDomain || !shopifyToken)) return alert("Vui lòng nhập đầy đủ thông tin Shopify.");
        if (provider === 'cloudinary' && (!cloudName || !apiKey || !apiSecret)) return alert("Vui lòng nhập đầy đủ thông tin Cloudinary.");
        if (provider === 'imgbb' && !imgbbKey) return alert("Vui lòng nhập API Key ImgBB.");

        setIsProcessing(true);
        setStatusMessage("Đang tính toán link cần xử lý...");
        setProgress(0);
        stopSignal.current = false;

        const updatedRows = [...rows];
        
        let totalFolders = 0;
        const processingTasks: { taskIndex: number; rowIndex: number; folderId: string; url: string }[] = [];

        for (let r = 0; r < updatedRows.length; r++) {
            const cellValue = updatedRows[r][sourceColumn] || '';
            const urls = cellValue.split('\n').map((u: string) => u.trim());
            for (let i = 0; i < urls.length; i++) {
                if (urls[i].includes('drive.google.com')) {
                    const fid = extractDriveFolderId(urls[i]);
                    if (fid) {
                        processingTasks.push({ taskIndex: processingTasks.length, rowIndex: r, folderId: fid, url: urls[i] });
                        totalFolders++;
                    }
                }
            }
        }

        if (totalFolders === 0) {
            setIsProcessing(false);
            return alert("Không tìm thấy link Google Drive Folder (bắt đầu bằng https://drive.google.com/...) trong cột đã chọn.");
        }

        const taskResults: string[][] = new Array(processingTasks.length);
        let completed = 0;
        const concurrency = 4;
        let pIndex = 0;

        const worker = async () => {
            while (pIndex < processingTasks.length && !stopSignal.current) {
                const currentIndex = pIndex;
                pIndex++;
                const task = processingTasks[currentIndex];

                try {
                    setStatusMessage(`Đang lấy data thư mục ${currentIndex + 1}/${totalFolders}...`);
                    const driveItems = await fetchDriveImages(task.folderId);
                    
                    const folderUrls: string[] = new Array(driveItems.length);
                    for (let d = 0; d < driveItems.length; d++) {
                        if (stopSignal.current) break;
                        const item = driveItems[d];
                        setStatusMessage(`Đang Upload ảnh ${d + 1}/${driveItems.length} (${item.name}) của thư mục ${currentIndex + 1}...`);
                        
                        const driveUrlRaw = String(item.url);
                        let finalDriveUrl = driveUrlRaw.startsWith('//') ? 'https:' + driveUrlRaw : driveUrlRaw;
                        
                        // Clean up double slashes in the path
                        finalDriveUrl = finalDriveUrl.replace(/([^:]\/)\/+/g, "$1");
                        
                        let payload: string | Blob = finalDriveUrl;
                        
                        // Always fetch through proxy first to prevent Cloudinary/Shopify/ImgBB from being blocked or hitting limits on Drive URLs
                        const fetchResult = await fetchImageBlob(finalDriveUrl);
                        if (fetchResult) {
                            try {
                                const processed = await processImage(fetchResult.blob, outputFormat, 90, resizeMode === 'original', optimizeQuality);
                                payload = processed.blob;
                            } catch (procErr: any) {
                                console.warn("Drive image processing fallback to raw blob:", procErr?.message);
                                payload = fetchResult.blob;
                            }
                        } else {
                            throw new Error(`Không thể tải ảnh ${item.name} từ Google Drive`);
                        }

                        let newUrl = typeof payload === 'string' ? payload : '';
                        if (provider === 'shopify') newUrl = await uploadImageToShopify(payload);
                        else if (provider === 'cloudinary') newUrl = await uploadImageToCloudinary(payload);
                        else if (provider === 'imgbb') newUrl = await uploadImageToImgBB(payload);
                        folderUrls[d] = newUrl;
                    }
                    
                    taskResults[task.taskIndex] = folderUrls.filter(Boolean);
                } catch (e) {
                    console.error("Error processing folder", task.folderId, e);
                    taskResults[task.taskIndex] = [];
                }

                completed++;
                setProgress(Math.round((completed / totalFolders) * 100));
            }
        };

        const workers = [];
        for (let w = 0; w < concurrency; w++) workers.push(worker());
        await Promise.all(workers);

        if (stopSignal.current) {
            setStatusMessage("Đã hủy.");
        } else {
            setStatusMessage("Đang tạo file Excel...");
            
            // Reconstruct rows preserving exact task order
            const rowResultsMap = new Map<number, string[]>();
            for (let t = 0; t < processingTasks.length; t++) {
                const task = processingTasks[t];
                const resList = taskResults[t] || [];
                const existing = rowResultsMap.get(task.rowIndex) || [];
                rowResultsMap.set(task.rowIndex, [...existing, ...resList]);
            }

            for (let r = 0; r < updatedRows.length; r++) {
                const combinedUrls = rowResultsMap.get(r) || [];
                if (combinedUrls.length > 0) {
                    const existingDest = updatedRows[r][destColumn] || '';
                    if (existingDest.trim()) {
                        updatedRows[r][destColumn] = existingDest + '\n' + combinedUrls.join('\n');
                    } else {
                        updatedRows[r][destColumn] = combinedUrls.join('\n');
                    }
                }
            }

            setRows(updatedRows);
            exportToExcel(updatedRows);
            setStatusMessage("Hoàn tất.");

            if (auth.currentUser) {
                try {
                    await addHistory(STORE_NAMES.BULK_DOWNLOADS, {
                        uid: auth.currentUser.uid,
                        userEmail: auth.currentUser.email || 'N/A',
                        actionType: 'Drive -> Upload Ảnh',
                        details: {
                            successCount: rowResultsMap.size,
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
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Results");
        XLSX.writeFile(wb, `Drive_Upload_Kết_quả_${Date.now()}.xlsx`);
    };

    return (
        <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-sky-300 mb-2 whitespace-nowrap overflow-hidden text-ellipsis">Excel {'->'} Drive Folder {'->'} Upload</h1>
                <p className="text-zinc-400 text-sm">Quét link thư mục Google Drive trong Excel, tải ảnh và tự động upload lên Shopify/Cloud/ImgBB, sau đó lấy link ảnh ghi lại vào file Excel.</p>
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

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-900/50 p-4 rounded-lg border border-zinc-700 gap-4">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="w-8 h-8 text-green-500 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-zinc-200 truncate">{file.name}</p>
                                <p className="text-xs text-zinc-500">{rows.length} dòng dữ liệu</p>
                            </div>
                        </div>
                        {!isProcessing && (
                            <button onClick={() => setFile(null)} className="text-xs text-rose-400 hover:text-rose-300 whitespace-nowrap">
                                Đổi file khác
                            </button>
                        )}
                    </div>

                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                        <h3 className="text-sm font-bold text-zinc-200 border-b border-zinc-800 pb-2">Cấu hình Cột</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-1">Cột chứa Link Drive Folder (đọc)</label>
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
                                <p className="text-[10px] text-zinc-500 mt-1">Lưu ý: Dữ liệu cũ trong cột này sẽ bị nối thêm hoặc ghi đè.</p>
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

                        <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-1">Google Drive API Key (Tùy chọn - Tự động cào công khai nếu trống)</label>
                            <TextInput
                                value={googleApiKey}
                                onChange={(e) => setGoogleApiKey(e.target.value)}
                                placeholder="AIzaSy... (Để trống nếu thư mục Drive công khai)"
                                disabled={isProcessing}
                            />
                            <p className="text-[10px] text-zinc-400 mt-1">💡 Mẹo: Thư mục Google Drive công khai (quyền "Bất kỳ ai có liên kết đều có thể xem") được cào trực tiếp 100% tự động mà <strong>không cần nhập API Key</strong>.</p>
                        </div>

                        <div className="border-t border-zinc-800 pt-4">
                            <ProviderConfig provider={provider} activeId={activeConfigId} onActiveIdChange={setActiveConfigId} disabled={isProcessing} />
                        </div>
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
                            <Button colorScheme="red" icon={<StopCircle className="w-4 h-4"/>} onClick={() => stopSignal.current = true}>
                                Dừng lại
                            </Button>
                        ) : (
                            <Button 
                                colorScheme="sky" 
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
