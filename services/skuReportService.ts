import { openDB, DBSchema, IDBPDatabase } from 'idb';
import * as XLSX from 'xlsx';

export interface SkuRecord {
  sku: string; // Mã SKU (Primary Key)
  productId: string; // ID sản phẩm
  productName: string; // Tên sản phẩm
  displayName?: string; // Tên hiển thị
  productType?: string; // Loại sản phẩm
  category: string; // Tên danh mục ngành hàng
  normalizedCategory: string; // Ngành hàng chuẩn hóa (Mẹ và Bé, Thời trang...)
  brand: string; // Tên thương hiệu
  status: string; // Trạng thái (Hoạt động / ...)
  tax?: string; // Thuế bán ra
  supplier?: string; // Danh sách tên NCC
  shippingType?: string; // Phân loại vận chuyển
  unit?: string; // Tên đơn vị tính cơ sở
  variantName?: string; // Tên biến thể
  detailedDisplayName?: string; // Tên hiển thị chi tiết
  barcode?: string; // Mã vạch
  partNumber?: string; // Part number
  storeGroupCode?: string; // Mã nhóm điểm bán

  // Cột tự động sinh từ 4 số đầu SKU
  monthYear: string; // "2026-09" (Chuẩn YYYY-MM trích xuất từ 4 số đầu SKU để lọc thời gian)
  creationYear: number; // Ví dụ 2026 từ "26"
  creationMonth: number; // Ví dụ 9 từ "09"
  creationPeriod: string; // "Tháng 09/2026"
  creationYearMonth: string; // "2026-09"
  rawDateCode: string; // "2609"

  // Cấu trúc sản phẩm biến thể
  isVariant: boolean; // true nếu là biến thể con (khoảng trống ở ID), false nếu là sản phẩm đơn
  parentProductId: string; // ID sản phẩm chính (Parent ID)

  // Thông tin quản lý đợt
  batchId: string;
  batchName: string;
  weekName?: string;
  isNewInBatch?: boolean;
  originalRowIndex?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ReportFilterOptions {
  filterMode: 'auto-batch' | 'period' | 'custom-row-count' | 'custom-row-range' | 'batch' | 'all';
  periodKey?: string;
  batchId?: string;
  rowCount?: number;
  rowRangeStart?: number;
  rowRangeEnd?: number;
}

export interface UploadBatch {
  id: string;
  name: string;
  periodKey: string;
  fileName: string;
  totalRows: number;
  newSkusCount: number;
  updatedSkusCount: number;
  createdAt: number;
}

export interface CategorySummaryItem {
  category: string;
  productCount: number; // Số lượng ID sản phẩm duy nhất
  skuCount: number; // Số lượng SKU
  percentage: number; // % trên tổng SKU
}

export interface ReportStats {
  periodKey: string;
  periodLabel: string;
  // Số liệu trong kỳ lọc (Onsite mới)
  newPeriod: {
    totalProducts: number;
    totalSkus: number;
    activeSkus: number;
    activeRatio: number;
    categories: CategorySummaryItem[];
    topCategory: { name: string; products: number; skus: number } | null;
    topBrand: { name: string; category: string; skus: number } | null;
    brandsCount: number;
    topBrandsList: { brand: string; category: string; count: number }[];
  };
  // Số liệu lũy kế toàn bộ hệ thống (Tổng đang có trên VNS)
  allTime: {
    totalProducts: number;
    totalSkus: number;
    categories: CategorySummaryItem[];
  };
}

interface SkuDB extends DBSchema {
  skus: {
    key: string;
    value: SkuRecord;
    indexes: {
      'by-productId': string;
      'by-period': string;
      'by-category': string;
      'by-brand': string;
      'by-batchId': string;
      'by-createdAt': number;
      'by-updatedAt': number;
    };
  };
  batches: {
    key: string;
    value: UploadBatch;
    indexes: {
      'by-createdAt': number;
    };
  };
}

const DB_NAME = 'vnsSkuMasterDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SkuDB>> | null = null;

export const getSkuDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<SkuDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('skus')) {
          const skuStore = db.createObjectStore('skus', { keyPath: 'sku' });
          skuStore.createIndex('by-productId', 'productId');
          skuStore.createIndex('by-period', 'creationYearMonth');
          skuStore.createIndex('by-category', 'normalizedCategory');
          skuStore.createIndex('by-brand', 'brand');
          skuStore.createIndex('by-batchId', 'batchId');
          skuStore.createIndex('by-createdAt', 'createdAt');
          skuStore.createIndex('by-updatedAt', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('batches')) {
          const batchStore = db.createObjectStore('batches', { keyPath: 'id' });
          batchStore.createIndex('by-createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
};

// --- Chuẩn hóa 4 số đầu SKU thành Năm / Tháng (VD: 2609 -> 2026-09) ---
export function parseSkuCreationDate(sku: string): {
  year: number;
  month: number;
  monthYear: string;
  periodKey: string;
  periodLabel: string;
  rawDateCode: string;
} {
  if (!sku || typeof sku !== 'string') {
    return {
      year: 2026,
      month: 9,
      monthYear: '2026-09',
      periodKey: '2026-09',
      periodLabel: 'Tháng 09/2026',
      rawDateCode: '2609'
    };
  }

  const clean = sku.trim();
  const match = clean.match(/^(\d{2})(\d{2})/);
  if (match) {
    const yy = parseInt(match[1], 10);
    const mm = parseInt(match[2], 10);
    if (mm >= 1 && mm <= 12) {
      const year = 2000 + yy;
      const monthStr = mm < 10 ? `0${mm}` : `${mm}`;
      const my = `${year}-${monthStr}`;
      return {
        year,
        month: mm,
        monthYear: my,
        periodKey: my,
        periodLabel: `Tháng ${monthStr}/${year}`,
        rawDateCode: `${match[1]}${monthStr}`
      };
    }
  }

  // Fallback an toàn nếu SKU đặc biệt
  return {
    year: 2026,
    month: 9,
    monthYear: '2026-09',
    periodKey: '2026-09',
    periodLabel: 'Tháng 09/2026',
    rawDateCode: '2609'
  };
}

// --- Chuẩn hóa danh mục ngành hàng theo chuẩn VNS (như trong ảnh mẫu 2, 4, 5) ---
export const CANONICAL_CATEGORIES = [
  'Mẹ và Bé',
  'Bách hóa online',
  'Sức khỏe và Làm đẹp',
  'Đồ công nghệ (ICT)',
  'Điện gia dụng',
  'Nhà cửa và đời sống',
  'Thời trang',
  'Thể thao & dã ngoại',
  'Sách, Văn phòng phẩm và Quà tặng',
  'Dịch vụ - Phiếu mua hàng',
  'Khác'
] as const;

export function normalizeCategory(rawCat: string): string {
  if (!rawCat || typeof rawCat !== 'string') return 'Khác';
  const c = rawCat.trim().toLowerCase();

  if (c.includes('mẹ') || c.includes('bé') || c.includes('baby') || c.includes('bỉm') || c.includes('sữa')) {
    return 'Mẹ và Bé';
  }
  if (c.includes('bách hóa') || c.includes('thực phẩm') || c.includes('tiêu dùng') || c.includes('fmcg') || c.includes('đồ uống')) {
    return 'Bách hóa online';
  }
  if (c.includes('sức khỏe') || c.includes('làm đẹp') || c.includes('mỹ phẩm') || c.includes('chăm sóc')) {
    return 'Sức khỏe và Làm đẹp';
  }
  if (c.includes('công nghệ') || c.includes('điện tử') || c.includes('ict') || c.includes('màn hình') || c.includes('laptop') || c.includes('điện thoại') || c.includes('camera') || c.includes('pc') || c.includes('mini asus')) {
    return 'Đồ công nghệ (ICT)';
  }
  if (c.includes('gia dụng') || c.includes('điện lạnh') || c.includes('nồi') || c.includes('bếp') || c.includes('quạt') || c.includes('máy giặt')) {
    return 'Điện gia dụng';
  }
  if (c.includes('nhà cửa') || c.includes('đời sống') || c.includes('nội thất') || c.includes('gia đình') || c.includes('chăn ga')) {
    return 'Nhà cửa và đời sống';
  }
  if (c.includes('thời trang') || c.includes('quần') || c.includes('áo') || c.includes('giày') || c.includes('dép') || c.includes('túi') || c.includes('ví') || c.includes('đồng hồ')) {
    return 'Thời trang';
  }
  if (c.includes('thể thao') || c.includes('dã ngoại') || c.includes('sport') || c.includes('fitness') || c.includes('gym') || c.includes('golf') || c.includes('bóng')) {
    return 'Thể thao & dã ngoại';
  }
  if (c.includes('sách') || c.includes('văn phòng phẩm') || c.includes('quà tặng') || c.includes('bút') || c.includes('vở')) {
    return 'Sách, Văn phòng phẩm và Quà tặng';
  }
  if (c.includes('dịch vụ') || c.includes('voucher') || c.includes('phiếu') || c.includes('vé')) {
    return 'Dịch vụ - Phiếu mua hàng';
  }

  // Khớp chính xác tên nếu đã trùng
  for (const cat of CANONICAL_CATEGORIES) {
    if (c === cat.toLowerCase()) return cat;
  }

  return rawCat.trim() || 'Khác';
}

export interface UpsertResult {
  total: number;
  newCount: number;
  updatedCount: number;
  newRecords: SkuRecord[];
  allBatchRecords: SkuRecord[];
}

// --- Xử lý nạp & Cập nhật dữ liệu hàng loạt (Upserting) ---
export async function upsertSkuRecords(
  records: Omit<SkuRecord, 'isNewInBatch' | 'createdAt' | 'updatedAt'>[],
  batchInfo: { id: string; name: string; periodKey: string; fileName: string },
  onProgress?: (processed: number, total: number) => void
): Promise<UpsertResult> {
  const db = await getSkuDB();
  const total = records.length;
  let newCount = 0;
  let updatedCount = 0;
  const newRecords: SkuRecord[] = [];
  const allBatchRecords: SkuRecord[] = [];

  // Reset cờ isNewInBatch của các đợt nạp trước đó
  const resetTx = db.transaction('skus', 'readwrite');
  const resetStore = resetTx.objectStore('skus');
  let resetCursor = await resetStore.openCursor();
  while (resetCursor) {
    if (resetCursor.value.isNewInBatch) {
      await resetCursor.update({ ...resetCursor.value, isNewInBatch: false });
    }
    resetCursor = await resetCursor.continue();
  }
  await resetTx.done;

  const chunkSize = 2500;
  const now = Date.now();

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const tx = db.transaction('skus', 'readwrite');
    const store = tx.objectStore('skus');

    for (const item of chunk) {
      const existing = await store.get(item.sku);
      if (existing) {
        // Cập nhật thông tin các cột mới, giữ nguyên ngày tạo gốc
        const updatedRecord: SkuRecord = {
          ...existing,
          ...item,
          monthYear: item.monthYear || existing.monthYear || item.creationYearMonth || '2026-09',
          isVariant: item.isVariant ?? existing.isVariant ?? false,
          parentProductId: item.parentProductId || existing.parentProductId || item.productId,
          creationYear: item.creationYear || existing.creationYear,
          creationMonth: item.creationMonth || existing.creationMonth,
          creationPeriod: item.creationPeriod || existing.creationPeriod,
          creationYearMonth: item.creationYearMonth || existing.creationYearMonth,
          rawDateCode: item.rawDateCode || existing.rawDateCode,
          batchId: batchInfo.id,
          batchName: batchInfo.name,
          isNewInBatch: false,
          updatedAt: now,
        };
        await store.put(updatedRecord);
        updatedCount++;
        allBatchRecords.push(updatedRecord);
      } else {
        // Thêm mới SKU
        const newRecord: SkuRecord = {
          ...item,
          monthYear: item.monthYear || item.creationYearMonth || '2026-09',
          isVariant: item.isVariant ?? false,
          parentProductId: item.parentProductId || item.productId,
          batchId: batchInfo.id,
          batchName: batchInfo.name,
          isNewInBatch: true,
          createdAt: now,
          updatedAt: now,
        };
        await store.put(newRecord);
        newCount++;
        newRecords.push(newRecord);
        allBatchRecords.push(newRecord);
      }
    }

    await tx.done;
    if (onProgress) {
      onProgress(Math.min(i + chunkSize, total), total);
    }
  }

  // Lưu thông tin batch
  const batchTx = db.transaction('batches', 'readwrite');
  await batchTx.objectStore('batches').put({
    id: batchInfo.id,
    name: batchInfo.name,
    periodKey: batchInfo.periodKey,
    fileName: batchInfo.fileName,
    totalRows: total,
    newSkusCount: newCount,
    updatedSkusCount: updatedCount,
    createdAt: now,
  });
  await batchTx.done;

  return { total, newCount, updatedCount, newRecords, allBatchRecords };
}

// --- Tính toán thống kê báo cáo theo Kỳ lọc & Toàn bộ hệ thống ---
export async function calculateReportStats(filterInput?: ReportFilterOptions | string): Promise<ReportStats> {
  const db = await getSkuDB();
  const allRecords = await db.getAll('skus');

  // Chuẩn hóa tùy chọn lọc
  let filterOpts: ReportFilterOptions;
  if (!filterInput) {
    filterOpts = { filterMode: 'period' };
  } else if (typeof filterInput === 'string') {
    filterOpts = { filterMode: 'period', periodKey: filterInput };
  } else {
    filterOpts = filterInput;
  }

  // 1. Phân loại tập dữ liệu "Hệ thống mới" (Onsite mới)
  let periodRecords: SkuRecord[] = [];
  let periodLabel = 'Kỳ báo cáo';
  let targetPeriod = filterOpts.periodKey || '2026-09';

  if (filterOpts.filterMode === 'auto-batch') {
    // Tự động lấy các SKU mới trong đợt nạp
    const newItems = allRecords.filter(r => r.isNewInBatch);
    if (newItems.length > 0) {
      periodRecords = newItems;
      periodLabel = 'Đợt nạp mới nhất (Tự động)';
    } else {
      // Fallback lấy đợt nạp gần nhất
      const batches = await db.getAll('batches');
      const latestBatch = batches.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (latestBatch) {
        periodRecords = allRecords.filter(r => r.batchId === latestBatch.id);
        periodLabel = latestBatch.name || 'Đợt nạp gần nhất';
      } else {
        periodRecords = allRecords;
        periodLabel = 'Tất cả dữ liệu';
      }
    }
  } else if (filterOpts.filterMode === 'custom-row-count') {
    // Người dùng chỉ định số dòng SKU mới từ đầu file (VD: 1440 hoặc 1423 dòng)
    const count = Math.max(1, filterOpts.rowCount || 1440);
    // Sắp xếp theo thứ tự dòng gốc nếu có
    const sorted = [...allRecords].sort((a, b) => (a.originalRowIndex || 0) - (b.originalRowIndex || 0));
    periodRecords = sorted.slice(0, count);
    periodLabel = `${count.toLocaleString()} dòng SKU đầu tiên`;
  } else if (filterOpts.filterMode === 'custom-row-range') {
    // Người dùng chỉ định khoảng dòng (Từ dòng A đến dòng B)
    const start = Math.max(1, filterOpts.rowRangeStart || 1);
    const end = Math.max(start, filterOpts.rowRangeEnd || allRecords.length);
    const sorted = [...allRecords].sort((a, b) => (a.originalRowIndex || 0) - (b.originalRowIndex || 0));
    periodRecords = sorted.slice(start - 1, end);
    periodLabel = `Từ dòng ${start.toLocaleString()} đến ${end.toLocaleString()}`;
  } else if (filterOpts.filterMode === 'batch') {
    // Lọc theo một đợt nạp file thô cụ thể từ lịch sử
    const batches = await db.getAll('batches');
    const matchedBatch = batches.find(b => b.id === filterOpts.batchId);
    if (filterOpts.batchId) {
      periodRecords = allRecords.filter(r => r.batchId === filterOpts.batchId);
    } else {
      periodRecords = allRecords;
    }
    periodLabel = matchedBatch ? `Đợt: ${matchedBatch.name}` : 'Đợt nạp đã chọn';
  } else {
    // Lọc theo Tháng/Năm từ 4 số đầu SKU (mặc định)
    if (!targetPeriod && allRecords.length > 0) {
      const periods = Array.from(new Set(allRecords.map(r => r.creationYearMonth))).sort().reverse();
      targetPeriod = periods[0] || '2026-09';
    }
    periodRecords = allRecords.filter(r => r.creationYearMonth === targetPeriod);
    const [y, m] = targetPeriod.split('-');
    periodLabel = `Tháng ${m}/${y}`;
  }

  // Nhóm theo ngành hàng cho kỳ lọc
  const periodCatMap = new Map<string, { products: Set<string>; skus: Set<string> }>();
  const allTimeCatMap = new Map<string, { products: Set<string>; skus: Set<string> }>();
  const brandCountMap = new Map<string, { brand: string; category: string; count: number }>();

  // Khởi tạo tất cả ngành hàng chuẩn để bảng luôn đầy đủ các mục như Ảnh 2 & 5
  CANONICAL_CATEGORIES.forEach(cat => {
    periodCatMap.set(cat, { products: new Set(), skus: new Set() });
    allTimeCatMap.set(cat, { products: new Set(), skus: new Set() });
  });

  let periodActiveSkus = 0;

  for (const r of periodRecords) {
    const cat = r.normalizedCategory || 'Khác';
    if (!periodCatMap.has(cat)) {
      periodCatMap.set(cat, { products: new Set(), skus: new Set() });
    }
    const catData = periodCatMap.get(cat)!;
    catData.products.add(r.productId);
    catData.skus.add(r.sku);

    // Đếm trạng thái hoạt động
    const st = (r.status || '').toLowerCase();
    if (st.includes('hoạt động') || st.includes('active') || st.includes('đang bán')) {
      periodActiveSkus++;
    }

    // Đếm thương hiệu
    if (r.brand && r.brand.trim() && r.brand.trim() !== 'N/A') {
      const bName = r.brand.trim();
      const current = brandCountMap.get(bName) || { brand: bName, category: cat, count: 0 };
      current.count++;
      brandCountMap.set(bName, current);
    }
  }

  // 2. Phân loại toàn bộ hệ thống (All-Time)
  const allTimeProducts = new Set<string>();
  const allTimeSkus = new Set<string>();

  for (const r of allRecords) {
    allTimeProducts.add(r.productId);
    allTimeSkus.add(r.sku);

    const cat = r.normalizedCategory || 'Khác';
    if (!allTimeCatMap.has(cat)) {
      allTimeCatMap.set(cat, { products: new Set(), skus: new Set() });
    }
    const catData = allTimeCatMap.get(cat)!;
    catData.products.add(r.productId);
    catData.skus.add(r.sku);
  }

  const periodTotalSkus = periodRecords.length;
  const periodTotalProducts = new Set(periodRecords.map(r => r.productId)).size;

  // Xây dựng danh sách danh mục cho kỳ lọc
  const periodCategories: CategorySummaryItem[] = [];
  periodCatMap.forEach((val, catName) => {
    const skuCount = val.skus.size;
    const percentage = periodTotalSkus > 0 ? (skuCount / periodTotalSkus) * 100 : 0;
    periodCategories.push({
      category: catName,
      productCount: val.products.size,
      skuCount,
      percentage: Math.round(percentage * 10) / 10
    });
  });

  // Xây dựng danh sách danh mục cho toàn bộ hệ thống
  const allTimeTotalSkus = allRecords.length;
  const allTimeCategories: CategorySummaryItem[] = [];
  allTimeCatMap.forEach((val, catName) => {
    const skuCount = val.skus.size;
    const percentage = allTimeTotalSkus > 0 ? (skuCount / allTimeTotalSkus) * 100 : 0;
    allTimeCategories.push({
      category: catName,
      productCount: val.products.size,
      skuCount,
      percentage: Math.round(percentage * 10) / 10
    });
  });

  // Tìm ngành hàng cao nhất trong kỳ
  let topCategory: { name: string; products: number; skus: number } | null = null;
  periodCategories.forEach(c => {
    if (!topCategory || c.skuCount > topCategory.skus) {
      if (c.skuCount > 0) {
        topCategory = { name: c.category, products: c.productCount, skus: c.skuCount };
      }
    }
  });

  // Top thương hiệu
  const sortedBrands = Array.from(brandCountMap.values()).sort((a, b) => b.count - a.count);
  const topBrand = sortedBrands[0] ? { name: sortedBrands[0].brand, category: sortedBrands[0].category, skus: sortedBrands[0].count } : null;

  const activeRatio = periodTotalSkus > 0 ? Math.round((periodActiveSkus / periodTotalSkus) * 100) : 100;

  return {
    periodKey: targetPeriod,
    periodLabel,
    newPeriod: {
      totalProducts: periodTotalProducts,
      totalSkus: periodTotalSkus,
      activeSkus: periodActiveSkus,
      activeRatio,
      categories: periodCategories,
      topCategory,
      topBrand,
      brandsCount: brandCountMap.size,
      topBrandsList: sortedBrands.slice(0, 5),
    },
    allTime: {
      totalProducts: allTimeProducts.size,
      totalSkus: allTimeSkus.size,
      categories: allTimeCategories,
    }
  };
}

// --- Lấy danh sách tất cả các Kỳ (Tháng/Năm) có sẵn trong Database ---
export async function getAvailablePeriods(): Promise<{ key: string; label: string; count: number }[]> {
  const db = await getSkuDB();
  const allRecords = await db.getAll('skus');
  const countMap = new Map<string, number>();

  for (const r of allRecords) {
    const p = r.creationYearMonth || '2026-09';
    countMap.set(p, (countMap.get(p) || 0) + 1);
  }

  return Array.from(countMap.entries())
    .map(([key, count]) => {
      const [year, month] = key.split('-');
      return {
        key,
        label: `Tháng ${month}/${year}`,
        count
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));
}

// --- Lấy danh sách lịch sử các đợt nạp file thô ---
export async function getUploadBatches(): Promise<UploadBatch[]> {
  const db = await getSkuDB();
  const batches = await db.getAll('batches');
  return batches.sort((a, b) => b.createdAt - a.createdAt);
}

// --- Xóa một đợt nạp khỏi lịch sử ---
export async function deleteUploadBatch(batchId: string): Promise<void> {
  const db = await getSkuDB();
  const tx = db.transaction(['batches', 'skus'], 'readwrite');
  await tx.objectStore('batches').delete(batchId);
  // Cập nhật các SKU thuộc batch này (hoặc xóa nếu là batch duy nhất)
  const skuStore = tx.objectStore('skus');
  const index = skuStore.index('by-batchId');
  let cursor = await index.openCursor(batchId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// --- Lấy tổng số lượng bản ghi hiện có ---
export async function getTotalSkuCount(): Promise<number> {
  const db = await getSkuDB();
  return await db.count('skus');
}

// --- Xóa toàn bộ dữ liệu SKU để làm mới ---
export async function clearSkuMasterDB(): Promise<void> {
  const db = await getSkuDB();
  const tx = db.transaction(['skus', 'batches'], 'readwrite');
  await tx.objectStore('skus').clear();
  await tx.objectStore('batches').clear();
  await tx.done;
}

// --- Xuất báo cáo ra file Excel hoàn chỉnh (.xlsx) ---
export function exportReportToExcel(stats: ReportStats, detailedSkus: SkuRecord[] = []) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Bảng số liệu Tổng hợp (Khớp đúng biểu mẫu Ảnh 2 & Ảnh 5)
  const summaryRows: any[] = [];
  summaryRows.push(['BÁO CÁO NHẬP LIỆU & PHÂN TÍCH SKU ONSITE']);
  summaryRows.push([`Kỳ báo cáo: ${stats.periodLabel}`, `Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`]);
  summaryRows.push([]);

  // Tiêu đề phần 1: Onsite mới
  summaryRows.push(['1. SỐ LƯỢNG SẢN PHẨM ONSITE MỚI', '', '', '']);
  summaryRows.push(['Ngành hàng (Category)', 'Sản phẩm', 'SKUs', 'Tỷ trọng %']);
  
  stats.newPeriod.categories.forEach(c => {
    summaryRows.push([c.category, c.productCount, c.skuCount, `${c.percentage}%`]);
  });
  summaryRows.push(['TỔNG SỐ LƯỢNG MỚI (TOTAL)', stats.newPeriod.totalProducts, stats.newPeriod.totalSkus, '100%']);
  summaryRows.push([]);

  // Tiêu đề phần 2: Tổng sản phẩm đang có trên VNS
  summaryRows.push(['2. TỔNG SẢN PHẨM ĐANG CÓ TRÊN VNS (LŨY KẾ)', '', '', '']);
  summaryRows.push(['Ngành hàng (Category)', 'Sản phẩm', 'SKUs', 'Tỷ trọng %']);
  stats.allTime.categories.forEach(c => {
    summaryRows.push([c.category, c.productCount, c.skuCount, `${c.percentage}%`]);
  });
  summaryRows.push(['TỔNG LŨY KẾ TOÀN HỆ THỐNG (GRAND TOTAL)', stats.allTime.totalProducts, stats.allTime.totalSkus, '100%']);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Báo Cáo Tổng Hợp');

  // Sheet 2: Danh sách chi tiết SKU kèm cột Tháng/Năm tạo tự động (Ảnh 1 + Yêu cầu)
  if (detailedSkus.length > 0) {
    const detailHeaders = [
      'STT',
      'ID sản phẩm chính (Parent ID)',
      'Mã SKU con',
      'Loại sản phẩm',
      'Tháng/Năm',
      'Kỳ tạo chi tiết',
      'Năm tạo',
      'Tháng tạo',
      'Trạng thái',
      'Tên sản phẩm',
      'Tên biến thể',
      'Tên hiển thị',
      'Loại sản phẩm (gốc)',
      'Ngành hàng chuẩn hóa',
      'Tên danh mục gốc',
      'Tên thương hiệu',
      'Thuế bán ra',
      'Danh sách tên NCC',
      'Phân loại vận chuyển',
      'Đơn vị tính',
      'Mã vạch',
      'Part number',
      'Mã nhóm điểm bán',
      'Đợt nhập'
    ];

    const detailRows = detailedSkus.slice(0, 50000).map((r, idx) => [
      idx + 1,
      r.productId,
      r.sku,
      r.isVariant ? 'Biến thể' : 'Sản phẩm đơn',
      r.monthYear || r.creationYearMonth || '2026-09',
      r.creationPeriod,
      r.creationYear,
      r.creationMonth,
      r.status,
      r.productName,
      r.variantName || '',
      r.displayName || '',
      r.productType || '',
      r.normalizedCategory,
      r.category,
      r.brand,
      r.tax || '',
      r.supplier || '',
      r.shippingType || '',
      r.unit || '',
      r.barcode || '',
      r.partNumber || '',
      r.storeGroupCode || '',
      r.batchName || ''
    ]);

    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi Tiết SKU (Đã Map Ngày)');
  }

  // Tải file về
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Bao_Cao_SKU_${stats.periodKey}_${dateStr}.xlsx`);
}

// --- Hàm phân tích trực tiếp mảng dòng Excel/CSV (100% tin cậy, không phụ thuộc Web Worker iframe) ---
export function parseRawSheetRows(
  rows: any[][],
  batchId: string,
  batchName: string
): SkuRecord[] {
  if (!rows || rows.length < 2) {
    throw new Error('File không chứa đủ dữ liệu tiêu đề và hàng.');
  }

  // Tự động quét tìm dòng chứa tiêu đề thực tế trong 10 dòng đầu
  let headerRowIndex = 0;
  let maxColMatches = -1;
  const headerKeywords = ['sku', 'sản phẩm', 'product', 'tên', 'danh mục', 'ngành hàng', 'thương hiệu', 'trạng thái', 'mã'];

  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const rowStr = (rows[r] || []).map(cell => String(cell || '').toLowerCase()).join(' ');
    let matches = 0;
    for (const kw of headerKeywords) {
      if (rowStr.includes(kw)) matches++;
    }
    if (matches > maxColMatches) {
      maxColMatches = matches;
      headerRowIndex = r;
    }
  }

  const rawHeaders = rows[headerRowIndex].map(h => String(h || '').trim());

  const findColIndex = (headers: string[], candidates: string[]): number => {
    for (const cand of candidates) {
      const target = cand.toLowerCase().replace(/[\s_\-–*]/g, '');
      const idx = headers.findIndex(h => {
        const cleanH = String(h || '').toLowerCase().replace(/[\s_\-–*]/g, '');
        return cleanH === target || cleanH.includes(target) || target.includes(cleanH);
      });
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxProductId = findColIndex(rawHeaders, ['id sản phẩm', 'idsảnphẩm', 'mã sản phẩm cha', 'product id', 'productid', 'id sp', 'idsp', 'mã cha', 'id cha', 'mã cha con', 'parent id', 'parentid', 'mã sp cha', 'mã gốc', 'mã hàng cha', 'id']);
  const idxSku = findColIndex(rawHeaders, ['mã sku', 'mãsku', 'sku', 'sku code', 'skucode', 'mã hàng', 'mã con', 'sku con', 'mã biến thể', 'mã hàng bán', 'mã sp con', 'mã sản phẩm', 'item code', 'itemcode', 'barcode/sku']);
  const idxStatus = findColIndex(rawHeaders, ['trạng thái', 'status', 'tình trạng', 'trạng thái sku', 'trạng thái sản phẩm']);
  const idxProductName = findColIndex(rawHeaders, ['tên sản phẩm', 'tênsảnphẩm', 'product name', 'productname', 'tên hàng', 'tên sp', 'tiêu đề']);
  const idxDisplayName = findColIndex(rawHeaders, ['tên hiển thị', 'tênhiểnthị', 'display name']);
  const idxProductType = findColIndex(rawHeaders, ['loại sản phẩm', 'loạisảnphẩm', 'loại']);
  const idxCategory = findColIndex(rawHeaders, ['tên danh mục ngành hàng', 'danh mục ngành hàng', 'ngành hàng', 'danh mục', 'category', 'nhóm hàng', 'ngành hàng cấp 1', 'ngành hàng cấp 2']);
  const idxBrand = findColIndex(rawHeaders, ['tên thương hiệu', 'thương hiệu', 'brand', 'nhãn hiệu', 'hãng']);
  const idxTax = findColIndex(rawHeaders, ['thuế bán ra', 'thuế', 'vat', 'tax']);
  const idxSupplier = findColIndex(rawHeaders, ['danh sách tên ncc', 'tên ncc', 'nhà cung cấp', 'ncc', 'supplier']);
  const idxShippingType = findColIndex(rawHeaders, ['phân loại vận chuyển', 'vận chuyển', 'shipping']);
  const idxUnit = findColIndex(rawHeaders, ['tên đơn vị tính', 'đơn vị tính', 'đvt', 'dvt', 'unit']);
  const idxVariantName = findColIndex(rawHeaders, ['tên biến thể', 'biến thể', 'phân loại hàng', 'tên phân loại', 'variant']);
  const idxDetailedDisplayName = findColIndex(rawHeaders, ['tên hiển thị chi tiết']);
  const idxBarcode = findColIndex(rawHeaders, ['mã vạch', 'barcode']);
  const idxPartNumber = findColIndex(rawHeaders, ['part number', 'partnumber']);
  const idxStoreGroup = findColIndex(rawHeaders, ['mã nhóm điểm bán', 'điểm bán']);
  let idxDateCode = findColIndex(rawHeaders, ['mã kỳ', 'kỳ tạo', 'năm/tháng', 'tháng/năm', 'tháng tạo', 'năm tạo', '2609']);

  if (idxDateCode === -1 && idxProductId !== -1 && idxSku !== -1 && Math.abs(idxSku - idxProductId) === 2) {
    const middleIdx = Math.min(idxProductId, idxSku) + 1;
    const sampleVal = String(rows[headerRowIndex + 1]?.[middleIdx] || '').trim();
    if (/^\d{4}$/.test(sampleVal)) {
      idxDateCode = middleIdx;
    }
  }

  // Fallback thông minh: nếu không tìm thấy cột SKU hoặc ID, quét mẫu dữ liệu
  let effIdxPid = idxProductId;
  let effIdxSku = idxSku;

  if (effIdxSku === -1) {
    // Thử tìm cột có dạng chuỗi mã SKU (VD: 2609..., P00..., V00... hoặc mã alphanumeric)
    for (let c = 0; c < Math.min(15, (rows[headerRowIndex + 1] || []).length); c++) {
      if (c === effIdxPid) continue;
      const sample = String(rows[headerRowIndex + 1]?.[c] || '').trim();
      if (/^\d{4}[A-Za-z0-9]+/.test(sample) || /^[A-Za-z0-9_\-]{4,30}$/.test(sample)) {
        effIdxSku = c;
        break;
      }
    }
    if (effIdxSku === -1) effIdxSku = 3;
  }

  if (effIdxPid === -1) {
    effIdxPid = 1;
  }

  const dataRows = rows.slice(headerRowIndex + 1);
  const totalRows = dataRows.length;
  const records: SkuRecord[] = [];

  let currentParentProductId = '';
  let currentParentProductName = '';
  let currentParentDisplayName = '';
  let currentParentCategory = '';
  let currentParentNormalizedCat = 'Khác';
  let currentParentBrand = 'N/A';
  let currentParentProductType = 'Hàng bán';
  let currentParentStatus = 'Hoạt động';
  let currentParentTax = '';
  let currentParentSupplier = '';
  let currentParentShipping = '';
  let currentParentUnit = 'Cái';
  let currentParentDateCode = '2609';

  for (let i = 0; i < totalRows; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;

    const rawSku = effIdxSku !== -1 ? String(row[effIdxSku] || '').trim() : '';
    const rawPid = effIdxPid !== -1 ? String(row[effIdxPid] || '').trim() : '';
    const rawProductName = idxProductName !== -1 ? String(row[idxProductName] || '').trim() : (row[5] ? String(row[5]).trim() : '');
    const rawDisplayName = idxDisplayName !== -1 ? String(row[idxDisplayName] || '').trim() : (row[6] ? String(row[6]).trim() : '');
    const rawCategory = idxCategory !== -1 ? String(row[idxCategory] || '').trim() : (row[8] ? String(row[8]).trim() : '');
    const rawBrand = idxBrand !== -1 ? String(row[idxBrand] || '').trim() : (row[9] ? String(row[9]).trim() : '');
    const rawStatus = idxStatus !== -1 ? String(row[idxStatus] || '').trim() : (row[4] ? String(row[4]).trim() : '');
    const rawProductType = idxProductType !== -1 ? String(row[idxProductType] || '').trim() : (row[7] ? String(row[7]).trim() : '');
    const rawTax = idxTax !== -1 ? String(row[idxTax] || '').trim() : (row[10] ? String(row[10]).trim() : '');
    const rawSupplier = idxSupplier !== -1 ? String(row[idxSupplier] || '').trim() : (row[11] ? String(row[11]).trim() : '');
    const rawShipping = idxShippingType !== -1 ? String(row[idxShippingType] || '').trim() : (row[12] ? String(row[12]).trim() : '');
    const rawUnit = idxUnit !== -1 ? String(row[idxUnit] || '').trim() : (row[13] ? String(row[13]).trim() : '');
    const rawDateVal = idxDateCode !== -1 ? String(row[idxDateCode] || '').trim() : (row[2] ? String(row[2]).trim() : '');

    // 1. Dòng có ID sản phẩm (Sản phẩm đơn hoặc Sản phẩm cha của biến thể)
    if (rawPid) {
      currentParentProductId = rawPid;
      if (rawProductName) currentParentProductName = rawProductName;
      if (rawDisplayName) currentParentDisplayName = rawDisplayName;
      if (rawCategory) {
        currentParentCategory = rawCategory;
        currentParentNormalizedCat = normalizeCategory(rawCategory);
      }
      if (rawBrand) currentParentBrand = rawBrand;
      if (rawStatus) currentParentStatus = rawStatus;
      if (rawProductType) currentParentProductType = rawProductType;
      if (rawTax) currentParentTax = rawTax;
      if (rawSupplier) currentParentSupplier = rawSupplier;
      if (rawShipping) currentParentShipping = rawShipping;
      if (rawUnit) currentParentUnit = rawUnit;
      if (rawDateVal && /^\d{4}$/.test(rawDateVal)) currentParentDateCode = rawDateVal;
    }

    // 2. Xử lý nhận diện Mã SKU:
    let effectiveSku = rawSku;
    if (!effectiveSku) {
      // Kiểm tra xem dòng này có phải là dòng cha của các biến thể con bên dưới không
      let isParentHeaderOnly = false;
      if (rawPid && i + 1 < totalRows) {
        const nextRow = dataRows[i + 1];
        if (nextRow) {
          const nextPid = effIdxPid !== -1 ? String(nextRow[effIdxPid] || '').trim() : '';
          const nextSku = effIdxSku !== -1 ? String(nextRow[effIdxSku] || '').trim() : '';
          if (!nextPid && nextSku) {
            isParentHeaderOnly = true;
          }
        }
      }

      if (isParentHeaderOnly || !rawPid) {
        // Dòng cha tiêu đề nhóm biến thể, hoặc dòng trống -> Bỏ qua không tính là SKU
        continue;
      }
      // Đây là sản phẩm đơn mà file chỉ điền mã ở cột ID sản phẩm -> Lấy rawPid làm SKU
      effectiveSku = rawPid;
    }

    // 3. Dòng CÓ SKU:
    const effectiveProductId = rawPid || currentParentProductId || `ID_${effectiveSku}`;
    const effectiveProductName = rawProductName || currentParentProductName || effectiveSku;
    const effectiveDisplayName = rawDisplayName || currentParentDisplayName || '';
    const effectiveCategory = rawCategory || currentParentCategory || 'Khác';
    const effectiveNormalizedCat = rawCategory ? normalizeCategory(rawCategory) : currentParentNormalizedCat;
    const effectiveBrand = rawBrand || currentParentBrand || 'N/A';
    const effectiveStatus = rawStatus || currentParentStatus || 'Hoạt động';
    const effectiveProductType = rawProductType || currentParentProductType || 'Hàng bán';
    const effectiveTax = rawTax || currentParentTax || '';
    const effectiveSupplier = rawSupplier || currentParentSupplier || '';
    const effectiveShipping = rawShipping || currentParentShipping || '';
    const effectiveUnit = rawUnit || currentParentUnit || 'Cái';

    let dateCode = '';
    if (rawDateVal && /^\d{4}$/.test(rawDateVal)) {
      dateCode = rawDateVal;
    } else {
      const match = effectiveSku.match(/^(\d{2})(\d{2})/);
      if (match) {
        dateCode = `${match[1]}${match[2]}`;
      } else if (currentParentDateCode) {
        dateCode = currentParentDateCode;
      }
    }

    const parsedDate = parseSkuCreationDate(dateCode || effectiveSku);

    records.push({
      sku: effectiveSku,
      productId: effectiveProductId,
      parentProductId: effectiveProductId,
      isVariant: !rawPid || Boolean(idxVariantName !== -1 && String(row[idxVariantName] || '').trim()),
      productName: effectiveProductName,
      displayName: effectiveDisplayName,
      productType: effectiveProductType,
      category: effectiveCategory,
      normalizedCategory: effectiveNormalizedCat,
      brand: effectiveBrand,
      status: effectiveStatus,
      tax: effectiveTax,
      supplier: effectiveSupplier,
      shippingType: effectiveShipping,
      unit: effectiveUnit,
      variantName: idxVariantName !== -1 ? String(row[idxVariantName] || '').trim() : '',
      detailedDisplayName: idxDetailedDisplayName !== -1 ? String(row[idxDetailedDisplayName] || '').trim() : '',
      barcode: idxBarcode !== -1 ? String(row[idxBarcode] || '').trim() : '',
      partNumber: idxPartNumber !== -1 ? String(row[idxPartNumber] || '').trim() : '',
      storeGroupCode: idxStoreGroup !== -1 ? String(row[idxStoreGroup] || '').trim() : '',

      monthYear: parsedDate.monthYear,
      creationYear: parsedDate.year,
      creationMonth: parsedDate.month,
      creationPeriod: parsedDate.periodLabel,
      creationYearMonth: parsedDate.periodKey,
      rawDateCode: parsedDate.rawDateCode,

      originalRowIndex: i + 1,
      batchId: batchId || `batch_${Date.now()}`,
      batchName: batchName || `Đợt ${new Date().toLocaleDateString('vi-VN')}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  return records;
}

// --- Sinh dữ liệu mẫu mô phỏng chuẩn xác STT 38 ➔ 55 từ ảnh của bạn ---
export function generateSampleData(): SkuRecord[] {
  const batchId = `sample_${Date.now()}`;
  const batchName = 'Dữ liệu mẫu STT 38-55';
  const now = Date.now();

  const sampleRows: any[] = [
    // 38-41: Sản phẩm đơn
    {
      sku: '2609P000929', productId: 'ID139806', parentProductId: 'ID139806', isVariant: false,
      productName: 'Combo Camera Imou Bullet 2E Full HD', displayName: 'Combo Camera Imou Bullet 2E',
      productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'IMOU', status: 'Hoạt động', tax: '8', supplier: 'M10000373', shippingType: 'Hàng vận chuyển',
      unit: 'Cái', barcode: '260600650', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609P000928', productId: 'ID139805', parentProductId: 'ID139805', isVariant: false,
      productName: 'Combo Camera Imou Ranger 2 4MP', displayName: 'Combo Camera Imou Ranger 2',
      productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'IMOU', status: 'Hoạt động', tax: '8', supplier: 'M10000373', shippingType: 'Hàng vận chuyển',
      unit: 'Cái', barcode: '260600647', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609P000927', productId: 'ID139804', parentProductId: 'ID139804', isVariant: false,
      productName: 'Tai nghe Apple AirPods Pro 2 MagSafe', displayName: 'Tai nghe Apple AirPods Pro 2',
      productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'APPLE', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609P000926', productId: 'ID139803', parentProductId: 'ID139803', isVariant: false,
      productName: 'Tai nghe Apple AirPods 3 Lightning', displayName: 'Tai nghe Apple AirPods 3',
      productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'APPLE', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    // 42-45: Samsung Galaxy ID139802 (3 SKU biến thể)
    {
      sku: '2609V001374', productId: 'ID139802', parentProductId: 'ID139802', isVariant: true,
      productName: 'Samsung Galaxy S24 Ultra 5G', displayName: 'Điện thoại Samsung Galaxy S24 Ultra',
      variantName: 'Xám Titan 256GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609V001372', productId: 'ID139802', parentProductId: 'ID139802', isVariant: true,
      productName: 'Samsung Galaxy S24 Ultra 5G', displayName: 'Điện thoại Samsung Galaxy S24 Ultra',
      variantName: 'Đen Titan 256GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609V001373', productId: 'ID139802', parentProductId: 'ID139802', isVariant: true,
      productName: 'Samsung Galaxy S24 Ultra 5G', displayName: 'Điện thoại Samsung Galaxy S24 Ultra',
      variantName: 'Tím Titan 512GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    // 46-50: Samsung Galaxy ID139801 (4 SKU biến thể)
    {
      sku: '2609V001369', productId: 'ID139801', parentProductId: 'ID139801', isVariant: true,
      productName: 'Samsung Galaxy Z Flip6 5G', displayName: 'Samsung Galaxy Z Flip6',
      variantName: 'Xanh Maya 256GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609V001370', productId: 'ID139801', parentProductId: 'ID139801', isVariant: true,
      productName: 'Samsung Galaxy Z Flip6 5G', displayName: 'Samsung Galaxy Z Flip6',
      variantName: 'Vàng Solar 256GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609V001371', productId: 'ID139801', parentProductId: 'ID139801', isVariant: true,
      productName: 'Samsung Galaxy Z Flip6 5G', displayName: 'Samsung Galaxy Z Flip6',
      variantName: 'Xám Metal 512GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609V001368', productId: 'ID139801', parentProductId: 'ID139801', isVariant: true,
      productName: 'Samsung Galaxy Z Flip6 5G', displayName: 'Samsung Galaxy Z Flip6',
      variantName: 'Xanh Mint 256GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    // 51-55: Samsung Galaxy ID139800 (4 SKU biến thể)
    {
      sku: '2609V001365', productId: 'ID139800', parentProductId: 'ID139800', isVariant: true,
      productName: 'Samsung Galaxy A55 5G', displayName: 'Samsung Galaxy A55',
      variantName: 'Xanh Iceblue 128GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609V001366', productId: 'ID139800', parentProductId: 'ID139800', isVariant: true,
      productName: 'Samsung Galaxy A55 5G', displayName: 'Samsung Galaxy A55',
      variantName: 'Tím Lilac 128GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609V001367', productId: 'ID139800', parentProductId: 'ID139800', isVariant: true,
      productName: 'Samsung Galaxy A55 5G', displayName: 'Samsung Galaxy A55',
      variantName: 'Navy 256GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    {
      sku: '2609V001364', productId: 'ID139800', parentProductId: 'ID139800', isVariant: true,
      productName: 'Samsung Galaxy A55 5G', displayName: 'Samsung Galaxy A55',
      variantName: 'Vàng Lemon 128GB', productType: 'Hàng bán', category: 'Điện tử và Công nghệ', normalizedCategory: 'Đồ công nghệ (ICT)',
      brand: 'SAMSUNG', status: 'Hoạt động', tax: '8', supplier: 'M10000486', shippingType: 'Hàng vận chuyển',
      unit: 'Chiếc', storeGroupCode: 'CH1001/CH1002/CH1003'
    },
    // Thêm các ngành hàng khác để bảng báo cáo có đầy đủ số liệu phong phú
    {
      sku: '2609P002100', productId: 'ID139750', parentProductId: 'ID139750', isVariant: false,
      productName: 'Áo Polo Nam Onoff Kháng Khuẩn', displayName: 'Áo Polo Nam Onoff',
      productType: 'Hàng bán', category: 'Thời trang', normalizedCategory: 'Thời trang',
      brand: 'Onoff', status: 'Hoạt động', tax: '8', supplier: 'NCC_ONOFF', unit: 'Cái'
    },
    {
      sku: '2609P002101', productId: 'ID139751', parentProductId: 'ID139751', isVariant: false,
      productName: 'Quần Lót Nam Boxer Onoff Cotton', displayName: 'Quần Lót Nam Boxer',
      productType: 'Hàng bán', category: 'Thời trang', normalizedCategory: 'Thời trang',
      brand: 'Onoff', status: 'Hoạt động', tax: '8', supplier: 'NCC_ONOFF', unit: 'Chiếc'
    },
    {
      sku: '2609P003001', productId: 'ID139600', parentProductId: 'ID139600', isVariant: false,
      productName: 'Nồi Cơm Điện Tử Lock&Lock 1.8L', displayName: 'Nồi Cơm Điện Tử Lock&Lock',
      productType: 'Hàng bán', category: 'Điện gia dụng', normalizedCategory: 'Điện gia dụng',
      brand: 'Lock&Lock', status: 'Hoạt động', tax: '8', supplier: 'NCC_LOCK', unit: 'Cái'
    },
    {
      sku: '2609P004001', productId: 'ID139500', parentProductId: 'ID139500', isVariant: false,
      productName: 'Tã Quần Moony Natural Size M', displayName: 'Tã Quần Moony',
      productType: 'Hàng bán', category: 'Mẹ và Bé', normalizedCategory: 'Mẹ và Bé',
      brand: 'Moony', status: 'Hoạt động', tax: '8', supplier: 'NCC_MOONY', unit: 'Gói'
    },
    {
      sku: '2609P005001', productId: 'ID139400', parentProductId: 'ID139400', isVariant: false,
      productName: 'Serum La Roche-Posay Hyalu B5 30ml', displayName: 'Serum La Roche-Posay',
      productType: 'Hàng bán', category: 'Sức khỏe và Làm đẹp', normalizedCategory: 'Sức khỏe và Làm đẹp',
      brand: 'La Roche-Posay', status: 'Hoạt động', tax: '8', supplier: 'NCC_LRP', unit: 'Chai'
    }
  ];

  return sampleRows.map((r, i) => ({
    ...r,
    monthYear: '2026-09',
    creationYear: 2026,
    creationMonth: 9,
    creationPeriod: 'Tháng 09/2026',
    creationYearMonth: '2026-09',
    rawDateCode: '2609',
    originalRowIndex: 38 + i,
    batchId,
    batchName,
    isNewInBatch: true,
    createdAt: now,
    updatedAt: now
  }));
}

