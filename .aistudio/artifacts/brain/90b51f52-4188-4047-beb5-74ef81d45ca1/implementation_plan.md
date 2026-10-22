# Implementation Plan - Feature Audit Report & Protection Strategy

## Overview
This implementation plan provides a comprehensive architectural report of all current features, modules, underlying source code, and integration logic in the application. Furthermore, it defines a multi-layered locking and preservation strategy to ensure future updates never overwrite or disrupt core stable features.

---

## Part 1: Comprehensive System Audit & Feature Architecture Report

### Group 1: Tổng quan (Overview)
1. **Dashboard (`DashboardTab.tsx` / `services/`)**
   - **Chức năng:** Tổng hợp số liệu nhập liệu, thống kê sản phẩm, trạng thái hoạt động hệ thống, lịch sử gần đây.
   - **Code & Logic:** Kết hợp React state, IndexedDB (`services/idbService.ts`), và Firebase Firestore (`src/firebase.ts`) để hiển thị thống kê thời gian thực.
2. **Thư viện App (Gallery) (`AppGalleryTab.tsx`)**
   - **Chức năng:** Trưng bày các tiện ích con, công cụ hỗ trợ và lối tắt truy cập nhanh.
   - **Code & Logic:** Component tĩnh kết hợp điều hướng state nội bộ của ứng dụng (`activeTab`).

### Group 2: Quản lý Sản phẩm (Product Management)
3. **Luồng 1-Step (Pipeline) (`ProductPipelineTab.tsx`)**
   - **Chức năng:** Quy trình tự động hóa khép kín: cào dữ liệu URL sản phẩm -> trích xuất thuộc tính -> chuẩn hóa tên -> sinh mô tả & tối ưu HTML -> tải ảnh hàng loạt.
   - **Code & Logic:** Kết hợp `utils/ecommerceScraper.ts`, `services/geminiService.ts`, và IndexedDB cache (`utils/pipelineCache.ts`).
4. **Tạo Mô tả (`DescriptionGeneratorTab.tsx`)**
   - **Chức năng:** Tạo nội dung mô tả sản phẩm thông minh bằng AI (Gemini API) dựa trên tên và thông số đầu vào.
   - **Code & Logic:** Sử dụng `@google/genai` thông qua `services/geminiService.ts` với prompt engineering chuyên biệt cho e-commerce.
5. **Tối ưu & Chuẩn hóa HTML (`GoogleDocsToHtmlTab.tsx`)**
   - **Chức năng:** Làm sạch, định dạng lại và tối ưu mã HTML mô tả sản phẩm (dọn dẹp tag rác, chuẩn hóa style).
   - **Code & Logic:** Xử lý chuỗi DOMpurify/Regex kết hợp với `utils/htmlOptimizer.ts`.
6. **Lấy thuộc tính (`ProductExtractorTab.tsx`)**
   - **Chức năng:** Trích xuất thông số kỹ thuật, giá cả, màu sắc, size từ văn bản hoặc trang web sản phẩm.
   - **Code & Logic:** Trình phân tích cú pháp HTML/JSON với kiểm tra chéo dữ liệu đảm bảo không lệch dòng/cột.
7. **Chuẩn hóa Tên (`ProductNameStandardizerTab.tsx`)**
   - **Chức năng:** Tự động chuẩn hóa tên sản phẩm, viết hoa, định dạng SKU, bỏ dấu tiếng Việt hoặc chuẩn hóa theo rule thương hiệu.
   - **Code & Logic:** Thuật toán xử lý chuỗi JavaScript kết hợp danh sách từ khóa chuẩn hóa.

### Group 3: Chỉnh sửa Media (Media Editing)
8. **Chỉnh sửa Ảnh (`ImageEditorTab.tsx`, `components/image-editor/*`)**
   - **Chức năng:** Công cụ chỉnh sửa ảnh chuyên nghiệp: cắt, xoay, điều chỉnh màu sắc, thêm khung, chèn watermark, upscale bằng AI.
   - **Code & Logic:** Canvas API / HTML5 Image processing (`utils/imageProcessor.ts`, `utils/imageUtils.ts`, `utils/cloudinaryUploader.ts`).
9. **Chỉnh sửa Video (`VideoEditorTab.tsx`)**
   - **Chức năng:** Cắt ghép và xử lý video cơ bản cho sản phẩm.
   - **Code & Logic:** HTML5 Video element manipulation & state management.
10. **Tạo Khung Hàng Loạt (`BatchFrameTab.tsx`)**
    - **Chức năng:** Đóng khung hàng loạt ảnh sản phẩm theo template thiết kế sẵn (thêm logo, khung khuyến mại).
    - **Code & Logic:** Xử lý canvas bất đồng bộ (batch processing) với Web Worker (`workers/dataProcessorWorker.ts`).

### Group 4: Công cụ Dữ liệu (Data Tools)
11. **Báo cáo Nhập liệu (SKU) (`SkuReportTab.tsx`, `services/skuReportService.ts`, `workers/skuReportWorker.ts`)**
    - **Chức năng:** Thống kê chi tiết SKU, kiểm tra trùng lặp, xuất báo cáo Excel/PDF.
    - **Code & Logic:** Web Worker (`skuReportWorker.ts`) tính toán dữ liệu lớn không làm đơ UI, kết hợp `htmlReportService.ts` & `pptReportService.ts`.
12. **Cào Dữ Liệu (`ScraperHubTab.tsx`, `ShopeeScraperTab.tsx`, `WebTarsScraperTab.tsx`, `RawImageScraperTab.tsx`, `ImageScraperTab.tsx`)**
    - **Chức năng:** Thu thập dữ liệu và hình ảnh từ các sàn thương mại điện tử (Shopee, WebTars, Titleist, Panasonic, Aristino...) và cào ảnh thô.
    - **Code & Logic:** Server-side proxy (`server.ts`), Cheerio/Puppeteer parsing patterns, và axios fetching.
13. **Tải Ảnh Hàng Loạt (`BulkDownloadTab.tsx`, `BulkDriveUpload.tsx`, `BulkShopifyUpload.tsx`)**
    - **Chức năng:** Tải xuống hàng loạt, đẩy lên Google Drive hoặc đẩy thẳng lên Shopify store.
    - **Code & Logic:** JSZip, Google Workspace API integration (`utils/googleSheets.ts`), Shopify Admin API proxy.
14. **Tự động Chuẩn hóa (`FileConverterV2Tab.tsx`, `ExcelRemoveAccents.tsx`)**
    - **Chức năng:** Chuyển đổi định dạng tệp, loại bỏ dấu tiếng Việt hàng loạt cho file Excel/CSV.
    - **Code & Logic:** SheetJS (xlsx) parsing & client-side file transformation.

### Group 5: Hệ thống & Hỗ trợ (System & Support)
15. **Chatbot (`ChatbotTab.tsx`, `components/GlobalChat.tsx`)**
    - **Chức năng:** Trợ lý AI hỗ trợ tra cứu quy trình và giải đáp thắc mắc nhập liệu.
    - **Code & Logic:** Gemini API streaming chat (`services/geminiService.ts`).
16. **Quản lý API Key (`ApiKeysTab.tsx`, `services/apiKeyUsageTracker.ts`)**
    - **Chức năng:** Quản lý và theo dõi hạn mức sử dụng API Key.
    - **Code & Logic:** LocalStorage encryption & usage tracking service.
17. **Tải App (`DownloadAppTab.tsx`, `electron/`)**
    - **Chức năng:** Tải phiên bản ứng dụng Desktop (Electron).
    - **Code & Logic:** Electron packaging configuration.
18. **Lịch sử Cập nhật (`ChangelogTab.tsx`) & Hướng dẫn (`GuideTab.tsx`)**
    - **Chức năng:** Xem nhật ký phiên bản và tài liệu hướng dẫn sử dụng.
    - **Code & Logic:** Markdown rendering / static UI components.
19. **Quản lý Người dùng (`UserManagementTab.tsx`, `src/firebase.ts`)**
    - **Chức năng:** Phân quyền người dùng (Admin, User, Blocked), kiểm soát quyền truy cập các tab.
    - **Code & Logic:** Firebase Authentication & Firestore security rules.

---

## Part 2: Comprehensive Feature Locking & Protection Strategy

Để đảm bảo các tính năng tốt hiện tại không bao giờ bị đè hoặc lỗi trong các lần update tiếp theo, chúng ta áp dụng chiến lược 4 lớp (4-Layer Protection Strategy):

1. **Layer 1: Documentation & Lock Manifest (`FEATURE_LOCKS.md`)**
   - Thiết lập tài liệu khóa rõ ràng liệt kê các tệp thành phần cốt lõi tuyệt đối không được sửa đổi cấu trúc logic trừ khi có yêu cầu đặc biệt từ Quản trị viên.
2. **Layer 2: Source Code Guards & JSDoc Annotations**
   - Đánh dấu các tệp quan trọng với chú thích `@preserve` và `@locked` trong JSDoc đầu file.
3. **Layer 3: Automated Build & Lint Verification**
   - Sử dụng `compile_applet` và `lint_applet` tự động sau mỗi lần thay đổi code để phát hiện sớm lỗi biên dịch hoặc import thiếu.
4. **Layer 4: Modular Isolation**
   - Giữ nguyên cấu trúc các tab độc lập (`components/tabs/*`) và các service (`services/*`), tách biệt hoàn toàn tính năng mới khỏi các luồng cào dữ liệu, xử lý ảnh và báo cáo SKU đã ổn định.
