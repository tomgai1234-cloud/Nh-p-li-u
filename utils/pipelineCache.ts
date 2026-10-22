/**
 * pipelineCache.ts
 * Bộ nhớ đệm (Cache) và Điều phối Liên kết giữa các Tab cho Luồng 1-Step (Pipeline)
 */

export interface PipelineImage {
  id: string;
  url: string;
  cloudinaryUrl?: string;
  uploadStatus?: 'idle' | 'uploading' | 'success' | 'error';
  isSelected: boolean;
  isCover: boolean;
  customName?: string;
  errorMsg?: string;
}

export interface PipelineProduct {
  id: string;
  sourceUrl: string;
  sourceType: string;
  productName: string;
  seoTitle: string;
  price: string;
  sku: string;
  category: string;
  images: PipelineImage[];
  description: string;
  descriptionHtml?: string;
  descriptionFormat: 'markdown' | 'html' | 'plain';
  specifications: Record<string, string>;
  lastUpdated: number;
}

export interface BatchItem {
  id: string;
  productName: string;
  productUrl: string;
  imageUrl?: string;
  // Processing outputs
  status: 'idle' | 'processing' | 'success' | 'error';
  stepStatus?: string;
  description?: string;
  descriptionHtml?: string;
  scrapedImages?: string[];
  cloudinaryUrls?: string[];
  coverCloudinaryUrl?: string;
  errorMsg?: string;
}

export interface PipelineDraft {
  mode: 'single' | 'batch';
  currentStep: 1 | 2 | 3;
  product: PipelineProduct;
  completedHistory: PipelineProduct[];
  batchItems: BatchItem[];
}

const STORAGE_KEY = 'pipeline_workspace_draft_v1';
const INCOMING_KEY = 'pipeline_incoming_transfer_v1';

export const createEmptyProduct = (): PipelineProduct => ({
  id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  sourceUrl: '',
  sourceType: 'manual',
  productName: '',
  seoTitle: '',
  price: '',
  sku: '',
  category: '',
  images: [],
  description: '',
  descriptionFormat: 'markdown',
  specifications: {},
  lastUpdated: Date.now(),
});

export const loadPipelineDraft = (): PipelineDraft => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.product) {
        return {
          mode: parsed.mode || 'single',
          currentStep: (parsed.currentStep >= 1 && parsed.currentStep <= 3) ? parsed.currentStep : 1,
          product: {
            ...createEmptyProduct(),
            ...parsed.product,
          },
          completedHistory: Array.isArray(parsed.completedHistory) ? parsed.completedHistory : [],
          batchItems: Array.isArray(parsed.batchItems) ? parsed.batchItems : [],
        };
      }
    }
  } catch (e) {
    console.warn("Lỗi khi đọc pipeline draft từ localStorage:", e);
  }

  return {
    mode: 'single',
    currentStep: 1,
    product: createEmptyProduct(),
    completedHistory: [],
    batchItems: [],
  };
};

export const savePipelineDraft = (draft: PipelineDraft): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pipeline-draft-synced', { detail: draft }));
    }
  } catch (e) {
    console.error("Lỗi khi lưu pipeline draft:", e);
  }
};

/**
 * Hàm gọi từ BẤT KỲ tab nào (Shopee Scraper, Đào ảnh, Lấy thuộc tính, v.v.)
 * để đẩy dữ liệu trực tiếp vào Luồng 1-Step
 */
export const pushDataToPipeline = (data: {
  title?: string;
  url?: string;
  sourceType?: string;
  price?: string;
  sku?: string;
  images?: string[];
  description?: string;
  specifications?: Record<string, string>;
  sourceTabLabel?: string;
}): void => {
  try {
    const transferPayload = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(INCOMING_KEY, JSON.stringify(transferPayload));

    // Cập nhật luôn vào bản nháp hiện tại của Pipeline
    const currentDraft = loadPipelineDraft();
    const newImages: PipelineImage[] = (data.images || []).map((imgUrl, idx) => ({
      id: `img_${Date.now()}_${idx}`,
      url: imgUrl,
      isSelected: true,
      isCover: idx === 0,
    }));

    // Gộp dữ liệu mới
    currentDraft.product = {
      ...currentDraft.product,
      productName: data.title || currentDraft.product.productName,
      seoTitle: data.title || currentDraft.product.seoTitle,
      sourceUrl: data.url || currentDraft.product.sourceUrl,
      sourceType: data.sourceType || currentDraft.product.sourceType || 'tab-transfer',
      price: data.price || currentDraft.product.price,
      sku: data.sku || currentDraft.product.sku,
      images: newImages.length > 0 ? newImages : currentDraft.product.images,
      description: data.description || currentDraft.product.description,
      specifications: data.specifications || currentDraft.product.specifications,
      lastUpdated: Date.now(),
    };

    // Tự động nhảy sang Bước 2 nếu đã có ảnh & tên
    if (newImages.length > 0 && currentDraft.product.productName) {
      currentDraft.currentStep = 2;
    }

    savePipelineDraft(currentDraft);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pipeline-incoming-data', { detail: transferPayload }));
    }
  } catch (err) {
    console.error("Lỗi khi chuyển dữ liệu sang Pipeline:", err);
  }
};

export const checkIncomingTransfer = (): any | null => {
  try {
    const raw = localStorage.getItem(INCOMING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Chỉ lấy nếu dưới 30 phút
    if (Date.now() - (parsed.timestamp || 0) < 30 * 60 * 1000) {
      return parsed;
    }
    localStorage.removeItem(INCOMING_KEY);
  } catch (e) {
    return null;
  }
  return null;
};

export const clearIncomingTransfer = (): void => {
  try {
    localStorage.removeItem(INCOMING_KEY);
  } catch (e) {
    // ignore
  }
};
