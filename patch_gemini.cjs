const fs = require('fs');
let code = fs.readFileSync('services/geminiService.ts', 'utf8');

const target = `                if (isQuotaError(error)) {
                    const keys = getApiKeys();
                    if (keys.length > 1) {
                        getAI(true); // Switch key
                        await delay(500);
                        continue;
                    }
                }`;

const replacement = `                if (isQuotaError(error)) {
                    const keys = getApiKeys();
                    if (keys.length > 1 && i < keys.length) {
                        getAI(true); // Switch key
                        await delay(300);
                        continue;
                    } else {
                        throw new Error("Lỗi Hạn ngạch (Quota): Hệ thống đang quá tải. Đã bỏ qua nhanh để tránh chờ lâu. Vui lòng kiểm tra API Key.");
                    }
                }`;

code = code.replace(target, replacement);
fs.writeFileSync('services/geminiService.ts', code);
