const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const target = `        if (isQuotaError(error)) {
            return new Error(\`Lỗi Hạn ngạch (Quota): Hệ thống đang quá tải. Đã tự động thử lại nhưng không thành công. Vui lòng thử lại sau ít phút.\`);
        }`;

const replacement = `        if (isQuotaError(error)) {
            if (message.includes('bỏ qua nhanh')) {
                return error; // Return the fast-fail error exactly as is
            }
            return new Error(\`Lỗi Hạn ngạch (Quota): Hệ thống đang quá tải. Đã tự động thử lại nhưng không thành công. Vui lòng thử lại sau ít phút.\`);
        }`;

code = code.replace(target, replacement);
fs.writeFileSync('services/geminiService.ts', code);
