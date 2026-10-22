import React, { useState, useMemo } from 'react';
import { 
  Sparkles, GitCommit, Tag, Calendar, CheckCircle2, Zap, 
  ShieldCheck, Bug, Search, ChevronDown, ChevronUp, Info, 
  ListFilter, Layers, ArrowUpRight, Check, RefreshCw
} from 'lucide-react';

export interface ChangeItem {
  type: 'feature' | 'performance' | 'bugfix' | 'system';
  title: string;
  description: string;
  details?: string[];
}

export interface ReleaseVersion {
  version: string;
  buildCode?: string;
  releaseDate: string;
  badge?: string;
  isLatest?: boolean;
  summary: string;
  changes: ChangeItem[];
}

const RELEASE_HISTORY: ReleaseVersion[] = [
  {
    version: 'v3.2.0',
    buildCode: 'Shopee Variant Scraper & CDN Resilience',
    releaseDate: '05/10/2026',
    badge: 'Mới nhất - Khôi phục Đào Ảnh Biến Thể Shopee & Fix CDN',
    isLatest: true,
    summary: 'Bản cập nhật khôi phục toàn diện tính năng Đào Ảnh Biến Thể Shopee (Variant Images): Bóc tách trọn vẹn 100% ảnh phân loại màu sắc, phiên bản dung lượng cùng tên biến thể từ API Shopee và SSR, đồng thời tối ưu hóa hạ tầng CDN Everest.',
    changes: [
      {
        type: 'bugfix',
        title: 'Khôi phục tính năng Đào Ảnh Biến Thể Shopee (Shopee Variant Images)',
        description: 'Tích hợp cơ chế cào ảnh đa tầng từ Shopee PDP/Item API, bóc tách `tier_variations` (phân loại màu sắc/dung lượng) và `models` trong mã nguồn trang.',
        details: [
          'Trích xuất đầy đủ tất cả ảnh đại diện của từng nút biến thể (Purple, White, Black, 12+256GB, 12+512GB...).',
          'Tự động map tên phân loại tương ứng vào từng ảnh biến thể.',
          'Bảo toàn phân loại ảnh Main (8), Variant (6), Description (10), Video (1) chuẩn cấu trúc ShopeeSave.'
        ]
      },
      {
        type: 'bugfix',
        title: 'Khắc phục triệt để lỗi "Failed to fetch" trên Everest CDN (cdneverest.net)',
        description: 'Tối ưu hóa endpoint `/api/proxy` phía Server: Loại bỏ header `Origin` giả lập vốn bị tường lửa CDN từ chối (403), chuẩn hóa `Sec-Fetch-Dest: image` và nâng thời gian timeout lên 12 - 35s cho các đợt tải hàng loạt.',
        details: [
          'Hỗ trợ cào mượt mà các link ảnh từ `2885371169.e.cdneverest.net` và các CDN thời trang nội địa.',
          'Bổ sung tầng Node.js Native Fetch và Puppeteer Buffer Direct Capture khi Axios bị chặn.',
          'Tích hợp 2 CDN Proxy toàn cầu (images.weserv.nl, corsproxy.io) dự phòng khi mất kết nối máy chủ.'
        ]
      },
      {
        type: 'bugfix',
        title: 'Tương thích Express 5 & Khởi động Dev Server mượt mà',
        description: 'Khắc phục lỗi cú pháp `PathError: Missing parameter name at index 1: *` của Express 5.x trên môi trường phát triển, đảm bảo Vite middleware hoạt động ổn định.',
        details: [
          'Chuyển đổi cú pháp định tuyến wildcard sang middleware tiêu chuẩn của Express 5.',
          'Khởi động Dev Server qua Vite development middleware với tốc độ phản hồi tức thì.'
        ]
      },
      {
        type: 'performance',
        title: 'Bổ sung cơ chế Tải Trực Tiếp (Client Direct Fetch) tốc độ ~50ms',
        description: 'Client tự động thử tải trực tiếp trước khi gọi qua Server Proxy đối với các CDN có hỗ trợ CORS mở, giúp giảm tải 80% cho máy chủ và tăng tốc độ tải ảnh lên gấp 5 lần.',
        details: [
          'Tự động phân luồng: Ảnh CORS tải trực tiếp tại máy người dùng; ảnh bị chặn CORS tự động đi qua Proxy 3 tầng.'
        ]
      },
      {
        type: 'system',
        title: 'Quy chuẩn Cập nhật Nhật Ký Phát Triển Toàn Diện',
        description: 'Thiết lập quy tắc mặc định: Mọi thay đổi, cập nhật tính năng, sửa lỗi hay nâng cấp hạ tầng đều phải được ghi nhận đầy đủ, minh bạch vào Tab Lịch Sử Cập Nhật.',
        details: [
          'Ghi nhận chi tiết ngày tháng phát hành, mã build và danh sách chi tiết các điểm thay đổi.'
        ]
      }
    ]
  },
  {
    version: 'v3.1.0',
    buildCode: 'Viewer Persistence & Standalone HTML Report',
    releaseDate: '01/10/2026',
    badge: 'Đột phá Báo Cáo: Xem Public Không Cần Tài Khoản',
    summary: 'Nâng cấp toàn diện cho tính năng Chia Sẻ Báo Cáo: Bảo vệ chế độ Người xem (Viewer Persistence), hỗ trợ Xuất Báo Cáo HTML Độc Lập tự chạy offline và link Web độc lập không bị chặn bởi AI Studio.',
    changes: [
      {
        type: 'bugfix',
        title: 'Bảo vệ Chế độ Người xem (Viewer Cloud Persistence) - Chống xóa trắng dữ liệu',
        description: 'Khắc phục triệt để tình trạng khi người xem mở link báo cáo trên máy khác và ấn "Áp Dụng Cho Báo Cáo" thì bị xóa trắng dữ liệu do máy người xem chưa có IndexedDB.',
        details: [
          'Hệ thống tự động phát hiện người xem máy ngoài và nạp snapshot từ Cloud Server.',
          'Người xem có thể bấm "Áp Dụng", chọn kỳ, lọc ngành hàng thoải mái mà không bao giờ bị mất số liệu.'
        ]
      },
      {
        type: 'feature',
        title: 'Ra mắt Tính năng Tải File Báo Cáo HTML Độc Lập (.html)',
        description: 'Bổ sung nút "Tải File HTML" xuất toàn bộ báo cáo thành 1 file `.html` duy nhất chứa đầy đủ biểu đồ Chart.js, bảng số liệu và nhận xét tự động.',
        details: [
          'Người nhận chỉ cần double-click mở file bằng trình duyệt là xem được ngay 100% offline.',
          'Không cần tài khoản, không cần đăng nhập Google AI Studio, không sợ nghẽn mạng.'
        ]
      },
      {
        type: 'feature',
        title: 'Hộp thoại Lấy Link Chia Sẻ Public & Hướng dẫn Chống Lỗi "Page not found"',
        description: 'Tạo link Web độc lập (`?tab=sku-report`) và cảnh báo người dùng không copy URL quản trị nội bộ Google AI Studio để tránh lỗi phân quyền.',
        details: [
          'Tích hợp nút Sao Chép Link 1-click và Mở xem thử trực tiếp trong tab mới.'
        ]
      }
    ]
  },
  {
    version: 'v3.0.0',
    buildCode: 'SKU Intelligence & Enterprise Analytics',
    releaseDate: '25/09/2026',
    badge: 'Phân Hệ Báo Cáo SKU Onsite Toàn Diện',
    summary: 'Chính thức ra mắt phân hệ Báo Cáo Nhập Liệu & Phân Tích SKU Onsite (SkuReportTab) với khả năng xử lý 100,000+ SKU, tự động phân loại ngành hàng, so sánh sản phẩm mới vs lũy kế và xuất báo cáo PowerPoint/Excel.',
    changes: [
      {
        type: 'feature',
        title: 'Hệ Thống Phân Tích SKU Onsite Tự Động (SkuReportTab)',
        description: 'Tự động bóc tách 4 số đầu SKU (`2609...` $\rightarrow$ Tháng 09/2026), phân loại sản phẩm đơn vs biến thể cha con, tự động chuẩn hóa về 10 ngành hàng chuẩn.',
        details: [
          'Tính toán số lượng sản phẩm mới trong kỳ vs Toàn bộ hệ thống lũy kế.',
          'Biểu đồ Cột và Biểu đồ Tròn cơ cấu tỷ trọng ngành hàng trực quan.',
          'Tự động sinh nhận xét tổng hợp chuẩn biểu mẫu VnShop.'
        ]
      },
      {
        type: 'feature',
        title: 'Xuất Báo Cáo Đa Kênh: PowerPoint (.pptx) & Excel (.xlsx)',
        description: 'Hỗ trợ xuất slide bài thuyết trình PowerPoint định dạng 16:9 chuyên nghiệp và file Excel chi tiết có phân loại ngành hàng.',
        details: [
          'Slide PowerPoint tự động vẽ biểu đồ và phân tích thương hiệu dẫn đầu.',
          'File Excel chuẩn hóa sẵn sàng gửi cho cấp quản lý.'
        ]
      },
      {
        type: 'performance',
        title: 'Quản Lý Kho Dữ Liệu Lớn bằng IndexedDB (100,000+ Dòng)',
        description: 'Lưu trữ cục bộ cực kỳ an toàn, cho phép nạp nhiều đợt dữ liệu, so sánh chênh lệch giữa các đợt và đặt lại kho dữ liệu tức thì.',
        details: [
          'Hỗ trợ chế độ Auto-Batch tự động tìm sản phẩm mới nạp lần đầu.'
        ]
      }
    ]
  },
  {
    version: 'v2.5.0',
    buildCode: 'v6.4.1 Build Engine',
    releaseDate: '12/08/2026',
    badge: 'Khắc phục lỗi Fetch & Tối ưu Speed 6x',
    isLatest: false,
    summary: 'Bản nâng cấp hạ tầng mạng diện rộng: Giải quyết triệt để lỗi "Failed to fetch" khi tải/đẩy ảnh hàng loạt, nâng cấp Server Proxy Cloudinary, tối ưu hóa thuật toán cào dữ liệu Puppeteer Stealth và mở rộng độ song song.',
    changes: [
      {
        type: 'bugfix',
        title: 'Khắc phục lỗi "Failed to fetch" & Quyền xem Google Drive',
        description: 'Cải tiến thuật toán bóc tách ID ảnh Google Drive (`lh3.googleusercontent.com/d/{id}=s0`), hỗ trợ tải trực tiếp không cần đăng nhập Google, bypassing hoàn toàn rào cản CORS và lỗi 403 Forbidden.',
        details: [
          'Chuyển đổi URL Drive xem trước/file/d/ sang direct high-res CDN stream endpoint.',
          'Tự động tích hợp Fallback `drive.google.com/thumbnail` khi gặp link hạn chế.',
          'Bổ sung thuật toán quét đa proxy xoay vòng tự động retry 3 lần với exponential backoff.'
        ]
      },
      {
        type: 'feature',
        title: 'Thêm Server Proxy Upload cho Cloudinary (/api/cloudinary/upload)',
        description: 'Bổ sung endpoint tải ảnh phía Server bằng Node.js Crypto SHA-1 signature. Nếu kết nối trực tiếp từ trình duyệt đến Cloudinary bị rớt mạng hoặc quá tải socket, hệ thống sẽ tự động chuyển hướng qua Server Proxy.',
        details: [
          'Tự động mã hóa Base64 và ký tên signature an toàn phía server.',
          'Giúp đẩy hàng trăm ảnh lớn lên Cloudinary mà không sợ bị hủy session.'
        ]
      },
      {
        type: 'performance',
        title: 'Nâng cấp Tốc độ Upload & Tối ưu Đa Luồng (Concurrency)',
        description: 'Điều chỉnh workerpool trong Tab "Tải Ảnh Hàng Loạt" & "Đẩy Ảnh Shopify/Cloudinary" giúp chạy ổn định 4-8 luồng đồng thời mà không bị kẹt bộ nhớ.',
        details: [
          'Giảm nghẽn mạng bằng cơ chế queue thông minh.',
          'Xử lý mượt mà danh sách Excel có chứa nhiều link trong cùng 1 ô (ngắt bằng xuống dòng hoặc dấu phẩy).'
        ]
      },
      {
        type: 'system',
        title: 'Cập nhật Puppeteer Stealth Engine cho Cào Dữ Liệu Web & Shopee',
        description: 'Tích hợp headless browser tự động bypass Cloudflare, chống bị block IP khi quét dữ liệu hàng loạt trên Shopee, Aristino, Panasonic, và các trang TMĐT.',
        details: [
          'Tự động giả lập User-Agent trình duyệt thật.',
          'Tích hợp chế độ cuộn trang thông minh (Lazy load image scraper).'
        ]
      }
    ]
  },
  {
    version: 'v2.4.0',
    buildCode: 'Scraper Hub & Multi-Platform',
    releaseDate: '28/07/2026',
    badge: 'Đột phá Cào Dữ Liệu',
    summary: 'Tập trung xây dựng hệ sinh thái cào dữ liệu chuyên sâu với Scraper Hub, hỗ trợ bóc tách sản phẩm Shopee, WebTars DOM Scraper và lưu trữ lịch sử quét.',
    changes: [
      {
        type: 'feature',
        title: 'Ra mắt Tab Scraper Hub (Trung tâm Cào Dữ Liệu)',
        description: 'Giao diện tập trung gom tất cả công cụ bóc tách dữ liệu sản phẩm, hình ảnh, văn bản HTML từ nhiều nguồn trang web khác nhau.',
        details: [
          'Tích hợp Shopee Scraper: Tự động bóc tách tên, giá, mã SKU, biến thể, hình ảnh sản phẩm.',
          'Tích hợp WebTars Scraper: Định nghĩa selector tùy biến để cào thông tin bất kỳ website nào.'
        ]
      },
      {
        type: 'feature',
        title: 'Quản lý Lịch sử Cào Dữ Liệu (Scraping History)',
        description: 'Cho phép xem lại các phiên quét trước đó, tải về file Excel/CSV mà không cần phải thực hiện cào lại từ đầu.',
        details: [
          'Lưu trữ tự động thông tin kết quả vào bộ nhớ máy và Cloud.',
          'Xuất dữ liệu tùy chọn định dạng Excel, CSV, JSON.'
        ]
      },
      {
        type: 'performance',
        title: 'Tối ưu Tốc độ Trích xuất HTML & Bóc tách thuộc tính',
        description: 'Tăng 300% tốc độ đọc DOM và bóc tách bảng thuộc tính sản phẩm kỹ thuật.',
        details: [
          'Xử lý bất đồng bộ đa luồng cho danh sách 500+ link cùng lúc.'
        ]
      }
    ]
  },
  {
    version: 'v2.2.0',
    buildCode: 'AI Media Studio & Frame Magic',
    releaseDate: '10/06/2026',
    badge: 'Xử lý Ảnh & Video AI',
    summary: 'Nâng cấp toàn diện cho bộ công cụ Media: Chỉnh sửa ảnh với AI Gemini Flash Image, Ghép khung sản phẩm hàng loạt (Batch Frame) và Biên tập Video.',
    changes: [
      {
        type: 'feature',
        title: 'Studio Chỉnh sửa Ảnh AI (ImageEditorTab)',
        description: 'Tích hợp mô hình AI Gemini Flash Image cho phép thực hiện các thao tác xử lý ảnh đỉnh cao bằng câu lệnh tự nhiên.',
        details: [
          'Tách nền tự động (AI Background Removal) cực kỳ sắc nét.',
          'Studio Phông nền: Tự động ghép sản phẩm vào cảnh Studio, bàn gỗ, sân vườn.',
          'Xóa vật thể thừa & Watermark (Object Cleanup) không để lại vết mờ.',
          'Chỉnh sửa bằng lệnh văn bản (Magic Prompt Edit): Ví dụ "Đổi màu sản phẩm sang đỏ".'
        ]
      },
      {
        type: 'feature',
        title: 'Tạo Khung Ảnh Hàng Loạt (BatchFrameTab)',
        description: 'Hỗ trợ đè khung khuyến mãi (Khung Sale, Freeship, Shopee Frame) lên hàng trăm ảnh sản phẩm chỉ trong vài giây.',
        details: [
          'Tải lên hoặc chọn các mẫu khung chuẩn sàn TMĐT.',
          'Tự động căn chỉnh tỷ lệ 1:1, bảo toàn chất lượng ảnh gốc.'
        ]
      },
      {
        type: 'feature',
        title: 'Chỉnh sửa Video Sản Phẩm (VideoEditorTab)',
        description: 'Công cụ hỗ trợ cắt video ngắn, chèn phụ đề tự động và nén dung lượng video phù hợp đăng lên TikTok / Shopee Video.',
        details: []
      }
    ]
  },
  {
    version: 'v2.0.0',
    buildCode: 'Craft UI & System Governance',
    releaseDate: '15/04/2026',
    badge: 'Giao diện Nguyên khối & Phân quyền',
    summary: 'Tái thiết kế toàn bộ giao diện theo ngôn ngữ Craft UI cao cấp, tích hợp Firebase Authentication, Firestore Database và Hệ thống Quản lý Người dùng.',
    changes: [
      {
        type: 'system',
        title: 'Tái thiết kế Giao diện Craft UI Dark Canvas',
        description: 'Mang đến trải nghiệm mượt mà, chuyên nghiệp với tông màu Dark Mode chuẩn thiết kế sản phẩm cao cấp, thanh Sidebar thu gọn linh hoạt.',
        details: [
          'Tối ưu hóa spacing, font chữ Plus Jakarta Sans & Playfair Display.',
          'Hiệu ứng chuyển trang mượt mà bằng Framer Motion.'
        ]
      },
      {
        type: 'system',
        title: 'Tích hợp Firebase Auth & Quản lý Phân quyền (UserManagementTab)',
        description: 'Hệ thống xác thực tài khoản qua Google Auth và phân quyền người dùng chặt chẽ theo vai trò Admin, User, Blocked.',
        details: [
          'Admin có quyền cấp/thu hồi truy cập từng Tab chức năng riêng biệt cho từng người dùng.',
          'Chế độ Local Admin truy cập nhanh không cần chờ xác thực.'
        ]
      },
      {
        type: 'feature',
        title: 'Trò chuyện Nội bộ (GlobalChat) & Quản lý API Key',
        description: 'Tích hợp cửa sổ chat realtime kết nối tất cả người dùng trong hệ thống và Tab ApiKeysTab giúp người dùng lưu trữ an toàn các chìa khóa API cá nhân.',
        details: [
          'Hỗ trợ quản lý API Key: Gemini API Key, Cloudinary Credentials, Shopify Access Token, ImgBB Key.'
        ]
      }
    ]
  },
  {
    version: 'v1.5.0',
    buildCode: 'Data Standardization Engine',
    releaseDate: '02/02/2026',
    badge: 'Chuẩn hóa Dữ liệu Hàng loạt',
    summary: 'Mở rộng bộ công cụ xử lý dữ liệu với Tự động Chuẩn hóa File (FileConverterV2), Chuẩn hóa Tên Sản phẩm và Tải Ảnh Hàng Loạt đẩy thẳng lên CDN.',
    changes: [
      {
        type: 'feature',
        title: 'Công cụ Tự động Chuẩn hóa (FileConverterV2Tab)',
        description: 'Xử lý file Excel/CSV/JSON hàng loạt: Tự động loại bỏ ký tự rác, viết hoa chữ cái đầu, định dạng số tiền, tách họ tên và chuẩn hóa ngày tháng DD/MM/YYYY.',
        details: [
          'Cross-check kiểm tra chéo dòng/cột đảm bảo không trùng lặp.',
          'Trả kết quả dưới dạng Bảng xem trước và xuất file Excel cực nhanh.'
        ]
      },
      {
        type: 'feature',
        title: 'Chuẩn hóa Tên Sản phẩm (ProductNameStandardizerTab)',
        description: 'Tự động biến đổi tên sản phẩm lộn xộn thành tên chuẩn sàn TMĐT theo cấu trúc `[Loại] [Thương hiệu] [Model] [Thông số]`.',
        details: [
          'Tạo mã SKU không dấu nhanh chóng.',
          'Tích hợp AI tạo Tên SEO Quảng Cáo tối ưu tỷ lệ nhấp chuột (CTR).'
        ]
      },
      {
        type: 'feature',
        title: 'Tải Ảnh Hàng Loạt (BulkDownloadTab) & Đẩy CDN',
        description: 'Cho phép nhập danh sách URL ảnh hoặc đọc file Excel, tự động tải hàng loạt ảnh về máy nén file ZIP hoặc đẩy lên Cloudinary/Shopify/ImgBB.',
        details: [
          'Hỗ trợ đọc link Google Drive, Dropbox, Onedrive và hình ảnh từ mọi trang web.'
        ]
      }
    ]
  },
  {
    version: 'v1.0.0',
    buildCode: 'Initial Genesis Release',
    releaseDate: '01/11/2025',
    badge: 'Bản Khởi Tạo Đầu Tiên',
    summary: 'Phát hành phiên bản đầu tiên của ứng dụng Hỗ Trợ Nhập Liệu & Xử Lý Dữ Liệu TMĐT với các tính năng cốt lõi cho nhập liệu viên.',
    changes: [
      {
        type: 'feature',
        title: 'Tạo Mô tả Sản phẩm AI (DescriptionGeneratorTab)',
        description: 'Công cụ khởi tạo mô tả sản phẩm tự động dựa trên từ khóa hoặc thông tin tra cứu internet chuẩn SEO.',
        details: [
          'Hỗ trợ Chế độ Tiêu chuẩn và Chế độ Đồng bộ danh sách lớn.',
          'Xuất định dạng Văn bản thô, HTML hoặc file Excel.'
        ]
      },
      {
        type: 'feature',
        title: 'Trích xuất Thuộc tính Sản phẩm (ProductExtractorTab)',
        description: 'Tự động quét và đọc thông số kỹ thuật (Thương hiệu, Công suất, Kích thước, Màu sắc) từ tên hoặc đường dẫn sản phẩm.',
        details: [
          'Cấu hình bộ thuộc tính tùy biến linh hoạt theo từng ngành hàng.'
        ]
      },
      {
        type: 'feature',
        title: 'Trợ lý AI Chatbot & Dashboard Tổng quan',
        description: 'Trợ lý ảo hỗ trợ giải đáp thắc mắc nhập liệu và Bảng điều khiển thống kê tổng quan hoạt động.',
        details: [
          'Tích hợp Tài liệu Hướng dẫn chi tiết (GuideTab).'
        ]
      }
    ]
  }
];

const TYPE_CONFIG = {
  feature: {
    label: 'Tính năng mới',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: <Sparkles className="w-3.5 h-3.5" />
  },
  performance: {
    label: 'Tối ưu Hiệu năng',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    icon: <Zap className="w-3.5 h-3.5" />
  },
  bugfix: {
    label: 'Sửa lỗi',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: <Bug className="w-3.5 h-3.5" />
  },
  system: {
    label: 'Hệ thống & Bảo mật',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    icon: <ShieldCheck className="w-3.5 h-3.5" />
  }
};

const ChangelogTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'feature' | 'performance' | 'bugfix' | 'system'>('all');
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({
    'v2.5.0': true,
    'v2.4.0': true,
  });

  const toggleExpand = (ver: string) => {
    setExpandedVersions(prev => ({ ...prev, [ver]: !prev[ver] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    RELEASE_HISTORY.forEach(r => { allExpanded[r.version] = true; });
    setExpandedVersions(allExpanded);
  };

  const collapseAll = () => {
    setExpandedVersions({});
  };

  const filteredReleases = useMemo(() => {
    return RELEASE_HISTORY.map(rel => {
      const matchesSearch = 
        rel.version.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rel.buildCode && rel.buildCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        rel.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rel.changes.some(c => 
          c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.details && c.details.some(d => d.toLowerCase().includes(searchTerm.toLowerCase())))
        );

      if (!matchesSearch) return null;

      if (selectedFilter === 'all') return rel;

      const filteredChanges = rel.changes.filter(c => c.type === selectedFilter);
      if (filteredChanges.length === 0) return null;

      return {
        ...rel,
        changes: filteredChanges
      };
    }).filter(Boolean) as ReleaseVersion[];
  }, [searchTerm, selectedFilter]);

  const totalFeatures = useMemo(() => {
    return RELEASE_HISTORY.reduce((acc, rel) => acc + rel.changes.length, 0);
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16 animate-fade-in">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 p-6 sm:p-8 border border-zinc-800 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
              Lịch sử Phát triển & Nâng cấp Ứng dụng
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-100 tracking-tight">
              Nhật ký Phiên bản (Release Notes)
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed">
              Theo dõi chi tiết toàn bộ các tính năng mới, bản sửa lỗi kỹ thuật, và các cải tiến hiệu năng hệ thống từ bản khởi tạo đầu tiên cho đến phiên bản mới nhất.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-3 justify-start md:items-end flex-shrink-0">
            <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-right shadow-inner">
              <div className="text-xs text-zinc-400 font-medium">Phiên bản hiện tại</div>
              <div className="text-lg font-bold text-sky-400 font-mono">v2.5.0 (Build v6.4.1)</div>
            </div>
            <div className="bg-zinc-800/80 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-right shadow-inner">
              <div className="text-xs text-zinc-400 font-medium">Tổng số cải tiến</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">{totalFeatures}+ mục nâng cấp</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Controls Toolbar */}
      <div className="bg-zinc-900/80 backdrop-blur-md p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-16 z-10 shadow-lg">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm kiếm tính năng, mã lỗi, phiên bản..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 custom-scrollbar">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedFilter === 'all'
                ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-sm'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Tất cả
          </button>
          
          {(Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>).map((key) => {
            const cfg = TYPE_CONFIG[key];
            const isSelected = selectedFilter === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
                  isSelected
                    ? `${cfg.bg} ${cfg.border} ${cfg.text} font-semibold`
                    : 'bg-zinc-800/40 border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Expand / Collapse buttons */}
        <div className="hidden lg:flex items-center gap-2 border-l border-zinc-800 pl-4 flex-shrink-0">
          <button
            onClick={expandAll}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
          >
            Mở tất cả
          </button>
          <span className="text-zinc-700">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
          >
            Thu gọn
          </button>
        </div>
      </div>

      {/* Release Versions List */}
      {filteredReleases.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/40 rounded-2xl border border-zinc-800/80">
          <Info className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-zinc-300">Không tìm thấy nhật ký phù hợp</h3>
          <p className="text-zinc-500 text-sm mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bỏ lọc danh mục.</p>
          <button
            onClick={() => { setSearchTerm(''); setSelectedFilter('all'); }}
            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm transition-colors"
          >
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-6 relative before:absolute before:inset-0 before:left-6 sm:before:left-8 before:w-0.5 before:bg-zinc-800/80 before:z-0">
          {filteredReleases.map((release) => {
            const isExpanded = !!expandedVersions[release.version];

            return (
              <div key={release.version} className="relative z-10 pl-12 sm:pl-16">
                {/* Timeline Node Point */}
                <div className={`absolute left-4 sm:left-6 top-5 -translate-x-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  release.isLatest 
                    ? 'bg-sky-500 border-zinc-950 shadow-[0_0_12px_rgba(56,189,248,0.5)]' 
                    : 'bg-zinc-900 border-zinc-700'
                }`}>
                  {release.isLatest && <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />}
                </div>

                {/* Release Card Container */}
                <div className={`bg-zinc-900/90 rounded-2xl border transition-all duration-300 overflow-hidden ${
                  release.isLatest 
                    ? 'border-sky-500/40 shadow-xl shadow-sky-950/20' 
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}>
                  {/* Card Header Header */}
                  <div 
                    onClick={() => toggleExpand(release.version)}
                    className="p-5 sm:p-6 cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xl font-bold font-mono text-zinc-100 flex items-center gap-2">
                          <GitCommit className="w-5 h-5 text-sky-400" />
                          {release.version}
                        </span>

                        {release.buildCode && (
                          <span className="text-xs font-mono text-zinc-400 bg-zinc-800/90 border border-zinc-700 px-2.5 py-0.5 rounded-full">
                            {release.buildCode}
                          </span>
                        )}

                        {release.badge && (
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                            release.isLatest 
                              ? 'bg-sky-500/10 border-sky-500/30 text-sky-300' 
                              : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                          }`}>
                            {release.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-zinc-300 text-sm leading-relaxed pt-1">
                        {release.summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60">
                      <div className="flex items-center text-xs text-zinc-400 gap-1.5 bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-zinc-800">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        {release.releaseDate}
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detailed Breakdown */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800/80 p-5 sm:p-6 bg-zinc-950/50 space-y-4 animate-fade-in">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <ListFilter className="w-3.5 h-3.5" />
                        Chi tiết các thay đổi ({release.changes.length} mục)
                      </div>

                      <div className="space-y-3.5">
                        {release.changes.map((change, idx) => {
                          const cfg = TYPE_CONFIG[change.type];

                          return (
                            <div 
                              key={idx} 
                              className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800/90 space-y-2 hover:border-zinc-700 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="text-sm font-semibold text-zinc-200 flex items-start gap-2 leading-tight">
                                  <span className="text-sky-400 mt-0.5">•</span>
                                  {change.title}
                                </h4>

                                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 flex-shrink-0 ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                                  {cfg.icon}
                                  {cfg.label}
                                </span>
                              </div>

                              <p className="text-xs text-zinc-400 leading-relaxed pl-3 border-l-2 border-zinc-800">
                                {change.description}
                              </p>

                              {change.details && change.details.length > 0 && (
                                <ul className="pl-6 space-y-1 text-xs text-zinc-400 pt-1 list-disc marker:text-zinc-600">
                                  {change.details.map((detail, dIdx) => (
                                    <li key={dIdx}>{detail}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info Box */}
      <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-4 text-center text-xs text-zinc-400 space-y-1">
        <p className="font-medium text-zinc-300">Hệ thống luôn được tự động cập nhật liên tục các tính năng và bản sửa lỗi mới nhất.</p>
        <p>Nếu bạn gặp sự cố hoặc có đóng góp tính năng, vui lòng gửi phản hồi qua khung chat GlobalChat hoặc liên hệ Admin.</p>
      </div>
    </div>
  );
};

export default ChangelogTab;
