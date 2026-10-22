import pptxgen from 'pptxgenjs';
import { ReportStats, SkuRecord } from './skuReportService';

export interface PptExportOptions {
  periodTitle?: string;
  author?: string;
  company?: string;
}

/**
 * Xuất Báo Cáo Phân Tích SKU sang định dạng Microsoft PowerPoint (.pptx)
 * Chuẩn trình chiếu chuyên nghiệp, chứa biểu đồ gốc và bảng số liệu tự động
 */
export async function exportReportToPPT(
  stats: ReportStats,
  detailedSkus: SkuRecord[] = [],
  options: PptExportOptions = {}
): Promise<void> {
  const pptx = new pptxgen();

  // 1. Cấu hình bài thuyết trình
  pptx.layout = 'LAYOUT_16x9'; // Tỷ lệ màn hình rộng chuẩn 16:9
  pptx.author = options.author || 'VnShop Assistant';
  pptx.company = options.company || 'VnShop';
  pptx.title = `Báo Cáo Nhập Liệu SKU - ${stats.periodLabel}`;

  const periodName = options.periodTitle?.trim() || stats.periodLabel;
  const p = stats.newPeriod;
  const exportDate = new Date().toLocaleDateString('vi-VN');

  // Palette màu chuyên nghiệp (Corporate Slate & Tech Accents)
  const COLOR_PRIMARY = '0F172A'; // Slate 900
  const COLOR_HEADER = '1E293B';  // Slate 800
  const COLOR_ACCENT_BLUE = '2563EB'; // Blue 600
  const COLOR_ACCENT_EMERALD = '059669'; // Emerald 600
  const COLOR_ACCENT_AMBER = 'D97706'; // Amber 600
  const COLOR_ACCENT_PURPLE = '7C3AED'; // Purple 600
  const COLOR_CARD_BG = 'F8FAFC'; // Slate 50
  const COLOR_BORDER = 'E2E8F0'; // Slate 200

  // ==========================================
  // SLIDE 1: TRANG TIÊU ĐỀ (COVER SLIDE)
  // ==========================================
  const slideCover = pptx.addSlide();
  slideCover.background = { color: COLOR_PRIMARY };

  // Dải trang trí gradient/accent
  slideCover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.35,
    h: '100%',
    fill: { color: COLOR_ACCENT_BLUE }
  });

  slideCover.addText('VNSHOP MARKETPLACE • BÁO CÁO VẬN HÀNH', {
    x: 1.0,
    y: 1.8,
    w: 11.5,
    h: 0.4,
    fontSize: 13,
    fontFace: 'Arial',
    color: '94A3B8',
    bold: true,
    charSpacing: 2
  });

  slideCover.addText('BÁO CÁO NHẬP LIỆU & PHÂN TÍCH SKU ONSITE', {
    x: 1.0,
    y: 2.3,
    w: 11.5,
    h: 1.4,
    fontSize: 34,
    fontFace: 'Arial',
    color: 'FFFFFF',
    bold: true,
    lineSpacing: 40
  });

  slideCover.addText(`KỲ BÁO CÁO: ${periodName.toUpperCase()}`, {
    x: 1.0,
    y: 3.8,
    w: 11.5,
    h: 0.6,
    fontSize: 20,
    fontFace: 'Arial',
    color: '38BDF8',
    bold: true
  });

  slideCover.addText(
    `Thống kê sản phẩm mới, cơ cấu tỷ trọng ngành hàng, biến thể & thương hiệu dẫn đầu\nNgày xuất báo cáo: ${exportDate} • Trạng thái: Dữ liệu chính thức`,
    {
      x: 1.0,
      y: 4.8,
      w: 11.0,
      h: 0.8,
      fontSize: 13,
      fontFace: 'Arial',
      color: 'CBD5E1'
    }
  );

  // ==========================================
  // SLIDE 2: TỔNG QUAN CHỈ SỐ KPI & NHẬN XÉT ĐIỀU HÀNH
  // ==========================================
  const slideKpi = pptx.addSlide();
  slideKpi.background = { color: 'FFFFFF' };

  // Header slide
  slideKpi.addText('TỔNG QUAN CHỈ SỐ KPI CHÍNH', {
    x: 0.8,
    y: 0.5,
    w: 8.0,
    h: 0.4,
    fontSize: 20,
    fontFace: 'Arial',
    bold: true,
    color: COLOR_HEADER
  });
  slideKpi.addText(`Kỳ báo cáo: ${periodName} | Nguồn: Kho dữ liệu SKU Onsite`, {
    x: 0.8,
    y: 0.95,
    w: 8.0,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: '64748B'
  });

  // 4 Thẻ KPI (KPI Cards)
  const cardWidth = 2.75;
  const cardHeight = 1.35;
  const cardY = 1.5;

  // Thẻ 1: Tổng Sản phẩm Mới
  slideKpi.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: cardY,
    w: cardWidth,
    h: cardHeight,
    fill: { color: 'EFF6FF' },
    line: { color: 'BFDBFE', width: 1 },
    rectRadius: 0.1
  });
  slideKpi.addText('SẢN PHẨM ONSITE MỚI', {
    x: 0.9,
    y: cardY + 0.15,
    w: cardWidth - 0.2,
    h: 0.25,
    fontSize: 10,
    bold: true,
    color: '1E40AF',
    fontFace: 'Arial'
  });
  slideKpi.addText(p.totalProducts.toLocaleString(), {
    x: 0.9,
    y: cardY + 0.45,
    w: cardWidth - 0.2,
    h: 0.5,
    fontSize: 26,
    bold: true,
    color: COLOR_ACCENT_BLUE,
    fontFace: 'Arial'
  });
  slideKpi.addText('Sản phẩm (Đơn & Cha)', {
    x: 0.9,
    y: cardY + 0.95,
    w: cardWidth - 0.2,
    h: 0.25,
    fontSize: 10,
    color: '64748B',
    fontFace: 'Arial'
  });

  // Thẻ 2: Tổng SKUs Mới
  slideKpi.addShape(pptx.ShapeType.roundRect, {
    x: 3.8,
    y: cardY,
    w: cardWidth,
    h: cardHeight,
    fill: { color: 'ECFDF5' },
    line: { color: 'A7F3D0', width: 1 },
    rectRadius: 0.1
  });
  slideKpi.addText('SKU ONSITE HIỆU LỰC', {
    x: 3.9,
    y: cardY + 0.15,
    w: cardWidth - 0.2,
    h: 0.25,
    fontSize: 10,
    bold: true,
    color: '065F46',
    fontFace: 'Arial'
  });
  slideKpi.addText(p.totalSkus.toLocaleString(), {
    x: 3.9,
    y: cardY + 0.45,
    w: cardWidth - 0.2,
    h: 0.5,
    fontSize: 26,
    bold: true,
    color: COLOR_ACCENT_EMERALD,
    fontFace: 'Arial'
  });
  slideKpi.addText('SKUs hàng bán hiệu lực', {
    x: 3.9,
    y: cardY + 0.95,
    w: cardWidth - 0.2,
    h: 0.25,
    fontSize: 10,
    color: '64748B',
    fontFace: 'Arial'
  });

  // Thẻ 3: Tỷ lệ hoạt động / có tồn
  slideKpi.addShape(pptx.ShapeType.roundRect, {
    x: 6.8,
    y: cardY,
    w: cardWidth,
    h: cardHeight,
    fill: { color: 'FFFBEB' },
    line: { color: 'FDE68A', width: 1 },
    rectRadius: 0.1
  });
  slideKpi.addText('TỶ LỆ HOẠT ĐỘNG / CÓ TỒN', {
    x: 6.9,
    y: cardY + 0.15,
    w: cardWidth - 0.2,
    h: 0.25,
    fontSize: 10,
    bold: true,
    color: '92400E',
    fontFace: 'Arial'
  });
  slideKpi.addText(`${p.activeRatio}%`, {
    x: 6.9,
    y: cardY + 0.45,
    w: cardWidth - 0.2,
    h: 0.5,
    fontSize: 26,
    bold: true,
    color: COLOR_ACCENT_AMBER,
    fontFace: 'Arial'
  });
  slideKpi.addText(`${p.activeSkus.toLocaleString()} SKUs đang bán/có tồn`, {
    x: 6.9,
    y: cardY + 0.95,
    w: cardWidth - 0.2,
    h: 0.25,
    fontSize: 10,
    color: '64748B',
    fontFace: 'Arial'
  });

  // Thẻ 4: Số thương hiệu tham gia
  slideKpi.addShape(pptx.ShapeType.roundRect, {
    x: 9.8,
    y: cardY,
    w: cardWidth,
    h: cardHeight,
    fill: { color: 'F5F3FF' },
    line: { color: 'DDD6FE', width: 1 },
    rectRadius: 0.1
  });
  slideKpi.addText('THƯƠNG HIỆU ONSITE', {
    x: 9.9,
    y: cardY + 0.15,
    w: cardWidth - 0.2,
    h: 0.25,
    fontSize: 10,
    bold: true,
    color: '5B21B6',
    fontFace: 'Arial'
  });
  slideKpi.addText(p.brandsCount.toLocaleString(), {
    x: 9.9,
    y: cardY + 0.45,
    w: cardWidth - 0.2,
    h: 0.5,
    fontSize: 26,
    bold: true,
    color: COLOR_ACCENT_PURPLE,
    fontFace: 'Arial'
  });
  slideKpi.addText('Thương hiệu có SKU mới', {
    x: 9.9,
    y: cardY + 0.95,
    w: cardWidth - 0.2,
    h: 0.25,
    fontSize: 10,
    color: '64748B',
    fontFace: 'Arial'
  });

  // Khối Nhận Xét Quản Lý (Executive Remarks)
  slideKpi.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 3.2,
    w: 11.75,
    h: 3.5,
    fill: { color: COLOR_CARD_BG },
    line: { color: COLOR_BORDER, width: 1 },
    rectRadius: 0.15
  });

  slideKpi.addText('NHẬN XÉT VẬN HÀNH & KẾT QUẢ ĐẠT ĐƯỢC (EXECUTIVE REMARKS)', {
    x: 1.1,
    y: 3.45,
    w: 11.0,
    h: 0.35,
    fontSize: 13,
    fontFace: 'Arial',
    bold: true,
    color: COLOR_HEADER
  });

  const topCatName = p.topCategory?.name || 'Thời trang';
  const topCatProducts = p.topCategory?.products || 0;
  const topCatSkus = p.topCategory?.skus || 0;
  const topBrandName = p.topBrand?.name || 'N/A';
  const topBrandCat = p.topBrand?.category || topCatName;
  const topBrandSkus = p.topBrand?.skus || 0;

  const remarksPoints = [
    {
      text: `Tổng số lượng sản phẩm onsite mới trên VnShop ${periodName} đạt ${p.totalProducts.toLocaleString()} sản phẩm (${p.totalSkus.toLocaleString()} SKUs). Số lượng SKU hàng bán hiệu lực đạt ${p.totalSkus.toLocaleString()} SKUs, trong đó số lượng SKU có tồn/hoạt động chiếm hơn ${p.activeRatio}% (${p.activeSkus.toLocaleString()} SKUs).`,
      options: { bullet: true, fontSize: 13, color: '334155', fontFace: 'Arial', lineSpacing: 22 }
    },
    {
      text: `Sản phẩm onsite nhiều nhất thuộc ngành hàng ${topCatName} với ${topCatProducts.toLocaleString()} sản phẩm (${topCatSkus.toLocaleString()} SKU), trong đó thương hiệu có số lượng SKU onsite nhiều nhất là ${topBrandName} (ngành hàng ${topBrandCat}) với ${topBrandSkus.toLocaleString()} SKU.`,
      options: { bullet: true, fontSize: 13, color: '334155', fontFace: 'Arial', lineSpacing: 22 }
    },
    {
      text: `Trong kỳ ghi nhận ${p.brandsCount} thương hiệu có sản phẩm/SKU mới onsite, đảm bảo nguồn hàng phong phú và tỷ lệ đáp ứng đơn hàng cao trên sàn.`,
      options: { bullet: true, fontSize: 13, color: '334155', fontFace: 'Arial', lineSpacing: 22 }
    }
  ];

  slideKpi.addText(remarksPoints, {
    x: 1.1,
    y: 3.9,
    w: 11.0,
    h: 2.6
  });

  // ==========================================
  // SLIDE 3: BIỂU ĐỒ SO SÁNH SẢN PHẨM VS SKUS (BAR CHART)
  // ==========================================
  const slideChart = pptx.addSlide();
  slideChart.background = { color: 'FFFFFF' };

  slideChart.addText('SO SÁNH SỐ LƯỢNG SẢN PHẨM & SKUS ĐÃ TẠO', {
    x: 0.8,
    y: 0.5,
    w: 10.0,
    h: 0.4,
    fontSize: 20,
    fontFace: 'Arial',
    bold: true,
    color: COLOR_HEADER
  });
  slideChart.addText(`Quy mô sản phẩm đơn & dòng sản phẩm biến thể trong ${periodName}`, {
    x: 0.8,
    y: 0.95,
    w: 10.0,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: '64748B'
  });

  // Native Column Chart trong PPTX
  const chartData = [
    {
      name: 'Sản phẩm (Unique IDs)',
      labels: [periodName],
      values: [p.totalProducts]
    },
    {
      name: 'SKUs (Mã hàng bán)',
      labels: [periodName],
      values: [p.totalSkus]
    }
  ];

  slideChart.addChart(pptx.ChartType.bar, chartData, {
    x: 0.8,
    y: 1.5,
    w: 7.2,
    h: 5.0,
    chartColors: ['3B82F6', 'EF4444'],
    barDir: 'col',
    showLegend: true,
    legendPos: 't',
    showValue: true,
    dataLabelFormatCode: '#,##0',
    dataLabelColor: '0F172A',
    dataLabelFontSize: 11,
    valAxisMinVal: 0
  });

  // Hộp phân tích bên cạnh biểu đồ
  slideChart.addShape(pptx.ShapeType.roundRect, {
    x: 8.3,
    y: 1.5,
    w: 4.25,
    h: 5.0,
    fill: { color: COLOR_CARD_BG },
    line: { color: COLOR_BORDER, width: 1 },
    rectRadius: 0.15
  });

  slideChart.addText('CHỈ SỐ BIẾN THỂ TRUNG BÌNH', {
    x: 8.6,
    y: 1.8,
    w: 3.7,
    h: 0.3,
    fontSize: 12,
    fontFace: 'Arial',
    bold: true,
    color: '1E293B'
  });

  const avgSkuPerProduct = p.totalProducts > 0 ? (p.totalSkus / p.totalProducts).toFixed(2) : '1.0';
  slideChart.addText(
    [
      { text: `${avgSkuPerProduct} `, options: { fontSize: 32, bold: true, color: '2563EB', fontFace: 'Arial' } },
      { text: 'SKU / Sản phẩm', options: { fontSize: 13, bold: true, color: '64748B', fontFace: 'Arial' } }
    ],
    { x: 8.6, y: 2.15, w: 3.7, h: 0.7 }
  );

  const chartNotes = [
    {
      text: `Sản phẩm đơn: Các dòng có ID sản phẩm và SKU trùng hàng, mỗi sản phẩm tương ứng 1 SKU độc lập.`,
      options: { bullet: true, fontSize: 11, color: '475569', fontFace: 'Arial', lineSpacing: 18 }
    },
    {
      text: `Sản phẩm biến thể: Các dòng SKU con được gom nhóm thông minh dưới 1 ID sản phẩm cha (STT 42-55).`,
      options: { bullet: true, fontSize: 11, color: '475569', fontFace: 'Arial', lineSpacing: 18 }
    },
    {
      text: `Tỷ lệ mở rộng biến thể đạt trung bình ${avgSkuPerProduct} SKU/sản phẩm, tập trung chủ yếu ở ngành Thời trang và Mẹ & Bé.`,
      options: { bullet: true, fontSize: 11, color: '475569', fontFace: 'Arial', lineSpacing: 18 }
    }
  ];

  slideChart.addText(chartNotes, {
    x: 8.6,
    y: 3.1,
    w: 3.7,
    h: 3.2
  });

  // ==========================================
  // SLIDE 4: BẢNG SỐ LIỆU TỔNG HỢP CƠ CẤU NGÀNH HÀNG
  // ==========================================
  const slideTable = pptx.addSlide();
  slideTable.background = { color: 'FFFFFF' };

  slideTable.addText('BẢNG SỐ LIỆU TỔNG HỢP THEO NGÀNH HÀNG', {
    x: 0.8,
    y: 0.5,
    w: 10.0,
    h: 0.4,
    fontSize: 20,
    fontFace: 'Arial',
    bold: true,
    color: COLOR_HEADER
  });
  slideTable.addText(`Chi tiết phân bổ Sản phẩm, SKUs và Tỷ trọng % theo biểu mẫu công ty`, {
    x: 0.8,
    y: 0.95,
    w: 10.0,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: '64748B'
  });

  // Tạo cấu trúc bảng chuẩn theo biểu mẫu
  const tableData: any[][] = [];

  // Header row
  tableData.push([
    { text: 'Ngành hàng (Category)', options: { fill: { color: '1E293B' }, color: 'FFFFFF', bold: true, fontSize: 10, align: 'left' } },
    { text: 'Sản phẩm', options: { fill: { color: '1E293B' }, color: 'FFFFFF', bold: true, fontSize: 10, align: 'center' } },
    { text: 'SKUs', options: { fill: { color: '1E293B' }, color: 'FFFFFF', bold: true, fontSize: 10, align: 'center' } },
    { text: 'Tỷ trọng %', options: { fill: { color: '1E293B' }, color: 'FFFFFF', bold: true, fontSize: 10, align: 'center' } }
  ]);

  // Data rows (Top categories)
  p.categories.forEach((cat, index) => {
    const isEven = index % 2 === 0;
    const isTop = index === 0;
    const rowBg = isTop ? 'EFF6FF' : isEven ? 'F8FAFC' : 'FFFFFF';
    const textBold = isTop;

    tableData.push([
      { text: cat.category, options: { fill: { color: rowBg }, color: isTop ? '1E40AF' : '1E293B', bold: textBold, fontSize: 9.5 } },
      { text: cat.productCount.toLocaleString(), options: { fill: { color: rowBg }, color: '334155', bold: textBold, fontSize: 9.5, align: 'center' } },
      { text: cat.skuCount.toLocaleString(), options: { fill: { color: rowBg }, color: '0F172A', bold: textBold, fontSize: 9.5, align: 'center' } },
      { text: `${cat.percentage}%`, options: { fill: { color: rowBg }, color: isTop ? '2563EB' : '059669', bold: true, fontSize: 9.5, align: 'center' } }
    ]);
  });

  // Total summary row
  tableData.push([
    { text: 'TỔNG SỐ LƯỢNG MỚI (TOTAL)', options: { fill: { color: 'E2E8F0' }, color: '0F172A', bold: true, fontSize: 10 } },
    { text: p.totalProducts.toLocaleString(), options: { fill: { color: 'E2E8F0' }, color: '0F172A', bold: true, fontSize: 10, align: 'center' } },
    { text: p.totalSkus.toLocaleString(), options: { fill: { color: 'E2E8F0' }, color: '0F172A', bold: true, fontSize: 10, align: 'center' } },
    { text: '100%', options: { fill: { color: 'E2E8F0' }, color: '0F172A', bold: true, fontSize: 10, align: 'center' } }
  ]);

  slideTable.addTable(tableData, {
    x: 0.8,
    y: 1.5,
    w: 7.2,
    h: 5.0,
    colW: [3.0, 1.4, 1.4, 1.4],
    border: { pt: 0.5, color: 'CBD5E1' }
  });

  // Doughnut Chart cho Tỷ Trọng Ngành Hàng
  const pieCategories = p.categories.filter(c => c.skuCount > 0).slice(0, 6);
  const pieChartData = [
    {
      name: 'Tỷ trọng SKU',
      labels: pieCategories.map(c => c.category),
      values: pieCategories.map(c => c.skuCount)
    }
  ];

  slideTable.addChart(pptx.ChartType.doughnut, pieChartData, {
    x: 8.2,
    y: 1.5,
    w: 4.4,
    h: 5.0,
    holeSize: 55,
    showLegend: true,
    legendPos: 'b',
    legendFontSize: 9,
    showPercent: true,
    dataLabelColor: 'FFFFFF',
    dataLabelFontSize: 9
  });

  // ==========================================
  // SLIDE 5: TOP THƯƠNG HIỆU & PHÂN TÍCH THEO MÃ NGÀY TẠO
  // ==========================================
  const slideBrands = pptx.addSlide();
  slideBrands.background = { color: 'FFFFFF' };

  slideBrands.addText('TOP THƯƠNG HIỆU & ĐẶC ĐIỂM DỮ LIỆU SKU', {
    x: 0.8,
    y: 0.5,
    w: 10.0,
    h: 0.4,
    fontSize: 20,
    fontFace: 'Arial',
    bold: true,
    color: COLOR_HEADER
  });
  slideBrands.addText(`Thông tin thương hiệu nổi bật và phân loại theo 4 số đầu SKU`, {
    x: 0.8,
    y: 0.95,
    w: 10.0,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: '64748B'
  });

  // Thẻ Top Thương hiệu
  slideBrands.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 1.5,
    w: 5.6,
    h: 4.8,
    fill: { color: 'F8FAFC' },
    line: { color: 'E2E8F0', width: 1 },
    rectRadius: 0.15
  });

  slideBrands.addText('THƯƠNG HIỆU ONSITE NHIỀU NHẤT', {
    x: 1.1,
    y: 1.8,
    w: 5.0,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    bold: true,
    color: '64748B'
  });

  slideBrands.addText(topBrandName, {
    x: 1.1,
    y: 2.1,
    w: 5.0,
    h: 0.6,
    fontSize: 24,
    fontFace: 'Arial',
    bold: true,
    color: '7C3AED'
  });

  slideBrands.addText(`Ngành hàng: ${topBrandCat} | Đóng góp: ${topBrandSkus.toLocaleString()} SKUs`, {
    x: 1.1,
    y: 2.7,
    w: 5.0,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    color: '475569'
  });

  const brandInsights = [
    {
      text: `Ghi nhận tổng cộng ${p.brandsCount} thương hiệu có SKU mới trong kỳ báo cáo.`,
      options: { bullet: true, fontSize: 11, color: '334155', fontFace: 'Arial', lineSpacing: 20 }
    },
    {
      text: `Thương hiệu ${topBrandName} dẫn đầu về số lượng mẫu mã và biến thể onsite mới.`,
      options: { bullet: true, fontSize: 11, color: '334155', fontFace: 'Arial', lineSpacing: 20 }
    },
    {
      text: `Tỷ lệ hàng có sẵn tồn kho được duy trì cao (${p.activeRatio}%), đáp ứng tiêu chuẩn giao hàng nhanh.`,
      options: { bullet: true, fontSize: 11, color: '334155', fontFace: 'Arial', lineSpacing: 20 }
    }
  ];

  slideBrands.addText(brandInsights, {
    x: 1.1,
    y: 3.2,
    w: 5.0,
    h: 2.8
  });

  // Thẻ Quy ước 4 số đầu SKU & Dữ liệu
  slideBrands.addShape(pptx.ShapeType.roundRect, {
    x: 6.8,
    y: 1.5,
    w: 5.6,
    h: 4.8,
    fill: { color: 'F8FAFC' },
    line: { color: 'E2E8F0', width: 1 },
    rectRadius: 0.15
  });

  slideBrands.addText('QUY TẮC MÃ HÓA & TRÍCH XUẤT 4 SỐ ĐẦU SKU', {
    x: 7.1,
    y: 1.8,
    w: 5.0,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    bold: true,
    color: '0369A1'
  });

  slideBrands.addText('2609... ➔ Tháng 09/2026', {
    x: 7.1,
    y: 2.1,
    w: 5.0,
    h: 0.6,
    fontSize: 22,
    fontFace: 'Arial',
    bold: true,
    color: '0284C7'
  });

  const dateCodeRules = [
    {
      text: `2 chữ số đầu: Đại diện cho Năm tạo (VD: "26" = Năm 2026).`,
      options: { bullet: true, fontSize: 11, color: '334155', fontFace: 'Arial', lineSpacing: 20 }
    },
    {
      text: `2 chữ số tiếp theo: Đại diện cho Tháng tạo (VD: "09" = Tháng 9).`,
      options: { bullet: true, fontSize: 11, color: '334155', fontFace: 'Arial', lineSpacing: 20 }
    },
    {
      text: `Cột "Tháng/Năm" (YYYY-MM) tự động sinh độc lập, phục vụ bộ lọc thời gian tuần/tháng/năm chính xác.`,
      options: { bullet: true, fontSize: 11, color: '334155', fontFace: 'Arial', lineSpacing: 20 }
    },
    {
      text: `Hệ thống tự động đồng bộ và upsert SKU cũ, cập nhật trạng thái mà không cần tải lại từ đầu.`,
      options: { bullet: true, fontSize: 11, color: '334155', fontFace: 'Arial', lineSpacing: 20 }
    }
  ];

  slideBrands.addText(dateCodeRules, {
    x: 7.1,
    y: 2.8,
    w: 5.0,
    h: 3.2
  });

  // ==========================================
  // SLIDE 6: TRANG KẾT THÚC (THANK YOU)
  // ==========================================
  const slideEnd = pptx.addSlide();
  slideEnd.background = { color: COLOR_PRIMARY };

  slideEnd.addText('VNSHOP MARKETPLACE', {
    x: 1.0,
    y: 2.5,
    w: 11.0,
    h: 0.4,
    fontSize: 14,
    fontFace: 'Arial',
    color: '94A3B8',
    bold: true,
    align: 'center',
    charSpacing: 2
  });

  slideEnd.addText('XIN CẢM ƠN QUÝ ANH/CHỊ', {
    x: 1.0,
    y: 3.0,
    w: 11.0,
    h: 0.9,
    fontSize: 32,
    fontFace: 'Arial',
    bold: true,
    color: 'FFFFFF',
    align: 'center'
  });

  slideEnd.addText(`Báo cáo tổng hợp tự động từ Hệ thống Hỗ trợ Nhập liệu & Phân tích SKU • ${exportDate}`, {
    x: 1.0,
    y: 4.0,
    w: 11.0,
    h: 0.5,
    fontSize: 12,
    fontFace: 'Arial',
    color: '94A3B8',
    align: 'center'
  });

  // 2. Xuất file về trình duyệt máy người dùng
  const sanitizedPeriod = periodName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Bao_Cao_SKU_${sanitizedPeriod}_${new Date().toISOString().slice(0, 10)}.pptx`;
  await pptx.writeFile({ fileName });
}
