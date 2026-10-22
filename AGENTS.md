# Quy tắc Phát triển
- **Bảo toàn tính năng:** Tuyệt đối KHÔNG BAO GIỜ được xóa hoặc ghi đè các tính năng hiện có đang hoạt động khi phát triển tính năng mới, ngoại trừ trường hợp người dùng đặc biệt yêu cầu xóa.
- **Triết lý "Ponytail" (Lười biếng như một Senior Dev):** Viết ít code nhất có thể. Code tốt nhất là code không bao giờ được viết ra. Tránh over-engineering (viết quá nhiều code phức tạp không cần thiết). Chỉ tập trung vào việc giải quyết đúng vấn đề với số dòng code tối thiểu nhưng vẫn đảm bảo hiệu quả và an toàn (100% safe).

# Quy tắc Đặc thù của Ứng dụng "Hỗ trợ nhập liệu"
- **Tính chính xác tuyệt đối:** Khi trích xuất dữ liệu, tuyệt đối không bịa thông tin. Trả về "N/A" nếu dữ liệu bị thiếu hoặc không thể đọc được.
- **Chuẩn hóa & Kiểm tra chéo (Cross-check):** Tuân thủ nghiêm ngặt định dạng đầu ra (ngày tháng, số tiền...). Luôn tự động kiểm tra chéo dữ liệu trước khi xuất kết quả để đảm bảo không lệch dòng/cột hay trùng lặp.
- **Tối ưu Xử lý Hàng loạt (Bulk Processing):** Các tác vụ xử lý hàng loạt (ảnh, web, SEO) phải chia lô (batching), chạy bất đồng bộ để tránh đơ giao diện, đồng thời có thông báo trạng thái hoặc thanh tiến trình rõ ràng.
- **Giao tiếp Dữ liệu An toàn:** Tương tác với Firestore phải luôn kiểm tra `auth.currentUser` và xử lý tốt các lỗi về phân quyền.
- **Tính ngắn gọn:** Báo cáo, tóm tắt kết quả trực tiếp bằng dạng Bảng hoặc JSON, loại bỏ các diễn giải dài dòng, không cần thiết.