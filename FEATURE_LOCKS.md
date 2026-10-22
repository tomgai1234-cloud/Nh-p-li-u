# FEATURE LOCKS MANIFEST (SỔ TAY KHÓA TÍNH NĂNG)

Tài liệu này định nghĩa danh sách các tệp mã nguồn và tính năng cốt lõi đã được kiểm định ổn định tuyệt đối (100% Safe & Stable). **TUYỆT ĐỐI KHÔNG ĐƯỢC XÓA HOẶC GHI ĐÈ** các logic trong các tệp này trừ khi có sự cho phép trực tiếp từ Quản trị viên (Admin).

---

## 🔒 Danh sách Tệp & Tính năng Khóa

### 1. Nhóm Cào Dữ Liệu & Trích Xuất (Scraping & Extraction)
- **`utils/ecommerceScraper.ts`**
  - *Chức năng:* Trích xuất sản phẩm đa sàn (Shopee, WebTars, Titleist, Panasonic, Aristino).
  - *Trạng thái:* Khóa cấu trúc phân tích cú pháp HTML & xử lý proxy.
- **`components/tabs/ProductExtractorTab.tsx` & `ProductPipelineTab.tsx`**
  - *Chức năng:* Luồng trích xuất thuộc tính 1-step, chuẩn hóa dữ liệu chéo chống lệch dòng.
  - *Trạng thái:* Khóa luồng tự động hóa end-to-end.

### 2. Nhóm Xử lý Ảnh & Media (Image & Media Processing)
- **`utils/imageProcessor.ts` & `utils/imageUtils.ts`**
  - *Chức năng:* Xử lý canvas, cắt, xoay, chèn khung hàng loạt, watermark.
  - *Trạng thái:* Khóa thuật toán render hình ảnh chất lượng cao.
- **`components/tabs/BatchFrameTab.tsx` & `ImageEditorTab.tsx`**
  - *Chức năng:* Giao diện chỉnh sửa ảnh và đóng khung hàng loạt.
  - *Trạng thái:* Khóa UI tương tác canvas.

### 3. Nhóm Báo cáo & Dữ liệu Lớn (SKU & Data Reports)
- **`services/skuReportService.ts` & `workers/skuReportWorker.ts`**
  - *Chức năng:* Tính toán báo cáo SKU, kiểm tra trùng lặp qua Web Worker không đơ UI.
  - *Trạng thái:* Khóa hiệu năng xử lý dữ liệu lớn.
- **`services/htmlReportService.ts` & `services/pptReportService.ts`**
  - *Chức năng:* Xuất báo cáo HTML/PowerPoint/Excel.
  - *Trạng thái:* Khóa định dạng xuất file.

### 4. Nhóm Tích hợp AI & Hệ thống (AI & System)
- **`services/geminiService.ts`**
  - *Chức năng:* Tích hợp `@google/genai` SDK cho sinh mô tả, chatbot, dịch thuật.
  - *Trạng thái:* Khóa client Gemini API.
- **`src/firebase.ts` & `components/tabs/UserManagementTab.tsx`**
  - *Chức năng:* Xác thực Firebase Auth và phân quyền người dùng (RBAC).
  - *Trạng thái:* Khóa bảo mật hệ thống.

---

## ⚙️ Quy tắc Cập nhật (Update Guidelines)
1. Khi phát triển tính năng mới, hãy tạo component/service riêng biệt (ví dụ trong thư mục mới hoặc file mới).
2. Không chỉnh sửa trực tiếp các hàm xử lý cốt lõi trong danh sách trên trừ khi sửa lỗi (bugfix) được yêu cầu.
3. Luôn chạy `compile_applet` sau mỗi lần thay đổi để xác thực không phá vỡ tính tương thích.
