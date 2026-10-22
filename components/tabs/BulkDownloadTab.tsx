
import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import Button from '../Button';
import { ProviderConfig } from '../ProviderConfig';
import { useProviderAccounts } from '../../src/hooks/useProviderAccounts';
import Spinner from '../Spinner';
import TextInput from '../TextInput';
import { Download, StopCircle, FileSpreadsheet, Sparkles, Upload, Trash2, Check, CloudUpload, Copy, FileInput, Plus, Replace, HardDrive, History } from 'lucide-react';
import { fetchImageBlob, processImage } from '../../utils/imageProcessor';
import { BulkShopifyUpload } from './BulkShopifyUpload';
import { BulkDriveUpload } from './BulkDriveUpload';
import BulkDownloadHistoryTab from './BulkDownloadHistoryTab';
import { db, auth } from '../../src/firebase';
import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';

interface ImageRow {
  id: string;
  sku: string;
  url: string;
  status: 'idle' | 'pending' | 'success' | 'error';
  errorMsg?: string;
}

interface UploadRow {
  id: string;
  file: File;
  status: 'idle' | 'pending' | 'success' | 'error';
  url?: string;
  errorMsg?: string;
}

interface TransferRow {
    id: string;
    fileName: string; // Add fileName to preserve original name column
    originalUrl: string;
    cloudinaryUrl?: string;
    status: 'idle' | 'pending' | 'success' | 'error';
    errorMsg?: string;
    isSelected: boolean; // Add selection state
}

type OutputFormat = 'jpg' | 'png' | 'webp';
type TabMode = 'download' | 'upload' | 'excel-transfer' | 'excel-shopify' | 'excel-drive' | 'history';
type ResizeMode = 'fill' | 'original';

interface CloudinaryAccount {
    id: string;
    cloudName: string;
    apiKey: string;
    apiSecret: string;
}

const CANVAS_SIZE = 800;
const MAX_DIMENSION = 750;
const CONCURRENCY_LIMIT = 6;
const ZIP_BATCH_SIZE = 2500;

// Helper component for copying URLs in the table
const UrlCell: React.FC<{ url?: string }> = ({ url }) => {
    const [copied, setCopied] = useState(false);

    if (!url) return <span className="text-zinc-500">-</span>;

    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center justify-end gap-2 max-w-[300px] ml-auto">
            <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="truncate text-sky-400 hover:text-sky-300 hover:underline text-xs block"
                title={url}
            >
                {url}
            </a>
            <button 
                onClick={handleCopy} 
                className="p-1.5 hover:bg-zinc-700 rounded-md transition-colors flex-shrink-0 group"
                title="Sao chép liên kết"
            >
                {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                ) : (
                    <Copy className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200" />
                )}
            </button>
        </div>
    );
};

const BulkDownloadTab: React.FC = () => {
  const [mode, setMode] = useState<TabMode>('download');
  const stopSignal = useRef<boolean>(false);
  const { cloudinaryAccounts, setCloudinaryAccounts } = useProviderAccounts();

  // --- DOWNLOAD MODE STATE ---
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImageRow[]>([]);
  const [hasHeader, setHasHeader] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('jpg');
  const [outputQuality, setOutputQuality] = useState<number>(90);
  const [resizeMode, setResizeMode] = useState<ResizeMode>('original');
  const [optimizeQuality, setOptimizeQuality] = useState<boolean>(false); 

  // --- UPLOAD MODE STATE ---
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const [provider, setProvider] = useState<'cloudinary' | 'imgbb'>(() => {
      return localStorage.getItem('upload_provider') as 'cloudinary' | 'imgbb' || 'cloudinary';
  });
  
  const [imgbbApiKey, setImgbbApiKey] = useState(() => {
      return localStorage.getItem('imgbb_api_key') || '';
  });

  const changeProvider = (val: 'cloudinary' | 'imgbb') => {
      setProvider(val);
      localStorage.setItem('upload_provider', val);
  };
  
  const changeImgbbApiKey = (val: string) => {
      setImgbbApiKey(val);
      localStorage.setItem('imgbb_api_key', val);
  };

  const [activeCloudinaryId, setActiveCloudinaryId] = useState<string>(() => {
      const saved = localStorage.getItem('cloudinary_active_id');
      return saved ? saved : 'default';
  });

  const cloudinaryConfig = cloudinaryAccounts.find(a => a.id === activeCloudinaryId) || cloudinaryAccounts[0];

  const updateActiveConfig = (updates: Partial<typeof cloudinaryConfig>) => {
      const newAccounts = cloudinaryAccounts.map(a => 
          a.id === activeCloudinaryId ? { ...a, ...updates } : a
      );
      setCloudinaryAccounts(newAccounts);
      localStorage.setItem('cloudinary_accounts_v2', JSON.stringify(newAccounts));
  };

  const addNewCloudinaryAccount = () => {
      const newId = Date.now().toString();
      const newAccounts = [...cloudinaryAccounts, { id: newId, cloudName: '', apiKey: '', apiSecret: '' }];
      setCloudinaryAccounts(newAccounts);
      setActiveCloudinaryId(newId);
      localStorage.setItem('cloudinary_accounts_v2', JSON.stringify(newAccounts));
      localStorage.setItem('cloudinary_active_id', newId);
  };

  const removeCloudinaryAccount = (id: string) => {
      if (cloudinaryAccounts.length === 1) return; // don't remove last one
      const newAccounts = cloudinaryAccounts.filter(a => a.id !== id);
      setCloudinaryAccounts(newAccounts);
      if (activeCloudinaryId === id) {
          setActiveCloudinaryId(newAccounts[0].id);
          localStorage.setItem('cloudinary_active_id', newAccounts[0].id);
      }
      localStorage.setItem('cloudinary_accounts_v2', JSON.stringify(newAccounts));
  };

  const changeActiveCloudinaryId = (val: string) => {
      setActiveCloudinaryId(val);
      localStorage.setItem('cloudinary_active_id', val);
  };

  // --- EXCEL TRANSFER MODE STATE ---
  const [transferRows, setTransferRows] = useState<TransferRow[]>([]);
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [isDraggingTransfer, setIsDraggingTransfer] = useState<boolean>(false);

  const handleStop = () => {
      stopSignal.current = true;
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }, []);

  const handleTransferFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTransferFile(e.target.files[0]);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  // --- TRANSFER MODE DRAG & DROP ---
  const handleTransferDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingTransfer(true);
  };
  const handleTransferDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingTransfer(false);
  };
  const handleTransferDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingTransfer(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          const f = e.dataTransfer.files[0];
          if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv')) {
              setTransferFile(f);
          } else {
              alert("Vui lòng chọn file Excel.");
          }
      }
  };

  const parseExcelForTransfer = useCallback(async () => {
      if (!transferFile) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const data = e.target?.result;
              const workbook = XLSX.read(data, { type: 'binary' });
              const sheetName = workbook.SheetNames[0];
              const sheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
              const parsedRows: TransferRow[] = [];
              const startIndex = hasHeader ? 1 : 0;

              for (let i = startIndex; i < jsonData.length; i++) {
                  const row = jsonData[i];
                  if (!row) continue;
                  
                  // Scan through the row for any URLs (pairs logic: Name in j-1, Link in j)
                  for(let j = 0; j < row.length; j++) {
                      const cell = String(row[j]).trim();
                      if(cell.match(/^https?:\/\//) || cell.startsWith('data:')) {
                          // Found a URL at index j.
                          // Try to find a name at j-1.
                          let fileName = `Item ${i}_${j}`;
                          if (j > 0 && row[j-1]) {
                              const potentialName = String(row[j-1]).trim();
                              // Simple check to ensure name isn't another URL (unlikely but possible)
                              if (!potentialName.match(/^https?:\/\//) && potentialName.length > 0) {
                                  fileName = potentialName;
                              }
                          }

                          parsedRows.push({
                              id: `trans-row-${i}-${j}-${Date.now()}-${Math.random()}`, // Added random to ensure true uniqueness
                              fileName: fileName,
                              originalUrl: cell,
                              status: 'idle',
                              isSelected: true
                          });
                      }
                  }
              }
              if (parsedRows.length === 0) alert("Không tìm thấy liên kết ảnh trong file (Cấu trúc: Cột Tên - Cột Link).");
              setTransferRows(parsedRows);
          } catch (error) {
              console.error(error);
              alert("Không thể đọc file.");
          }
      }
      reader.readAsBinaryString(transferFile);
  }, [transferFile, hasHeader]);

  // ... (parseFile implementation same as before) ...
  const parseFile = useCallback(async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        const parsedRows: ImageRow[] = [];
        const startIndex = hasHeader ? 1 : 0;
        
        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          for(let j = 0; j < row.length; j++) {
                const cell = String(row[j]).trim();
                if (cell.match(/^https?:\/\//) || cell.startsWith('data:')) {
                    let sku = `image_row${i+1}_col${j+1}`;
                    if (j > 0 && row[j-1]) {
                        const potentialSku = String(row[j-1]).trim();
                        if (!potentialSku.match(/^https?:\/\//)) {
                            sku = potentialSku;
                        }
                    }
                    parsedRows.push({
                        id: `row-${i}-col-${j}-${Date.now()}`,
                        sku: sku,
                        url: cell,
                        status: 'idle'
                    });
                }
          }
        }
        
        if (parsedRows.length === 0) {
            alert("Không tìm thấy liên kết ảnh hợp lệ trong file. Vui lòng đảm bảo file có chứa Link ảnh (http/https).");
        }
        setRows(parsedRows);
      } catch (error) {
        console.error(error);
        alert("Không thể đọc file.");
      }
    };
    reader.readAsBinaryString(file);
  }, [file, hasHeader]);

  // ... (keep downloadSingleImage, exportDownloadResults, handleBulkDownloadZip, handleUploadFilesChange, handleDragEnterUpload etc.) ...
  const downloadSingleImage = async (row: ImageRow) => {
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'pending' } : r));
    try {
        const fetchResult = await fetchImageBlob(row.url);
        if (fetchResult) {
            const processed = await processImage(
                fetchResult.blob, 
                outputFormat, 
                outputQuality, 
                resizeMode === 'original',
                optimizeQuality
            );
            const link = document.createElement('a');
            link.href = URL.createObjectURL(processed.blob);
            link.download = `${row.sku.replace(/[^a-z0-9_\-\s]/gi, '_')}.${processed.extension}`;
            link.click();
            URL.revokeObjectURL(link.href);
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'success' } : r));
        } else throw new Error();
    } catch (err) {
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', errorMsg: 'Lỗi' } : r));
    }
  };

  const exportDownloadResults = () => {
      const data = rows.map(r => ({ 
          'SKU': r.sku, 
          'Link Gốc': r.url,
          'Trạng thái': r.status === 'success' ? 'Thành công' : (r.status === 'error' ? 'Lỗi' : (r.status === 'pending' ? 'Đang xử lý' : 'Chờ')),
          'Chi tiết lỗi': r.errorMsg || ''
      }));
      
      if (data.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(data);
      const wscols = [{wch: 30}, {wch: 50}, {wch: 15}, {wch: 30}];
      ws['!cols'] = wscols;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KetQuaTaiAnh");
      XLSX.writeFile(wb, `ket_qua_tai_anh_${Date.now()}.xlsx`);
  };

  const handleBulkDownloadZip = async () => {
    if (rows.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    stopSignal.current = false;
    const totalBatches = Math.ceil(rows.length / ZIP_BATCH_SIZE);
    let globalCompleted = 0;
    let totalSuccess = 0;

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        if (stopSignal.current) break;
        const batchStart = batchIdx * ZIP_BATCH_SIZE;
        const batchEnd = Math.min((batchIdx + 1) * ZIP_BATCH_SIZE, rows.length);
        const batchRows = rows.slice(batchStart, batchEnd);
        const zip = new JSZip();
        const folderName = totalBatches > 1 ? `images_part_${batchIdx + 1}` : 'images';
        const folder = zip.folder(folderName);
        let batchSuccessCount = 0;
        const queue = [...batchRows];
        const workers = [];
        setStatusMessage(`Đang tải phần ${batchIdx + 1}/${totalBatches}...`);

        const worker = async () => {
            while (queue.length > 0 && !stopSignal.current) {
                const item = queue.shift();
                if (!item) continue;
                setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'pending' } : r));
                try {
                    const fetchResult = await fetchImageBlob(item.url);
                    if (fetchResult && !stopSignal.current) {
                        const processed = await processImage(fetchResult.blob, outputFormat, outputQuality, resizeMode === 'original', optimizeQuality);
                        const safeSku = item.sku.replace(/[^a-z0-9_\-\s]/gi, '_');
                        let fileName = `${safeSku}.${processed.extension}`;
                        let counter = 1;
                        while (folder?.file(fileName)) {
                            fileName = `${safeSku}_${counter}.${processed.extension}`;
                            counter++;
                        }
                        folder?.file(fileName, processed.blob);
                        batchSuccessCount++;
                        setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'success' } : r));
                    } else {
                        setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'error', errorMsg: 'Lỗi tải' } : r));
                    }
                } catch (e) {
                    setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'error', errorMsg: 'Lỗi xử lý' } : r));
                }
                globalCompleted++;
                setProgress(Math.round((globalCompleted / rows.length) * 100));
            }
        };
        for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, queue.length); i++) workers.push(worker());
        await Promise.all(workers);
        totalSuccess += batchSuccessCount;

        if (batchSuccessCount > 0 && !stopSignal.current) {
            setStatusMessage(`Đang đóng gói phần ${batchIdx + 1}/${totalBatches}...`);
            try {
                const content = await zip.generateAsync({ type: "blob", compression: "STORE" });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                const suffix = totalBatches > 1 ? `_part${batchIdx + 1}` : '';
                link.download = `images_bulk_${Date.now()}${suffix}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                await new Promise(r => setTimeout(r, 1000));
                URL.revokeObjectURL(link.href);
            } catch (error) {
                console.error("Zip generation failed", error);
                alert(`Lỗi tạo file ZIP cho phần ${batchIdx + 1}. Có thể do bộ nhớ đầy.`);
            }
        }
    }
    setIsProcessing(false);
    setStatusMessage(stopSignal.current ? 'Đã dừng.' : 'Hoàn tất.');

    if (auth.currentUser && !stopSignal.current && totalSuccess > 0) {
        try {
            await addHistory(STORE_NAMES.BULK_DOWNLOADS, {
                uid: auth.currentUser.uid,
                userEmail: auth.currentUser.email || 'N/A',
                actionType: 'Tải về ZIP',
                details: {
                    successCount: totalSuccess,
                    totalCount: rows.length,
                    format: outputFormat
                },
                status: 'success',
                createdAt: Date.now()
            });
        } catch (err) {
            console.error("Failed to save history", err);
        }
    }
  };

  const handleUploadFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadFiles(files);
      setUploadRows(files.map((f, i) => ({ id: `up-${i}`, file: f, status: 'idle' })));
    }
  };

  const handleDragEnterUpload = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeaveUpload = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOverUpload = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true); };
  const handleUploadDrop = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation(); setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        setUploadFiles(files);
        setUploadRows(files.map((f, i) => ({ id: `up-${i}`, file: f, status: 'idle' })));
      }
  };

  const generateSignature = async (timestamp: number) => {
      // NOTE: use_filename=true, unique_filename=true ensures that duplicate files are given a unique suffix
      // preventing one link from overwriting another if the excel has duplicate "Names" (filenames).
      const params = { timestamp, unique_filename: 'true', use_filename: 'true' };
      const stringToSign = Object.keys(params).sort().map(k => `${k}=${(params as any)[k]}`).join('&') + cloudinaryConfig.apiSecret;
      const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(stringToSign));
      return Array.from(new Uint8Array(hash)).map(v => v.toString(16).padStart(2, '0')).join('');
  };

  const handleUpload = async () => {
      if (uploadRows.length === 0) return;
      
      if (provider === 'imgbb' && !imgbbApiKey) {
          alert('Vui lòng nhập ImgBB API Key');
          return;
      }
      if (provider === 'cloudinary' && (!cloudinaryConfig.cloudName || !cloudinaryConfig.apiKey || !cloudinaryConfig.apiSecret)) {
          alert('Vui lòng nhập đủ thông tin Cloudinary');
          return;
      }

      setIsUploading(true); setProgress(0); stopSignal.current = false;
      const total = uploadRows.length;
      let completed = 0;
      let successCount = 0;
      const timestamp = Math.floor(Date.now() / 1000);
      const resultsTracker = new Map<string, { status: 'idle' | 'pending' | 'success' | 'error', url?: string, errorMsg?: string }>();
      uploadRows.forEach(r => resultsTracker.set(r.id, { status: 'idle' }));

      const worker = async (queue: UploadRow[]) => {
          while (queue.length > 0 && !stopSignal.current) {
              const item = queue.shift();
              if (!item) continue;
              setUploadRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'pending' } : r));
              resultsTracker.set(item.id, { status: 'pending' });
              try {
                  let newUrl = '';
                  let fileToUpload: File | Blob = item.file;
                  try {
                      const processed = await processImage(
                          item.file, 
                          outputFormat, 
                          outputQuality, 
                          resizeMode === 'original', 
                          optimizeQuality
                      );
                      fileToUpload = processed.blob;
                  } catch (procErr) {
                      console.warn("Processing failed, using raw file:", procErr);
                  }

                  if (provider === 'imgbb') {
                      const fd = new FormData();
                      fd.append('image', fileToUpload, item.file.name);
                      
                      const url = new URL('https://api.imgbb.com/1/upload');
                      url.searchParams.append('key', imgbbApiKey);
                      url.searchParams.append('name', item.file.name.replace(/\.[^/.]+$/, ""));
                      
                      const res = await fetch(url.toString(), { method: 'POST', body: fd });
                      const data = await res.json();
                      if (data?.success) {
                          newUrl = data.data.url;
                      } else {
                          throw new Error(data?.error?.message || "ImgBB Upload failed");
                      }
                  } else {
                      const signature = await generateSignature(timestamp);
                      const fd = new FormData();
                      if (fileToUpload instanceof Blob && !(fileToUpload instanceof File)) {
                          fd.append('file', fileToUpload, item.file.name);
                      } else {
                          fd.append('file', fileToUpload);
                      }
                      fd.append('api_key', cloudinaryConfig.apiKey);
                      fd.append('timestamp', String(timestamp));
                      fd.append('use_filename', 'true');
                      fd.append('unique_filename', 'true');
                      fd.append('signature', signature);

                      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, { method: 'POST', body: fd });
                      const data = await res.json();
                      
                      if (res.ok) {
                          newUrl = data.secure_url;
                      } else {
                          throw new Error(data.error?.message || "Upload failed");
                      }
                  }

                  if (newUrl) {
                      setUploadRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'success', url: newUrl } : r));
                      resultsTracker.set(item.id, { status: 'success', url: newUrl });
                      successCount++;
                  }
              } catch (e) {
                  const errorMsg = e instanceof Error ? e.message : 'Unknown error';
                  setUploadRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'error', errorMsg } : r));
                  resultsTracker.set(item.id, { status: 'error', errorMsg });
              }
              completed++;
              setProgress(Math.round((completed / total) * 100));
          }
      };
      const queue = [...uploadRows];
      const workers = Array(Math.min(4, queue.length)).fill(null).map(() => worker(queue));
      await Promise.all(workers);
      setIsUploading(false);
      if (successCount > 0 && !stopSignal.current) {
          const finalRows = uploadRows.map(r => {
             const track = resultsTracker.get(r.id);
             return track ? { ...r, ...track } : r;
          });
          exportUploadResults(finalRows);
          
          if (auth.currentUser) {
              try {
                  await addHistory(STORE_NAMES.BULK_DOWNLOADS, {
                      uid: auth.currentUser.uid,
                      userEmail: auth.currentUser.email || 'N/A',
                      actionType: 'Upload Ảnh (Local)',
                      details: {
                          successCount,
                          totalCount: total,
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
  };

  const exportUploadResults = (rowsToExport: UploadRow[]) => {
      const data = rowsToExport.map(r => ({ 
          'Tên File': r.file.name, 
          'Trạng thái': r.status === 'success' ? 'Thành công' : (r.status === 'error' ? 'Lỗi' : 'Chờ'),
          'Link Ảnh': r.url || '',
          'Chi tiết lỗi': r.errorMsg || ''
      }));
      if (data.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(data);
      const wscols = [{wch: 30}, {wch: 15}, {wch: 50}, {wch: 30}];
      ws['!cols'] = wscols;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Uploads");
      XLSX.writeFile(wb, `cloudinary_results_${Date.now()}.xlsx`);
  };

  // ================= EXCEL TO CLOUD TRANSFER HANDLERS =================

  const toggleSelectAllTransfer = () => {
      const areAllSelected = transferRows.every(r => r.isSelected);
      setTransferRows(prev => prev.map(r => ({ ...r, isSelected: !areAllSelected })));
  };

  const toggleSelectRowTransfer = (id: string) => {
      setTransferRows(prev => prev.map(r => r.id === id ? { ...r, isSelected: !r.isSelected } : r));
  };

  const handleExcelToCloudTransfer = async () => {
        const rowsToProcess = transferRows.filter(r => r.isSelected && r.status !== 'success');
        if (rowsToProcess.length === 0) {
            alert("Vui lòng chọn ít nhất một liên kết chưa hoàn thành.");
            return;
        }
        if (provider === 'imgbb' && !imgbbApiKey) {
            alert('Vui lòng nhập ImgBB API Key');
            return;
        }
        if (provider === 'cloudinary' && (!cloudinaryConfig.cloudName || !cloudinaryConfig.apiKey || !cloudinaryConfig.apiSecret)) {
            alert('Vui lòng nhập đủ thông tin Cloudinary');
            return;
        }

        setIsUploading(true);
        setProgress(0);
        stopSignal.current = false;
        
        const total = rowsToProcess.length;
        let completed = 0;
        let successCount = 0;
        const timestamp = Math.floor(Date.now() / 1000);

        const queue = [...rowsToProcess];
        
        const worker = async () => {
            while (queue.length > 0 && !stopSignal.current) {
                const item = queue.shift();
                if (!item) continue;

                setTransferRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'pending' } : r));

                try {
                    const signature = await generateSignature(timestamp);
                    
                    let uploadPayload: Blob | string = item.originalUrl;
                    let isFile = false;

                    const fetchResult = await fetchImageBlob(item.originalUrl);
                    if (fetchResult) {
                        try {
                            const processed = await processImage(
                                fetchResult.blob, 
                                outputFormat, 
                                outputQuality, 
                                resizeMode === 'original', 
                                optimizeQuality
                            );
                            uploadPayload = processed.blob;
                            isFile = true;
                        } catch (err) {
                            console.warn("Processing failed, falling back to original blob", err);
                            uploadPayload = fetchResult.blob;
                            isFile = true;
                        }
                    } else if (item.originalUrl.includes('drive.google.com')) {
                        throw new Error("Không thể tải ảnh từ Google Drive (File quá lớn hoặc lỗi proxy)");
                    }

                    if (provider === 'imgbb') {
                        if (!isFile && typeof uploadPayload === 'string') {
                            const fetchRes = await fetchImageBlob(uploadPayload);
                            if (fetchRes) {
                                try {
                                    const processed = await processImage(fetchRes.blob, outputFormat, outputQuality, resizeMode === 'original', optimizeQuality);
                                    uploadPayload = processed.blob;
                                } catch {
                                    uploadPayload = fetchRes.blob;
                                }
                                isFile = true;
                            } else {
                                throw new Error("Không thể tải ảnh gốc để upload ImgBB");
                            }
                        }
                        
                        const fd = new FormData();
                        const safeFileName = (item.fileName || 'image').replace(/[^a-zA-Z0-9_\-\s]/g, '_');
                        fd.append('image', uploadPayload as Blob, `${safeFileName}.${outputFormat}`);
                        
                        const url = new URL('https://api.imgbb.com/1/upload');
                        url.searchParams.append('key', imgbbApiKey);
                        url.searchParams.append('name', safeFileName);
                        
                        const res = await fetch(url.toString(), { method: 'POST', body: fd });
                        const data = await res.json();
                        if (data?.success) {
                            setTransferRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'success', cloudinaryUrl: data.data.url } : r));
                            successCount++;
                        } else {
                            throw new Error(data?.error?.message || "ImgBB Upload failed");
                        }
                    } else {
                        const signature = await generateSignature(timestamp);
                        const fd = new FormData();
                        const safeFileName = (item.fileName || 'upload').replace(/[^a-zA-Z0-9_\-]/g, '_');
                        if (isFile && uploadPayload instanceof Blob) {
                            fd.append('file', uploadPayload, `${safeFileName}_${timestamp}.${outputFormat}`);
                        } else {
                            fd.append('file', uploadPayload);
                        }
                        
                        fd.append('api_key', cloudinaryConfig.apiKey);
                        fd.append('timestamp', String(timestamp));
                        fd.append('use_filename', 'true');
                        fd.append('unique_filename', 'true');
                        fd.append('signature', signature);

                        let res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, { method: 'POST', body: fd });
                        let data = await res.json();

                        // Fallback
                        if (!res.ok && !isFile && typeof uploadPayload === 'string') {
                            const fetchRes = await fetchImageBlob(uploadPayload);
                            if (fetchRes) {
                                let blobToUpload: Blob = fetchRes.blob;
                                try {
                                    const proc = await processImage(fetchRes.blob, outputFormat, outputQuality, resizeMode === 'original', optimizeQuality);
                                    blobToUpload = proc.blob;
                                } catch (e) {
                                    console.warn("Fallback processing failed", e);
                                }
                                const blobFd = new FormData();
                                blobFd.append('file', blobToUpload, `${safeFileName}_${timestamp}.${outputFormat}`);
                                blobFd.append('api_key', cloudinaryConfig.apiKey);
                                blobFd.append('timestamp', String(timestamp));
                                blobFd.append('use_filename', 'true');
                                blobFd.append('unique_filename', 'true');
                                blobFd.append('signature', signature);
                                
                                res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, { method: 'POST', body: blobFd });
                                data = await res.json();
                            }
                        }

                        if (res.ok) {
                            setTransferRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'success', cloudinaryUrl: data.secure_url } : r));
                            successCount++;
                        } else {
                            throw new Error(data.error?.message || "Transfer failed");
                        }
                    }

                } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
                    setTransferRows(prev => prev.map(r => r.id === item.id ? { ...r, status: 'error', errorMsg } : r));
                }

                completed++;
                setProgress(Math.round((completed / total) * 100));
            }
        };

        const workers = Array(Math.min(6, queue.length)).fill(null).map(worker);
        await Promise.all(workers);

        setIsUploading(false);
        
        if (auth.currentUser && successCount > 0 && !stopSignal.current) {
            try {
                await addHistory(STORE_NAMES.BULK_DOWNLOADS, {
                    uid: auth.currentUser.uid,
                    userEmail: auth.currentUser.email || 'N/A',
                    actionType: 'Chuyển đổi Cloud',
                    details: {
                        successCount,
                        totalCount: total,
                        provider
                    },
                    status: 'success',
                    createdAt: Date.now()
                });
            } catch (err) {
                console.error("Failed to save history", err);
            }
        }
  };

  const exportTransferResults = () => {
      const data = transferRows.map(r => ({ 
          'Tên File': r.fileName,
          'Link Gốc': r.originalUrl,
          'Link Cloud': r.cloudinaryUrl || '',
          'Trạng thái': r.status === 'success' ? 'Thành công' : r.status,
          'Lỗi': r.errorMsg || ''
      }));
      
      if (data.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(data);
      const wscols = [{wch: 30}, {wch: 50}, {wch: 50}, {wch: 15}, {wch: 30}];
      ws['!cols'] = wscols;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TransferResults");
      XLSX.writeFile(wb, `transfer_results_${Date.now()}.xlsx`);
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-8">
        <div className="flex justify-center">
            <div className="bg-zinc-800 p-1 rounded-lg border border-zinc-700 flex flex-wrap gap-1 justify-center">
                <button
                    onClick={() => setMode('download')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        mode === 'download' ? 'bg-sky-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                    <Download className="w-4 h-4" />
                    Tải về máy
                </button>
                <button
                    onClick={() => setMode('upload')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        mode === 'upload' ? 'bg-sky-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                    <CloudUpload className="w-4 h-4" />
                    Upload File Local
                </button>
                <button
                    onClick={() => setMode('excel-transfer')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        mode === 'excel-transfer' ? 'bg-sky-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                    <FileInput className="w-4 h-4" />
                    Excel &rarr; Cloudinary
                </button>
                <button
                    onClick={() => setMode('excel-shopify')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        mode === 'excel-shopify' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                    <Replace className="w-4 h-4" />
                    Excel &rarr; URL ảnh tổng
                </button>
                <button
                    onClick={() => setMode('excel-drive')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        mode === 'excel-drive' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                    <HardDrive className="w-4 h-4" />
                    Excel Drive &rarr; Upload
                </button>
                <button
                    onClick={() => setMode('history')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        mode === 'history' ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                    <History className="w-4 h-4" />
                    Lịch sử
                </button>
            </div>
        </div>

      {mode === 'download' && (
        <>
        <div className="bg-zinc-800/50 p-6 sm:p-8 rounded-2xl border border-zinc-700 space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-sky-300 mb-2 flex items-center gap-2">
                    <Download className="w-8 h-8" />
                    Tải Ảnh Siêu Tốc
                </h1>
                <p className="text-zinc-400 text-sm">
                    Tải ảnh song song ({CONCURRENCY_LIMIT} ảnh cùng lúc). Cấu trúc: Quét toàn bộ cột, tìm cặp (Tên - Link).
                </p>
            </header>

            <div className="space-y-4">
                {!file ? (
                    <label
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-zinc-900/70 border-2 border-zinc-600 border-dashed rounded-lg appearance-none cursor-pointer hover:border-sky-500 focus:outline-none"
                    >
                        <Upload className="w-10 h-10 text-zinc-500 mb-2" />
                        <span className="text-sm text-zinc-400">Kéo thả file Excel</span>
                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileChange} />
                    </label>
                ) : (
                    <div className="flex items-center justify-between p-4 bg-zinc-900/80 border border-zinc-600 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-900/30 rounded-lg text-green-400">
                                <Check className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium text-zinc-200">{file.name}</p>
                            </div>
                        </div>
                        <button onClick={() => { setFile(null); setRows([]); }} className="p-2 text-zinc-400 hover:text-red-400">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                )}
                {file && rows.length === 0 && (
                    <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} className="rounded border-zinc-600 bg-zinc-800 text-sky-500"/>
                            <span className="text-sm text-zinc-300">Bỏ dòng đầu</span>
                        </label>
                        <Button onClick={parseFile} className="!w-auto">Đọc File</Button>
                    </div>
                )}
            </div>
        </div>

        {rows.length > 0 && (
            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 flex flex-col h-[650px]">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-200">Danh sách ({rows.length})</h2>
                        {isProcessing && (
                            <div className="mt-2 w-64">
                                <div className="flex justify-between text-xs text-sky-400 mb-1">
                                    <span>{statusMessage}</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-sky-500 h-full transition-all duration-300" 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>
                   <div className="flex gap-3 items-center">
                        {isProcessing ? (
                            <Button onClick={handleStop} colorScheme="red" className="!w-auto !px-6">
                                <StopCircle className="w-5 h-5 mr-2" /> Dừng
                            </Button>
                        ) : (
                            <>
                                <Button onClick={exportDownloadResults} colorScheme="green" className="!w-auto !px-4 !py-2 !text-sm">
                                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Xuất Excel
                                </Button>
                                <Button onClick={handleBulkDownloadZip} disabled={isProcessing} className="!w-auto !px-6">
                                    <Download className="w-5 h-5 mr-2" /> Tải ZIP
                                </Button>
                            </>
                        )}
                   </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-700 p-4 rounded-lg mb-4 flex flex-wrap gap-6 items-center flex-shrink-0 overflow-x-auto">
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
                    <div className="flex items-center gap-2 min-w-fit">
                        <label className="flex items-center gap-2 cursor-pointer bg-zinc-800 p-1.5 px-3 rounded border border-zinc-700 select-none hover:bg-zinc-700 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={optimizeQuality} 
                                onChange={e => setOptimizeQuality(e.target.checked)} 
                                className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-sky-500 focus:ring-sky-500"
                            />
                            <span className="text-xs text-zinc-300 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-yellow-400" /> 
                                Làm nét (Giữ nguyên độ bóng)
                            </span>
                        </label>
                    </div>
                </div>

                <div className="flex-1 overflow-auto border border-zinc-700 rounded-lg bg-zinc-900/40">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-sky-300 uppercase bg-zinc-700/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">#</th>
                                <th className="px-4 py-3">SKU</th>
                                <th className="px-4 py-3">URL</th>
                                <th className="px-4 py-3 text-center">Trạng thái</th>
                                <th className="px-4 py-3 text-right">Lẻ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr key={row.id} className="border-b border-zinc-700/50 hover:bg-zinc-800/50">
                                    <td className="px-4 py-3 text-zinc-500">{index + 1}</td>
                                    <td className="px-4 py-3 text-zinc-200">{row.sku}</td>
                                    <td className="px-4 py-3"><UrlCell url={row.url} /></td>
                                    <td className="px-4 py-3 text-center">
                                        {row.status === 'pending' ? <Spinner /> : 
                                         row.status === 'success' ? <Check className="w-5 h-5 text-green-400 mx-auto"/> :
                                         row.status === 'error' ? <span className="text-red-400 text-xs">!</span> : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => downloadSingleImage(row)} disabled={isProcessing} className="text-sky-400 hover:underline text-xs">Tải</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
        </>
      )}

      {mode === 'upload' && (
          <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 space-y-6">
              <header><h1 className="text-2xl font-bold text-sky-300">Upload Ảnh (Từ máy)</h1></header>
              
              <div className="space-y-4 p-5 bg-zinc-900/60 rounded-xl border border-zinc-700/50">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-2 pb-4 border-b border-zinc-800">
                      <label className="text-sm font-bold text-white whitespace-nowrap">Dịch vụ Upload:</label>
                      <div className="flex space-x-2">
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                              <input type="radio" value="cloudinary" checked={provider === 'cloudinary'} onChange={() => changeProvider('cloudinary')} />
                              Cloudinary
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                              <input type="radio" value="imgbb" checked={provider === 'imgbb'} onChange={() => changeProvider('imgbb')} />
                              ImgBB
                          </label>
                      </div>
                  </div>

                  {provider === 'cloudinary' ? (
                      <>
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                               <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto flex-1">
                                   <label className="text-sm font-bold text-sky-400 whitespace-nowrap">Tài khoản Cloudinary:</label>
                                   <select 
                                       value={activeCloudinaryId} 
                                       onChange={e => changeActiveCloudinaryId(e.target.value)}
                                       className="flex-1 min-w-[200px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500 transition-colors"
                                   >
                                       {cloudinaryAccounts.map((a, i) => (
                                           <option key={a.id} value={a.id}>{a.cloudName || 'Chưa thiết lập'} {i === 0 && a.id === 'default' ? '(Mặc định)' : ''}</option>
                                       ))}
                                   </select>
                               </div>
                               <div className="flex items-center gap-2 w-full sm:w-auto mt-2 md:mt-0">
                                   <Button onClick={addNewCloudinaryAccount} colorScheme="zinc" className="flex-1 sm:flex-none !w-auto !px-4 !py-2.5 text-sm"><Plus className="w-4 h-4 mr-1" /> Thêm profile</Button>
                                   <Button onClick={() => removeCloudinaryAccount(activeCloudinaryId)} colorScheme="red" className="flex-1 sm:flex-none !w-auto !px-4 !py-2.5 text-sm" disabled={cloudinaryAccounts.length === 1} title="Xóa tài khoản này"><Trash2 className="w-4 h-4 mr-1" /> Xóa</Button>
                               </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-2 border-t border-zinc-800">
                              <div>
                                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">Cloud Name</label>
                                  <TextInput value={cloudinaryConfig.cloudName} onChange={e => updateActiveConfig({cloudName: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">API Key</label>
                                  <TextInput value={cloudinaryConfig.apiKey} onChange={e => updateActiveConfig({apiKey: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">API Secret</label>
                                  <TextInput type="password" value={cloudinaryConfig.apiSecret} onChange={e => updateActiveConfig({apiSecret: e.target.value})}/>
                              </div>
                          </div>
                      </>
                  ) : (
                      <div className="pt-2">
                          <div>
                              <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">ImgBB API Key <a href="https://api.imgbb.com/" target="_blank" rel="noreferrer" className="text-sky-500 lowercase underline">(Lấy key tại đây)</a></label>
                              <TextInput value={imgbbApiKey} onChange={e => changeImgbbApiKey(e.target.value)} />
                          </div>
                      </div>
                  )}
              </div>
              
              <div className="bg-zinc-900/50 border border-zinc-700 p-4 rounded-lg flex flex-wrap gap-6 items-center flex-shrink-0 overflow-x-auto mt-4">
                  <div className="flex items-center gap-2 min-w-fit">
                      <span className="text-xs text-zinc-400">Định dạng:</span>
                      <div className="flex bg-zinc-800 rounded p-1 border border-zinc-700">
                          {(['jpg', 'png', 'webp'] as const).map(f => (
                              <button key={f} onClick={() => setOutputFormat(f as OutputFormat)} className={`px-3 py-1 text-xs rounded ${outputFormat === f ? 'bg-sky-600 text-white' : 'text-zinc-400'}`}>{f.toUpperCase()}</button>
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

              <label
                onDragEnter={handleDragEnterUpload}
                onDragLeave={handleDragLeaveUpload}
                onDragOver={handleDragOverUpload}
                onDrop={handleUploadDrop}
                className={`flex flex-col items-center justify-center w-full h-32 bg-zinc-900/70 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-sky-500 bg-sky-900/20' : 'border-zinc-600 hover:border-sky-500'}`}
              >
                  <Upload className={`w-10 h-10 mb-2 ${isDragging ? 'text-sky-400' : 'text-zinc-500'}`} />
                  <span className={`text-sm ${isDragging ? 'text-sky-300' : 'text-zinc-400'}`}>
                      {isDragging ? 'Thả ảnh vào đây' : 'Chọn ảnh upload hoặc kéo thả vào đây'}
                  </span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleUploadFilesChange} />
              </label>

              {uploadRows.length > 0 && (
                  <div className="space-y-4">
                      <div className="flex justify-between items-center">
                          <span className="text-zinc-200">{uploadRows.length} ảnh</span>
                          <div className="flex gap-3">
                            {uploadRows.some(r => r.status === 'success' || r.status === 'error') && !isUploading && (
                                <Button onClick={() => exportUploadResults(uploadRows)} colorScheme="green" className="!w-auto">
                                    <FileSpreadsheet className="w-5 h-5 mr-2" />
                                    Xuất Excel
                                </Button>
                            )}
                            {isUploading ? <Button onClick={handleStop} colorScheme="red" className="!w-auto">Dừng</Button> : <Button onClick={handleUpload} className="!w-auto">Bắt đầu</Button>}
                          </div>
                      </div>
                      
                      <div className="flex-1 overflow-auto border border-zinc-700 rounded-lg bg-zinc-900/40 max-h-[600px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-sky-300 uppercase bg-zinc-700/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Tên File</th>
                                    <th className="px-4 py-3 text-center">Trạng thái</th>
                                    <th className="px-4 py-3 text-right">Link Ảnh</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uploadRows.map((row) => (
                                    <tr key={row.id} className="border-b border-zinc-700/50 hover:bg-zinc-800/50">
                                        <td className="px-4 py-2 text-zinc-300 truncate max-w-[200px]" title={row.file.name}>
                                            {row.file.name}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                             {row.status === 'pending' ? <Spinner /> : 
                                              row.status === 'success' ? <Check className="w-5 h-5 text-green-400 mx-auto"/> :
                                              row.status === 'error' ? <span className="text-red-400 text-xs" title={row.errorMsg}>Lỗi</span> : 
                                              <span className="text-zinc-600">-</span>}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            {row.url ? <UrlCell url={row.url} /> : <span className="text-zinc-600">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                  </div>
              )}
          </div>
      )}

      {mode === 'excel-transfer' && (
          <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 space-y-6">
              <header>
                  <h1 className="text-2xl font-bold text-sky-300 mb-2">Chuyển đổi Excel {'->'} Cloud</h1>
                  <p className="text-zinc-400 text-sm">Upload ảnh từ danh sách URL trong Excel thẳng lên Cloud (Cloudinary, ImgBB) mà không cần tải về máy.</p>
              </header>

              <div className="space-y-4 p-5 bg-zinc-900/60 rounded-xl border border-zinc-700/50">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-2 pb-4 border-b border-zinc-800">
                      <label className="text-sm font-bold text-white whitespace-nowrap">Dịch vụ Upload:</label>
                      <div className="flex space-x-2">
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                              <input type="radio" value="cloudinary" checked={provider === 'cloudinary'} onChange={() => changeProvider('cloudinary')} />
                              Cloudinary
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                              <input type="radio" value="imgbb" checked={provider === 'imgbb'} onChange={() => changeProvider('imgbb')} />
                              ImgBB
                          </label>
                      </div>
                  </div>

                  {provider === 'cloudinary' ? (
                      <>
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                               <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto flex-1">
                                   <label className="text-sm font-bold text-sky-400 whitespace-nowrap">Tài khoản Cloudinary:</label>
                                   <select 
                                       value={activeCloudinaryId} 
                                       onChange={e => changeActiveCloudinaryId(e.target.value)}
                                       className="flex-1 min-w-[200px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500 transition-colors"
                                   >
                                       {cloudinaryAccounts.map((a, i) => (
                                           <option key={a.id} value={a.id}>{a.cloudName || 'Chưa thiết lập'} {i === 0 && a.id === 'default' ? '(Mặc định)' : ''}</option>
                                       ))}
                                   </select>
                               </div>
                               <div className="flex items-center gap-2 w-full sm:w-auto mt-2 md:mt-0">
                                   <Button onClick={addNewCloudinaryAccount} colorScheme="zinc" className="flex-1 sm:flex-none !w-auto !px-4 !py-2.5 text-sm"><Plus className="w-4 h-4 mr-1" /> Thêm profile</Button>
                                   <Button onClick={() => removeCloudinaryAccount(activeCloudinaryId)} colorScheme="red" className="flex-1 sm:flex-none !w-auto !px-4 !py-2.5 text-sm" disabled={cloudinaryAccounts.length === 1} title="Xóa tài khoản này"><Trash2 className="w-4 h-4 mr-1" /> Xóa</Button>
                               </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-2 border-t border-zinc-800">
                              <div>
                                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">Cloud Name</label>
                                  <TextInput value={cloudinaryConfig.cloudName} onChange={e => updateActiveConfig({cloudName: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">API Key</label>
                                  <TextInput value={cloudinaryConfig.apiKey} onChange={e => updateActiveConfig({apiKey: e.target.value})}/>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">API Secret</label>
                                  <TextInput type="password" value={cloudinaryConfig.apiSecret} onChange={e => updateActiveConfig({apiSecret: e.target.value})}/>
                              </div>
                          </div>
                      </>
                  ) : (
                      <div className="pt-2">
                          <div>
                              <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">ImgBB API Key <a href="https://api.imgbb.com/" target="_blank" rel="noreferrer" className="text-sky-500 lowercase underline">(Lấy key tại đây)</a></label>
                              <TextInput value={imgbbApiKey} onChange={e => changeImgbbApiKey(e.target.value)} />
                          </div>
                      </div>
                  )}
              </div>

              {!transferFile ? (
                  <label 
                    className={`flex flex-col items-center justify-center w-full h-32 px-4 transition bg-zinc-900/70 border-2 border-zinc-600 border-dashed rounded-lg appearance-none cursor-pointer focus:outline-none hover:bg-zinc-800 ${isDraggingTransfer ? 'border-sky-500 bg-sky-900/20' : 'hover:border-sky-500'}`}
                    onDragOver={handleTransferDragOver}
                    onDragLeave={handleTransferDragLeave}
                    onDrop={handleTransferDrop}
                  >
                      <FileInput className={`w-10 h-10 mb-2 ${isDraggingTransfer ? 'text-sky-400' : 'text-zinc-500'}`} />
                      <span className={`text-sm ${isDraggingTransfer ? 'text-sky-300' : 'text-zinc-400'}`}>
                          {isDraggingTransfer ? 'Thả file Excel vào đây' : 'Kéo thả hoặc Chọn file Excel'}
                      </span>
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleTransferFileChange} />
                  </label>
              ) : (
                  <div className="flex items-center justify-between p-4 bg-zinc-900/80 border border-zinc-600 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-900/30 rounded-lg text-purple-400">
                                <FileSpreadsheet className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium text-zinc-200">{transferFile.name}</p>
                            </div>
                        </div>
                        {transferRows.length === 0 ? (
                            <Button onClick={parseExcelForTransfer} className="!w-auto !py-1">Đọc Link</Button>
                        ) : (
                            <button onClick={() => { setTransferFile(null); setTransferRows([]); }} className="p-2 text-zinc-400 hover:text-red-400">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                  </div>
              )}

              {transferRows.length > 0 && (
                  <div className="space-y-4">
                      {/* --- Added Settings Bar --- */}
                      <div className="bg-zinc-900/50 border border-zinc-700 p-4 rounded-lg mb-4 flex flex-wrap gap-6 items-center flex-shrink-0 overflow-x-auto">
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
                        <div className="flex items-center gap-2 min-w-fit">
                            <label className="flex items-center gap-2 cursor-pointer bg-zinc-800 p-1.5 px-3 rounded border border-zinc-700 select-none hover:bg-zinc-700 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={optimizeQuality} 
                                    onChange={e => setOptimizeQuality(e.target.checked)} 
                                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-sky-500 focus:ring-sky-500"
                                />
                                <span className="text-xs text-zinc-300 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-yellow-400" /> 
                                    Làm nét (Giữ nguyên độ bóng)
                                </span>
                            </label>
                        </div>
                    </div>

                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                              <span className="text-zinc-200">{transferRows.filter(r => r.isSelected).length} / {transferRows.length} liên kết được chọn</span>
                              {isUploading && (
                                <div className="flex items-center gap-2 text-xs text-sky-400">
                                    <div className="w-24 bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-sky-500 h-full transition-all" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    {progress}%
                                </div>
                              )}
                          </div>
                          <div className="flex gap-3">
                            {transferRows.some(r => r.status === 'success' || r.status === 'error') && !isUploading && (
                                <Button onClick={exportTransferResults} colorScheme="green" className="!w-auto">
                                    <FileSpreadsheet className="w-5 h-5 mr-2" />
                                    Xuất Excel Kết Quả
                                </Button>
                            )}
                            {isUploading ? <Button onClick={handleStop} colorScheme="red" className="!w-auto">Dừng</Button> : <Button onClick={handleExcelToCloudTransfer} className="!w-auto">Bắt đầu Chuyển đổi</Button>}
                          </div>
                      </div>
                      
                      <div className="flex-1 overflow-auto border border-zinc-700 rounded-lg bg-zinc-900/40 max-h-[500px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-sky-300 uppercase bg-zinc-700/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-center w-10">
                                        <input 
                                            type="checkbox" 
                                            checked={transferRows.every(r => r.isSelected)}
                                            onChange={toggleSelectAllTransfer}
                                            className="rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-offset-0 focus:ring-sky-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-4 py-3">Tên</th>
                                    <th className="px-4 py-3">Link Gốc</th>
                                    <th className="px-4 py-3 text-center">Trạng thái</th>
                                    <th className="px-4 py-3 text-right">Link Mới (Cloud)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transferRows.map((row) => (
                                    <tr key={row.id} className={`border-b border-zinc-700/50 transition-colors ${row.isSelected ? 'hover:bg-zinc-800/50' : 'opacity-50 bg-zinc-900/50'}`}>
                                        <td className="px-4 py-2 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={row.isSelected}
                                                onChange={() => toggleSelectRowTransfer(row.id)}
                                                className="rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-offset-0 focus:ring-sky-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-zinc-300 max-w-[150px] truncate" title={row.fileName}>
                                            {row.fileName}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="max-w-[250px] truncate text-zinc-400" title={row.originalUrl}>
                                                {row.originalUrl}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                             {row.status === 'pending' ? <Spinner /> : 
                                              row.status === 'success' ? <Check className="w-5 h-5 text-green-400 mx-auto"/> :
                                              row.status === 'error' ? <span className="text-red-400 text-xs" title={row.errorMsg}>Lỗi</span> : 
                                              <span className="text-zinc-600">-</span>}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            {row.cloudinaryUrl ? <UrlCell url={row.cloudinaryUrl} /> : <span className="text-zinc-600">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                  </div>
              )}
          </div>
      )}

      {mode === 'excel-shopify' && <BulkShopifyUpload />}
      {mode === 'excel-drive' && <BulkDriveUpload />}
      {mode === 'history' && <BulkDownloadHistoryTab />}
    </div>
  );
};

export default BulkDownloadTab;
