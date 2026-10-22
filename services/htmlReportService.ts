import { ReportStats, SkuRecord } from './skuReportService';

export function exportReportToStandaloneHtml(
  stats: ReportStats,
  detailedList: SkuRecord[],
  options: { periodTitle?: string; author?: string; company?: string } = {}
) {
  const periodTitle = options.periodTitle || stats.periodLabel;
  const company = options.company || 'VnShop';
  const author = options.author || 'Trợ lý Báo cáo SKU';
  const exportDate = new Date().toLocaleString('vi-VN');

  const categoriesData = stats.newPeriod.categories.filter(c => c.skuCount > 0);

  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo Cáo SKU Onsite - ${periodTitle} - ${company}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; color: black !important; }
    }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen p-4 md:p-8">
  <div class="max-w-6xl mx-auto space-y-6">
    
    <!-- Header -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Báo Cáo Độc Lập (Standalone)
          </span>
          <span class="text-xs text-zinc-400">${company} • ${exportDate}</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-black text-white">
          Báo Cáo Nhập Liệu & Phân Tích SKU Onsite
        </h1>
        <p class="text-amber-400 font-semibold text-sm mt-1">
          Kỳ báo cáo: ${periodTitle}
        </p>
      </div>

      <div class="flex items-center gap-2 no-print">
        <button onclick="window.print()" class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer border border-zinc-700">
          🖨️ In / Lưu PDF
        </button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div class="text-xs text-zinc-400">Tổng SKU Lũy Kế (VNS)</div>
        <div class="text-2xl font-black text-white mt-1">${stats.allTime.totalSkus.toLocaleString()}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">Từ ${stats.allTime.totalProducts.toLocaleString()} sản phẩm</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div class="text-xs text-amber-400">SKU Mới (${periodTitle})</div>
        <div class="text-2xl font-black text-amber-400 mt-1">${stats.newPeriod.totalSkus.toLocaleString()}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">Từ ${stats.newPeriod.totalProducts.toLocaleString()} sản phẩm mới</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div class="text-xs text-zinc-400">Ngành Hàng Dẫn Đầu</div>
        <div class="text-lg font-black text-white mt-1 truncate" title="${stats.newPeriod.topCategory?.name || 'N/A'}">${stats.newPeriod.topCategory?.name || 'N/A'}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">${(stats.newPeriod.topCategory?.skus || 0).toLocaleString()} SKUs</div>
      </div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div class="text-xs text-zinc-400">Tỷ Lệ Đang Hoạt Động</div>
        <div class="text-2xl font-black text-emerald-400 mt-1">${stats.newPeriod.activeRatio}%</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">Trạng thái SKU Onsite</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h3 class="text-base font-bold text-white mb-1">Số Lượng Sản Phẩm & SKUs Đã Tạo</h3>
        <p class="text-xs text-zinc-400 mb-4">So sánh Sản phẩm (ID duy nhất) vs SKUs trong ${periodTitle}</p>
        <div class="h-64">
          <canvas id="barChart"></canvas>
        </div>
      </div>

      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h3 class="text-base font-bold text-white mb-1">Cơ Cấu Tỷ Trọng Ngành Hàng</h3>
        <p class="text-xs text-zinc-400 mb-4">Tỷ lệ % SKU theo danh mục trong ${periodTitle}</p>
        <div class="h-64">
          <canvas id="donutChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Summary Table -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
      <div class="bg-zinc-800/80 px-6 py-4 border-b border-zinc-700 flex justify-between items-center">
        <h3 class="text-base font-bold text-white">Bảng Số Liệu Tổng Hợp Theo Ngành Hàng</h3>
        <span class="text-xs font-semibold text-amber-400">Kỳ: ${periodTitle}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm border-collapse">
          <thead>
            <tr class="bg-zinc-950 border-b border-zinc-700 text-xs">
              <th class="py-3 px-4 font-bold text-rose-400 uppercase w-1/3">HỆ THỐNG MỚI</th>
              <th colspan="3" class="py-3 px-4 font-bold text-white text-center border-l border-zinc-800 bg-zinc-900">${periodTitle}</th>
              <th colspan="3" class="py-3 px-4 font-bold text-white text-center border-l border-zinc-800 bg-blue-950/50">TOÀN HỆ THỐNG VNS (LŨY KẾ)</th>
            </tr>
            <tr class="border-b border-zinc-800 bg-zinc-900/90 text-xs text-zinc-400">
              <th class="py-2.5 px-4">Ngành hàng (Category)</th>
              <th class="py-2.5 px-4 text-right border-l border-zinc-800 text-rose-300">Sản phẩm</th>
              <th class="py-2.5 px-4 text-right text-rose-200">SKUs</th>
              <th class="py-2.5 px-4 text-right text-zinc-300">Tỷ trọng %</th>
              <th class="py-2.5 px-4 text-right border-l border-zinc-800 text-blue-300">Sản phẩm</th>
              <th class="py-2.5 px-4 text-right text-blue-200">SKUs</th>
              <th class="py-2.5 px-4 text-right text-zinc-300">Tỷ trọng %</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800 text-zinc-200 text-xs">
            <tr class="bg-zinc-800/40 font-bold">
              <td class="py-2.5 px-4 text-emerald-400 font-extrabold">Số lượng sản phẩm onsite mới</td>
              <td class="py-2.5 px-4 text-right border-l border-zinc-800 text-rose-300 font-extrabold">${stats.newPeriod.totalProducts.toLocaleString()}</td>
              <td class="py-2.5 px-4 text-right text-rose-200 font-extrabold">${stats.newPeriod.totalSkus.toLocaleString()}</td>
              <td class="py-2.5 px-4 text-right">100%</td>
              <td class="py-2.5 px-4 text-right border-l border-zinc-800 text-blue-300 font-extrabold">${stats.allTime.totalProducts.toLocaleString()}</td>
              <td class="py-2.5 px-4 text-right text-blue-200 font-extrabold">${stats.allTime.totalSkus.toLocaleString()}</td>
              <td class="py-2.5 px-4 text-right">100%</td>
            </tr>
            ${stats.newPeriod.categories.map(c => {
              const allC = stats.allTime.categories.find(ac => ac.category === c.category);
              return `<tr>
                <td class="py-2.5 px-4 font-semibold text-zinc-300">${c.category}</td>
                <td class="py-2.5 px-4 text-right border-l border-zinc-800 text-zinc-300 font-mono">${c.productCount.toLocaleString()}</td>
                <td class="py-2.5 px-4 text-right text-zinc-200 font-mono font-bold">${c.skuCount.toLocaleString()}</td>
                <td class="py-2.5 px-4 text-right text-zinc-400">${c.percentage}%</td>
                <td class="py-2.5 px-4 text-right border-l border-zinc-800 text-zinc-300 font-mono">${(allC?.productCount || 0).toLocaleString()}</td>
                <td class="py-2.5 px-4 text-right text-zinc-200 font-mono font-bold">${(allC?.skuCount || 0).toLocaleString()}</td>
                <td class="py-2.5 px-4 text-right text-zinc-400">${allC?.percentage || 0}%</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Auto Remarks -->
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3">
      <h3 class="text-base font-bold text-white">Nhận Xét & Đánh Giá Tự Động (${periodTitle})</h3>
      <ul class="space-y-2 text-sm text-zinc-300 list-disc list-inside">
        <li>Tổng số lượng sản phẩm onsite mới trên VnShop ${periodTitle} đạt <strong>${stats.newPeriod.totalProducts.toLocaleString()} sản phẩm</strong> tương ứng với <strong>${stats.newPeriod.totalSkus.toLocaleString()} SKUs</strong>.</li>
        <li>Ngành hàng chiếm tỷ trọng SKU cao nhất trong kỳ là <strong>${stats.newPeriod.topCategory?.name || 'N/A'}</strong> với <strong>${(stats.newPeriod.topCategory?.skus || 0).toLocaleString()} SKUs</strong>.</li>
        <li>Tỷ lệ hàng đang hoạt động đạt <strong>${stats.newPeriod.activeRatio}%</strong>.</li>
        <li>Lũy kế toàn sàn VnShop hiện có <strong>${stats.allTime.totalProducts.toLocaleString()} sản phẩm</strong> và <strong>${stats.allTime.totalSkus.toLocaleString()} SKUs</strong> đã onsite.</li>
      </ul>
    </div>

    <!-- Footer -->
    <div class="text-center text-xs text-zinc-500 pt-4 pb-8">
      Xuất bản bởi ${author} • Hệ thống Báo Cáo Nhập Liệu VnShop
    </div>

  </div>

  <script>
    // Initialize Bar Chart
    const ctxBar = document.getElementById('barChart').getContext('2d');
    new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: ['${periodTitle}'],
        datasets: [
          {
            label: 'Sản phẩm (${stats.newPeriod.totalProducts.toLocaleString()})',
            data: [${stats.newPeriod.totalProducts}],
            backgroundColor: '#3b82f6',
            borderRadius: 6
          },
          {
            label: 'SKUs (${stats.newPeriod.totalSkus.toLocaleString()})',
            data: [${stats.newPeriod.totalSkus}],
            backgroundColor: '#dc2626',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e4e4e7', font: { size: 12 } } }
        },
        scales: {
          x: { ticks: { color: '#a1a1aa' }, grid: { display: false } },
          y: { ticks: { color: '#a1a1aa' }, grid: { color: '#27272a' } }
        }
      }
    });

    // Initialize Donut Chart
    const ctxDonut = document.getElementById('donutChart').getContext('2d');
    new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: ${JSON.stringify(categoriesData.map(c => c.category))},
        datasets: [{
          data: ${JSON.stringify(categoriesData.map(c => c.skuCount))},
          backgroundColor: ['#3b82f6', '#06b6d4', '#f97316', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#e4e4e7', font: { size: 11 } } }
        }
      }
    });
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bao_Cao_SKU_${periodTitle.replace(/[^a-zA-Z0-9_\-]/g, '_')}_VnShop.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
