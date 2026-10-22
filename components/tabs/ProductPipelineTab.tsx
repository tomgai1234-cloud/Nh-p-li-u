import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Layers, ArrowRight, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, 
  Copy, Sparkles, Image as ImageIcon, Trash2, Star, Eye, ExternalLink,
  RefreshCw, AlertCircle, ShieldCheck, Globe, Link2, FileText, Check, 
  FolderArchive, Edit3, ShoppingBag, Plus, Database, Clock, Upload, CloudUpload, Play
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  PipelineDraft, PipelineProduct, PipelineImage, BatchItem,
  loadPipelineDraft, savePipelineDraft, createEmptyProduct, 
  checkIncomingTransfer, clearIncomingTransfer 
} from '../../utils/pipelineCache';
import { specializedScrape, isShopeePromotionalOverlay } from '../../utils/ecommerceScraper';
import { useProviderAccounts } from '../../src/hooks/useProviderAccounts';
import { uploadUrlToCloudinary } from '../../utils/cloudinaryUploader';
import { generateProductDescription } from '../../services/geminiService';

// Quy chuẩn mặc định của Tab Tạo Mô Tả (DescriptionGeneratorTab)
const DEFAULT_DESCRIPTION_GUIDELINES = `QUY CHUẨN MÔ TẢ SẢN PHẨM

I. GIỚI HẠN ĐỘ DÀI
- Độ dài mô tả: Bắt buộc từ 3.000 – 4.900 ký tự (viết chi tiết, đầy đủ các mục, phân tích sâu công năng, đặc điểm kỹ thuật và trải nghiệm người dùng để đạt dung lượng theo yêu cầu).

1. Cấu trúc nội dung

Dòng đầu tiên: luôn bắt đầu bằng <h3><strong>Giới thiệu tổng quan về [Tên sản phẩm đầy đủ]</strong></h3>.

Quan trọng: Sau dòng tiêu đề <h3> này, hãy đi thẳng vào nội dung mô tả công dụng và lợi ích. TUYỆT ĐỐI không viết thêm một dòng phụ kiểu "Giới thiệu sản phẩm..." hay nhắc lại tên sản phẩm một lần nữa dưới dạng in đậm ngay sát phía dưới.

Phần nội dung chính: 4–6 câu tóm tắt công dụng chính, lợi ích nổi bật của sản phẩm (viết tự nhiên, rõ ràng, không gượng ép).

Các phần tiếp theo có tiêu đề in đậm:

Thông tin sản phẩm

Tính năng nổi bật

Hướng dẫn sử dụng

(Thêm mục khác tùy loại sản phẩm nếu cần: Chính sách bảo hành, Thành phần, Thông số kỹ thuật, Công nghệ, Hướng dẫn bảo quản
…)

2. Trình bày

Sử dụng gạch đầu dòng “-” để liệt kê, không dùng ký tự đặc biệt (❌ không dùng ☀️, ✨, • …).

Nội dung được chia khối rõ ràng, dễ nhìn, không gộp hết thành 1 đoạn dài.

Không chèn các dòng phân cách (❌ “-----” hoặc dấu gạch ngang dài).

3. Nội dung đưa vào

Chỉ đưa các thông tin chính xác từ website chính hãng hoặc nguồn uy tín (VD: thành phần, xuất xứ, chất liệu, màu sắc, công nghệ…).

Nếu không tìm được thông tin chính xác, thì không cho vào mô tả (tránh bịa đặt).

Phần giới thiệu sản phẩm được phép viết khái quát, tự nhiên, nhưng phải phù hợp với sản phẩm.

Có thể bổ sung thêm nội dung khác để khách hàng hiểu rõ hơn về sản phẩm.

4. Từ khóa

Chèn từ khóa tự nhiên, hợp lý, tránh nhồi nhét.

Nêu bật sự khác biệt và lợi ích của sản phẩm so với sản phẩm khác.

5. Tính chính xác tuyệt đối (Không Hallucination)

Tuyệt đối không sử dụng kiến thức bên ngoài (ngoài dữ liệu được cấp hoặc trang web chính thức của sản phẩm).

Nếu các thông số kỹ thuật (như công suất, kích thước, khối lượng, chất liệu, màu sắc...) không xuất hiện rõ ràng trong nội dung gốc/URL/nguồn chính thức, AI bắt buộc phải bỏ qua (omit) thay vì tự phỏng đoán hay tự tạo ra thông số giả. "Thà có một mô tả ngắn hơn là một mô tả sai thông số kỹ thuật".`;

export const ProductPipelineTab: React.FC = () => {
  const [draft, setDraft] = useState<PipelineDraft>(() => loadPipelineDraft());
  const { cloudinaryAccounts } = useProviderAccounts();
  const [activeCloudId, setActiveCloudId] = useState<string>(() => {
    return localStorage.getItem('cloudinary_active_id') || 'default';
  });

  const activeCloudinaryConfig = useMemo(() => {
    return cloudinaryAccounts.find(a => a.id === activeCloudId) || cloudinaryAccounts[0] || {
      id: 'default',
      cloudName: localStorage.getItem('upload_cloud_name') || '',
      apiKey: localStorage.getItem('upload_api_key') || '',
      apiSecret: localStorage.getItem('upload_api_secret') || ''
    };
  }, [cloudinaryAccounts, activeCloudId]);

  // Single mode inputs
  const [inputTitle, setInputTitle] = useState<string>(draft.product.productName || '');
  const [inputProductUrl, setInputProductUrl] = useState<string>(draft.product.sourceUrl || '');
  const [inputImageUrl, setInputImageUrl] = useState<string>('');

  // Processing states
  const [isRunningPipeline, setIsRunningPipeline] = useState<boolean>(false);
  const [pipelineCurrentTask, setPipelineCurrentTask] = useState<string>('');
  const [pipelineProgress, setPipelineProgress] = useState<number>(0);

  // Batch mode states
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchRows, setBatchRows] = useState<BatchItem[]>(draft.batchItems || []);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const batchStopSignal = useRef<boolean>(false);

  // Cloudinary direct upload states in Step 2
  const [isUploadingToCloudinary, setIsUploadingToCloudinary] = useState<boolean>(false);
  const [uploadCloudProgress, setUploadCloudProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // Common UI states
  const [incomingAlert, setIncomingAlert] = useState<any | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string>('Vừa xong');

  // Debounced auto-save
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      savePipelineDraft(draft);
      setLastSavedTime(new Date().toLocaleTimeString('vi-VN'));
    }, 400);
    return () => clearTimeout(timer);
  }, [draft]);

  // Sync draft batch rows
  useEffect(() => {
    setDraft(prev => ({ ...prev, batchItems: batchRows }));
  }, [batchRows]);

  // Incoming transfer detection
  useEffect(() => {
    const handleIncoming = (e: any) => {
      const incoming = e.detail || checkIncomingTransfer();
      if (incoming) setIncomingAlert(incoming);
    };

    window.addEventListener('pipeline-incoming-data', handleIncoming);
    window.addEventListener('storage', (e) => {
      if (e.key === 'pipeline_incoming_transfer_v1') {
        const inc = checkIncomingTransfer();
        if (inc) setIncomingAlert(inc);
      }
    });

    const existingIncoming = checkIncomingTransfer();
    if (existingIncoming) setIncomingAlert(existingIncoming);

    return () => {
      window.removeEventListener('pipeline-incoming-data', handleIncoming);
    };
  }, []);

  const currentStep = draft.currentStep;
  const product = draft.product;

  const updateProduct = (updates: Partial<PipelineProduct>) => {
    setDraft(prev => ({
      ...prev,
      product: {
        ...prev.product,
        ...updates,
        lastUpdated: Date.now()
      }
    }));
  };

  const setStep = (step: 1 | 2 | 3) => {
    setDraft(prev => ({ ...prev, currentStep: step }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // CORE HELPER 1: AI GENERATE DESCRIPTION (Dùng cho cả Single & Batch)
  // Kết nối trực tiếp logic Tab Tạo mô tả với Quy chuẩn mặc định (DEFAULT_DESCRIPTION_GUIDELINES)
  // Trả về đồng thời cả Mô tả Văn bản chuẩn hóa và Mô tả HTML chuẩn SEO
  // =========================================================================
  const generateAiDescriptionForProduct = async (
    title: string, 
    rawDesc: string = '', 
    productUrl?: string
  ): Promise<{ text: string; html: string }> => {
    try {
      // Gọi service gemini chuẩn chung của Tab Tạo mô tả với quy chuẩn mặc định
      const res = await generateProductDescription(
        title,
        DEFAULT_DESCRIPTION_GUIDELINES,
        'gemini-3.8-flash',
        true, // useWebSearch
        productUrl || undefined,
        rawDesc || undefined
      );

      if (res && (res.descriptionHtml || res.descriptionText)) {
        const html = (res.descriptionHtml || '').trim();
        const text = res.descriptionText ? res.descriptionText.trim() : (
          html
            .replace(/<h3><strong>(.*?)<\/strong><\/h3>/gi, '$1\n\n')
            .replace(/<h[1-6]>(.*?)<\/h[1-6]>/gi, '$1\n\n')
            .replace(/<strong>(.*?)<\/strong>/gi, '$1')
            .replace(/<b>(.*?)<\/b>/gi, '$1')
            .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim()
        );
        return { text, html };
      }
    } catch (apiErr) {
      console.warn("generateProductDescription gặp lỗi, fallback sang /api/gemini/generate:", apiErr);
    }

    // Fallback: endpoint proxy nếu client SDK không gọi được
    const prompt = `Bạn là một chuyên gia viết mô tả sản phẩm e-commerce. Hãy viết mô tả sản phẩm chi tiết, chuyên nghiệp theo QUY CHUẨN MÔ TẢ SẢN PHẨM MẶC ĐỊNH:
${DEFAULT_DESCRIPTION_GUIDELINES}

Tên sản phẩm: "${title}"
${productUrl ? `URL sản phẩm: "${productUrl}"` : ''}
${rawDesc ? `Thông tin gốc: "${rawDesc}"` : ''}

Yêu cầu xuất: Định dạng HTML chuẩn SEO (Dòng đầu tiên bắt buộc là <h3><strong>Giới thiệu tổng quan về ${title}</strong></h3>). Tuyệt đối không bịa thông số kỹ thuật.`;

    try {
      const resp = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: 'gemini-3.8-flash' })
      });

      if (resp.ok) {
        const data = await resp.json();
        const html = (data.candidates?.[0]?.content?.parts?.[0]?.text || data.text || '').trim();
        const text = html
          .replace(/<h[1-6]>(.*?)<\/h[1-6]>/gi, '$1\n\n')
          .replace(/<strong>(.*?)<\/strong>/gi, '$1')
          .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();
        return { text, html };
      }
    } catch (fallbackErr) {
      console.warn("Fallback gemini generate error:", fallbackErr);
    }

    const defaultHtml = `<h3><strong>Giới thiệu tổng quan về ${title}</strong></h3>\n<p>${title} chất lượng cao, cam kết chính hãng 100%.</p>`;
    return {
      text: `${title}\nChất lượng cao, cam kết chính hãng 100%.`,
      html: defaultHtml
    };
  };

  // =========================================================================
  // CORE HELPER 2: SCRAPE IMAGES FROM PRODUCT URL (Đào ảnh từ URL sản phẩm)
  // =========================================================================
  const scrapeImagesFromUrl = async (url: string): Promise<{ images: string[]; rawTitle?: string; rawDesc?: string; price?: string }> => {
    const trimmed = url.trim();
    if (!trimmed) return { images: [] };

    const isShopee = trimmed.includes('shopee.vn') || trimmed.includes('shopee.');
    let scraped: any = null;

    if (isShopee) {
      try {
        const resp = await fetch('/api/shopee/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed })
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json.success && json.data) {
            scraped = json.data;
          }
        }
      } catch (err) {
        console.warn("Shopee API proxy failed, fallback to specializedScrape", err);
      }
    }

    if (!scraped) {
      scraped = await specializedScrape(trimmed);
    }

    if (Array.isArray(scraped)) {
      scraped = scraped[0];
    }

    if (!scraped) return { images: [] };

    const rawUrls = [
      ...(scraped.main || []),
      ...(scraped.variants || []),
      ...(scraped.description || [])
    ].filter(u => typeof u === 'string' && u.startsWith('http') && !isShopeePromotionalOverlay(u));

    const uniqueUrls = Array.from(new Set(rawUrls));
    const desc = scraped.descriptionText || (scraped.description && scraped.description.length > 0 ? scraped.description.join('\n') : '');

    return {
      images: uniqueUrls,
      rawTitle: scraped.title,
      rawDesc: desc,
      price: scraped.price ? String(scraped.price).replace(/[^0-9]/g, '') : undefined
    };
  };

  // =========================================================================
  // THỰC THI LUỒNG 1-STEP (SINGLE ITEM): Tên - URL SP - URL Ảnh (Có/Không)
  // Thứ tự bắt buộc theo yêu cầu:
  // 1. Tạo mô tả
  // 2. 2.1 Đào ảnh dựa theo URL SP nếu không cung cấp URL ảnh
  //    2.2 Sang luôn bước tải ảnh hàng loạt để chuyển đổi link sang Cloudinary
  // 3. Sau khi xong sẽ có Excel thông tin kết quả
  // =========================================================================
  const handleExecuteSinglePipeline = async () => {
    const title = inputTitle.trim();
    const productUrl = inputProductUrl.trim();
    const rawImgInput = inputImageUrl.trim();

    if (!title && !productUrl) {
      toast.error("Vui lòng nhập Tên sản phẩm hoặc Url sản phẩm!");
      return;
    }

    setIsRunningPipeline(true);
    setPipelineProgress(10);
    setPipelineCurrentTask("Khởi động Luồng 1-Step...");

    try {
      let finalTitle = title;
      let finalDesc = '';
      let finalDescHtml = '';
      let collectedImages: string[] = [];

      // Phân tích danh sách link ảnh nếu người dùng có cung cấp
      if (rawImgInput) {
        collectedImages = rawImgInput
          .split(/[\n,;]+/)
          .map(u => u.trim())
          .filter(u => u.startsWith('http') && !isShopeePromotionalOverlay(u));
      }

      // -------------------------------------------------------------
      // BƯỚC 1: TẠO MÔ TẢ (Quy chuẩn mặc định Tab Tạo mô tả)
      // -------------------------------------------------------------
      setPipelineProgress(25);
      setPipelineCurrentTask("Bước 1/3: AI đang phân tích và tạo bài mô tả bán hàng...");
      try {
        const descRes = await generateAiDescriptionForProduct(finalTitle || 'Sản phẩm mới', '', productUrl);
        finalDesc = descRes.text;
        finalDescHtml = descRes.html;
      } catch (err: any) {
        console.warn("AI tạo mô tả gặp lỗi:", err);
        finalDesc = `${finalTitle}\nCam kết chất lượng cao, chính hãng 100%.`;
        finalDescHtml = `<h3><strong>Giới thiệu tổng quan về ${finalTitle}</strong></h3>\n<p>Cam kết chất lượng cao, chính hãng 100%.</p>`;
      }

      // -------------------------------------------------------------
      // BƯỚC 2: 
      // 2.1. Đào ảnh dựa theo url sản phẩm nếu KHÔNG cung cấp url hình ảnh
      // -------------------------------------------------------------
      if (collectedImages.length === 0) {
        if (!productUrl) {
          throw new Error("Không có link ảnh và cũng không có link sản phẩm để đào ảnh!");
        }
        setPipelineProgress(50);
        setPipelineCurrentTask("Bước 2.1: Đang tự động đào ảnh từ liên kết sản phẩm...");
        const scrapeRes = await scrapeImagesFromUrl(productUrl);
        if (scrapeRes.images.length > 0) {
          collectedImages = scrapeRes.images;
          if (!finalTitle && scrapeRes.rawTitle) {
            finalTitle = scrapeRes.rawTitle;
          }
        } else {
          toast.error("Không đào được ảnh nào từ liên kết này. Vui lòng kiểm tra lại URL.");
        }
      }

      if (collectedImages.length === 0) {
        throw new Error("Không tìm thấy bất kỳ ảnh nào để thực hiện chuyển đổi Cloudinary.");
      }

      // -------------------------------------------------------------
      // 2.2. Sang luôn bước tải ảnh hàng loạt để chuyển đổi link sang Cloudinary
      // -------------------------------------------------------------
      setPipelineProgress(75);
      setPipelineCurrentTask(`Bước 2.2: Đang chuyển đổi ${collectedImages.length} ảnh sang Cloudinary...`);

      const pipelineImages: PipelineImage[] = [];
      let successCloudinaryCount = 0;

      for (let i = 0; i < collectedImages.length; i++) {
        const originalUrl = collectedImages[i];
        setPipelineCurrentTask(`Bước 2.2: Đang chuyển ảnh ${i + 1}/${collectedImages.length} sang Cloudinary...`);

        let cloudUrl: string | undefined = undefined;
        let status: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
        let errMsg: string | undefined = undefined;

        if (activeCloudinaryConfig.cloudName && activeCloudinaryConfig.apiKey && activeCloudinaryConfig.apiSecret) {
          const res = await uploadUrlToCloudinary(originalUrl, activeCloudinaryConfig, `${finalTitle}_${i + 1}`);
          if (res.success && res.url) {
            cloudUrl = res.url;
            status = 'success';
            successCloudinaryCount++;
          } else {
            status = 'error';
            errMsg = res.error;
          }
        } else {
          errMsg = "Chưa cấu hình Cloudinary API (vui lòng kiểm tra Cài đặt tài khoản)";
          status = 'error';
        }

        pipelineImages.push({
          id: `img_${Date.now()}_${i}`,
          url: originalUrl,
          cloudinaryUrl: cloudUrl,
          uploadStatus: status,
          isSelected: true,
          isCover: i === 0,
          errorMsg: errMsg
        });
      }

      // Cập nhật sản phẩm hoàn chỉnh
      const updatedProduct: PipelineProduct = {
        ...product,
        productName: finalTitle,
        seoTitle: finalTitle,
        sourceUrl: productUrl,
        images: pipelineImages,
        description: finalDesc,
        descriptionHtml: finalDescHtml,
        lastUpdated: Date.now()
      };

      updateProduct(updatedProduct);

      // -------------------------------------------------------------
      // BƯỚC 3: KẾT QUẢ & CHUYỂN SANG BƯỚC 3 XUẤT EXCEL
      // -------------------------------------------------------------
      setPipelineProgress(100);
      setPipelineCurrentTask("Hoàn tất Luồng 1-Step!");
      toast.success(`Xong! Đã tạo mô tả & chuyển đổi ${successCloudinaryCount}/${pipelineImages.length} ảnh sang Cloudinary!`);

      // Tự động chuyển sang Bước 3 (Kết quả & Xuất Excel)
      setStep(3);

    } catch (err: any) {
      console.error("Lỗi trong Luồng 1-Step:", err);
      toast.error(err.message || "Xảy ra lỗi trong luồng xử lý!");
    } finally {
      setIsRunningPipeline(false);
      setPipelineCurrentTask('');
      setPipelineProgress(0);
    }
  };

  // =========================================================================
  // XỬ LÝ HÀNG LOẠT (BATCH EXCEL): Tên - URL SP - URL Ảnh (Có/Không)
  // Đọc file Excel nhiều dòng, chạy tuần tự từng dòng:
  // 1. Tạo mô tả
  // 2.1 Đào ảnh từ URL SP nếu chưa có
  // 2.2 Chuyển sang link Cloudinary
  // 3. Xuất file Excel tổng hợp kết quả toàn bộ danh sách
  // =========================================================================
  const handleBatchExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBatchFile(file);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          if (data.length <= 1) {
            toast.error("File Excel không có dữ liệu!");
            return;
          }

          // Nhận diện cột tự động (Tìm cột Tên, Cột URL SP, Cột Link Ảnh)
          const headerRow = data[0].map(h => String(h || '').trim().toLowerCase());
          let nameColIdx = headerRow.findIndex(h => h.includes('tên') || h.includes('name') || h.includes('title') || h.includes('tiêu đề'));
          let urlColIdx = headerRow.findIndex(h => h.includes('url sản phẩm') || h.includes('link sản phẩm') || h.includes('url') || h.includes('link') || h.includes('sản phẩm'));
          let imgColIdx = headerRow.findIndex(h => h.includes('ảnh') || h.includes('hình') || h.includes('image') || h.includes('photo'));

          // Fallback nếu không khớp tên cột: 0 -> Tên, 1 -> URL SP, 2 -> URL Ảnh
          if (nameColIdx === -1) nameColIdx = 0;
          if (urlColIdx === -1) urlColIdx = 1;
          if (imgColIdx === -1) imgColIdx = 2;

          const parsedRows: BatchItem[] = [];
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const name = String(row[nameColIdx] || '').trim();
            const prodUrl = String(row[urlColIdx] || '').trim();
            const imgUrl = String(row[imgColIdx] || '').trim();

            if (!name && !prodUrl && !imgUrl) continue;

            parsedRows.push({
              id: `batch_${i}_${Date.now()}`,
              productName: name || `Sản phẩm dòng ${i}`,
              productUrl: prodUrl,
              imageUrl: imgUrl,
              status: 'idle',
              stepStatus: 'Chờ xử lý',
              scrapedImages: [],
              cloudinaryUrls: []
            });
          }

          setBatchRows(parsedRows);
          toast.success(`Đã đọc ${parsedRows.length} dòng dữ liệu từ file Excel!`);
        } catch (err: any) {
          console.error("Lỗi đọc Excel:", err);
          toast.error("Không thể đọc file Excel, hãy kiểm tra lại định dạng!");
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleRunBatchPipeline = async () => {
    if (batchRows.length === 0) {
      toast.error("Chưa có dòng nào trong danh sách!");
      return;
    }

    if (!activeCloudinaryConfig.cloudName || !activeCloudinaryConfig.apiKey || !activeCloudinaryConfig.apiSecret) {
      toast.error("Cần cài đặt Cloudinary (Cloud Name, API Key, Secret) trước khi chạy chuyển đổi!");
      return;
    }

    setIsBatchRunning(true);
    batchStopSignal.current = false;
    setBatchProgress({ current: 0, total: batchRows.length });

    const updated = [...batchRows];

    for (let i = 0; i < updated.length; i++) {
      if (batchStopSignal.current) {
        toast("Đã dừng tiến trình xử lý hàng loạt theo yêu cầu.", { icon: '🛑' });
        break;
      }

      const item = updated[i];
      setBatchProgress({ current: i + 1, total: updated.length });

      // Cập nhật trạng thái item đang chạy
      item.status = 'processing';
      item.stepStatus = '1. Đang tạo mô tả AI...';
      setBatchRows([...updated]);

      try {
        // 1. Tạo mô tả (y hệt tính năng tạo mô tả theo Quy chuẩn mặc định)
        const descRes = await generateAiDescriptionForProduct(item.productName, '', item.productUrl);
        item.description = descRes.text;
        item.descriptionHtml = descRes.html;

        // 2.1 Đào ảnh nếu không có URL ảnh
        item.stepStatus = '2.1. Đang kiểm tra / đào ảnh...';
        setBatchRows([...updated]);

        let targetImages: string[] = [];
        if (item.imageUrl && item.imageUrl.startsWith('http')) {
          targetImages = item.imageUrl.split(/[\n,;]+/).map(u => u.trim()).filter(u => u.startsWith('http'));
        }

        if (targetImages.length === 0 && item.productUrl) {
          const scrapeRes = await scrapeImagesFromUrl(item.productUrl);
          if (scrapeRes.images.length > 0) {
            targetImages = scrapeRes.images;
          }
        }

        item.scrapedImages = targetImages;

        // 2.2 Chuyển đổi link sang Cloudinary
        item.stepStatus = `2.2. Đang upload ${targetImages.length} ảnh lên Cloudinary...`;
        setBatchRows([...updated]);

        const uploadedCloudinaryUrls: string[] = [];
        for (let imgIdx = 0; imgIdx < targetImages.length; imgIdx++) {
          const imgUrl = targetImages[imgIdx];
          const cloudRes = await uploadUrlToCloudinary(imgUrl, activeCloudinaryConfig, `${item.productName}_${imgIdx + 1}`);
          if (cloudRes.success && cloudRes.url) {
            uploadedCloudinaryUrls.push(cloudRes.url);
          }
        }

        item.cloudinaryUrls = uploadedCloudinaryUrls;
        item.coverCloudinaryUrl = uploadedCloudinaryUrls[0] || '';
        item.status = 'success';
        item.stepStatus = `Hoàn thành (${uploadedCloudinaryUrls.length} ảnh Cloudinary)`;

      } catch (err: any) {
        item.status = 'error';
        item.errorMsg = err.message || 'Lỗi không xác định';
        item.stepStatus = `Lỗi: ${item.errorMsg}`;
      }

      setBatchRows([...updated]);
    }

    setIsBatchRunning(false);
    toast.success("Đã hoàn thành toàn bộ danh sách hàng loạt!");

    // Tự động xuất file Excel tổng hợp
    handleExportBatchExcel(updated);
  };

  const handleExportBatchExcel = (rowsToExport: BatchItem[] = batchRows) => {
    if (rowsToExport.length === 0) {
      toast.error("Không có dữ liệu để xuất!");
      return;
    }

    // Chỉ giữ lại đúng các cột được yêu cầu: Tên SP, Ảnh đại diện Cloudinary, DS ảnh Cloudinary, Mô tả sản phẩm, Mô tả (HTML), Nguồn gốc
    const excelData = rowsToExport.map((row) => ({
      'Tên sản phẩm': row.productName,
      'Ảnh đại diện Cloudinary': row.coverCloudinaryUrl || row.cloudinaryUrls?.[0] || 'N/A',
      'Danh sách ảnh Cloudinary': (row.cloudinaryUrls || []).join('; '),
      'Mô tả sản phẩm': row.description || 'N/A',
      'Mô tả (HTML)': row.descriptionHtml || row.description || 'N/A',
      'Nguồn gốc': row.productUrl || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ket_Qua_Luong_1Step");

    const wscols = [
      { wch: 35 }, // Tên sản phẩm
      { wch: 50 }, // Ảnh đại diện Cloudinary
      { wch: 70 }, // Danh sách ảnh Cloudinary
      { wch: 80 }, // Mô tả sản phẩm
      { wch: 80 }, // Mô tả (HTML)
      { wch: 50 }  // Nguồn gốc
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `KetQua_Luong_1Step_${Date.now()}.xlsx`);
    toast.success("Đã xuất file Excel kết quả tổng hợp!");
  };

  // Chuyển đổi thủ công lại ảnh sang Cloudinary tại Bước 2 nếu người dùng muốn
  const handleUploadRemainingToCloudinary = async () => {
    const pendingImages = product.images.filter(img => !img.cloudinaryUrl && img.isSelected);
    if (pendingImages.length === 0) {
      toast("Tất cả ảnh đã có link Cloudinary!", { icon: 'ℹ️' });
      return;
    }

    if (!activeCloudinaryConfig.cloudName || !activeCloudinaryConfig.apiKey || !activeCloudinaryConfig.apiSecret) {
      toast.error("Vui lòng cấu hình tài khoản Cloudinary trước!");
      return;
    }

    setIsUploadingToCloudinary(true);
    setUploadCloudProgress({ current: 0, total: pendingImages.length });

    const currentImages = [...product.images];
    let successCount = 0;

    for (let i = 0; i < pendingImages.length; i++) {
      const target = pendingImages[i];
      setUploadCloudProgress({ current: i + 1, total: pendingImages.length });

      const res = await uploadUrlToCloudinary(target.url, activeCloudinaryConfig, `${product.productName}_${i + 1}`);
      const idx = currentImages.findIndex(img => img.id === target.id);
      if (idx !== -1) {
        if (res.success && res.url) {
          currentImages[idx] = { ...currentImages[idx], cloudinaryUrl: res.url, uploadStatus: 'success' };
          successCount++;
        } else {
          currentImages[idx] = { ...currentImages[idx], uploadStatus: 'error', errorMsg: res.error };
        }
      }
      updateProduct({ images: currentImages });
    }

    setIsUploadingToCloudinary(false);
    toast.success(`Đã chuyển đổi thành công ${successCount}/${pendingImages.length} ảnh sang Cloudinary!`);
  };

  // Xuất file Excel cho Single Product
  const handleExportSingleExcel = () => {
    const selected = product.images.filter(img => img.isSelected);
    const coverCloud = selected.find(img => img.isCover)?.cloudinaryUrl || selected[0]?.cloudinaryUrl || '';
    const otherClouds = selected.map(img => img.cloudinaryUrl || img.url).join('; ');

    // Chỉ giữ lại đúng các cột được yêu cầu: Tên sản phẩm, Ảnh đại diện Cloudinary, Danh sách ảnh Cloudinary, Mô tả sản phẩm, Mô tả (HTML), Nguồn gốc
    const rowData = [
      {
        'Tên sản phẩm': product.productName,
        'Ảnh đại diện Cloudinary': coverCloud || selected[0]?.url || '',
        'Danh sách ảnh Cloudinary': otherClouds,
        'Mô tả sản phẩm': product.description,
        'Mô tả (HTML)': product.descriptionHtml || product.description,
        'Nguồn gốc': product.sourceUrl || 'N/A'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rowData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'San_Pham_1Step');

    worksheet['!cols'] = [
      { wch: 35 }, // Tên sản phẩm
      { wch: 50 }, // Ảnh đại diện Cloudinary
      { wch: 70 }, // Danh sách ảnh Cloudinary
      { wch: 80 }, // Mô tả sản phẩm
      { wch: 80 }, // Mô tả (HTML)
      { wch: 50 }  // Nguồn gốc
    ];

    const fileName = `SanPham_${(product.productName || '1Step').slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Đã xuất file Excel kết quả!");
  };

  const selectedImagesCount = useMemo(() => {
    return product.images.filter(img => img.isSelected).length;
  }, [product.images]);

  const cloudinaryCount = useMemo(() => {
    return product.images.filter(img => img.isSelected && !!img.cloudinaryUrl).length;
  }, [product.images]);

  return (
    <div className="flex flex-col bg-zinc-950 text-zinc-100 min-h-[850px] rounded-2xl border border-zinc-800/80 shadow-2xl overflow-hidden">
      {/* ----------------- TOP HEADER ----------------- */}
      <div className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 p-4 sm:p-5 sticky top-0 z-20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Luồng Xử Lý 1-Step (End-to-End Pipeline)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Chuẩn Hóa TMĐT
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Tên - URL SP - URL Ảnh ➔ [1] Tạo mô tả ➔ [2] Đào ảnh & Đổi link Cloudinary ➔ [3] Xuất Excel kết quả
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Mode Switcher */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
              <button
                onClick={() => setDraft(prev => ({ ...prev, mode: 'single' }))}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  draft.mode === 'single' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                1 Dòng (Single)
              </button>
              <button
                onClick={() => setDraft(prev => ({ ...prev, mode: 'batch' }))}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  draft.mode === 'batch' ? 'bg-teal-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                File Excel Hàng Loạt
              </button>
            </div>

            <button
              onClick={() => {
                if (confirm("Làm mới lại toàn bộ dữ liệu?")) {
                  const resetDraft: PipelineDraft = {
                    mode: draft.mode,
                    currentStep: 1,
                    product: createEmptyProduct(),
                    completedHistory: draft.completedHistory,
                    batchItems: []
                  };
                  setDraft(resetDraft);
                  savePipelineDraft(resetDraft);
                  setInputTitle('');
                  setInputProductUrl('');
                  setInputImageUrl('');
                  setBatchRows([]);
                  toast.success("Đã làm mới dữ liệu!");
                }
              }}
              className="text-xs text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Làm mới
            </button>
          </div>
        </div>

        {/* 3-STEP PROGRESS STEPPER */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { step: 1, label: '1. Nhập Liệu & Chạy 1-Step', desc: 'Tên - URL SP - URL Ảnh' },
            { step: 2, label: '2. Kiểm Tra Ảnh & Cloudinary', desc: `${cloudinaryCount}/${selectedImagesCount} ảnh Cloudinary` },
            { step: 3, label: '3. Kết Quả & Xuất Excel', desc: 'Tải File Excel tổng hợp' },
          ].map(s => {
            const isCompleted = currentStep > s.step;
            const isCurrent = currentStep === s.step;
            return (
              <button
                key={s.step}
                onClick={() => setStep(s.step as any)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                  isCurrent 
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-white shadow-lg shadow-emerald-500/10' 
                    : isCompleted
                    ? 'bg-zinc-900/90 border-zinc-700/80 text-zinc-300 hover:bg-zinc-850'
                    : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                  isCurrent 
                    ? 'bg-emerald-500 text-white shadow' 
                    : isCompleted 
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : s.step}
                </div>
                <div className="min-w-0">
                  <div className={`text-xs font-bold truncate ${isCurrent ? 'text-emerald-300' : 'text-zinc-200'}`}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate">
                    {s.desc}
                  </div>
                </div>
                {isCurrent && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ----------------- BODY ----------------- */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col">

        {/* =========================================================================
            STEP 1: NHẬP LIỆU & BẮT ĐẦU LUỒNG 1-STEP
            ========================================================================= */}
        {currentStep === 1 && (
          <div className="max-w-4xl mx-auto w-full space-y-6 animate-fade-in">
            {/* MODE 1: SINGLE ITEM (1 DÒNG) */}
            {draft.mode === 'single' && (
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-base font-bold text-white">
                      Nhập Thông Tin Sản Phẩm (1 Dòng)
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-400">
                    Hệ thống sẽ tự động thực hiện 3 bước liên hoàn
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      1. Tên sản phẩm <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Tai nghe không dây Bluetooth True Wireless Pro"
                      value={inputTitle}
                      onChange={(e) => setInputTitle(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      2. URL sản phẩm (Shopee, Tiki, Lazada, Web...) <span className="text-zinc-400 font-normal">(Dùng để đào ảnh nếu không có URL hình ảnh)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: https://shopee.vn/product/1494502661/56013171027"
                      value={inputProductUrl}
                      onChange={(e) => setInputProductUrl(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-zinc-300">
                        3. URL hình ảnh <span className="text-emerald-400 font-semibold">(Nếu có/Không có thì hệ thống sẽ tự động đào từ URL sản phẩm ở trên)</span>
                      </label>
                      <span className="text-[11px] text-zinc-400">Mỗi dòng 1 link hoặc cách nhau bằng dấu phẩy</span>
                    </div>
                    <textarea
                      rows={3}
                      placeholder="https://down-vn.img.susercontent.com/file/... (Để trống nếu muốn tự đào từ link sản phẩm)"
                      value={inputImageUrl}
                      onChange={(e) => setInputImageUrl(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                {/* Cloudinary account indicator */}
                <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CloudUpload className="w-4 h-4 text-sky-400" />
                    <span className="text-zinc-400">Đích đến chuyển đổi link:</span>
                    <span className="font-bold text-sky-300">
                      Cloudinary ({activeCloudinaryConfig.cloudName || 'Chưa thiết lập'})
                    </span>
                  </div>
                  {!activeCloudinaryConfig.cloudName && (
                    <span className="text-red-400 text-[11px]">Cần cấu hình API trong tab Tải ảnh hàng loạt / Cài đặt</span>
                  )}
                </div>

                {/* RUN BUTTON */}
                <button
                  onClick={handleExecuteSinglePipeline}
                  disabled={isRunningPipeline || (!inputTitle.trim() && !inputProductUrl.trim())}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-4 rounded-xl shadow-xl shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-base"
                >
                  {isRunningPipeline ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      {pipelineCurrentTask || "Đang thực hiện..."} ({pipelineProgress}%)
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      Bắt Đầu Chạy Luồng 1-Step Ngay
                    </>
                  )}
                </button>

                {/* FLOW EXPLANATION BOX */}
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/80 space-y-2 text-xs text-zinc-400">
                  <div className="font-bold text-zinc-300">Thứ tự các bước liên kết trực tiếp với các tính năng gốc:</div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 font-bold flex items-center justify-center text-[11px] border border-emerald-500/40">1</span>
                    <span><strong>1. Tạo mô tả:</strong> Kết nối trực tiếp logic Tab Tạo mô tả với <em>Quy chuẩn mặc định</em> (cấu trúc chuẩn SEO, cam kết không bịa thông số).</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 font-bold flex items-center justify-center text-[11px] border border-emerald-500/40">2</span>
                    <span><strong>2. Đào ảnh & Tải ảnh hàng loạt (Cloudinary):</strong> Kết nối Tab Cào dữ liệu (nếu thiếu URL ảnh) ➔ chuyển trực tiếp sang Tab Tải ảnh hàng loạt để upload Cloudinary.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 font-bold flex items-center justify-center text-[11px] border border-emerald-500/40">3</span>
                    <span><strong>3. Xuất file Excel kết quả:</strong> Xuất đúng các cột yêu cầu (Tên sản phẩm, Ảnh đại diện Cloudinary, Danh sách ảnh Cloudinary, Mô tả sản phẩm, Mô tả (HTML), Nguồn gốc), loại bỏ các cột thừa.</span>
                  </div>
                </div>
              </div>
            )}

            {/* MODE 2: BATCH EXCEL (XỬ LÝ HÀNG LOẠT NHIỀU SẢN PHẨM) */}
            {draft.mode === 'batch' && (
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                    <h2 className="text-base font-bold text-white">
                      Xử Lý Hàng Loạt Bằng File Excel
                    </h2>
                  </div>
                  <span className="text-xs text-zinc-400">
                    Cấu trúc file: Cột 1 [Tên sản phẩm] - Cột 2 [URL sản phẩm] - Cột 3 [URL hình ảnh (nếu có)]
                  </span>
                </div>

                {/* Upload File Box */}
                <div className="border-2 border-dashed border-zinc-700/80 hover:border-teal-500 rounded-2xl p-6 text-center bg-zinc-950/60 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    id="batch-excel-input"
                    onChange={handleBatchExcelUpload}
                    className="hidden"
                  />
                  <label htmlFor="batch-excel-input" className="cursor-pointer flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-200">
                        {batchFile ? batchFile.name : "Tải lên file Excel danh sách sản phẩm (.xlsx, .xls)"}
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Kéo thả file vào đây hoặc bấm để chọn file từ máy tính
                      </div>
                    </div>
                  </label>
                </div>

                {/* Batch Table Preview */}
                {batchRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-zinc-300">
                        Danh sách sản phẩm chờ xử lý ({batchRows.length} dòng):
                      </div>
                      {isBatchRunning ? (
                        <button
                          onClick={() => { batchStopSignal.current = true; }}
                          className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold"
                        >
                          Dừng lại
                        </button>
                      ) : (
                        <button
                          onClick={handleRunBatchPipeline}
                          className="bg-teal-600 hover:bg-teal-500 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-lg shadow-teal-600/20 flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Chạy Hàng Loạt Ngay
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 overflow-y-auto border border-zinc-800 rounded-xl bg-zinc-950">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 sticky top-0">
                          <tr>
                            <th className="p-2.5 w-12">#</th>
                            <th className="p-2.5">Tên sản phẩm</th>
                            <th className="p-2.5">URL sản phẩm</th>
                            <th className="p-2.5">URL hình ảnh</th>
                            <th className="p-2.5 w-44">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                          {batchRows.map((row, i) => (
                            <tr key={row.id} className="hover:bg-zinc-900/40">
                              <td className="p-2.5 font-mono text-zinc-500">{i + 1}</td>
                              <td className="p-2.5 font-semibold text-zinc-200 truncate max-w-[200px]">{row.productName}</td>
                              <td className="p-2.5 text-zinc-400 truncate max-w-[200px]">{row.productUrl || '-'}</td>
                              <td className="p-2.5 text-zinc-400 truncate max-w-[200px]">{row.imageUrl || 'Tự đào từ URL SP'}</td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.status === 'success' 
                                    ? 'bg-emerald-500/20 text-emerald-400' 
                                    : row.status === 'processing'
                                    ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                                    : row.status === 'error'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}>
                                  {row.stepStatus || 'Chờ'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Export batch button */}
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => handleExportBatchExcel(batchRows)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-4 py-2 rounded-lg font-bold border border-zinc-700 flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                        Xuất File Excel Danh Sách Này
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STEP 2: KIỂM TRA ẢNH & ĐỔI LINK CLOUDINARY
            ========================================================================= */}
        {currentStep === 2 && (
          <div className="max-w-5xl mx-auto w-full space-y-6 animate-fade-in">
            {/* Header Toolbar */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Danh Sách Ảnh Sản Phẩm & Trạng Thái Cloudinary
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {cloudinaryCount}/{selectedImagesCount} ảnh đã được chuyển đổi sang link Cloudinary
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleUploadRemainingToCloudinary}
                    disabled={isUploadingToCloudinary || cloudinaryCount === selectedImagesCount}
                    className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3.5 py-2 rounded-xl font-bold shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CloudUpload className="w-4 h-4" />
                    {isUploadingToCloudinary 
                      ? `Đang đẩy ${uploadCloudProgress.current}/${uploadCloudProgress.total}...` 
                      : "Chuyển Đổi Ảnh Còn Lại Sang Cloudinary"}
                  </button>
                </div>
              </div>

              {/* Grid Images */}
              {product.images.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  Chưa có ảnh nào. Vui lòng quay lại Bước 1 để thực hiện Luồng 1-Step.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                  {product.images.map((img, idx) => (
                    <div
                      key={img.id}
                      className={`relative rounded-xl overflow-hidden border transition-all ${
                        img.isSelected 
                          ? 'border-emerald-500/60 bg-zinc-900 ring-1 ring-emerald-500/30' 
                          : 'border-zinc-800 bg-zinc-950 opacity-40'
                      }`}
                    >
                      <div className="aspect-square relative bg-zinc-950 flex items-center justify-center p-1">
                        <img
                          src={img.cloudinaryUrl || img.url}
                          alt=""
                          className="w-full h-full object-contain"
                        />

                        {/* Top Badges */}
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                          {img.isCover && (
                            <span className="bg-amber-500 text-black font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                              Ảnh Bìa #1
                            </span>
                          )}
                          {img.cloudinaryUrl ? (
                            <span className="bg-sky-500/90 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> Cloudinary
                            </span>
                          ) : (
                            <span className="bg-zinc-800/90 text-zinc-300 text-[9px] px-1.5 py-0.5 rounded">
                              Link Gốc
                            </span>
                          )}
                        </div>

                        {/* Checkbox select */}
                        <div className="absolute top-1.5 right-1.5">
                          <input
                            type="checkbox"
                            checked={img.isSelected}
                            onChange={() => {
                              const updated = product.images.map(m => m.id === img.id ? { ...m, isSelected: !m.isSelected } : m);
                              updateProduct({ images: updated });
                            }}
                            className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* URL Preview */}
                      <div className="p-2 bg-zinc-950 border-t border-zinc-800 text-[10px] space-y-1">
                        <div className="text-zinc-400 truncate" title={img.cloudinaryUrl || img.url}>
                          {img.cloudinaryUrl ? '⚡ ' + img.cloudinaryUrl : img.url}
                        </div>
                        {img.cloudinaryUrl && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(img.cloudinaryUrl!);
                              toast.success("Đã copy link Cloudinary!");
                            }}
                            className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
                          >
                            <Copy className="w-2.5 h-2.5" /> Copy Cloudinary URL
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stepper Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-zinc-300 hover:text-white bg-zinc-900 px-4 py-2.5 rounded-xl border border-zinc-700 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Quay lại Bước 1
              </button>

              <button
                onClick={() => setStep(3)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                Tiếp tục: Bước 3 (Kết quả & Xuất Excel)
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 3: KẾT QUẢ THÔNG TIN & XUẤT FILE EXCEL
            ========================================================================= */}
        {currentStep === 3 && (
          <div className="max-w-4xl mx-auto w-full space-y-6 animate-fade-in">
            {/* Passport card */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Kết Quả Luồng 1-Step Đã Hoàn Tất</h3>
                    <p className="text-xs text-zinc-400">Đã tạo mô tả & chuyển đổi ảnh Cloudinary sẵn sàng xuất bản</p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Sẵn Sàng Xuất File
                </span>
              </div>

              {/* Product Info Display */}
              <div className="space-y-3 bg-zinc-950/80 p-4 rounded-xl border border-zinc-800">
                <div>
                  <span className="text-xs text-zinc-400">Tên sản phẩm:</span>
                  <div className="text-sm font-bold text-zinc-100">{product.productName || 'N/A'}</div>
                </div>

                <div>
                  <span className="text-xs text-zinc-400">URL sản phẩm gốc:</span>
                  <div className="text-xs font-mono text-zinc-300 truncate">{product.sourceUrl || 'N/A'}</div>
                </div>

                <div>
                  <span className="text-xs text-zinc-400">Số lượng ảnh Cloudinary:</span>
                  <div className="text-xs font-bold text-sky-400">{cloudinaryCount} ảnh đã chuyển đổi thành công</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400">Mô tả sản phẩm tạo bởi AI (Quy chuẩn mặc định):</span>
                    {product.descriptionHtml && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                        Đầy đủ Văn bản & HTML chuẩn SEO
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-300 bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans">
                    {product.description || 'Chưa có mô tả'}
                  </div>
                </div>
              </div>

              {/* EXPORT BUTTONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <button
                  onClick={handleExportSingleExcel}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-xl shadow-lg shadow-emerald-600/20 font-bold text-left transition-all border border-emerald-500/40 flex items-center justify-between group"
                >
                  <div>
                    <div className="text-sm font-bold">Xuất File Excel Kết Quả (.xlsx)</div>
                    <div className="text-xs text-emerald-100/80 mt-0.5">Chỉ gồm: Tên SP, Ảnh đại diện, DS ảnh, Mô tả, Mô tả (HTML), Nguồn gốc</div>
                  </div>
                  <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform shrink-0" />
                </button>

                <button
                  onClick={() => {
                    const dataToCopy = {
                      tenSanPham: product.productName,
                      anhDaiDienCloudinary: product.images.find(i => i.isCover)?.cloudinaryUrl || product.images.find(i => i.isSelected)?.cloudinaryUrl || '',
                      danhSachAnhCloudinary: product.images.filter(i => i.isSelected).map(i => i.cloudinaryUrl || i.url).join('; '),
                      moTaSanPham: product.description,
                      moTaHtml: product.descriptionHtml || product.description,
                      nguonGoc: product.sourceUrl || 'N/A'
                    };
                    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
                    toast.success("Đã sao chép kết quả dạng JSON vào Clipboard!");
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white p-4 rounded-xl border border-zinc-700/80 font-bold text-left transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="text-sm font-bold text-zinc-100">Sao Chép Dữ Liệu (JSON)</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Dán nhanh vào trang tính hoặc hệ thống kho</div>
                  </div>
                  <Copy className="w-5 h-5 text-zinc-400 group-hover:text-white shrink-0" />
                </button>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setStep(2)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Quay lại xem danh sách ảnh
                </button>

                <button
                  onClick={() => {
                    setDraft(prev => ({
                      ...prev,
                      currentStep: 1,
                      product: createEmptyProduct()
                    }));
                    setInputTitle('');
                    setInputProductUrl('');
                    setInputImageUrl('');
                    toast.success("Sẵn sàng nhập sản phẩm tiếp theo!");
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-4 py-2 rounded-xl font-bold border border-zinc-700 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Nhập Sản Phẩm Mới
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ProductPipelineTab;
