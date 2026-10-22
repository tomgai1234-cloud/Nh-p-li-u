import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileText, Sparkles, Upload, Copy, Check, Trash2, RefreshCw, 
  DownloadCloud, FileSpreadsheet, Layers, Play, StopCircle, 
  ExternalLink, Eye, Code, AlignLeft, Settings, HelpCircle, CheckCircle2, 
  AlertCircle, List, Plus, Wand2, ArrowRight, Split, Minimize2, FileCode, CheckSquare, Image as ImageIcon
} from 'lucide-react';
import Button from '../Button';
import toast from 'react-hot-toast';
import { 
  HtmlOptimizeOptions, 
  DEFAULT_HTML_OPTIMIZE_OPTIONS, 
  OptimizationStats, 
  optimizeHtml, 
  beautifyHtml, 
  minifyHtml 
} from '../../utils/htmlOptimizer';

export interface DocItem {
  id: string;
  sku: string;
  url: string;
  status: 'idle' | 'pending' | 'success' | 'error';
  docTitle?: string;
  rawText?: string;
  rawCleanHtml?: string;
  finalHtml?: string;
  images?: string[];
  errorMsg?: string;
  stats?: OptimizationStats;
}

export interface ExcelBulkItem {
  id: string;
  sku: string;
  originalHtml: string;
  optimizedHtml: string;
  stats?: OptimizationStats;
  status: 'idle' | 'success' | 'error';
}

const SAMPLE_RAW_HTML = `<h3><strong>Giới thiệu sản phẩm Máy giặt Panasonic Inverter 12kg NA-24VDG1BVT</strong></h3>
<br>
<div>
 <div>
  <div>
   <div>
    <div>
     <h2>Diệt khuẩn vượt trội. Máy tự làm sạch. Sống khỏe nhẹ nhàng mỗi ngày</h2>
     <p>Cung cấp các sản phẩm vệ sinh thiết yếu cho việc giặt giũ hằng ngày của bạn, từ khâu giặt...</p>
    </div>
    <div>
     <div>
      <h2>Máy tự làm sạch</h2>
      <p>Chức năng Tự động vệ sinh gioăng cửa và Tự động vệ sinh lồng giặt kết hợp cùng nhau như một hệ thống tự làm...</p>
     </div>
     <div>
      <h2>Loại bỏ xơ vải và cặn bẩn</h2>
      <p>Tính năng Tự động vệ sinh gioăng sử dụng hai tia phun kết hợp với ion Ag+ và tia UV để loại bỏ 99,99%*¹...</p>
     </div>
     <div>
      <h2>Vệ sinh lồng giặt hằng ngày, ngăn ngừa nấm mốc phát triển</h2>
      <p>Tính năng Tự động vệ sinh lồng giặt tận dụng nước sau mỗi chu trình giặt, kết hợp tia UV và ion bạc Ag+ giúp loại bỏ cặn bẩn, ức chế nấm mốc*2...</p>
     </div>
     <div>
      <h2>Làm sạch sâu với hơi nước. Hiệu quả diệt khuẩn đã được kiểm chứng.</h2>
      <p>Không giống như nước, hơi nước thấm sâu vào sợi vải nhanh hơn – vì vậy tính năng StainMaster+ có thể loại...</p>
     </div>
     <div>
      <h2>Thiết kế tối ưu</h2>
      <p>Từng chi tiết đều được thiết kế để giúp việc giặt giũ trở nên đơn giản hơn, từ cách bạn cho đồ vào đến cách bạn điều khiển máy.</p>
     </div>
     <div>
      <h2>Thuận tiện cho vào - lấy ra</h2>
      <p>Cửa máy rộng hơn kết hợp lồng giặt được nâng cao giúp việc cho và lấy đồ dễ...</p>
     </div>
     <div>
      <h2>Tự động ghi nhớ cài đặt thường dùng</h2>
      <p>Ghi nhớ chương trình giặt với các chế độ cài đặt bạn hay dùng và lưu lại cho lần giặt tiếp...</p>
     </div>
     <div>
      <h2>Điều khiển dễ dàng. Chống trầy xước</h2>
      <p>Các nút điều khiển rõ ràng trực quan với bề mặt bền bỉ, chống trầy xước, hiển thị rõ ràng và dễ sử dụng trong suốt vòng đời sản phẩm.</p>
     </div>
     <div>
      <h2>Tiết kiệm hơn với mỗi lần giặt</h2>
      <p>Công nghệ cảm biến thông minh tự động nhận diện khối lượng đồ và nhiệt độ nước để tối ưu hóa hiệu năng giặt giũ.<br>
        Máy sẽ tự động điều chỉnh lượng nước, thời gian giặt và...</p>
     </div>
     <div>
      <h2>Ghi nhớ thông minh MySmart Memory hoạt động ra sao và làm cách nào để kích hoạt?</h2>
      <p>Ghi nhớ thông minh MySmart Memory tự động ghi nhớ và thiết lập mặc định chương trình thường dùng nhất dựa trên 10 lần giặt gần nhất. Tính năng này vận hành hoàn...</p>
     </div>
     <div>
      <h2>Chức năng Tự động vệ sinh gioăng hoạt động như thế nào?</h2>
      <p>Chức năng Tự động vệ sinh gioăng sử dụng hai đầu phun nước để rửa sạch cặn chất tẩy rửa và xơ vải trên gioăng...</p>
     </div>
     <div>
      <h2>Chức năng Tự động vệ sinh gioăng có cần chất tẩy rửa hoặc tăng lượng nước sử dụng không?</h2>
      <p>Không cần sử dụng bột giặt hoặc các sản phẩm vệ sinh khác. Máy tận dụng nước từ chu trình giặt mà không cần tiêu thụ thêm nước.</p>
     </div>
     <div>
      <h2>Khi nào tôi nên chạy chương trình Vệ sinh lồng giặt?</h2>
      <p>Nhờ tính năng Tự động vệ sinh lồng giặt sau mỗi chu trình, bạn có thể sử dụng đến 200 chu trình giặt mới cần chạy chương trình Vệ sinh lồng giặt. Đèn biểu tượng Vệ sinh lồng giặt nhấp nháy sẽ nhắc...</p>
     </div>
     <div>
      <h2>Mẫu này có chức năng Hơi nước không?</h2>
      <p>Đúng. Tất cả các mẫu thuộc dòng DG1 đều bao gồm chương trình Giặt diệt khuẩn bằng hơi nước giúp loại bỏ vi khuẩn và chất gây...</p>
     </div>
    </div>
    <div>
     <div></div>
     <div>
      <ul>
       <li>
        <h3>Khối lượng giặt: 12 kg</h3></li>
       <li>
        <h3>Máy tự làm sạch - Tự động vệ sinh gioăng, Tự động vệ sinh lồng giặt</h3></li>
       <li>
        <h3>Làm sạch sâu hơn với hơi nước. Hiệu quả làm sạch đã được chứng minh - StainMaster+ với hơi nước</h3></li>
       <li>
        <h3>Được thiết kế hướng đến người dùng - Lồng giặt rộng hơn, Ghi nhớ thông minh MySmart Memory</h3></li>
       <li>
        <h3>Tiết kiệm hơn với mỗi lần giặt - Giặt giũ thông minh với AI</h3></li>
      </ul>
      <ul>
       <li></li>
       <li></li>
      </ul>
     </div>
    </div>
   </div>
  </div>
 </div>
</div>
<p></p>
<p><img></p>
<p><img src="https://res.cloudinary.com/dr9bdcoyf/image/upload/v1781493384/blob_xbbmaj.jpg"></p>
<p><img src="https://res.cloudinary.com/dr9bdcoyf/image/upload/v1781493385/blob_ub13sp.jpg"></p>
<p><img src="https://res.cloudinary.com/dr9bdcoyf/image/upload/v1781493385/blob_ylwea8.jpg"></p>
<p><img src="https://res.cloudinary.com/dr9bdcoyf/image/upload/v1781493385/blob_cpgc2c.jpg"></p>`;

const SAMPLE_DOCS_INPUT = `SKU001 | https://docs.google.com/document/d/1t78Y1ocJ5kVtJLUih5_QXaweUDgLbUoO/edit
SKU002 | https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit`;

const GoogleDocsToHtmlTab: React.FC = () => {
  // Main Navigation Modes: Direct HTML Optimizer vs Google Docs vs Excel Bulk
  const [mainMode, setMainMode] = useState<'direct-html' | 'google-docs' | 'excel-bulk'>('direct-html');

  // Shared Optimization Options
  const [options, setOptions] = useState<HtmlOptimizeOptions>(DEFAULT_HTML_OPTIMIZE_OPTIONS);

  // --- STATE: DIRECT HTML OPTIMIZER ---
  const [directRawHtml, setDirectRawHtml] = useState<string>(SAMPLE_RAW_HTML);
  const [directResult, setDirectResult] = useState<{ html: string; stats: OptimizationStats }>(() => 
    optimizeHtml(SAMPLE_RAW_HTML, DEFAULT_HTML_OPTIMIZE_OPTIONS)
  );
  const [directViewMode, setDirectViewMode] = useState<'preview' | 'code' | 'diff'>('preview');
  const [isCopiedDirect, setIsCopiedDirect] = useState(false);

  // Auto-optimize direct HTML when options or text changes
  const handleOptimizeDirect = () => {
    const res = optimizeHtml(directRawHtml, options);
    setDirectResult(res);
    toast.success('Đã tối ưu hóa HTML thành công!');
  };

  useEffect(() => {
    if (directRawHtml) {
      const res = optimizeHtml(directRawHtml, options);
      setDirectResult(res);
    }
  }, [options]);

  const handleCopyDirect = () => {
    if (!directResult.html) return;
    navigator.clipboard.writeText(directResult.html);
    setIsCopiedDirect(true);
    toast.success('Đã sao chép mã HTML đã tối ưu!');
    setTimeout(() => setIsCopiedDirect(false), 2000);
  };

  const handleDownloadDirectHtml = () => {
    if (!directResult.html) return;
    const blob = new Blob([directResult.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimized_product_description_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống file HTML!');
  };

  // --- STATE: GOOGLE DOCS SCRAPER ---
  const [docsInputMode, setDocsInputMode] = useState<'text' | 'excel'>('text');
  const [docsTextInput, setDocsTextInput] = useState('');
  const [docItems, setDocItems] = useState<DocItem[]>([]);
  const [isProcessingDocs, setIsProcessingDocs] = useState(false);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const [activeDocItemView, setActiveDocItemView] = useState<Record<string, 'preview' | 'code' | 'raw'>>({});

  // Docs Excel state
  const [docsExcelColumns, setDocsExcelColumns] = useState<string[]>([]);
  const [docsExcelRows, setDocsExcelRows] = useState<any[]>([]);
  const [docsUrlColumn, setDocsUrlColumn] = useState('');
  const [docsSkuColumn, setDocsSkuColumn] = useState('');
  const docsFileInputRef = useRef<HTMLInputElement>(null);
  const docsAbortControllerRef = useRef<boolean>(false);

  // --- STATE: BULK EXCEL HTML CLEANER ---
  const [bulkExcelColumns, setBulkExcelColumns] = useState<string[]>([]);
  const [bulkExcelRows, setBulkExcelRows] = useState<any[]>([]);
  const [bulkHtmlColumn, setBulkHtmlColumn] = useState('');
  const [bulkSkuColumn, setBulkSkuColumn] = useState('');
  const [bulkItems, setBulkItems] = useState<ExcelBulkItem[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS: GOOGLE DOCS ---
  const handleParseDocsText = () => {
    if (!docsTextInput.trim()) {
      toast.error('Vui lòng dán danh sách link Google Docs');
      return;
    }

    const lines = docsTextInput.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: DocItem[] = [];

    lines.forEach((line, idx) => {
      let sku = `SP_${idx + 1}`;
      let url = line;

      if (line.includes('|')) {
        const parts = line.split('|');
        sku = parts[0].trim();
        url = parts[1].trim();
      } else if (line.includes('\t')) {
        const parts = line.split('\t');
        sku = parts[0].trim();
        url = parts[1].trim();
      } else if (line.includes(',')) {
        const parts = line.split(',');
        if (parts[1] && parts[1].includes('docs.google.com')) {
          sku = parts[0].trim();
          url = parts[1].trim();
        }
      }

      if (url.includes('docs.google.com') || url.includes('drive.google.com') || url.length > 20) {
        parsed.push({
          id: `doc_${Date.now()}_${idx}`,
          sku,
          url,
          status: 'idle'
        });
      }
    });

    if (parsed.length === 0) {
      toast.error('Không tìm thấy link Google Docs hợp lệ nào');
      return;
    }

    setDocItems(parsed);
    toast.success(`Đã thêm ${parsed.length} link Google Docs vào danh sách`);
  };

  const handleDocsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        if (data.length > 0) {
          const headers = (data[0] as string[]).map(h => String(h || '').trim()).filter(Boolean);
          const rows = data.slice(1);
          setDocsExcelColumns(headers);
          setDocsExcelRows(rows);

          const foundUrlCol = headers.find(h => /link|doc|google|url/i.test(h)) || headers[0] || '';
          const foundSkuCol = headers.find(h => /sku|mã|tên|product/i.test(h)) || '';

          setDocsUrlColumn(foundUrlCol);
          setDocsSkuColumn(foundSkuCol);
          toast.success(`Đã đọc ${rows.length} dòng từ file Excel`);
        }
      } catch (err: any) {
        toast.error('Lỗi khi đọc file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleApplyDocsExcel = () => {
    if (!docsUrlColumn) {
      toast.error('Vui lòng chọn cột chứa Link Google Docs');
      return;
    }

    const urlIdx = docsExcelColumns.indexOf(docsUrlColumn);
    const skuIdx = docsSkuColumn ? docsExcelColumns.indexOf(docsSkuColumn) : -1;

    const parsed: DocItem[] = [];
    docsExcelRows.forEach((row, idx) => {
      const urlVal = String(row[urlIdx] || '').trim();
      const skuVal = skuIdx >= 0 ? String(row[skuIdx] || '').trim() : `SP_${idx + 1}`;

      if (urlVal && (urlVal.includes('docs.google.com') || urlVal.length > 15)) {
        parsed.push({
          id: `excel_doc_${Date.now()}_${idx}`,
          sku: skuVal || `SP_${idx + 1}`,
          url: urlVal,
          status: 'idle'
        });
      }
    });

    if (parsed.length === 0) {
      toast.error('Không có dữ liệu hợp lệ từ các cột đã chọn');
      return;
    }

    setDocItems(parsed);
    toast.success(`Đã nạp ${parsed.length} link Google Docs từ Excel`);
  };

  const processSingleDocItem = async (item: DocItem): Promise<DocItem> => {
    try {
      const res = await fetch('/api/google-docs/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi trích xuất tài liệu Google Docs');
      }

      const docTitle = data.title || 'Tài liệu Google Docs';
      const rawText = data.rawText || '';
      const rawCleanHtml = data.rawCleanHtml || '';
      const images = data.images || [];

      // Dùng HTML Optimizer Engine để tối ưu triệt để
      const optimizeRes = optimizeHtml(rawCleanHtml || `<p>${rawText}</p>`, options);

      return {
        ...item,
        status: 'success',
        docTitle,
        rawText,
        rawCleanHtml,
        finalHtml: optimizeRes.html,
        stats: optimizeRes.stats,
        images
      };
    } catch (err: any) {
      return {
        ...item,
        status: 'error',
        errorMsg: err.message || 'Lỗi kết nối'
      };
    }
  };

  const handleStartProcessingDocs = async () => {
    if (docItems.length === 0) {
      toast.error('Danh sách trống');
      return;
    }

    setIsProcessingDocs(true);
    docsAbortControllerRef.current = false;

    setDocItems(prev => prev.map(it => ({ ...it, status: 'pending' })));

    const CONCURRENCY = 3;
    const queue = [...docItems];
    const results: DocItem[] = [...docItems];

    for (let i = 0; i < queue.length; i += CONCURRENCY) {
      if (docsAbortControllerRef.current) break;

      const batch = queue.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(item => processSingleDocItem(item))
      );

      batchResults.forEach(resItem => {
        const idx = results.findIndex(r => r.id === resItem.id);
        if (idx !== -1) {
          results[idx] = resItem;
        }
      });

      setDocItems([...results]);
    }

    setIsProcessingDocs(false);
    toast.success('Đã hoàn thành xử lý Google Docs!');
  };

  const handleStopProcessingDocs = () => {
    docsAbortControllerRef.current = true;
    setIsProcessingDocs(false);
    toast('Đã dừng tiến trình', { icon: '🛑' });
  };

  const handleExportDocsExcel = () => {
    const successItems = docItems.filter(it => it.status === 'success');
    if (successItems.length === 0) {
      toast.error('Chưa có dữ liệu hoàn thành để xuất Excel');
      return;
    }

    const exportData = docItems.map((it, idx) => ({
      'STT': idx + 1,
      'SKU / Tên SP': it.sku,
      'Link Google Doc': it.url,
      'Tiêu đề Trích xuất': it.docTitle || '',
      'Mã HTML Mô tả Đã Tối Ưu': it.finalHtml || '',
      'Dung lượng giảm (%)': it.stats ? `${it.stats.reductionPercentage}%` : 'N/A',
      'Trạng thái': it.status === 'success' ? 'Thành công' : `Lỗi (${it.errorMsg || ''})`
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HTML_Mo_Ta_Toi_Uu');

    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 45 },
      { wch: 35 },
      { wch: 60 },
      { wch: 15 },
      { wch: 15 }
    ];

    XLSX.writeFile(wb, `GoogleDocs_HTML_ToiUu_${Date.now()}.xlsx`);
    toast.success('Đã tải xuống file Excel!');
  };

  // --- HANDLERS: BULK EXCEL HTML CLEANER ---
  const handleBulkExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        if (data.length > 0) {
          const headers = (data[0] as string[]).map(h => String(h || '').trim()).filter(Boolean);
          const rows = data.slice(1);
          setBulkExcelColumns(headers);
          setBulkExcelRows(rows);

          const foundHtmlCol = headers.find(h => /html|mô tả|description|detail|nội dung/i.test(h)) || headers[0] || '';
          const foundSkuCol = headers.find(h => /sku|mã|tên|title|product/i.test(h)) || '';

          setBulkHtmlColumn(foundHtmlCol);
          setBulkSkuColumn(foundSkuCol);
          toast.success(`Đã đọc ${rows.length} dòng từ file Excel`);
        }
      } catch (err: any) {
        toast.error('Lỗi khi đọc file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStartBulkExcelOptimize = () => {
    if (!bulkHtmlColumn) {
      toast.error('Vui lòng chọn cột chứa mã HTML mô tả');
      return;
    }

    setIsProcessingBulk(true);
    const htmlIdx = bulkExcelColumns.indexOf(bulkHtmlColumn);
    const skuIdx = bulkSkuColumn ? bulkExcelColumns.indexOf(bulkSkuColumn) : -1;

    const processed: ExcelBulkItem[] = bulkExcelRows.map((row, idx) => {
      const rawHtml = String(row[htmlIdx] || '').trim();
      const skuVal = skuIdx >= 0 ? String(row[skuIdx] || '').trim() : `SP_${idx + 1}`;

      if (!rawHtml) {
        return {
          id: `bulk_${idx}`,
          sku: skuVal || `SP_${idx + 1}`,
          originalHtml: '',
          optimizedHtml: '',
          status: 'idle'
        };
      }

      const res = optimizeHtml(rawHtml, options);
      return {
        id: `bulk_${idx}`,
        sku: skuVal || `SP_${idx + 1}`,
        originalHtml: rawHtml,
        optimizedHtml: res.html,
        stats: res.stats,
        status: 'success'
      };
    });

    setBulkItems(processed);
    setIsProcessingBulk(false);
    toast.success(`Đã tối ưu hóa thành công ${processed.length} dòng HTML!`);
  };

  const handleExportBulkExcelResult = () => {
    if (bulkItems.length === 0) {
      toast.error('Chưa có dữ liệu hoàn thành để xuất');
      return;
    }

    const exportRows = bulkItems.map((item, idx) => ({
      'STT': idx + 1,
      'Mã SKU / Tên SP': item.sku,
      'HTML Đã Tối Ưu (Cleaned HTML)': item.optimizedHtml,
      'HTML Gốc (Original)': item.originalHtml,
      'Dung lượng giảm (%)': item.stats ? `${item.stats.reductionPercentage}%` : '0%',
      'Thẻ rỗng đã xóa': item.stats ? item.stats.emptyTagsRemoved : 0,
      'Thẻ Divs đã dỡ': item.stats ? item.stats.divsUnwrapped : 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HTML_Toi_Uu');

    ws['!cols'] = [
      { wch: 6 },
      { wch: 25 },
      { wch: 60 },
      { wch: 40 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 }
    ];

    XLSX.writeFile(wb, `Excel_HTML_Toi_Uu_${Date.now()}.xlsx`);
    toast.success('Đã xuất file Excel kết quả thành công!');
  };

  const docsStats = useMemo(() => {
    const total = docItems.length;
    const success = docItems.filter(i => i.status === 'success').length;
    const error = docItems.filter(i => i.status === 'error').length;
    const pending = docItems.filter(i => i.status === 'pending').length;
    const progress = total > 0 ? Math.round(((success + error) / total) * 100) : 0;
    return { total, success, error, pending, progress };
  }, [docItems]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 p-6 sm:p-8 border border-zinc-800 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Bộ Tối Ưu Hóa & Chuẩn Hóa HTML Mô Tả Chuyên Nghiệp
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-100 tracking-tight">
              Tối Ưu & Chuẩn Hóa Mã HTML Sản Phẩm
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base max-w-3xl leading-relaxed">
              Tự động dỡ bỏ các thẻ <code className="text-amber-400">&lt;div&gt;</code> lồng nhau vô nghĩa, xóa thẻ rỗng, sửa lỗi <code className="text-sky-400">&lt;h3&gt;</code> trong <code className="text-sky-400">&lt;li&gt;</code>, in đậm nhãn thuộc tính, làm sạch ảnh và định dạng chuẩn SEO cho Shopee, Tiki, Lazada, Shopify, WordPress.
            </p>
          </div>

          {/* Quick Mode Switcher */}
          <div className="flex bg-zinc-950 p-1.5 rounded-xl border border-zinc-800 text-xs font-medium self-start md:self-auto shadow-inner">
            <button
              onClick={() => setMainMode('direct-html')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                mainMode === 'direct-html' 
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-lg shadow-amber-500/20' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              Tối ưu HTML Trực tiếp
            </button>
            <button
              onClick={() => setMainMode('google-docs')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                mainMode === 'google-docs' 
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-lg shadow-amber-500/20' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              Google Docs sang HTML
            </button>
            <button
              onClick={() => setMainMode('excel-bulk')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                mainMode === 'excel-bulk' 
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-lg shadow-amber-500/20' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              File Excel Hàng Loạt
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: DIRECT HTML OPTIMIZER (Tối ưu trực tiếp đoạn mã HTML) */}
      {/* ========================================================================= */}
      {mainMode === 'direct-html' && (
        <div className="space-y-6">
          {/* Rules & Optimization Options Floating Panel */}
          <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                  Cấu hình Luật Tối Ưu Hóa (Smart Optimization Rules)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOptions(DEFAULT_HTML_OPTIMIZE_OPTIONS)}
                  className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Khôi phục mặc định
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Option 1: Unwrap Divs */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={options.unwrapDivs}
                  onChange={(e) => setOptions({ ...options, unwrapDivs: e.target.checked })}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-zinc-200 block">Dỡ bỏ thẻ Div lồng nhau</span>
                  <span className="text-[11px] text-zinc-500">Loại bỏ các lớp div thừa không có style/id</span>
                </div>
              </label>

              {/* Option 2: Remove Empty Tags */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={options.removeEmptyTags}
                  onChange={(e) => setOptions({ ...options, removeEmptyTags: e.target.checked })}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-zinc-200 block">Xóa thẻ rỗng / Thẻ lỗi</span>
                  <span className="text-[11px] text-zinc-500">Xóa &lt;p&gt;&lt;/p&gt;, &lt;img&gt; thiếu src, &lt;li&gt;&lt;/li&gt;</span>
                </div>
              </label>

              {/* Option 3: Clean Junk Styles and Attrs */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={options.cleanJunkStylesAndAttrs}
                  onChange={(e) => setOptions({ ...options, cleanJunkStylesAndAttrs: e.target.checked })}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-zinc-200 block">Lọc Style rác Docs / Word</span>
                  <span className="text-[11px] text-zinc-500">Gỡ font-family, 11pt, c0, c1... bảo toàn in đậm/nghiêng</span>
                </div>
              </label>

              {/* Option 4: Fix Headings in List */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={options.fixHeadingsInList}
                  onChange={(e) => setOptions({ ...options, fixHeadingsInList: e.target.checked })}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-zinc-200 block">Sửa Heading trong &lt;li&gt;</span>
                  <span className="text-[11px] text-zinc-500">Chuẩn W3C: đổi &lt;h3&gt; trong &lt;li&gt; thành &lt;strong&gt;</span>
                </div>
              </label>

              {/* Option: Bold Headings for Ecommerce SEO */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={options.boldHeadings}
                  onChange={(e) => setOptions({ ...options, boldHeadings: e.target.checked })}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-zinc-200 block">Bọc &lt;strong&gt; Tiêu đề (SEO TMĐT)</span>
                  <span className="text-[11px] text-zinc-500">Bọc &lt;strong&gt; trong &lt;h1-h6&gt; chuẩn Shopee/Lazada</span>
                </div>
              </label>

              {/* Option 5: Clean consecutive breaks */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={options.cleanConsecutiveBreaks}
                  onChange={(e) => setOptions({ ...options, cleanConsecutiveBreaks: e.target.checked })}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-zinc-200 block">Dọn thẻ &lt;br&gt; dư thừa</span>
                  <span className="text-[11px] text-zinc-500">Xóa br ở đầu/cuối đoạn hoặc liên tiếp</span>
                </div>
              </label>

              {/* Option 6: Image responsive */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={options.imageResponsive}
                  onChange={(e) => setOptions({ ...options, imageResponsive: e.target.checked })}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-zinc-200 block">Ảnh Responsive & Lazy</span>
                  <span className="text-[11px] text-zinc-500">Tự co giãn trên mobile, giữ nguyên alt gốc</span>
                </div>
              </label>

              {/* Option 7: Bold Key-Value */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={options.boldKeyValueLabels}
                  onChange={(e) => setOptions({ ...options, boldKeyValueLabels: e.target.checked })}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-zinc-200 block">In đậm nhãn Thuộc tính (Tùy chọn)</span>
                  <span className="text-[11px] text-zinc-500">Mặc định tắt để bảo toàn 100% chữ gốc</span>
                </div>
              </label>

              {/* Option 8: Auto Add Emoji */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={options.autoAddEmoji}
                  onChange={(e) => setOptions({ ...options, autoAddEmoji: e.target.checked })}
                  className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-semibold text-zinc-200 block">Tự động gắn Emoji (Tùy chọn)</span>
                  <span className="text-[11px] text-zinc-500">Mặc định tắt, chỉ bật khi muốn chèn icon</span>
                </div>
              </label>
            </div>

            {/* Select Dropdowns Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/80 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Chuẩn hóa thẻ Tiêu đề:</label>
                <select
                  value={options.headingStyle}
                  onChange={(e) => setOptions({ ...options, headingStyle: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200"
                >
                  <option value="keep">Giữ nguyên cấp độ thẻ gốc (Khuyên dùng)</option>
                  <option value="h3">&lt;h3&gt;Tiêu đề&lt;/h3&gt; (Đồng bộ chuẩn SEO)</option>
                  <option value="h4">&lt;h4&gt;Tiêu đề&lt;/h4&gt;</option>
                  <option value="p-strong">&lt;p&gt;&lt;strong&gt;Tiêu đề&lt;/strong&gt;&lt;/p&gt;</option>
                  <option value="p-b">&lt;p&gt;&lt;b&gt;Tiêu đề&lt;/b&gt;&lt;/p&gt;</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Định dạng mã xuất ra:</label>
                <select
                  value={options.outputFormat}
                  onChange={(e) => setOptions({ ...options, outputFormat: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200"
                >
                  <option value="beautify">✨ Thụt lề đẹp (Beautify 2 spaces)</option>
                  <option value="minify">⚡ Nén 1 dòng (Minify siêu nhẹ)</option>
                  <option value="clean-lines">📄 Chuẩn dòng phân cách</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Xử lý hình ảnh mô tả:</label>
                <select
                  value={options.imageHandling}
                  onChange={(e) => setOptions({ ...options, imageHandling: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200"
                >
                  <option value="keep-in-place">🖼️ Giữ nguyên vị trí ảnh & Responsive</option>
                  <option value="gather-at-bottom">📥 Gom toàn bộ ảnh về cuối mô tả</option>
                  <option value="remove-all">🚫 Xóa toàn bộ thẻ ảnh</option>
                </select>
              </div>
            </div>
          </div>

          {/* Side-by-Side Editor & Optimizer Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Box: Raw HTML Input */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-5 space-y-4 shadow-xl flex flex-col h-full">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                      Mã HTML Gốc (Chưa tối ưu)
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setDirectRawHtml(SAMPLE_RAW_HTML);
                      toast.success('Đã nạp đoạn mã mẫu ví dụ');
                    }}
                    className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Nạp mẫu thử Panasonic
                  </button>
                </div>

                <div className="flex-1 relative">
                  <textarea
                    rows={18}
                    value={directRawHtml}
                    onChange={(e) => setDirectRawHtml(e.target.value)}
                    placeholder="Dán đoạn mã HTML gốc vào đây..."
                    className="w-full h-full min-h-[420px] bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-200 font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors custom-scrollbar leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-zinc-500 font-mono">
                    {directRawHtml.length} ký tự
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDirectRawHtml('')}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                    >
                      Xóa trắng
                    </button>
                    <Button
                      onClick={handleOptimizeDirect}
                      className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs px-4 py-2 rounded-lg shadow-lg shadow-amber-500/10 flex items-center gap-1.5"
                    >
                      <Wand2 className="w-4 h-4" />
                      Tối ưu hóa ngay
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Box: Optimized Result & Live Preview */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-5 space-y-4 shadow-xl flex flex-col h-full">
                {/* Result Header & View Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                      Kết quả Đã Tối Ưu
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Switcher */}
                    <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                      <button
                        onClick={() => setDirectViewMode('preview')}
                        className={`px-3 py-1 rounded flex items-center gap-1.5 transition-colors ${
                          directViewMode === 'preview' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                        Giao diện
                      </button>
                      <button
                        onClick={() => setDirectViewMode('code')}
                        className={`px-3 py-1 rounded flex items-center gap-1.5 transition-colors ${
                          directViewMode === 'code' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Code className="w-3.5 h-3.5 text-emerald-400" />
                        Mã HTML
                      </button>
                    </div>

                    <Button
                      onClick={handleCopyDirect}
                      className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
                    >
                      {isCopiedDirect ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {isCopiedDirect ? 'Đã sao chép' : 'Sao chép HTML'}
                    </Button>

                    <button
                      onClick={handleDownloadDirectHtml}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      title="Tải file .html"
                    >
                      <DownloadCloud className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Badges / Stats Bar */}
                {directResult.stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5 text-center">
                      <span className="text-zinc-500 block text-[10px]">Dung lượng giảm</span>
                      <span className="text-emerald-400 font-bold font-mono text-sm">
                        -{directResult.stats.reductionPercentage}%
                      </span>
                    </div>
                    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5 text-center">
                      <span className="text-zinc-500 block text-[10px]">Thẻ rỗng đã xóa</span>
                      <span className="text-amber-400 font-bold font-mono text-sm">
                        {directResult.stats.emptyTagsRemoved} thẻ
                      </span>
                    </div>
                    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5 text-center">
                      <span className="text-zinc-500 block text-[10px]">Thẻ Div đã dỡ</span>
                      <span className="text-sky-400 font-bold font-mono text-sm">
                        {directResult.stats.divsUnwrapped} divs
                      </span>
                    </div>
                    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5 text-center">
                      <span className="text-zinc-500 block text-[10px]">Heading trong Li đã sửa</span>
                      <span className="text-purple-400 font-bold font-mono text-sm">
                        {directResult.stats.headingsFixedInList} mục
                      </span>
                    </div>
                  </div>
                )}

                {/* Display Output Body */}
                <div className="flex-1 min-h-[380px] bg-zinc-950 rounded-xl border border-zinc-800 p-4 overflow-hidden relative">
                  {directViewMode === 'preview' ? (
                    <div 
                      className="prose prose-invert prose-sm max-w-none text-zinc-200 leading-relaxed text-xs max-h-[480px] overflow-y-auto custom-scrollbar pr-2 [&_h3]:text-amber-400 [&_h3]:font-bold [&_h3]:text-sm [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h2]:text-amber-400 [&_h2]:font-bold [&_h2]:text-sm [&_h2]:mt-4 [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1 [&_p]:my-1.5 [&_img]:rounded-lg [&_img]:my-2"
                      dangerouslySetInnerHTML={{ __html: directResult.html }}
                    />
                  ) : (
                    <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap break-all max-h-[480px] overflow-y-auto custom-scrollbar select-all leading-relaxed">
                      {directResult.html}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: GOOGLE DOCS TO HTML (Đọc từ danh sách link Docs / Excel Docs) */}
      {/* ========================================================================= */}
      {mainMode === 'google-docs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input Panel & Settings */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-5 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  1. Nhập Danh sách Google Docs
                </h2>
                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs font-medium">
                  <button
                    onClick={() => setDocsInputMode('text')}
                    className={`px-3 py-1 rounded-md transition-colors ${docsInputMode === 'text' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Dán Links
                  </button>
                  <button
                    onClick={() => setDocsInputMode('excel')}
                    className={`px-3 py-1 rounded-md transition-colors ${docsInputMode === 'excel' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    File Excel
                  </button>
                </div>
              </div>

              {docsInputMode === 'text' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Mỗi dòng 1 link (hoặc <code className="text-amber-400">Mã_SKU | Link_Docs</code>)</span>
                    <button 
                      onClick={() => setDocsTextInput(SAMPLE_DOCS_INPUT)}
                      className="text-sky-400 hover:underline flex items-center gap-1"
                    >
                      Dán mẫu thử
                    </button>
                  </div>
                  <textarea
                    rows={7}
                    placeholder={`Mẫu 1: https://docs.google.com/document/d/...\nMẫu 2: SKU001 | https://docs.google.com/document/d/...`}
                    value={docsTextInput}
                    onChange={(e) => setDocsTextInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-200 font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors custom-scrollbar"
                  />
                  <Button 
                    onClick={handleParseDocsText}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-sm py-2.5 rounded-xl shadow-lg shadow-amber-500/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm vào danh sách chờ
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div 
                    onClick={() => docsFileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-zinc-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-xs font-medium text-zinc-300">Click để chọn file Excel (.xlsx, .xls, .csv)</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Hệ thống sẽ tự động đọc các cột dữ liệu</p>
                    <input 
                      ref={docsFileInputRef}
                      type="file" 
                      accept=".xlsx,.xls,.csv" 
                      onChange={handleDocsFileUpload} 
                      className="hidden" 
                    />
                  </div>

                  {docsExcelColumns.length > 0 && (
                    <div className="space-y-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs">
                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">Cột chứa Link Google Docs (*):</label>
                        <select 
                          value={docsUrlColumn} 
                          onChange={(e) => setDocsUrlColumn(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
                        >
                          <option value="">-- Chọn cột --</option>
                          {docsExcelColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">Cột chứa Mã SKU / Tên SP (Tùy chọn):</label>
                        <select 
                          value={docsSkuColumn} 
                          onChange={(e) => setDocsSkuColumn(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200"
                        >
                          <option value="">-- Không chọn (Tự đánh số) --</option>
                          {docsExcelColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>

                      <Button 
                        onClick={handleApplyDocsExcel}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-xs py-2 rounded-lg"
                      >
                        Nạp {docsExcelRows.length} dòng từ Excel
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Execution Queue & Preview Results */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-400" />
                    Danh sách Google Docs ({docItems.length})
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Xử lý song song bóc tách nội dung & tự động tối ưu hóa mã HTML
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isProcessingDocs ? (
                    <Button
                      onClick={handleStopProcessingDocs}
                      className="bg-red-500 hover:bg-red-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
                    >
                      <StopCircle className="w-4 h-4" />
                      Dừng
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStartProcessingDocs}
                      disabled={docItems.length === 0}
                      className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Bắt đầu Xử lý ({docItems.length})
                    </Button>
                  )}

                  {docItems.length > 0 && !isProcessingDocs && (
                    <button
                      onClick={() => setDocItems([])}
                      className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Xóa danh sách"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {docItems.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>Tiến trình: {docsStats.success + docsStats.error} / {docsStats.total} ({docsStats.progress}%)</span>
                    <div className="flex gap-3">
                      <span className="text-emerald-400">Thành công: {docsStats.success}</span>
                      {docsStats.error > 0 && <span className="text-red-400">Lỗi: {docsStats.error}</span>}
                    </div>
                  </div>
                  <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${docsStats.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {docsStats.success > 0 && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={handleExportDocsExcel}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Xuất File Excel Kết Quả ({docsStats.success})
                  </Button>
                </div>
              )}
            </div>

            {/* Doc Items Feed */}
            {docItems.length === 0 ? (
              <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800/80 p-12 text-center space-y-3">
                <FileText className="w-12 h-12 text-zinc-600 mx-auto" />
                <h3 className="text-zinc-300 font-medium">Chưa có link Google Docs</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Dán link Google Docs hoặc tải file Excel để trích xuất HTML sạch chuẩn SEO.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                {docItems.map((item, idx) => {
                  const currentView = activeDocItemView[item.id] || 'preview';

                  return (
                    <div 
                      key={item.id} 
                      className={`bg-zinc-900/90 rounded-2xl border transition-all duration-200 p-5 space-y-4 ${
                        item.status === 'success' ? 'border-zinc-800' :
                        item.status === 'error' ? 'border-red-500/40 bg-red-950/10' :
                        item.status === 'pending' ? 'border-amber-500/40' : 'border-zinc-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              #{idx + 1} | {item.sku}
                            </span>
                            {item.status === 'success' && (
                              <span className="text-[11px] text-emerald-400 font-medium">✓ Đã tối ưu</span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-zinc-100 truncate">
                            {item.docTitle || item.sku}
                          </h4>
                        </div>

                        {item.status === 'success' && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-[11px]">
                              <button
                                onClick={() => setActiveDocItemView({ ...activeDocItemView, [item.id]: 'preview' })}
                                className={`px-2.5 py-1 rounded ${currentView === 'preview' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400'}`}
                              >
                                Xem trước
                              </button>
                              <button
                                onClick={() => setActiveDocItemView({ ...activeDocItemView, [item.id]: 'code' })}
                                className={`px-2.5 py-1 rounded ${currentView === 'code' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400'}`}
                              >
                                Mã HTML
                              </button>
                            </div>

                            <Button
                              onClick={() => {
                                if (item.finalHtml) {
                                  navigator.clipboard.writeText(item.finalHtml);
                                  setCopiedDocId(item.id);
                                  toast.success('Đã sao chép HTML');
                                  setTimeout(() => setCopiedDocId(null), 2000);
                                }
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                            >
                              {copiedDocId === item.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedDocId === item.id ? 'Đã chép' : 'Sao chép'}
                            </Button>
                          </div>
                        )}
                      </div>

                      {item.status === 'success' && item.finalHtml && (
                        <div className="bg-zinc-950 rounded-xl border border-zinc-800/80 p-4 overflow-hidden">
                          {currentView === 'preview' ? (
                            <div 
                              className="prose prose-invert prose-sm max-w-none text-zinc-200 text-xs [&_h3]:text-amber-400 [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5"
                              dangerouslySetInnerHTML={{ __html: item.finalHtml }}
                            />
                          ) : (
                            <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap break-all max-h-60 overflow-y-auto custom-scrollbar">
                              {item.finalHtml}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: BULK EXCEL HTML CLEANER (Tối ưu file Excel chứa cột HTML) */}
      {/* ========================================================================= */}
      {mainMode === 'excel-bulk' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-6 space-y-6 shadow-xl">
            <div className="border-b border-zinc-800/80 pb-4">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Tối Ưu Hàng Loạt Cột HTML Từ File Excel
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Tải lên file Excel chứa hàng trăm sản phẩm có cột mô tả HTML thô. Hệ thống sẽ dọn sạch toàn bộ thẻ rỗng, unwrap div lồng nhau và trả về file Excel mới đã tối ưu.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                onClick={() => bulkFileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-950/60 rounded-2xl p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center min-h-[180px]"
              >
                <FileSpreadsheet className="w-10 h-10 text-emerald-400 mb-3" />
                <p className="text-sm font-semibold text-zinc-200">Click để chọn file Excel (.xlsx, .xls, .csv)</p>
                <p className="text-xs text-zinc-500 mt-1">Hỗ trợ file xuất từ Shopee, Lazada, Tiki, Shopify, Haravan</p>
                <input 
                  ref={bulkFileInputRef}
                  type="file" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleBulkExcelUpload} 
                  className="hidden" 
                />
              </div>

              {bulkExcelColumns.length > 0 && (
                <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-4 text-xs">
                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1.5">
                      Cột chứa nội dung HTML cần tối ưu (*):
                    </label>
                    <select
                      value={bulkHtmlColumn}
                      onChange={(e) => setBulkHtmlColumn(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-zinc-200 text-xs font-medium"
                    >
                      <option value="">-- Chọn cột HTML --</option>
                      {bulkExcelColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1.5">
                      Cột SKU / Tên sản phẩm (Tùy chọn):
                    </label>
                    <select
                      value={bulkSkuColumn}
                      onChange={(e) => setBulkSkuColumn(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-zinc-200 text-xs font-medium"
                    >
                      <option value="">-- Không chọn (Tự đánh số) --</option>
                      {bulkExcelColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <Button
                    onClick={handleStartBulkExcelOptimize}
                    disabled={isProcessingBulk || !bulkHtmlColumn}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs py-3 rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" />
                    Tối ưu hóa toàn bộ {bulkExcelRows.length} dòng dữ liệu
                  </Button>
                </div>
              )}
            </div>

            {/* Bulk Results Table */}
            {bulkItems.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-zinc-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold text-zinc-200">
                    Đã xử lý xong: <span className="text-emerald-400">{bulkItems.length} sản phẩm</span>
                  </span>
                  <Button
                    onClick={handleExportBulkExcelResult}
                    className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    Tải file Excel đã Tối Ưu (.xlsx)
                  </Button>
                </div>

                <div className="overflow-x-auto border border-zinc-800 rounded-xl max-h-96 custom-scrollbar">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800 sticky top-0">
                      <tr>
                        <th className="p-3 w-12">#</th>
                        <th className="p-3 w-40">Mã SKU</th>
                        <th className="p-3 w-28 text-center">Giảm dung lượng</th>
                        <th className="p-3 w-28 text-center">Thẻ rỗng xóa</th>
                        <th className="p-3">Xem trước HTML Đã Tối Ưu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
                      {bulkItems.slice(0, 50).map((item, idx) => (
                        <tr key={item.id} className="hover:bg-zinc-800/30">
                          <td className="p-3 font-mono text-zinc-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-medium text-amber-400">{item.sku}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-400">
                            {item.stats ? `-${item.stats.reductionPercentage}%` : '0%'}
                          </td>
                          <td className="p-3 text-center font-mono text-amber-400">
                            {item.stats ? item.stats.emptyTagsRemoved : 0}
                          </td>
                          <td className="p-3 font-mono text-zinc-400 text-[11px] truncate max-w-md">
                            {item.optimizedHtml}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleDocsToHtmlTab;
