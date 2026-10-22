import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { 
  Upload, FileSpreadsheet, RefreshCw, Download, Copy, Check, Filter, 
  Search, Trash2, Database, TrendingUp, Layers, CheckCircle2, 
  Calendar, Info, AlertTriangle, ArrowUpRight, BarChart3, PieChart as PieChartIcon,
  ListFilter, Sparkles, Hash, ArrowRight, Play, Presentation,
  History, Clock, Eye, ChevronDown, ChevronUp, Globe, Share2, CloudUpload, Cloud
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  getSkuDB, 
  calculateReportStats, 
  getAvailablePeriods, 
  getTotalSkuCount, 
  clearSkuMasterDB, 
  exportReportToExcel, 
  parseRawSheetRows,
  generateSampleData,
  upsertSkuRecords,
  getUploadBatches,
  deleteUploadBatch,
  UploadBatch,
  ReportStats, 
  ReportFilterOptions,
  SkuRecord,
  CANONICAL_CATEGORIES
} from '../../services/skuReportService';
import { exportReportToPPT } from '../../services/pptReportService';
import { exportReportToStandaloneHtml } from '../../services/htmlReportService';

const DONUT_COLORS = [
  '#3b82f6', // Thời trang (Blue)
  '#06b6d4', // Nhà cửa & đời sống (Cyan)
  '#f97316', // Điện gia dụng (Orange)
  '#10b981', // Đồ công nghệ (ICT) (Emerald)
  '#f59e0b', // Sức khỏe và Làm đẹp (Amber)
  '#6366f1', // Mẹ và Bé (Indigo)
  '#ec4899', // Bách hóa online (Pink)
  '#f43f5e', // Thể thao & dã ngoại (Rose)
  '#8b5cf6', // Sách, Văn phòng phẩm (Purple)
  '#14b8a6', // Dịch vụ (Teal)
  '#64748b'  // Khác (Slate)
];

const SkuReportTab: React.FC = () => {
  // State quản lý thống kê & lọc
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<{ key: string; label: string; count: number }[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [customPeriodTitle, setCustomPeriodTitle] = useState<string>('Tuần 4 09.26');
  const [totalDatabaseSkus, setTotalDatabaseSkus] = useState<number>(0);
  const [totalBatchesCount, setTotalBatchesCount] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);

  // Chế độ lọc tập dữ liệu "Mới trong kỳ"
  const [filterMode, setFilterMode] = useState<'period' | 'custom-row-count' | 'custom-row-range' | 'auto-batch' | 'batch'>('period');
  const [rowCountInput, setRowCountInput] = useState<number>(1440);
  const [rangeStartInput, setRangeStartInput] = useState<number>(1);
  const [rangeEndInput, setRangeEndInput] = useState<number>(1440);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [uploadBatches, setUploadBatches] = useState<UploadBatch[]>([]);
  const [showBatchHistory, setShowBatchHistory] = useState<boolean>(true);

  // Trạng thái kiểm soát hiển thị báo cáo: chỉ hiện khi người dùng ấn Áp dụng hoặc Tích chọn hàng mới
  const [hasAppliedReport, setHasAppliedReport] = useState<boolean>(false);
  const [showDetailedDataTable, setShowDetailedDataTable] = useState<boolean>(false);
  const [newBatchPreviewRecords, setNewBatchPreviewRecords] = useState<SkuRecord[]>([]);
  const [previewFilterOnlyNew, setPreviewFilterOnlyNew] = useState<boolean>(true);
  const [showUploadPreview, setShowUploadPreview] = useState<boolean>(false);

  // State Xuất bản Public (Cloud Sync cho người khác cùng xem)
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishedInfo, setPublishedInfo] = useState<{ id: string; publishedAt: string; periodTitle?: string } | null>(null);
  const [isViewingPublicCloud, setIsViewingPublicCloud] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [isLinkCopied, setIsLinkCopied] = useState<boolean>(false);

  // Lấy đường dẫn Web độc lập để người xem mở thẳng mà không bị vào AI Studio
  const getStandaloneShareableUrl = () => {
    if (typeof window === 'undefined') return '';
    let origin = window.location.origin;
    // Tự động chuyển link dev runner sang link public viewer
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return `${origin}/?tab=sku-report`;
  };

  // State upload file
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [batchNameInput, setBatchNameInput] = useState<string>('Dữ liệu đợt mới');
  const [lastUploadResult, setLastUploadResult] = useState<{ total: number; newCount: number; updatedCount: number } | null>(null);

  // State danh sách dữ liệu chi tiết
  const [detailedList, setDetailedList] = useState<SkuRecord[]>([]);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'single' | 'variant'>('all');
  const [viewLayout, setViewLayout] = useState<'flat' | 'grouped'>('flat');
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  const toggleExpandProduct = (pid: string) => {
    setExpandedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  // Nạp danh sách các đợt nạp file thô
  const loadBatchesList = async () => {
    try {
      const list = await getUploadBatches();
      setUploadBatches(list);
      setTotalBatchesCount(list.length);
      return list;
    } catch (e) {
      console.error('Lỗi nạp danh sách đợt:', e);
      return [];
    }
  };

  // Chọn nhanh một đợt nạp từ lịch sử để xem báo cáo
  const handleSelectBatch = async (batch: UploadBatch) => {
    setSelectedBatchId(batch.id);
    setFilterMode('batch');
    setCustomPeriodTitle(batch.name);
    setHasAppliedReport(true);
    await loadDataWithFilter({ filterMode: 'batch', batchId: batch.id });
    toast.success(`Đang xem báo cáo của đợt: "${batch.name}"`);
  };

  // Áp dụng báo cáo riêng cho các SKU MỚI vừa upload (Yêu cầu 2)
  const handleApplyOnlyNewBatchSkus = async () => {
    setFilterMode('auto-batch');
    setCustomPeriodTitle(lastUploadResult ? `Hàng mới (+${lastUploadResult.newCount.toLocaleString()} SKU)` : 'Hàng mới');
    setHasAppliedReport(true);
    await loadDataWithFilter({ filterMode: 'auto-batch' });
    toast.success('Đã áp dụng báo cáo cho toàn bộ SKU Mới trong file!');
  };

  // Danh sách dòng xem trước so khớp file mới
  const displayedPreviewRows = useMemo(() => {
    if (previewFilterOnlyNew) {
      return newBatchPreviewRecords.filter(r => r.isNewInBatch);
    }
    return newBatchPreviewRecords;
  }, [newBatchPreviewRecords, previewFilterOnlyNew]);

  // Xóa một đợt nạp khỏi lịch sử
  const handleDeleteBatch = async (batchId: string, batchName: string) => {
    try {
      await deleteUploadBatch(batchId);
      toast.success(`Đã xóa đợt nạp "${batchName}" khỏi lịch sử.`);
      const remaining = await loadBatchesList();
      if (remaining.length > 0) {
        await loadDataWithFilter({ filterMode: 'period', periodKey: remaining[0].periodKey });
      } else {
        await loadDataWithFilter({ filterMode: 'period', periodKey: '2026-09' });
      }
    } catch (err: any) {
      console.error('Lỗi xóa đợt nạp:', err);
      toast.error('Lỗi khi xóa đợt nạp: ' + (err.message || err));
    }
  };

  // Copy status
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hàm load thống kê cốt lõi
  const loadDataWithFilter = async (opts: ReportFilterOptions) => {
    try {
      setIsLoadingStats(true);
      const db = await getSkuDB();
      const total = await getTotalSkuCount();

      if (total === 0) {
        // Khi người xem ở máy tính khác (chưa có local DB):
        // Nạp và duy trì dữ liệu từ Cloud Server để không bao giờ bị xóa trắng khi ấn Áp dụng!
        try {
          const res = await fetch('/api/sku-report/public-latest');
          if (res.ok) {
            const data = await res.json();
            if (data && data.stats) {
              setStats(data.stats);
              if (data.periodTitle) setCustomPeriodTitle(data.periodTitle);
              if (data.uploadBatches) setUploadBatches(data.uploadBatches);
              if (data.availablePeriods) setAvailablePeriods(data.availablePeriods);
              if (data.totalDatabaseSkus) setTotalDatabaseSkus(data.totalDatabaseSkus);
              else if (data.stats?.allTime?.totalSkus) setTotalDatabaseSkus(data.stats.allTime.totalSkus);
              if (data.detailedSample && data.detailedSample.length > 0) {
                setDetailedList(data.detailedSample);
              }
              setIsViewingPublicCloud(true);
              setHasAppliedReport(true);
              toast.success('Đã áp dụng báo cáo từ Cloud!');
              return;
            }
          }
        } catch (cloudErr) {
          console.warn('Không thể tải từ cloud:', cloudErr);
        }

        // Nếu cả cloud và local đều chưa có dữ liệu:
        setTotalDatabaseSkus(0);
        setTotalBatchesCount(0);
        setAvailablePeriods([]);
        return;
      }

      setTotalDatabaseSkus(total);
      setIsViewingPublicCloud(false);

      const batches = await db.getAll('batches');
      setTotalBatchesCount(batches.length);

      const periods = await getAvailablePeriods();
      setAvailablePeriods(periods);

      // Tính toán thống kê theo bộ lọc được chọn
      const reportStats = await calculateReportStats(opts);
      setStats(reportStats);

      // Lấy danh sách SKU tương ứng để hiển thị trong bảng
      const allSkus = await db.getAll('skus');
      let displaySkus: SkuRecord[] = [];

      if (opts.filterMode === 'auto-batch') {
        const newSkus = allSkus.filter(s => s.isNewInBatch);
        displaySkus = newSkus.length > 0 ? newSkus : allSkus;
      } else if (opts.filterMode === 'batch') {
        const batchSkus = allSkus.filter(s => s.batchId === opts.batchId);
        displaySkus = batchSkus.length > 0 ? batchSkus : allSkus;
      } else if (opts.filterMode === 'custom-row-count') {
        const sorted = [...allSkus].sort((a, b) => (a.originalRowIndex || 0) - (b.originalRowIndex || 0));
        displaySkus = sorted.slice(0, Math.max(1, opts.rowCount || 1440));
      } else if (opts.filterMode === 'custom-row-range') {
        const sorted = [...allSkus].sort((a, b) => (a.originalRowIndex || 0) - (b.originalRowIndex || 0));
        const s = Math.max(1, opts.rowRangeStart || 1);
        const e = Math.max(s, opts.rowRangeEnd || allSkus.length);
        displaySkus = sorted.slice(s - 1, e);
      } else {
        const pKey = opts.periodKey || (periods[0]?.key || '2026-09');
        displaySkus = allSkus.filter(s => s.creationYearMonth === pKey);
      }

      setDetailedList(displaySkus.length > 0 ? displaySkus : allSkus);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Lỗi tính toán báo cáo:', err);
      toast.error('Lỗi khi nạp dữ liệu: ' + err.message);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Khởi tạo ban đầu
  useEffect(() => {
    (async () => {
      const batches = await loadBatchesList();
      const periods = await getAvailablePeriods();

      // Nếu đã có nhiều đợt nạp trong máy (từ lần 2 trở đi): tự động kích hoạt chế độ auto-batch
      if (batches.length >= 2) {
        setFilterMode('auto-batch');
        loadDataWithFilter({ filterMode: 'auto-batch' });
      } else if (periods.length > 0) {
        setSelectedPeriod(periods[0].key);
        setFilterMode('period');
        loadDataWithFilter({ filterMode: 'period', periodKey: periods[0].key });
      } else {
        // Kiểm tra xem trên Cloud Server có báo cáo Public nào do Admin xuất bản không
        try {
          const res = await fetch('/api/sku-report/public-latest');
          if (res.ok) {
            const data = await res.json();
            if (data && data.stats) {
              setStats(data.stats);
              if (data.periodTitle) setCustomPeriodTitle(data.periodTitle);
              if (data.uploadBatches) setUploadBatches(data.uploadBatches);
              if (data.detailedSample && data.detailedSample.length > 0) {
                setDetailedList(data.detailedSample);
              }
              setPublishedInfo({ id: data.id, publishedAt: data.publishedAt, periodTitle: data.periodTitle });
              setIsViewingPublicCloud(true);
              setHasAppliedReport(true);
              return;
            }
          }
        } catch (_) {
          // Bỏ qua nếu chưa có
        }

        setSelectedPeriod('2026-09');
        loadDataWithFilter({ filterMode: 'period', periodKey: '2026-09' });
      }
    })();
  }, []);

  // Áp dụng bộ lọc người dùng chọn
  const handleApplyFilter = () => {
    setHasAppliedReport(true);
    if (filterMode === 'period') {
      loadDataWithFilter({ filterMode: 'period', periodKey: selectedPeriod });
    } else if (filterMode === 'batch') {
      loadDataWithFilter({ filterMode: 'batch', batchId: selectedBatchId });
    } else if (filterMode === 'custom-row-count') {
      loadDataWithFilter({ filterMode: 'custom-row-count', rowCount: Number(rowCountInput) });
    } else if (filterMode === 'custom-row-range') {
      loadDataWithFilter({ filterMode: 'custom-row-range', rowRangeStart: Number(rangeStartInput), rowRangeEnd: Number(rangeEndInput) });
    } else if (filterMode === 'auto-batch') {
      loadDataWithFilter({ filterMode: 'auto-batch' });
    }
  };

  // State xác nhận xóa database (Hỗ trợ cả inline ngay trên nút và modal an toàn)
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showInlineResetConfirm, setShowInlineResetConfirm] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Xử lý nạp File (Excel / CSV) - Trực tiếp & Tin cậy 100% trong môi trường iFrame
  const processUploadedFile = async (file: File) => {
    if (!file) return;

    const fileName = file.name;
    const isCSV = fileName.toLowerCase().endsWith('.csv');
    const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');

    if (!isCSV && !isExcel) {
      toast.error('Vui lòng chọn file Excel (.xlsx, .xls) hoặc file .csv');
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setUploadMessage('Đang nạp file vào bộ nhớ...');
    setLastUploadResult(null);

    try {
      let rows: any[][] = [];

      if (isCSV) {
        const text = await file.text();
        const Papa = (await import('papaparse')).default;
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        rows = parsed.data as any[][];
      } else {
        const arrayBuf = await file.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuf, { type: 'array', cellDates: false });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('File Excel không có dữ liệu sheet.');
        }
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      }

      setUploadProgress(45);
      setUploadMessage(`Đang nhận diện sản phẩm đơn & biến thể (${(rows.length - 1).toLocaleString()} dòng)...`);

      const batchId = `batch_${Date.now()}`;
      const bName = batchNameInput.trim() || `Đợt ${new Date().toLocaleDateString('vi-VN')}`;

      // Phân tích cấu trúc sản phẩm cha & con và cột Tháng/Năm (YYYY-MM)
      const records = parseRawSheetRows(rows, batchId, bName);

      setUploadProgress(75);
      setUploadMessage(`Đang ghi nhận ${records.length.toLocaleString()} SKU vào kho dữ liệu...`);

      const firstSkuPeriod = records[0]?.monthYear || records[0]?.creationYearMonth || '2026-09';
      const result = await upsertSkuRecords(
        records,
        { id: batchId, name: bName, periodKey: firstSkuPeriod, fileName },
        (proc, tot) => {
          setUploadProgress(75 + Math.floor((proc / tot) * 23));
        }
      );

      setLastUploadResult(result);
      setNewBatchPreviewRecords(result.allBatchRecords);
      setShowUploadPreview(true);

      const allBatches = await loadBatchesList();
      const total = await getTotalSkuCount();
      setTotalDatabaseSkus(total);

      // YÊU CẦU 1 & 2: Chưa tự động hiển thị các bảng báo cáo ra ngay
      setHasAppliedReport(false);

      if (allBatches.length >= 2) {
        setFilterMode('auto-batch');
      } else {
        setFilterMode('period');
        setSelectedPeriod(firstSkuPeriod);
      }
      toast.success(`Đã nạp xong: +${result.newCount.toLocaleString()} SKU mới, cập nhật ${result.updatedCount.toLocaleString()} SKU cũ! Vui lòng chọn phạm vi hoặc tích chọn hàng mới rồi ấn Áp dụng.`);
    } catch (err: any) {
      console.error('Lỗi nạp file:', err);
      toast.error('Lỗi khi nạp file: ' + err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  // Nạp dữ liệu mẫu STT 38-55 mô phỏng chính xác ảnh người dùng gửi
  const handleLoadSampleData = async () => {
    try {
      setIsUploading(true);
      setUploadProgress(40);
      setUploadMessage('Đang nạp dữ liệu mẫu STT 38-55 từ ảnh...');

      const sample = generateSampleData();
      const batchId = sample[0].batchId;
      const bName = sample[0].batchName;

      const result = await upsertSkuRecords(
        sample,
        { id: batchId, name: bName, periodKey: '2026-09', fileName: 'Mau_STT_38_55.xlsx' }
      );

      setLastUploadResult(result);
      setNewBatchPreviewRecords(result.allBatchRecords);
      setShowUploadPreview(true);
      setHasAppliedReport(false);
      await loadBatchesList();
      const total = await getTotalSkuCount();
      setTotalDatabaseSkus(total);
      toast.success(`Đã nạp dữ liệu mẫu: +${result.newCount} SKU mới! Bấm "Áp Dụng Cho Báo Cáo" để xem kết quả.`);
    } catch (e: any) {
      toast.error('Lỗi nạp mẫu: ' + e.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  // Tự động sinh nội dung nhận xét báo cáo chuẩn mẫu Ảnh 6
  const generatedReportRemarks = useMemo(() => {
    if (!stats) return '';
    const p = stats.newPeriod;
    const periodName = customPeriodTitle.trim() || stats.periodLabel;
    const topCatName = p.topCategory?.name || 'Thời trang';
    const topCatProducts = p.topCategory?.products || 0;
    const topCatSkus = p.topCategory?.skus || 0;
    const topBrandName = p.topBrand?.name || 'N/A';
    const topBrandCat = p.topBrand?.category || topCatName;
    const topBrandSkus = p.topBrand?.skus || 0;

    return `• Tổng số lượng sản phẩm onsite mới trên VnShop ${periodName} đạt ${p.totalProducts.toLocaleString()} sản phẩm (${p.totalSkus.toLocaleString()} SKUs). Số lượng SKU hàng bán hiệu lực đạt ${p.totalSkus.toLocaleString()} SKUs, trong đó số lượng SKU có tồn/hoạt động chiếm hơn ${p.activeRatio}% (${p.activeSkus.toLocaleString()} SKUs)
• Sản phẩm onsite nhiều nhất thuộc ngành hàng ${topCatName} với ${topCatProducts.toLocaleString()} sản phẩm (${topCatSkus.toLocaleString()} SKU), trong đó thương hiệu có số lượng SKU onsite nhiều nhất là ${topBrandName} (ngành hàng ${topBrandCat}) với ${topBrandSkus.toLocaleString()} SKU
• Trong kỳ ghi nhận ${p.brandsCount} thương hiệu có sản phẩm/SKU mới onsite.`;
  }, [stats, customPeriodTitle]);

  // Copy nhận xét vào clipboard
  const handleCopyRemarks = () => {
    if (!generatedReportRemarks) return;
    navigator.clipboard.writeText(generatedReportRemarks).then(() => {
      setIsCopied(true);
      toast.success('Đã sao chép nội dung nhận xét vào clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  // Xuất file Excel báo cáo hoàn chỉnh
  const handleExportExcel = () => {
    if (!stats) {
      toast.error('Chưa có dữ liệu báo cáo để xuất.');
      return;
    }
    exportReportToExcel(stats, detailedList);
    toast.success('Đang tạo và tải file Excel báo cáo...');
  };

  // Xuất bài thuyết trình PowerPoint (.pptx) báo cáo hoàn chỉnh
  const [isExportingPPT, setIsExportingPPT] = useState<boolean>(false);
  const handleExportPPT = async () => {
    if (!stats) {
      toast.error('Chưa có dữ liệu báo cáo để xuất PowerPoint.');
      return;
    }
    try {
      setIsExportingPPT(true);
      toast.loading('Đang khởi tạo bài thuyết trình PowerPoint (.pptx)...', { id: 'export-ppt' });
      await exportReportToPPT(stats, detailedList, {
        periodTitle: customPeriodTitle,
        company: 'VnShop',
        author: 'Trợ lý Báo cáo SKU'
      });
      toast.success('Đã xuất file PowerPoint (.pptx) thành công!', { id: 'export-ppt' });
    } catch (err: any) {
      console.error('Lỗi xuất PowerPoint:', err);
      toast.error('Lỗi xuất file PowerPoint: ' + (err.message || err), { id: 'export-ppt' });
    } finally {
      setIsExportingPPT(false);
    }
  };

  // Xuất file Báo cáo HTML Độc lập (.html) - Tự chạy trên mọi thiết bị offline
  const handleExportHtml = () => {
    if (!stats) {
      toast.error('Chưa có dữ liệu báo cáo để xuất HTML.');
      return;
    }
    try {
      exportReportToStandaloneHtml(stats, detailedList, {
        periodTitle: customPeriodTitle || stats.periodLabel,
        company: 'VnShop',
        author: 'Trợ lý Báo cáo SKU'
      });
      toast.success('Đã tải xuống file Báo cáo HTML Độc lập (.html)! Người nhận có thể mở xem trực tiếp mà không cần internet hay tài khoản.');
    } catch (err: any) {
      console.error('Lỗi xuất HTML:', err);
      toast.error('Lỗi xuất file HTML: ' + err.message);
    }
  };

  // Xuất bản Báo cáo lên Server Cloud để mọi người cùng vào xem
  const handlePublishPublicReport = async () => {
    if (!stats) {
      toast.error('Chưa có dữ liệu báo cáo để xuất bản. Vui lòng bấm "Áp Dụng Cho Báo Cáo" trước.');
      return;
    }
    try {
      setIsPublishing(true);
      toast.loading('Đang đồng bộ báo cáo lên Cloud Server...', { id: 'publish-report' });
      
      const payload = {
        id: `report_${Date.now()}`,
        periodTitle: customPeriodTitle.trim() || stats.periodLabel,
        publishedAt: new Date().toISOString(),
        publishedBy: 'Admin',
        stats,
        remarks: generatedReportRemarks,
        uploadBatches,
        availablePeriods,
        totalDatabaseSkus,
        totalBatchesCount,
        detailedSample: detailedList.slice(0, 300),
      };

      const res = await fetch('/api/sku-report/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Máy chủ phản hồi lỗi khi lưu báo cáo.');
      const data = await res.json();
      setPublishedInfo({ id: data.reportId, publishedAt: data.publishedAt, periodTitle: payload.periodTitle });
      
      const shareUrl = getStandaloneShareableUrl();
      if (shareUrl) {
        navigator.clipboard.writeText(shareUrl).catch(() => {});
      }
      setShowShareModal(true);
      toast.success('Đã xuất bản Public báo cáo thành công! Mở hộp thoại để lấy link gửi người xem.', { id: 'publish-report' });
    } catch (err: any) {
      console.error('Lỗi khi xuất bản báo cáo:', err);
      toast.error('Lỗi xuất bản: ' + (err.message || err), { id: 'publish-report' });
    } finally {
      setIsPublishing(false);
    }
  };

  // Nạp báo cáo Public mới nhất từ Server Cloud
  const loadPublicReportFromServer = async () => {
    try {
      setIsLoadingStats(true);
      const res = await fetch('/api/sku-report/public-latest');
      if (!res.ok) {
        throw new Error('Chưa có bản ghi báo cáo Public nào trên máy chủ.');
      }
      const data = await res.json();
      if (data && data.stats) {
        setStats(data.stats);
        if (data.periodTitle) setCustomPeriodTitle(data.periodTitle);
        if (data.uploadBatches) setUploadBatches(data.uploadBatches);
        if (data.detailedSample && data.detailedSample.length > 0) {
          setDetailedList(data.detailedSample);
        }
        setPublishedInfo({ id: data.id, publishedAt: data.publishedAt, periodTitle: data.periodTitle });
        setIsViewingPublicCloud(true);
        setHasAppliedReport(true);
        toast.success(`Đã nạp báo cáo Public thành công (${data.periodTitle || data.stats.periodLabel})!`);
      }
    } catch (err: any) {
      console.warn('Không thể nạp báo cáo public:', err);
      toast.error(err.message || 'Không tìm thấy dữ liệu public.');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Xóa trắng dữ liệu Master (Kích hoạt trực tiếp & phản hồi tức thì)
  const handleClearDatabase = () => {
    setShowInlineResetConfirm(true);
  };

  const confirmResetDatabase = async () => {
    try {
      setShowInlineResetConfirm(false);
      setShowResetModal(false);
      await clearSkuMasterDB();
      toast.success('Đã đặt lại kho: Xóa sạch toàn bộ cơ sở dữ liệu SKU.');
      setStats(null);
      setDetailedList([]);
      setTotalDatabaseSkus(0);
      setTotalBatchesCount(0);
      setAvailablePeriods([]);
      setUploadBatches([]);
      setSelectedBatchId('');
      setLastUploadResult(null);
      setNewBatchPreviewRecords([]);
      setShowUploadPreview(false);
      setHasAppliedReport(false);
    } catch (err: any) {
      console.error('Lỗi khi xóa dữ liệu SKU:', err);
      toast.error('Lỗi khi đặt lại kho: ' + (err.message || err));
    }
  };

  // Dữ liệu cho biểu đồ Cột (Ảnh 3 & 6)
  const barChartData = useMemo(() => {
    if (!stats) return [];
    return [
      {
        name: customPeriodTitle.trim() || stats.periodLabel,
        'Sản phẩm': stats.newPeriod.totalProducts,
        'SKUs': stats.newPeriod.totalSkus,
      }
    ];
  }, [stats, customPeriodTitle]);

  // Dữ liệu cho biểu đồ Donut (Ảnh 4 & 5 & 6)
  const donutChartData = useMemo(() => {
    if (!stats) return [];
    return stats.newPeriod.categories
      .filter(c => c.skuCount > 0)
      .map(c => ({
        name: c.category,
        value: c.skuCount,
        percentage: c.percentage,
        products: c.productCount
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  // Lọc danh sách dữ liệu thô
  const filteredSkus = useMemo(() => {
    return detailedList.filter(item => {
      const matchKeyword = !searchKeyword || 
        item.sku.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.productId.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.productName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchKeyword.toLowerCase());

      const matchCategory = categoryFilter === 'all' || item.normalizedCategory === categoryFilter;

      const isVariant = item.sku.includes('V') || item.variantName;
      const matchType = typeFilter === 'all' 
        ? true 
        : typeFilter === 'variant' ? isVariant : !isVariant;

      return matchKeyword && matchCategory && matchType;
    });
  }, [detailedList, searchKeyword, categoryFilter, typeFilter]);

  const totalPages = Math.ceil(filteredSkus.length / pageSize) || 1;
  const paginatedSkus = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSkus.slice(start, start + pageSize);
  }, [filteredSkus, currentPage]);

  // Gom nhóm các SKU theo ID sản phẩm chính (Parent Product Grouping)
  const groupedProducts = useMemo(() => {
    const map = new Map<string, {
      productId: string;
      productName: string;
      category: string;
      brand: string;
      monthYear: string;
      creationPeriod: string;
      skus: SkuRecord[];
      isVariantGroup: boolean;
    }>();

    for (const item of filteredSkus) {
      const pid = item.productId || 'UNKNOWN';
      if (!map.has(pid)) {
        map.set(pid, {
          productId: pid,
          productName: item.productName,
          category: item.normalizedCategory,
          brand: item.brand,
          monthYear: item.monthYear || item.creationYearMonth || '2026-09',
          creationPeriod: item.creationPeriod || 'Tháng 09/2026',
          skus: [],
          isVariantGroup: false
        });
      }
      const g = map.get(pid)!;
      g.skus.push(item);
      if (item.isVariant || item.sku.includes('V') || item.variantName || g.skus.length > 1) {
        g.isVariantGroup = true;
      }
    }

    return Array.from(map.values());
  }, [filteredSkus]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Title */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-zinc-700/80 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Xử Lý Sản Phẩm Đơn & Biến Thể Chuẩn Xác
              </span>
              <span className="text-xs text-zinc-400">Tự động gắn SKU biến thể vào đúng ID sản phẩm cha</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-amber-400" />
              Báo Cáo Nhập Liệu & Phân Tích SKU Onsite
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Hệ thống tự động map mã SKU, tính toán sản phẩm mới, cơ cấu ngành hàng và sinh nhận xét tổng hợp theo đúng biểu mẫu công ty.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleApplyFilter()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs md:text-sm font-medium border border-zinc-700 transition"
              title="Làm mới dữ liệu từ bộ nhớ"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStats ? 'animate-spin text-amber-400' : ''}`} />
              Làm mới
            </button>

            {/* Nút Xuất Bản Báo Cáo Public cho mọi người cùng xem */}
            <button
              onClick={handlePublishPublicReport}
              disabled={isPublishing || !stats}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-sky-950/40 transition cursor-pointer disabled:opacity-50"
              title="Đồng bộ báo cáo này lên Cloud để người xem trên mọi thiết bị có thể vào xem trực tiếp data bạn đã nạp"
            >
              <CloudUpload className={`w-4 h-4 ${isPublishing ? 'animate-bounce' : ''}`} />
              {isPublishing ? 'Đang đồng bộ...' : 'Xuất Bản Public (Cloud Sync)'}
            </button>

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-emerald-900/30 transition cursor-pointer"
              title="Xuất bảng số liệu và danh sách chi tiết ra Excel (.xlsx)"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>

            <button
              onClick={handleExportPPT}
              disabled={isExportingPPT}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-orange-900/30 transition cursor-pointer disabled:opacity-50"
              title="Xuất bài thuyết trình PowerPoint (.pptx) chuẩn báo cáo"
            >
              <Presentation className={`w-4 h-4 ${isExportingPPT ? 'animate-bounce' : ''}`} />
              {isExportingPPT ? 'Đang tạo PPT...' : 'Xuất File PPT'}
            </button>

            <button
              onClick={handleExportHtml}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-purple-900/30 transition cursor-pointer"
              title="Tải file HTML báo cáo độc lập để gửi người xem (mở xem trực tiếp offline không cần đăng nhập)"
            >
              <Sparkles className="w-4 h-4" />
              Tải File HTML
            </button>

            {showInlineResetConfirm ? (
              <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-rose-950/90 border border-rose-500/60 shadow-lg animate-in fade-in duration-150">
                <span className="text-xs text-rose-200 font-semibold px-2">Xóa sạch kho SKU?</span>
                <button
                  type="button"
                  onClick={confirmResetDatabase}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-rose-950 cursor-pointer active:scale-95"
                  title="Xác nhận xóa sạch toàn bộ dữ liệu SKU"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa ngay
                </button>
                <button
                  type="button"
                  onClick={() => setShowInlineResetConfirm(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleClearDatabase}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 hover:text-rose-300 text-sm font-medium border border-rose-500/30 hover:border-rose-500/60 transition shadow-sm cursor-pointer active:scale-95"
                title="Xóa trắng database để nạp lại"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                Đặt lại kho
              </button>
            )}
          </div>
        </div>

        {/* Banner Trạng thái Đồng bộ Public / Cloud */}
        {publishedInfo && (
          <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-sky-950/70 to-blue-950/70 border border-sky-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0 border border-sky-500/30">
                <Globe className="w-4 h-4 animate-pulse" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>Báo cáo Public đã đồng bộ lên Cloud!</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live trên máy chủ
                  </span>
                </div>
                <div className="text-sky-300/80 text-[11px] mt-0.5">
                  Kỳ: <strong>{publishedInfo.periodTitle || customPeriodTitle}</strong> • Cập nhật: {new Date(publishedInfo.publishedAt).toLocaleString('vi-VN')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Lấy link chia sẻ
              </button>
            </div>
          </div>
        )}

        {/* Thống kê KPI - Chỉ hiển thị khi người dùng đã bấm Áp Dụng (Yêu cầu 1 & 2) */}
        {hasAppliedReport && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-zinc-700/60 animate-in fade-in duration-150">
            <div className="bg-zinc-800/80 rounded-xl p-3.5 border border-zinc-700/50">
              <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
                <span>Tổng SKU lũy kế (VNS)</span>
                <Database className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {stats?.allTime.totalSkus.toLocaleString() || '0'}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                từ {stats?.allTime.totalProducts.toLocaleString() || 0} sản phẩm (gồm đơn & cha)
              </div>
            </div>

            <div className="bg-zinc-800/80 rounded-xl p-3.5 border border-zinc-700/50">
              <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
                <span>SKU Mới trong kỳ báo cáo</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                {stats?.newPeriod.totalSkus.toLocaleString() || '0'}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                từ <strong className="text-emerald-300">{stats?.newPeriod.totalProducts.toLocaleString() || 0}</strong> sản phẩm mới
              </div>
            </div>

            <div className="bg-zinc-800/80 rounded-xl p-3.5 border border-zinc-700/50">
              <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
                <span>Tỷ lệ SKU Hoạt động</span>
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400">
                {stats?.newPeriod.activeRatio || 0}%
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {stats?.newPeriod.activeSkus.toLocaleString() || 0} SKU có tồn/bán
              </div>
            </div>

            <div className="bg-zinc-800/80 rounded-xl p-3.5 border border-zinc-700/50">
              <div className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
                <span>Ngành hàng dẫn đầu</span>
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-base font-bold text-purple-300 truncate" title={stats?.newPeriod.topCategory?.name || 'N/A'}>
                {stats?.newPeriod.topCategory?.name || 'Chưa có'}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {stats?.newPeriod.topCategory?.skus.toLocaleString() || 0} SKUs ({stats?.newPeriod.topCategory ? Math.round(((stats.newPeriod.topCategory.skus / (stats.newPeriod.totalSkus || 1)) * 100)) : 0}%)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Khu vực Tải file thô & Cơ chế Upsert Thông minh */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-400" />
              Nạp Dữ Liệu Thô (Đọc Luồng Nền 100.000+ Dòng Không Đơ UI)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tự động xử lý ô trống ở dòng biến thể: Kế thừa ID sản phẩm cha cho các SKU biến thể con bên dưới.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 whitespace-nowrap">Tên đợt/Kỳ nạp:</span>
            <input
              type="text"
              value={batchNameInput}
              onChange={(e) => setBatchNameInput(e.target.value)}
              placeholder="VD: Tuần 4 Tháng 09/2026"
              className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 w-48"
            />
          </div>
        </div>

        {/* Dropzone */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDragging) setIsDragging(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) {
              processUploadedFile(droppedFile);
            }
          }}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5 ${
            isUploading 
              ? 'border-indigo-500 bg-indigo-500/5' 
              : isDragging
                ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01] ring-2 ring-emerald-400/40 shadow-xl'
                : 'border-zinc-700 hover:border-indigo-500 hover:bg-zinc-800/50 bg-zinc-800/30'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={isUploading}
          />
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            isDragging 
              ? 'bg-emerald-500/20 text-emerald-300 scale-110' 
              : 'bg-indigo-500/10 text-indigo-400'
          }`}>
            {isUploading ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : isDragging ? (
              <Upload className="w-7 h-7 animate-bounce text-emerald-400" />
            ) : (
              <FileSpreadsheet className="w-7 h-7" />
            )}
          </div>
          <div>
            <p className={`text-sm font-bold transition-colors ${
              isDragging ? 'text-emerald-300' : 'text-zinc-200'
            }`}>
              {isUploading 
                ? 'Đang phân tích & map cấu trúc sản phẩm...' 
                : isDragging
                  ? 'Thả file Excel/CSV vào đây để nạp dữ liệu ngay!'
                  : 'Kéo thả file Excel (.xlsx, .xls) hoặc CSV vào đây, hoặc click để chọn file'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Hỗ trợ kéo thả trực tiếp file Excel/CSV lớn, tự động nhận diện SKU sản phẩm đơn và biến thể.
            </p>
          </div>
        </div>

        {/* Progress bar khi tải file */}
        {isUploading && (
          <div className="mt-4 p-4 rounded-xl bg-zinc-800/90 border border-indigo-500/30">
            <div className="flex items-center justify-between text-xs text-zinc-300 mb-2">
              <span className="font-medium text-indigo-400">{uploadMessage}</span>
              <span className="font-bold">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-zinc-700 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Kết quả sau khi nạp */}
        {lastUploadResult && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div className="text-xs text-zinc-200">
                <span className="font-bold text-emerald-400">Nạp dữ liệu thành công! </span>
                Tổng số SKU phân tích: <strong>{lastUploadResult.total.toLocaleString()}</strong> | 
                SKU Mới: <strong className="text-emerald-400">+{lastUploadResult.newCount.toLocaleString()}</strong> | 
                SKU Cũ cập nhật: <strong className="text-sky-400">{lastUploadResult.updatedCount.toLocaleString()}</strong>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-medium">
              Đã đồng bộ IndexedDB
            </span>
          </div>
        )}
      </div>

      {/* 2.5 LỊCH SỬ CÁC ĐỢT NẠP FILE THÔ (Upload Batches History) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Lịch Sử Các Đợt Nạp Dữ Liệu Thô
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {uploadBatches.length} đợt đã lưu
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Theo dõi các đợt upload file Excel/CSV, số lượng SKU mới/cũ cập nhật và xem lại báo cáo từng đợt chỉ với 1 click.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowBatchHistory(!showBatchHistory)}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 border border-zinc-700 transition cursor-pointer"
          >
            {showBatchHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showBatchHistory ? 'Thu gọn' : 'Xem lịch sử'}
          </button>
        </div>

        {showBatchHistory && (
          <div>
            {uploadBatches.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs bg-zinc-800/30 rounded-xl border border-dashed border-zinc-800 p-6">
                <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
                Chưa có đợt nạp file nào được ghi nhận. Hãy kéo thả file Excel (.xlsx, .xls) hoặc CSV ở trên để bắt đầu lưu lịch sử.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-800/90 text-zinc-300 font-semibold">
                    <tr className="border-b border-zinc-700">
                      <th className="py-2.5 px-3">Đợt Nạp / Tên Kỳ</th>
                      <th className="py-2.5 px-3">Tên File Gốc</th>
                      <th className="py-2.5 px-3">Thời Gian Nạp</th>
                      <th className="py-2.5 px-3">Kỳ (4 số đầu)</th>
                      <th className="py-2.5 px-3 text-center">Tổng Dòng SKU</th>
                      <th className="py-2.5 px-3 text-center">SKU Mới</th>
                      <th className="py-2.5 px-3 text-center">SKU Cũ Cập Nhật</th>
                      <th className="py-2.5 px-3 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {uploadBatches.map((b, idx) => {
                      const isCurrent = filterMode === 'batch' && selectedBatchId === b.id;
                      const isLatest = idx === 0;
                      return (
                        <tr 
                          key={b.id} 
                          className={`transition ${
                            isCurrent 
                              ? 'bg-sky-950/40 border-l-2 border-l-sky-400' 
                              : 'hover:bg-zinc-800/40'
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{b.name}</span>
                              {isLatest && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Mới nhất
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                  Đang xem
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-zinc-300 font-mono text-[11px] truncate max-w-[180px]" title={b.fileName}>
                            {b.fileName || 'file_thô.xlsx'}
                          </td>
                          <td className="py-3 px-3 text-zinc-400 whitespace-nowrap">
                            {new Date(b.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {b.periodKey || '2026-09'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-zinc-200">
                            {b.totalRows.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">
                              +{b.newSkusCount.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300">
                              {b.updatedSkusCount.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSelectBatch(b)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                  isCurrent
                                    ? 'bg-sky-600 text-white shadow-sm'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-sky-400 border border-zinc-700 hover:border-sky-500/40'
                                }`}
                                title="Xem báo cáo và số liệu của đợt này"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {isCurrent ? 'Đang xem' : 'Xem đợt này'}
                              </button>
                              <button
                                onClick={() => handleDeleteBatch(b.id, b.name)}
                                className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                title="Xóa đợt nạp này khỏi lịch sử"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2.8 BẢNG ĐỐI SOÁT & HIGHLIGHT HÀNG MỚI VỪA NẠP (Yêu cầu 2: Lọc & Highlight hàng mới để nhận biết) */}
      {showUploadPreview && lastUploadResult && newBatchPreviewRecords.length > 0 && (
        <div className="bg-zinc-900 border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Kết Quả So Khớp File Mới Vừa Nạp:
                  <span className="text-emerald-400 font-extrabold">+{lastUploadResult.newCount.toLocaleString()} SKU MỚI</span>
                  <span className="text-xs text-zinc-400 font-normal">
                    (trên tổng {lastUploadResult.total.toLocaleString()} dòng file)
                  </span>
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Các hàng mới phát hiện được <strong className="text-emerald-400 font-semibold">tô màu xanh nổi bật</strong> để bạn dễ dàng nhận biết. Bạn có thể chọn chỉ các hàng mới này để sinh báo cáo ngay.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-zinc-800 p-1 rounded-xl border border-zinc-700 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewFilterOnlyNew(true)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    previewFilterOnlyNew 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Chỉ xem Hàng Mới ({lastUploadResult.newCount.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilterOnlyNew(false)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    !previewFilterOnlyNew 
                      ? 'bg-zinc-700 text-white shadow-sm' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Tất cả trong file ({lastUploadResult.total.toLocaleString()})
                </button>
              </div>

              <button
                type="button"
                onClick={handleApplyOnlyNewBatchSkus}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                Tích Chọn Hàng Mới & Tạo Báo Cáo Ngay
              </button>
            </div>
          </div>

          {/* Bảng danh sách hàng đối soát */}
          <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-zinc-800/90 text-zinc-300 sticky top-0 z-10 font-semibold">
                <tr className="border-b border-zinc-700">
                  <th className="py-2.5 px-3">Phân Loại</th>
                  <th className="py-2.5 px-3">Mã SKU</th>
                  <th className="py-2.5 px-3">ID Sản Phẩm</th>
                  <th className="py-2.5 px-3">Tên Sản Phẩm</th>
                  <th className="py-2.5 px-3">Ngành Hàng</th>
                  <th className="py-2.5 px-3">Thương Hiệu</th>
                  <th className="py-2.5 px-3">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {displayedPreviewRows.map((r, idx) => {
                  const isNew = r.isNewInBatch;
                  return (
                    <tr 
                      key={`${r.sku}_${idx}`} 
                      className={isNew ? 'bg-emerald-950/30 hover:bg-emerald-950/50 border-l-4 border-l-emerald-400' : 'hover:bg-zinc-800/40 text-zinc-400'}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isNew ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            SKU MỚI
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] text-zinc-400 bg-zinc-800/60 border border-zinc-700/60">
                            Đã có trong kho
                          </span>
                        )}
                      </td>
                      <td className={`py-2.5 px-3 font-mono font-bold ${isNew ? 'text-emerald-300' : 'text-zinc-300'}`}>
                        {r.sku}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-400">
                        {r.productId}
                      </td>
                      <td className={`py-2.5 px-3 max-w-[240px] truncate ${isNew ? 'text-zinc-100 font-semibold' : 'text-zinc-400'}`} title={r.productName}>
                        {r.productName}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300 whitespace-nowrap">
                        {r.normalizedCategory}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-300 whitespace-nowrap">
                        {r.brand}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          r.status?.toLowerCase().includes('hoạt động') ? 'text-emerald-400' : 'text-zinc-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. BỘ CHỌN PHẠM VI BÁO CÁO (Người dùng tự chọn tuần và phạm vi dữ liệu) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <ListFilter className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Chọn Phạm Vi Dữ Liệu Tạo Báo Cáo "Hệ Thống Mới"
            </h3>
          </div>

          {/* Bộ chọn Tuần & Kỳ báo cáo hiển thị */}
          <div className="flex items-center gap-2 flex-wrap text-xs bg-zinc-800/80 p-1.5 rounded-xl border border-zinc-700/60">
            <span className="text-zinc-400 font-medium pl-1">Chọn Tuần:</span>
            {['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5', 'Cả Tháng'].map((wk) => {
              const currentMonthCode = selectedPeriod ? selectedPeriod.replace(/^20/, '').replace('-', '.') : '09.26';
              const targetTitle = wk === 'Cả Tháng' ? (selectedPeriod ? `Tháng ${selectedPeriod}` : 'Tháng 09/2026') : `${wk} ${currentMonthCode}`;
              const isSelected = customPeriodTitle.startsWith(wk) || (wk === 'Cả Tháng' && customPeriodTitle.startsWith('Tháng'));
              return (
                <button
                  key={wk}
                  type="button"
                  onClick={() => {
                    setCustomPeriodTitle(targetTitle);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  {wk}
                </button>
              );
            })}
            <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-700">
              <span className="text-zinc-400">Tên hiển thị:</span>
              <input
                type="text"
                value={customPeriodTitle}
                onChange={(e) => setCustomPeriodTitle(e.target.value)}
                placeholder="VD: Tuần 4 09.26"
                className="bg-zinc-900 border border-zinc-700 text-xs font-bold text-amber-300 px-2.5 py-1 rounded-lg w-36 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          </div>
        </div>

        {/* 5 Chế độ chọn phạm vi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Chế độ 1: Chọn số dòng SKU mới từ đầu file (Dành cho file ban đầu) */}
          <div 
            onClick={() => setFilterMode('custom-row-count')}
            className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
              filterMode === 'custom-row-count'
                ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-zinc-800/40 border-zinc-700/60 hover:bg-zinc-800/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  Số Dòng SKU Đầu Tiên
                </span>
                {filterMode === 'custom-row-count' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                Dành cho file ban đầu: Chọn N dòng SKU mới tạo trong tuần/tháng.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                value={rowCountInput}
                onChange={(e) => setRowCountInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-zinc-900 border border-zinc-700 text-xs text-white px-2.5 py-1 rounded-lg font-mono focus:border-amber-400 focus:outline-none"
                placeholder="1440"
              />
              <span className="text-[11px] text-zinc-400 whitespace-nowrap">dòng</span>
            </div>
          </div>

          {/* Chế độ 2: Tự động phát hiện SKU mới (Từ lần đẩy file 2 trở đi) */}
          <div 
            onClick={() => setFilterMode('auto-batch')}
            className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
              filterMode === 'auto-batch'
                ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500/40'
                : 'bg-zinc-800/40 border-zinc-700/60 hover:bg-zinc-800/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Tự Động (Lần Nạp 2 Trở Đi)
                </span>
                {filterMode === 'auto-batch' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                Tự động lọc các SKU MỚI được thêm vào trong đợt nạp gần nhất.
              </p>
            </div>
            <div className="mt-3">
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold block text-center">
                {totalBatchesCount >= 2 ? 'Đã sẵn sàng tự động' : 'Kích hoạt khi nạp lần 2'}
              </span>
            </div>
          </div>

          {/* Chế độ 3: Theo Tháng/Năm (4 số đầu SKU: 2609...) */}
          <div 
            onClick={() => setFilterMode('period')}
            className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
              filterMode === 'period'
                ? 'bg-blue-500/10 border-blue-500/60 ring-1 ring-blue-500/40'
                : 'bg-zinc-800/40 border-zinc-700/60 hover:bg-zinc-800/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Theo 4 Số Đầu SKU
                </span>
                {filterMode === 'period' && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                Lọc toàn bộ SKU có mã ngày tương ứng (VD: 2609... ➔ Tháng 09/2026).
              </p>
            </div>
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-xs text-white px-2 py-1 rounded-lg focus:border-blue-400 focus:outline-none"
              >
                {availablePeriods.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
                {availablePeriods.length === 0 && <option value="2026-09">Tháng 09/2026</option>}
              </select>
            </div>
          </div>

          {/* Chế độ 4: Khoảng dòng STT (Từ A đến B) */}
          <div 
            onClick={() => setFilterMode('custom-row-range')}
            className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
              filterMode === 'custom-row-range'
                ? 'bg-purple-500/10 border-purple-500/60 ring-1 ring-purple-500/40'
                : 'bg-zinc-800/40 border-zinc-700/60 hover:bg-zinc-800/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Khoảng Dòng STT
                </span>
                {filterMode === 'custom-row-range' && <Check className="w-3.5 h-3.5 text-purple-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                Chỉ định chính xác từ dòng bắt đầu đến dòng kết thúc.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                value={rangeStartInput}
                onChange={(e) => setRangeStartInput(parseInt(e.target.value) || 1)}
                className="w-16 bg-zinc-900 border border-zinc-700 text-xs text-white px-1.5 py-1 rounded font-mono"
                placeholder="1"
              />
              <span className="text-xs text-zinc-500">➔</span>
              <input
                type="number"
                value={rangeEndInput}
                onChange={(e) => setRangeEndInput(parseInt(e.target.value) || 1440)}
                className="w-16 bg-zinc-900 border border-zinc-700 text-xs text-white px-1.5 py-1 rounded font-mono"
                placeholder="1440"
              />
            </div>
          </div>

          {/* Chế độ 5: Theo đợt nạp trong lịch sử */}
          <div 
            onClick={() => {
              setFilterMode('batch');
              if (!selectedBatchId && uploadBatches.length > 0) {
                setSelectedBatchId(uploadBatches[0].id);
              }
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
              filterMode === 'batch'
                ? 'bg-sky-500/10 border-sky-500/60 ring-1 ring-sky-500/40'
                : 'bg-zinc-800/40 border-zinc-700/60 hover:bg-zinc-800/70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Đợt Nạp Lịch Sử
                </span>
                {filterMode === 'batch' && <Check className="w-3.5 h-3.5 text-sky-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 leading-tight">
                Chọn chính xác 1 đợt file thô đã upload để tính báo cáo.
              </p>
            </div>
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <select
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value);
                  setFilterMode('batch');
                }}
                className="w-full bg-zinc-900 border border-zinc-700 text-xs text-white px-2 py-1 rounded-lg focus:border-sky-400 focus:outline-none"
              >
                {uploadBatches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.totalRows} SKU)
                  </option>
                ))}
                {uploadBatches.length === 0 && <option value="">Chưa có lịch sử</option>}
              </select>
            </div>
          </div>
        </div>

        {/* Nút bấm áp dụng & mô tả trạng thái */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Đang áp dụng: <strong className="text-white">{stats?.periodLabel}</strong> ({stats?.newPeriod.totalSkus.toLocaleString() || 0} SKUs ➔ {stats?.newPeriod.totalProducts.toLocaleString() || 0} sản phẩm)
          </div>

          <button
            onClick={handleApplyFilter}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition"
          >
            Áp Dụng Cho Báo Cáo
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4, 5, 6. KHỐI BÁO CÁO & BIỂU ĐỒ - CHỈ HIỂN THỊ KHI ĐÃ BẤM ÁP DỤNG (Yêu cầu 1 & 2) */}
      {hasAppliedReport && stats ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* 4. Khối BIỂU ĐỒ BÁO CÁO (Ảnh 3, 4, 6) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Biểu đồ Cột So Sánh (Ảnh 3 & 6) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Số Lượng Sản Phẩm và SKUs Đã Tạo
              </h3>
              <p className="text-xs text-zinc-400">So sánh Sản phẩm (ID duy nhất) vs SKUs trong {customPeriodTitle || stats?.periodLabel}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Sản phẩm ({stats?.newPeriod.totalProducts.toLocaleString() || 0})
              </span>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-3 h-3 rounded-sm bg-red-600 inline-block" /> SKUs ({stats?.newPeriod.totalSkus.toLocaleString() || 0})
              </span>
            </div>
          </div>

          <div className="h-72 w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 25, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fill: '#e4e4e7', fontSize: 13, fontWeight: 500 }} />
                <YAxis stroke="#a1a1aa" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '0.75rem', color: '#fff' }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="Sản phẩm" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={110} />
                <Bar dataKey="SKUs" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={110} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around text-center text-xs font-semibold pt-2 text-zinc-400 border-t border-zinc-800 mt-2">
            <div>Cột Xanh (Sản phẩm): <span className="text-blue-400 font-bold">{stats?.newPeriod.totalProducts.toLocaleString() || 0} SP</span></div>
            <div>Cột Đỏ (SKUs): <span className="text-red-400 font-bold">{stats?.newPeriod.totalSkus.toLocaleString() || 0} SKUs</span></div>
          </div>
        </div>

        {/* Biểu đồ Donut Cơ cấu Ngành Hàng (Ảnh 4, 5, 6) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-md flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-emerald-400" />
                Cơ Cấu Tỷ Trọng Ngành Hàng (SKU Share)
              </h3>
              <p className="text-xs text-zinc-400">Tỷ lệ % số lượng SKU theo danh mục ngành hàng trong {customPeriodTitle || stats?.periodLabel}</p>
            </div>
            <span className="text-xs font-bold text-zinc-300 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
              Tổng: {stats?.newPeriod.totalSkus.toLocaleString() || 0} SKUs
            </span>
          </div>

          <div className="h-72 w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={3}
                  dataKey="value"
                  label={(entry: any) => `${(entry.name || '').slice(0, 10)}... ${entry.percentage || 0}%`}
                  labelLine={true}
                >
                  {donutChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any, name: any, item: any) => [`${Number(value).toLocaleString()} SKUs (${item.payload.percentage}%)`, name]}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '0.75rem', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-zinc-400 justify-center pt-2 border-t border-zinc-800 mt-2">
            {donutChartData.slice(0, 5).map((d, idx) => (
              <span key={d.name} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                {d.name}: <strong>{d.percentage}%</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 5. BẢNG SỐ LIỆU TỔNG HỢP (Khớp 100% Ảnh 2 & Ảnh 5) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-zinc-800/80 px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">NEW SKUs</span>
            <h3 className="text-base font-bold text-white">
              Bảng Số Liệu Tổng Hợp Theo Ngành Hàng
            </h3>
          </div>
          <span className="text-xs text-zinc-400">
            Kỳ đối chiếu: <strong className="text-amber-400">{customPeriodTitle || stats?.periodLabel}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              {/* Header cấp 1 */}
              <tr className="border-b border-zinc-700 bg-zinc-950/70 text-xs">
                <th className="py-3 px-4 font-bold text-zinc-300 w-1/3">
                  <span className="text-rose-400 font-extrabold uppercase">HỆ THỐNG MỚI</span>
                </th>
                <th colSpan={3} className="py-3 px-4 font-bold text-white text-center border-l border-zinc-800 bg-zinc-900">
                  {customPeriodTitle || stats?.periodLabel || 'Kỳ báo cáo'}
                </th>
                <th colSpan={3} className="py-3 px-4 font-bold text-white text-center border-l border-zinc-800 bg-blue-950/50">
                  TOÀN HỆ THỐNG VNS (LŨY KẾ)
                </th>
              </tr>
              {/* Header cấp 2 */}
              <tr className="border-b border-zinc-800 bg-zinc-900/90 text-xs text-zinc-400">
                <th className="py-2.5 px-4 font-semibold">Ngành hàng (Category)</th>
                <th className="py-2.5 px-4 font-semibold text-right border-l border-zinc-800 bg-rose-950/30 text-rose-300">Sản phẩm</th>
                <th className="py-2.5 px-4 font-semibold text-right bg-rose-950/40 text-rose-200">SKUs</th>
                <th className="py-2.5 px-4 font-semibold text-right bg-rose-950/30 text-zinc-300">Tỷ trọng %</th>
                <th className="py-2.5 px-4 font-semibold text-right border-l border-zinc-800 bg-blue-950/30 text-blue-300">Sản phẩm</th>
                <th className="py-2.5 px-4 font-semibold text-right bg-blue-950/40 text-blue-200">SKUs</th>
                <th className="py-2.5 px-4 font-semibold text-right bg-blue-950/30 text-zinc-300">Tỷ trọng %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-200">
              {/* Phần 1: Số lượng sản phẩm onsite mới */}
              <tr className="bg-zinc-800/40 font-bold text-zinc-100">
                <td className="py-2.5 px-4 text-emerald-400">
                  Số lượng sản phẩm onsite mới
                </td>
                <td className="py-2.5 px-4 text-right border-l border-zinc-800 text-rose-300 font-extrabold">
                  {stats?.newPeriod.totalProducts.toLocaleString() || 0}
                </td>
                <td className="py-2.5 px-4 text-right text-rose-200 font-extrabold">
                  {stats?.newPeriod.totalSkus.toLocaleString() || 0}
                </td>
                <td className="py-2.5 px-4 text-right text-zinc-400">100%</td>
                <td className="py-2.5 px-4 text-right border-l border-zinc-800 text-blue-300 font-extrabold">
                  {stats?.allTime.totalProducts.toLocaleString() || 0}
                </td>
                <td className="py-2.5 px-4 text-right text-blue-200 font-extrabold">
                  {stats?.allTime.totalSkus.toLocaleString() || 0}
                </td>
                <td className="py-2.5 px-4 text-right text-zinc-400">100%</td>
              </tr>

              {/* Từng ngành hàng */}
              {CANONICAL_CATEGORIES.map((catName) => {
                const newCat = stats?.newPeriod.categories.find(c => c.category === catName);
                const allCat = stats?.allTime.categories.find(c => c.category === catName);

                return (
                  <tr key={catName} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 px-4 text-zinc-300 font-medium">
                      {catName}
                    </td>
                    <td className="py-2 px-4 text-right border-l border-zinc-800/60 text-zinc-300 font-medium">
                      {newCat?.productCount.toLocaleString() || 0}
                    </td>
                    <td className="py-2 px-4 text-right font-semibold text-white">
                      {newCat?.skuCount.toLocaleString() || 0}
                    </td>
                    <td className="py-2 px-4 text-right text-xs text-zinc-400">
                      {newCat?.percentage || 0}%
                    </td>
                    <td className="py-2 px-4 text-right border-l border-zinc-800/60 text-zinc-300 font-medium">
                      {allCat?.productCount.toLocaleString() || 0}
                    </td>
                    <td className="py-2 px-4 text-right font-semibold text-sky-200">
                      {allCat?.skuCount.toLocaleString() || 0}
                    </td>
                    <td className="py-2 px-4 text-right text-xs text-zinc-400">
                      {allCat?.percentage || 0}%
                    </td>
                  </tr>
                );
              })}

              {/* Dòng TOTAL (Ảnh 2 & Ảnh 5) */}
              <tr className="bg-zinc-950 font-extrabold text-amber-400 border-t-2 border-zinc-700">
                <td className="py-3 px-4 uppercase tracking-wider text-amber-400">
                  TOTAL (GRAND TOTAL)
                </td>
                <td className="py-3 px-4 text-right border-l border-zinc-800 text-rose-400 text-base">
                  {stats?.newPeriod.totalProducts.toLocaleString() || 0}
                </td>
                <td className="py-3 px-4 text-right text-rose-300 text-base">
                  {stats?.newPeriod.totalSkus.toLocaleString() || 0}
                </td>
                <td className="py-3 px-4 text-right text-zinc-400 text-xs">100%</td>
                <td className="py-3 px-4 text-right border-l border-zinc-800 text-sky-400 text-base">
                  {stats?.allTime.totalProducts.toLocaleString() || 0}
                </td>
                <td className="py-3 px-4 text-right text-sky-300 text-base">
                  {stats?.allTime.totalSkus.toLocaleString() || 0}
                </td>
                <td className="py-3 px-4 text-right text-zinc-400 text-xs">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. NHẬN XÉT BÁO CÁO TỰ ĐỘNG (Khớp 100% Ảnh 6) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-red-500 flex items-center gap-2">
              3. Số lượng sản phẩm và thương hiệu mới onsite trong {customPeriodTitle || stats?.periodLabel}
            </h3>
            <p className="text-xs text-zinc-400">Được hệ thống tự động sinh dựa trên dữ liệu thực tế đã phân tích</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyRemarks}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isCopied 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
              }`}
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {isCopied ? 'Đã sao chép' : 'Sao chép nhận xét'}
            </button>

            <button
              onClick={handleExportPPT}
              disabled={isExportingPPT}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/40 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              title="Xuất bài thuyết trình PowerPoint"
            >
              <Presentation className="w-3.5 h-3.5 text-orange-400" />
              {isExportingPPT ? 'Đang tạo PPT...' : 'Xuất File PPT (.pptx)'}
            </button>

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition cursor-pointer"
              title="Xuất bảng số liệu Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Xuất Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Nội dung nhận xét dạng Bullet Points đúng Ảnh 6 */}
        <div className="bg-zinc-800/40 rounded-xl p-5 border border-zinc-700/60 font-sans text-sm text-zinc-200 leading-relaxed space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
            <p>
              Tổng số lượng sản phẩm onsite mới trên VnShop {customPeriodTitle || stats?.periodLabel} đạt{' '}
              <strong className="text-red-400 font-bold">{stats?.newPeriod.totalProducts.toLocaleString()} sản phẩm</strong> ({stats?.newPeriod.totalSkus.toLocaleString()} SKUs). 
              Số lượng SKU hàng bán hiệu lực đạt <strong className="text-red-400 font-bold">{stats?.newPeriod.totalSkus.toLocaleString()} SKUs</strong>, 
              trong đó số lượng SKU có tồn/hoạt động chiếm hơn <strong className="text-red-400 font-bold">{stats?.newPeriod.activeRatio}%</strong> ({stats?.newPeriod.activeSkus.toLocaleString()} SKUs).
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
            <p>
              Sản phẩm onsite nhiều nhất thuộc ngành hàng <strong className="text-red-400 font-bold">{stats?.newPeriod.topCategory?.name || 'Khác'}</strong> với{' '}
              <strong className="text-red-400 font-bold">{stats?.newPeriod.topCategory?.products.toLocaleString() || 0} sản phẩm</strong> ({stats?.newPeriod.topCategory?.skus.toLocaleString() || 0} SKU), 
              trong đó thương hiệu có số lượng SKU onsite nhiều nhất là <strong className="text-red-400 font-bold">{stats?.newPeriod.topBrand?.name || 'N/A'}</strong> (ngành hàng {stats?.newPeriod.topBrand?.category || stats?.newPeriod.topCategory?.name}) với <strong className="text-red-400 font-bold">{stats?.newPeriod.topBrand?.skus.toLocaleString() || 0} SKU</strong>.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
            <p>
              Trong kỳ ghi nhận <strong className="text-amber-400 font-bold">{stats?.newPeriod.brandsCount || 0} thương hiệu</strong> có SKU mới onsite
              {stats?.newPeriod.topBrandsList && stats.newPeriod.topBrandsList.length > 0 && (
                <span> (Top đầu: {stats.newPeriod.topBrandsList.map(b => `${b.brand} - ${b.count} SKU`).join(', ')})</span>
              )}.
            </p>
          </div>
        </div>
      </div>
    </div>
  ) : (
    /* Hướng dẫn khi chưa bấm Áp Dụng (Yêu cầu 1 & 2) */
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-8 text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
        <ListFilter className="w-6 h-6" />
      </div>
      <h4 className="text-base font-bold text-white">Chưa Hiển Thị Báo Cáo</h4>
      <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
        Hãy chọn phạm vi ở trên (theo Số dòng SKU, Tháng/Năm, Đợt nạp hoặc Tích chọn Hàng mới) rồi bấm nút <strong className="text-amber-400 font-semibold">"Áp Dụng Cho Báo Cáo"</strong> để tạo biểu đồ và bảng số liệu tổng hợp.
      </p>
    </div>
  )}

      {/* 7. BẢNG DỮ LIỆU SKU & SẢN PHẨM - THU GỌN MẶC ĐỊNH ĐỂ TIẾT KIỆM KHÔNG GIAN (Yêu cầu 3) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              Dữ Liệu SKU & Sản Phẩm
              <span className="text-xs font-normal text-zinc-400">
                ({filteredSkus.length.toLocaleString()} SKU trong kho)
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Cột <strong className="text-emerald-400">Tháng/Năm</strong> tự động trích xuất 4 số đầu SKU. Bảng chi tiết được thu gọn để tiết kiệm không gian.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDetailedDataTable(!showDetailedDataTable)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              showDetailedDataTable
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950'
            }`}
          >
            {showDetailedDataTable ? (
              <>
                <span>▲ Thu Gọn Bảng Dữ Liệu Chi Tiết</span>
              </>
            ) : (
              <>
                <span>▼ Nhấn Để Mở Rộng Xem Bảng Dữ Liệu ({filteredSkus.length.toLocaleString()} SKU)</span>
              </>
            )}
          </button>
        </div>

        {/* Nội dung bảng chỉ hiển thị khi người dùng bấm mở rộng */}
        {showDetailedDataTable && (
          <div className="space-y-4 pt-4 border-t border-zinc-800 animate-in fade-in duration-200">
            <div className="flex items-center gap-3 flex-wrap justify-between">
            {/* Chế độ xem: Bảng phẳng vs Gom nhóm */}
            <div className="bg-zinc-800 p-0.5 rounded-xl border border-zinc-700 flex items-center text-xs">
              <button
                onClick={() => setViewLayout('flat')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  viewLayout === 'flat' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Bảng SKU Phẳng
              </button>
              <button
                onClick={() => setViewLayout('grouped')}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  viewLayout === 'grouped' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Gom Nhóm Biến Thể ({groupedProducts.length.toLocaleString()} SP)
              </button>
            </div>

            {/* Lọc loại sản phẩm đơn / biến thể */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as any); setCurrentPage(1); }}
              className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 px-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tất cả loại (Đơn & Biến thể)</option>
              <option value="single">Sản phẩm đơn (STT 38-41)</option>
              <option value="variant">Sản phẩm biến thể (STT 42-55)</option>
            </select>

            {/* Ô tìm kiếm */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => { setSearchKeyword(e.target.value); setCurrentPage(1); }}
                placeholder="Tìm SKU, ID SP, Tên SP..."
                className="bg-zinc-800 border border-zinc-700 text-xs text-white pl-9 pr-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-500 w-48"
              />
            </div>

            {/* Lọc theo ngành hàng */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 px-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tất cả ngành hàng</option>
              {CANONICAL_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 1. CHẾ ĐỘ GOM NHÓM THEO ID SẢN PHẨM CHÍNH */}
        {viewLayout === 'grouped' ? (
          <div className="space-y-3">
            {groupedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((group, gIdx) => {
              const isExpanded = expandedProductIds.has(group.productId);
              return (
                <div key={group.productId} className="bg-zinc-800/40 rounded-xl border border-zinc-800 overflow-hidden">
                  <div 
                    onClick={() => toggleExpandProduct(group.productId)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-800/70 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 text-xs font-mono font-medium">
                        #{(currentPage - 1) * pageSize + gIdx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/20 text-sky-400 border border-sky-500/30">
                        {group.productId}
                      </span>
                      <span className="text-sm font-semibold text-zinc-100 max-w-sm truncate" title={group.productName}>
                        {group.productName}
                      </span>
                      <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                        {group.category}
                      </span>
                      <span className="text-xs text-purple-300 font-medium">
                        {group.brand}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {group.monthYear}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        group.isVariantGroup 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {group.isVariantGroup ? `${group.skus.length} SKUs Biến Thể` : 'Sản Phẩm Đơn (1 SKU)'}
                      </span>
                      <span className="text-zinc-400 text-xs">{isExpanded ? '▲ Thu gọn' : '▼ Chi tiết SKU'}</span>
                    </div>
                  </div>

                  {/* Chi tiết các SKU con bên dưới */}
                  {isExpanded && (
                    <div className="p-3 bg-zinc-950/60 border-t border-zinc-800/80">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-zinc-400 border-b border-zinc-800">
                            <th className="py-1.5 px-3">Mã SKU</th>
                            <th className="py-1.5 px-3">Tháng/Năm</th>
                            <th className="py-1.5 px-3">Tên biến thể</th>
                            <th className="py-1.5 px-3">Trạng thái</th>
                            <th className="py-1.5 px-3">Loại sản phẩm</th>
                            <th className="py-1.5 px-3">Nhà cung cấp</th>
                            <th className="py-1.5 px-3">Đơn vị</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {group.skus.map((skuItem, sIdx) => (
                            <tr key={`${skuItem.sku}_${sIdx}`} className="text-zinc-300 hover:bg-zinc-800/30">
                              <td className="py-2 px-3 font-mono font-bold text-amber-300">{skuItem.sku}</td>
                              <td className="py-2 px-3 font-mono text-emerald-400 font-semibold">{skuItem.monthYear}</td>
                              <td className="py-2 px-3 text-purple-200">{skuItem.variantName || '-'}</td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400">
                                  {skuItem.status || 'Hoạt động'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-zinc-400">{skuItem.productType || 'Hàng bán'}</td>
                              <td className="py-2 px-3 text-zinc-400">{skuItem.supplier || '-'}</td>
                              <td className="py-2 px-3 text-zinc-400">{skuItem.unit || 'Cái'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* 2. CHẾ ĐỘ BẢNG PHẲNG TỪNG DÒNG SKU */
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-zinc-800/90 text-zinc-300 font-semibold sticky top-0">
                <tr className="border-b border-zinc-700">
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3">ID sản phẩm (Parent)</th>
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3">Mã SKU</th>
                  {/* CỘT THÁNG/NĂM TỰ ĐỘNG THEO YÊU CẦU */}
                  <th className="py-2.5 px-3 bg-emerald-950/60 text-emerald-300 border-x border-emerald-800 font-bold whitespace-nowrap">
                    Tháng/Năm (YYYY-MM)
                  </th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3">Tên sản phẩm</th>
                  <th className="py-2.5 px-3">Tên biến thể</th>
                  <th className="py-2.5 px-3">Ngành hàng chuẩn hóa</th>
                  <th className="py-2.5 px-3">Tên thương hiệu</th>
                  <th className="py-2.5 px-3">Danh sách tên NCC</th>
                  <th className="py-2.5 px-3">Đơn vị tính</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-300">
                {paginatedSkus.map((item, idx) => {
                  const isVariant = item.sku.includes('V') || item.variantName;
                  return (
                    <tr key={`${item.sku}_${idx}`} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="py-2 px-3 text-zinc-500">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-medium text-sky-400">
                        {item.productId}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isVariant 
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {isVariant ? 'Biến thể' : 'Đơn'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-amber-300">{item.sku}</td>
                      {/* CỘT THÁNG/NĂM CHUẨN YYYY-MM */}
                      <td className="py-2 px-3 bg-emerald-950/30 text-emerald-300 border-x border-emerald-900/50 font-semibold whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 text-[11px]">
                          {item.monthYear || item.creationYearMonth || '2026-09'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          (item.status || '').toLowerCase().includes('hoạt động')
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-700 text-zinc-400'
                        }`}>
                          {item.status || 'Hoạt động'}
                        </span>
                      </td>
                      <td className="py-2 px-3 max-w-xs truncate" title={item.productName}>{item.productName}</td>
                      <td className="py-2 px-3 max-w-xs truncate text-purple-200" title={item.variantName || '-'}>{item.variantName || '-'}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-zinc-200">{item.normalizedCategory}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-purple-300 font-medium">{item.brand}</td>
                      <td className="py-2 px-3 text-zinc-400">{item.supplier || '-'}</td>
                      <td className="py-2 px-3 text-zinc-400">{item.unit || 'Cái'}</td>
                    </tr>
                  );
                })}

                {paginatedSkus.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-zinc-500">
                      Chưa có dữ liệu hoặc không tìm thấy bản ghi phù hợp. Hãy kéo thả file dữ liệu thô ở phía trên.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        {filteredSkus.length > 0 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-zinc-800 text-xs text-zinc-400">
            <div>
              Hiển thị <strong>{((currentPage - 1) * pageSize + 1).toLocaleString()}</strong> - <strong>{Math.min(currentPage * pageSize, filteredSkus.length).toLocaleString()}</strong> trên tổng số <strong>{filteredSkus.length.toLocaleString()}</strong> dòng
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300"
              >
                Trước
              </button>
              <span className="font-semibold text-zinc-200">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, Math.min(totalPages, p + 1)))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300"
              >
                Sau
              </button>
            </div>
          </div>
        )}
          </div>
        )}
      </div>

      {/* Modal Xác nhận Đặt lại Kho Dữ liệu (Dùng createPortal vào document.body để vượt qua transform của motion.div) */}
      {showResetModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác Nhận Đặt Lại Kho Dữ Liệu</h3>
                <p className="text-xs text-zinc-400">Thao tác này sẽ xóa sạch các SKU đã lưu</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa toàn bộ cơ sở dữ liệu SKU đã lưu trong trình duyệt để nạp lại từ đầu? Mọi dữ liệu đã lưu trữ sẽ bị đặt lại.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={confirmResetDatabase}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xác Nhận Đặt Lại
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Hướng Dẫn & Lấy Link Chia Sẻ Báo Cáo Độc Lập Cho Người Xem */}
      {showShareModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-sky-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Link Báo Cáo Public Độc Lập</h3>
                  <p className="text-xs text-zinc-400">Dành cho người xem mở trực tiếp trên mọi thiết bị</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Đường dẫn Web Báo Cáo (Gửi link này cho đồng nghiệp / sếp):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getStandaloneShareableUrl()}
                    className="flex-1 bg-zinc-950 border border-zinc-700 text-xs font-mono text-sky-300 px-3 py-2 rounded-xl focus:outline-none focus:border-sky-500 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = getStandaloneShareableUrl();
                      navigator.clipboard.writeText(url);
                      setIsLinkCopied(true);
                      toast.success('Đã sao chép link Web báo cáo!');
                      setTimeout(() => setIsLinkCopied(false), 2500);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                      isLinkCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sky-600 hover:bg-sky-500 text-white'
                    }`}
                  >
                    {isLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {isLinkCopied ? 'Đã chép' : 'Sao chép'}
                  </button>
                </div>
              </div>

              {/* Hộp giải thích và hướng dẫn người dùng */}
              <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="text-zinc-200">
                    <strong>Xem trực tiếp không cần tài khoản:</strong> Bất kỳ ai mở link Web này sẽ xem được ngay toàn bộ biểu đồ, số liệu và nhận xét của kỳ <strong>{publishedInfo?.periodTitle || customPeriodTitle}</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="text-zinc-300">
                    <strong>Tránh lỗi "Page not found":</strong> Lỗi "Page not found" xảy ra khi người nhận mở link quản trị AI Studio (<code className="text-amber-300">aistudio.google.com/build/...</code>). Hãy dùng <strong>chính xác nút "Sao chép"</strong> ở trên!
                  </span>
                </div>
              </div>

              {/* Tùy chọn tải File Báo Cáo Offline */}
              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-bold text-purple-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Cách dự phòng an toàn nhất: Gửi File HTML
                  </div>
                  <div className="text-zinc-400 text-[11px] mt-0.5">
                    Người nhận double-click mở xem trực tiếp offline (100% không lo lỗi link/mạng)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportHtml}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải File HTML
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <a
                href={getStandaloneShareableUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 hover:underline font-medium"
              >
                <ArrowUpRight className="w-4 h-4" />
                Mở xem thử trong tab mới
              </a>

              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SkuReportTab;
