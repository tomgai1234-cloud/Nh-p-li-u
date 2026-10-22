import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, Search, Sparkles, Globe, FileText, Image as ImageIcon, 
  Code, ScanLine, Tag, DownloadCloud, ExternalLink, Copy, Check, 
  ArrowRight, Play, Filter, Wand2, Eye, BookOpen, Layers, ShieldCheck,
  Zap, Cpu, CheckCircle2, X
} from 'lucide-react';
import type { AppGalleryItem } from '../../types';

interface AppGalleryTabProps {
  onSelectTab?: (tabId: string, payload?: any) => void;
}

const GALLERY_APPS: AppGalleryItem[] = [
  {
    id: 'seo-search-assistant',
    title: 'Google Search Fact-Check & AI Assistant',
    category: 'seo',
    badge: 'Google Search Live',
    description: 'Trợ lý AI kết nối dữ liệu Google Search thời gian thực để thảo luận tin tức mới nhất, kiểm tra sự thật (fact-check), tra cứu thông số sản phẩm và dẫn nguồn uy tín.',
    features: [
      'Truy vấn Google Search trực tiếp thời gian thực',
      'Fact-check kiểm tra thông số kỹ thuật chống AI bịa đặt',
      'Cung cấp URL trích dẫn chính xác kèm tiêu đề nguồn'
    ],
    targetTab: 'chatbot',
    presetQuery: 'Fact-check kiểm tra thông số chip và camera thực tế của iPhone 16 Pro Max?',
    promptExample: 'Hãy tra cứu Google Search thời gian thực và phân tích các nguồn tin mới nhất về [Sản phẩm/Chủ đề], sau đó trích dẫn nguồn uy tín.'
  },
  {
    id: 'seo-keyword-booster',
    title: 'SEO Keyword Suggestion & Meta Generator',
    category: 'seo',
    badge: 'SEO Ranking',
    description: 'Tự động nghiên cứu từ khóa tìm kiếm Google phổ biến, tạo từ khóa chính, từ khóa dài (long-tail) và tối ưu thẻ Meta Description chuẩn 120-165 ký tự.',
    features: [
      'Gợi ý từ khóa chính & từ khóa ngách bằng Google Search',
      'Viết Meta Description chuẩn SEO kích thích click (CTR)',
      'Phân tích ý định tìm kiếm (Search Intent) của khách hàng'
    ],
    targetTab: 'description',
    presetQuery: 'Máy giặt Panasonic Inverter 12kg',
    promptExample: 'Phân tích từ khóa tìm kiếm Google và tạo bộ từ khóa SEO + Meta Description cho sản phẩm: [Tên sản phẩm].'
  },
  {
    id: 'html-description-generator',
    title: 'Trình Tạo Mô Tả Sản Phẩm & Chuẩn Hóa HTML',
    category: 'content',
    badge: 'E-commerce AI',
    description: 'Chuyển đổi tên sản phẩm hoặc ghi chú thô thành bài mô tả chuẩn SEO, định dạng HTML semantic đẹp mắt, tương thích Shopee, Lazada, Tiki, WooCommerce.',
    features: [
      'Xuất bản HTML sạch, không chứa inline styles rườm rà',
      'Bật/tắt linh hoạt các khối thông số kỹ thuật (Review Mode)',
      'Tích hợp kiểm tra chống bịa đặt (Hallucination Checker)'
    ],
    targetTab: 'description',
    presetQuery: 'Nồi chiên không dầu Philips HD9650 3.5 lít',
    promptExample: 'Tạo bài viết mô tả sản phẩm chi tiết định dạng HTML semantic cho [Tên sản phẩm] với các thẻ h2, h3, ul, li, strong.'
  },
  {
    id: 'batch-frame-studio',
    title: 'Đóng Khung & Watermark Hàng Loạt',
    category: 'media',
    badge: 'Batch Automation',
    description: 'Xử lý hàng loạt ảnh sản phẩm, tự động ghép khung viền khuyến mãi, logo thương hiệu, dán nhãn flash sale siêu tốc cho sàn thương mại điện tử.',
    features: [
      'Xử lý canvas thời gian thực trực tiếp trên trình duyệt',
      'Tải xuống hàng loạt định dạng ZIP hoặc từng file ảnh',
      'Tùy chỉnh tỷ lệ 1:1, 3:4 và căn chỉnh vị trí linh hoạt'
    ],
    targetTab: 'batch-frame',
    promptExample: 'Tự động áp dụng khung viền khuyến mãi viền đỏ viền vàng và logo cho danh sách 50 ảnh sản phẩm.'
  },
  {
    id: 'attribute-extractor',
    title: 'Bóc Tách Thuộc Tính & Thông Số Kỹ Thuật',
    category: 'data',
    badge: 'Data Mining',
    description: 'Tự động quét văn bản mô tả hoặc hướng dẫn sử dụng, phân tách chính xác các cặp thuộc tính: Giá trị (Công suất, Dung tích, Kích thước, Trọng lượng).',
    features: [
      'Xuất bảng dữ liệu có cấu trúc JSON / Excel sẵn sàng import',
      'Nhận diện các đại lượng kỹ thuật (W, V, Kg, Lít, mm)',
      'Không bịa thông tin: Tự động điền N/A khi thông tin thiếu'
    ],
    targetTab: 'extractor',
    presetQuery: 'Công suất 1800W, dung tích 5 lít, điện áp 220V, trọng lượng 4.5kg',
    promptExample: 'Trích xuất toàn bộ thông số kỹ thuật từ đoạn mô tả sau thành danh sách thuộc tính chuẩn hóa: [Đoạn văn bản]'
  },
  {
    id: 'product-name-standardizer',
    title: 'Chuẩn Hóa Tên Sản Phẩm Theo Công Thức',
    category: 'ecommerce',
    badge: 'Formula SEO',
    description: 'Định dạng lại hàng loạt tên sản phẩm lộn xộn theo công thức chuẩn: [Loại] + [Thương hiệu] + [Model] + [Đặc điểm chính] + [Màu sắc/Kích thước].',
    features: [
      'Chuẩn hóa chữ hoa/thường, xóa ký tự rác và icon lỗi',
      'Đảm bảo độ dài tối ưu cho thuật toán tìm kiếm sàn TMĐT',
      'Xử lý lô hàng trăm sản phẩm đồng thời'
    ],
    targetTab: 'standardizer',
    presetQuery: 'ip16 prm 256gb titan sa mac gia tot',
    promptExample: 'Chuẩn hóa tên sản phẩm sau theo cấu trúc thương mại điện tử chuẩn: [Tên sản phẩm gốc]'
  },
  {
    id: 'html-beautifier-cleaner',
    title: 'Tối Ưu & Làm Sạch HTML Lồng Nhau',
    category: 'content',
    badge: 'Code Optimizer',
    description: 'Làm sạch các đoạn mã HTML rác copy từ Google Docs, Word hay website đối thủ. Loại bỏ các thẻ div lồng nhau vô nghĩa, giữ lại cấu trúc semantic tinh gọn.',
    features: [
      'Xóa bỏ triệt để div lồng vô tận và inline css style',
      'Chuyển đổi heading hợp lý (h2, h3, p, strong)',
      'Bảo toàn 100% nội dung gốc của bài viết'
    ],
    targetTab: 'docs-to-html',
    promptExample: 'Tối ưu và rút gọn cấu trúc HTML sau, loại bỏ div lồng nhau nhưng giữ nguyên nội dung: [Đoạn mã HTML]'
  },
  {
    id: 'scraper-hub',
    title: 'Hub Cào Dữ Liệu & Tải Ảnh Đa Nền Tảng',
    category: 'data',
    badge: 'Web Scraper',
    description: 'Cào ảnh gốc chất lượng cao, trích xuất dữ liệu sản phẩm từ Shopee, WebTars và các trang thương mại điện tử chỉ với 1 đường link URL.',
    features: [
      'Trích xuất toàn bộ gallery ảnh sản phẩm và ảnh mô tả',
      'Tải xuống một lần trọn gói file nén ZIP tiện lợi',
      'Tự động lọc ảnh trùng lặp và ảnh icon không cần thiết'
    ],
    targetTab: 'scraper-hub',
    promptExample: 'Thu thập tất cả ảnh độ phân giải cao và video sản phẩm từ link URL: [URL sản phẩm]'
  }
];

const CATEGORIES = [
  { id: 'all', label: 'Tất cả Ứng dụng' },
  { id: 'seo', label: 'SEO & Search' },
  { id: 'content', label: 'Nội dung & AI' },
  { id: 'media', label: 'Hình ảnh & Media' },
  { id: 'data', label: 'Dữ liệu & Khai thác' },
  { id: 'ecommerce', label: 'E-commerce Sàn' },
];

export const AppGalleryTab: React.FC<AppGalleryTabProps> = ({ onSelectTab }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalApp, setActiveModalApp] = useState<AppGalleryItem | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const filteredApps = useMemo(() => {
    return GALLERY_APPS.filter(app => {
      const matchCat = selectedCategory === 'all' || app.category === selectedCategory;
      const matchSearch = searchQuery.trim() === '' || 
        app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handleCopyPrompt = (prompt: string, id: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const handleLaunchApp = (app: AppGalleryItem | null) => {
    if (!app) return;
    setActiveModalApp(null);
    if (onSelectTab) {
      onSelectTab(app.targetTab, { presetQuery: app.presetQuery, prompt: app.promptExample });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-950/40 via-zinc-900 to-zinc-950 border border-sky-500/20 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Thư Viện Ứng Dụng (App Gallery)
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight">
            Khám Phá & Remix Các Ứng Dụng Sẵn Có
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Khởi động quy trình làm việc e-commerce nhanh chóng: Tìm công cụ bạn thích, xem chi tiết cách hoạt động (How it's built), và Remix/Mở trực tiếp để sử dụng cho sản phẩm của bạn.
          </p>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 custom-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-700/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm ứng dụng, tính năng..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Grid of Apps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredApps.map(app => (
          <div
            key={app.id}
            className="flex flex-col justify-between bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 hover:border-sky-500/40 rounded-xl p-5 shadow-sm transition-all duration-200 group"
          >
            <div className="space-y-3">
              {/* Header Badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-950/60 border border-sky-500/40 text-sky-300">
                  <Zap className="w-3 h-3 text-sky-400" />
                  {app.badge}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  {app.category}
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-base font-bold text-zinc-100 group-hover:text-sky-300 transition-colors">
                  {app.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 line-clamp-3 leading-relaxed">
                  {app.description}
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                {app.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-2 text-xs text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center gap-2">
              <button
                onClick={() => setActiveModalApp(app)}
                className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                title="Xem cách xây dựng ứng dụng này"
              >
                <Eye className="w-3.5 h-3.5" /> Xem cách tạo
              </button>

              <button
                onClick={() => handleLaunchApp(app)}
                className="flex-1 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-sky-600/20 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" /> Mở & Remix
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredApps.length === 0 && (
        <div className="text-center py-16 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <Search className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium text-sm">Không tìm thấy ứng dụng phù hợp với tìm kiếm của bạn.</p>
          <button 
            onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
            className="mt-3 text-xs text-sky-400 hover:text-sky-300 font-semibold"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      )}

      {/* How It's Built / Remix Details Modal */}
      <AnimatePresence>
        {activeModalApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-600/40 font-semibold">
                      {activeModalApp.badge}
                    </span>
                    <span className="text-xs text-zinc-500 uppercase">{activeModalApp.category}</span>
                  </div>
                  <h2 className="text-lg font-bold text-zinc-100 mt-1">
                    {activeModalApp.title}
                  </h2>
                </div>
                <button
                  onClick={() => setActiveModalApp(null)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Description & Architecture */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-sky-400" /> Kiến trúc & Công nghệ (How it's built)
                </h4>
                <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 text-xs text-zinc-300 space-y-2">
                  <p><strong>Mô hình AI:</strong> Google Gemini 2.5 Flash kết nối Google Search Grounding thời gian thực.</p>
                  <p><strong>Cơ chế bảo vệ:</strong> Không bịa thông tin (Zero Hallucination), trả về "N/A" khi thiếu dữ liệu, tự động rà soát đối chiếu chéo.</p>
                  <p><strong>Hiệu năng:</strong> Batch processing bất đồng bộ không làm đơ giao diện, tự động sinh mã HTML semantic tối giản.</p>
                </div>
              </div>

              {/* Prompt Template */}
              {activeModalApp.promptExample && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Code className="w-4 h-4 text-emerald-400" /> Mẫu Lệnh AI (System / Prompt Blueprint)
                    </h4>
                    <button
                      onClick={() => handleCopyPrompt(activeModalApp.promptExample!, activeModalApp.id)}
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedPromptId === activeModalApp.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPromptId === activeModalApp.id ? 'Đã sao chép' : 'Sao chép Prompt'}
                    </button>
                  </div>
                  <pre className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs text-emerald-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {activeModalApp.promptExample}
                  </pre>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
                <button
                  onClick={() => setActiveModalApp(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  onClick={() => handleLaunchApp(activeModalApp)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-sky-600/30 cursor-pointer"
                >
                  <Wand2 className="w-4 h-4" /> Mở công cụ & Remix ngay
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppGalleryTab;
