import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Hàm phân tích 4 chữ số đầu SKU
function parseSkuDate(sku: string) {
  if (!sku || typeof sku !== 'string') {
    return {
      year: 2026,
      month: 9,
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
      return {
        year,
        month: mm,
        periodKey: `${year}-${monthStr}`,
        periodLabel: `Tháng ${monthStr}/${year}`,
        rawDateCode: `${match[1]}${monthStr}`
      };
    }
  }

  return {
    year: 2026,
    month: 9,
    periodKey: '2026-09',
    periodLabel: 'Tháng 09/2026',
    rawDateCode: '2609'
  };
}

// Chuẩn hóa tên ngành hàng
function normalizeCategoryWorker(rawCat: string): string {
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

  return rawCat.trim() || 'Khác';
}

// Tìm index cột thông minh (Fuzzy header matcher)
function findColIndex(headers: string[], candidates: string[]): number {
  for (const cand of candidates) {
    const target = cand.toLowerCase().replace(/[\s_\-–]/g, '');
    const idx = headers.findIndex(h => {
      const cleanH = String(h || '').toLowerCase().replace(/[\s_\-–]/g, '');
      return cleanH.includes(target) || target.includes(cleanH);
    });
    if (idx !== -1) return idx;
  }
  return -1;
}

self.onmessage = async (e: MessageEvent) => {
  const { fileData, isCSV, fileName, batchId, batchName } = e.data;

  try {
    self.postMessage({ type: 'progress', percent: 10, message: 'Đang đọc cấu trúc file...' });

    let rows: any[][] = [];

    if (isCSV) {
      const text = typeof fileData === 'string' ? fileData : new TextDecoder('utf-8').decode(fileData);
      const parsed = Papa.parse(text, { skipEmptyLines: true });
      rows = parsed.data as any[][];
    } else {
      const workbook = XLSX.read(fileData, { type: 'array', cellDates: false });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('File Excel không có dữ liệu sheet.');
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    }

    if (!rows || rows.length < 2) {
      throw new Error('File không chứa đủ dữ liệu tiêu đề và hàng.');
    }

    self.postMessage({ type: 'progress', percent: 25, message: 'Đang ánh xạ cột dữ liệu...' });

    const rawHeaders = rows[0].map(h => String(h || '').trim());

    // Xác định vị trí các cột
    const idxProductId = findColIndex(rawHeaders, ['id sản phẩm', 'idsảnphẩm', 'mã sản phẩm', 'product id', 'id sp', 'idsp']);
    const idxSku = findColIndex(rawHeaders, ['mã sku', 'mãsku', 'sku', 'sku code', 'mã hàng']);
    const idxStatus = findColIndex(rawHeaders, ['trạng thái', 'status', 'tình trạng']);
    const idxProductName = findColIndex(rawHeaders, ['tên sản phẩm', 'tênsảnphẩm', 'product name', 'tên hàng']);
    const idxDisplayName = findColIndex(rawHeaders, ['tên hiển thị', 'tênhiểnthị']);
    const idxProductType = findColIndex(rawHeaders, ['loại sản phẩm', 'loạisảnphẩm']);
    const idxCategory = findColIndex(rawHeaders, ['tên danh mục ngành hàng', 'danh mục ngành hàng', 'ngành hàng', 'danh mục', 'category']);
    const idxBrand = findColIndex(rawHeaders, ['tên thương hiệu', 'thương hiệu', 'brand', 'nhãn hiệu']);
    const idxTax = findColIndex(rawHeaders, ['thuế bán ra', 'thuế', 'vat']);
    const idxSupplier = findColIndex(rawHeaders, ['danh sách tên ncc', 'tên ncc', 'nhà cung cấp', 'ncc']);
    const idxShippingType = findColIndex(rawHeaders, ['phân loại vận chuyển', 'vận chuyển']);
    const idxUnit = findColIndex(rawHeaders, ['tên đơn vị tính', 'đơn vị tính', 'đvt', 'dvt']);
    const idxVariantName = findColIndex(rawHeaders, ['tên biến thể', 'biến thể']);
    const idxDetailedDisplayName = findColIndex(rawHeaders, ['tên hiển thị chi tiết']);
    const idxBarcode = findColIndex(rawHeaders, ['mã vạch', 'barcode']);
    const idxPartNumber = findColIndex(rawHeaders, ['part number', 'partnumber']);
    const idxStoreGroup = findColIndex(rawHeaders, ['mã nhóm điểm bán', 'điểm bán']);
    let idxDateCode = findColIndex(rawHeaders, ['mã kỳ', 'kỳ tạo', 'năm/tháng', 'tháng/năm', 'tháng tạo', 'năm tạo', '2609']);

    // Tự động nhận diện cột 4 số (như Cột C nằm giữa ID sản phẩm và Mã SKU) nếu chưa tìm thấy theo tên
    if (idxDateCode === -1 && idxProductId !== -1 && idxSku !== -1 && Math.abs(idxSku - idxProductId) === 2) {
      const middleIdx = Math.min(idxProductId, idxSku) + 1;
      const sampleVal = String(rows[1]?.[middleIdx] || '').trim();
      if (/^\d{4}$/.test(sampleVal)) {
        idxDateCode = middleIdx;
      }
    }

    // Kiểm tra cột bắt buộc
    if (idxSku === -1 && idxProductId === -1) {
      throw new Error('Không tìm thấy cột "Mã SKU" hoặc "ID sản phẩm" trong file. Vui lòng kiểm tra lại tiêu đề cột.');
    }

    const dataRows = rows.slice(1);
    const totalRows = dataRows.length;
    const records: any[] = [];

    self.postMessage({ type: 'progress', percent: 40, message: `Bắt đầu phân tích ${totalRows.toLocaleString()} dòng dữ liệu...` });

    const stepInterval = Math.max(1, Math.floor(totalRows / 20));

    // Biến lưu trữ thông tin Sản Phẩm Cha (Forward-fill cho sản phẩm biến thể)
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

      const rawSku = idxSku !== -1 ? String(row[idxSku] || '').trim() : '';
      const rawPid = idxProductId !== -1 ? String(row[idxProductId] || '').trim() : '';
      const rawProductName = idxProductName !== -1 ? String(row[idxProductName] || '').trim() : '';
      const rawDisplayName = idxDisplayName !== -1 ? String(row[idxDisplayName] || '').trim() : '';
      const rawCategory = idxCategory !== -1 ? String(row[idxCategory] || '').trim() : '';
      const rawBrand = idxBrand !== -1 ? String(row[idxBrand] || '').trim() : '';
      const rawStatus = idxStatus !== -1 ? String(row[idxStatus] || '').trim() : '';
      const rawProductType = idxProductType !== -1 ? String(row[idxProductType] || '').trim() : '';
      const rawTax = idxTax !== -1 ? String(row[idxTax] || '').trim() : '';
      const rawSupplier = idxSupplier !== -1 ? String(row[idxSupplier] || '').trim() : '';
      const rawShipping = idxShippingType !== -1 ? String(row[idxShippingType] || '').trim() : '';
      const rawUnit = idxUnit !== -1 ? String(row[idxUnit] || '').trim() : '';
      const rawDateVal = idxDateCode !== -1 ? String(row[idxDateCode] || '').trim() : '';

      // 1. Khi gặp dòng có ID sản phẩm (Sản phẩm đơn hoặc Sản phẩm cha của biến thể):
      if (rawPid) {
        currentParentProductId = rawPid;
        if (rawProductName) currentParentProductName = rawProductName;
        if (rawDisplayName) currentParentDisplayName = rawDisplayName;
        if (rawCategory) {
          currentParentCategory = rawCategory;
          currentParentNormalizedCat = normalizeCategoryWorker(rawCategory);
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

      // 2. Nếu dòng KHÔNG CÓ SKU:
      // Đây là dòng tiêu đề sản phẩm cha tổng quát (như stt 42, 46, 51 trong ảnh mẫu),
      // chỉ định nghĩa ID và thuộc tính chung, KHÔNG tính là 1 SKU riêng biệt!
      if (!rawSku) {
        continue;
      }

      // 3. Nếu dòng CÓ SKU:
      // Có thể là sản phẩm đơn (stt 38-41) hoặc sản phẩm biến thể con (stt 43-45 kế thừa ID từ cha)
      const effectiveProductId = rawPid || currentParentProductId || `ID_${rawSku}`;
      const effectiveProductName = rawProductName || currentParentProductName || rawSku;
      const effectiveDisplayName = rawDisplayName || currentParentDisplayName || '';
      const effectiveCategory = rawCategory || currentParentCategory || 'Khác';
      const effectiveNormalizedCat = rawCategory ? normalizeCategoryWorker(rawCategory) : currentParentNormalizedCat;
      const effectiveBrand = rawBrand || currentParentBrand || 'N/A';
      const effectiveStatus = rawStatus || currentParentStatus || 'Hoạt động';
      const effectiveProductType = rawProductType || currentParentProductType || 'Hàng bán';
      const effectiveTax = rawTax || currentParentTax || '';
      const effectiveSupplier = rawSupplier || currentParentSupplier || '';
      const effectiveShipping = rawShipping || currentParentShipping || '';
      const effectiveUnit = rawUnit || currentParentUnit || 'Cái';

      // Xác định 4 số đầu tạo sản phẩm
      let dateCode = '';
      if (rawDateVal && /^\d{4}$/.test(rawDateVal)) {
        dateCode = rawDateVal;
      } else {
        const match = rawSku.match(/^(\d{2})(\d{2})/);
        if (match) {
          dateCode = `${match[1]}${match[2]}`;
        } else if (currentParentDateCode) {
          dateCode = currentParentDateCode;
        }
      }

      const parsedDate = parseSkuDate(dateCode || rawSku);

      records.push({
        sku: rawSku,
        productId: effectiveProductId,
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

        // Cột tự động sinh từ 4 số đầu SKU
        monthYear: parsedDate.periodKey, // "2026-09"
        creationYear: parsedDate.year,
        creationMonth: parsedDate.month,
        creationPeriod: parsedDate.periodLabel,
        creationYearMonth: parsedDate.periodKey,
        rawDateCode: parsedDate.rawDateCode,

        // Cấu trúc sản phẩm biến thể
        isVariant: !rawPid || Boolean(idxVariantName !== -1 && String(row[idxVariantName] || '').trim()),
        parentProductId: effectiveProductId,

        originalRowIndex: i + 1, // Lưu số thứ tự dòng thực tế trong file
        batchId: batchId || `batch_${Date.now()}`,
        batchName: batchName || `Đợt ${new Date().toLocaleDateString('vi-VN')}`
      });

      if (i % stepInterval === 0 || i === totalRows - 1) {
        const percent = Math.min(95, 40 + Math.floor((i / totalRows) * 55));
        self.postMessage({
          type: 'progress',
          percent,
          processed: i + 1,
          total: totalRows,
          message: `Đã xử lý ${ (i + 1).toLocaleString() } / ${ totalRows.toLocaleString() } dòng...`
        });
      }
    }

    self.postMessage({
      type: 'done',
      records,
      fileName,
      totalCount: records.length,
      headers: rawHeaders
    });

  } catch (error: any) {
    self.postMessage({
      type: 'error',
      error: error.message || 'Lỗi trong quá trình xử lý file.'
    });
  }
};
