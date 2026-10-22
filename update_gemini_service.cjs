const fs = require('fs');

let fileContent = fs.readFileSync('services/geminiService.ts', 'utf8');

// Replace the previous extractSpecsFromDescription
const extractCodeToReplace = `export async function extractSpecsFromDescription(description: string, model: string = 'gemini-3-flash-preview'): Promise<{name: string, value: string}[]> {
    const prompt = \`
Bạn là một chuyên gia bóc tách dữ liệu kỹ thuật.
Hãy đọc đoạn mô tả sản phẩm sau và trích xuất TẤT CẢ các thông số kỹ thuật (ví dụ: kích thước, chất liệu, khối lượng, công suất, công nghệ đặc trưng, tính năng nổi bật...) thành một danh sách JSON mảng các đối tượng chứa "name" và "value".

Mô tả:
\${description}

TRẢ VỀ JSON array có cấu trúc:
[
  { "name": "Tên thông số (ví dụ: Kích thước, Trọng lượng)", "value": "Giá trị" }
]
CHỈ trả về JSON.
\`;
    try {
        const response = await generateWithRetry(model, { 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text || "[]";
        let specs = [];
        try {
            specs = JSON.parse(text);
            if (!Array.isArray(specs)) specs = [];
        } catch (e) {
            console.error("JSON parse failed for specs", e);
        }
        return specs;
    } catch (error) {
        console.error("Error extracting specs:", error);
        return [];
    }
}`;

const extractCodeReplacement = `export async function extractReviewComponents(description: string, model: string = 'gemini-3-flash-preview'): Promise<{specs: {name: string, value: string}[], sections: string[]}> {
    const prompt = \`
Bạn là một chuyên gia phân tích cấu trúc bài viết và bóc tách dữ liệu kỹ thuật.
Hãy đọc đoạn HTML mô tả sản phẩm sau:

\${description}

Nhiệm vụ của bạn:
1. Trích xuất TẤT CẢ các thông số kỹ thuật rõ ràng (ví dụ: kích thước, chất liệu, khối lượng, công suất...) thành mảng "specs" gồm các object { "name": "...", "value": "..." }.
2. Trích xuất TẤT CẢ các TIÊU ĐỀ PHẦN NỘI DUNG (Sections) có trong bài (thường nằm trong thẻ <h3>, <strong>, <h2>... như: Giới thiệu, Thông tin sản phẩm, Tính năng nổi bật, Hướng dẫn sử dụng...) thành mảng chuỗi "sections".

TRẢ VỀ JSON có cấu trúc sau:
{
  "specs": [ { "name": "Tên thông số", "value": "Giá trị" } ],
  "sections": [ "Tên phần 1", "Tên phần 2" ]
}
CHỈ trả về JSON.
\`;
    try {
        const response = await generateWithRetry(model, { 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text || "{}";
        let result = { specs: [], sections: [] };
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.specs)) result.specs = parsed.specs;
            if (Array.isArray(parsed.sections)) result.sections = parsed.sections;
        } catch (e) {
            console.error("JSON parse failed for review components", e);
        }
        return result;
    } catch (error) {
        console.error("Error extracting components:", error);
        return { specs: [], sections: [] };
    }
}`;

fileContent = fileContent.replace(extractCodeToReplace, extractCodeReplacement);


const rewriteCodeToReplace = `export async function rewriteDescriptionWithSpecs(
    originalDescription: string, 
    specsToKeep: {name: string, value: string}[], 
    specsToRemove: {name: string, value: string}[],
    model: string = 'gemini-3-flash-preview'
): Promise<string> {
    const prompt = \`
Bạn là một AI Copywriter chuyên nghiệp.
Dưới đây là một đoạn mô tả sản phẩm:
---
\${originalDescription}
---

Nhiệm vụ của bạn:
1. LOẠI BỎ hoàn toàn các thông tin liên quan đến các thông số sau (không được nhắc đến chúng nữa):
\${specsToRemove.map(s => \`- \${s.name}: \${s.value}\`).join('\\n')}

2. GIỮ LẠI và CẬP NHẬT (hoặc thêm vào nếu thiếu) các thông số sau (chắc chắn rằng chúng có mặt trong mô tả một cách tự nhiên hoặc trong danh sách thông số):
\${specsToKeep.map(s => \`- \${s.name}: \${s.value}\`).join('\\n')}

YÊU CẦU BẮT BUỘC:
- GIỮ NGUYÊN cấu trúc HTML (các thẻ <h3>, <strong>, <ul>, <li>...), giọng văn, độ dài và các nội dung đã chuẩn hóa khác của bài viết gốc. CHỈ thay đổi nội dung liên quan đến các thông số kỹ thuật trên.
- Trả về nguyên đoạn HTML. Không sử dụng markdown bọc code (\`\`\`html).
\`;
    try {
        const response = await generateWithRetry(model, { contents: prompt });
        let newDescription = response.text || originalDescription;
        newDescription = newDescription.replace(/^\`\`\`html\\s*/i, '').replace(/\\s*\`\`\`$/i, '').trim();
        return newDescription;
    } catch (error) {
        console.error("Error rewriting description:", error);
        return originalDescription;
    }
}`;

const rewriteCodeReplacement = `export async function rewriteDescriptionWithSpecs(
    originalDescription: string, 
    specsToKeep: {name: string, value: string}[], 
    specsToRemove: {name: string, value: string}[],
    sectionsToRemove: string[] = [],
    model: string = 'gemini-3-flash-preview'
): Promise<string> {
    const prompt = \`
Bạn là một AI Copywriter chuyên nghiệp.
Dưới đây là một đoạn mô tả sản phẩm HTML:
---
\${originalDescription}
---

Nhiệm vụ của bạn:
1. LOẠI BỎ hoàn toàn các thông tin liên quan đến các thông số kỹ thuật sau:
\${specsToRemove.map(s => \`- \${s.name}: \${s.value}\`).join('\\n')}

2. LOẠI BỎ HOÀN TOÀN CÁC PHẦN NỘI DUNG (Sections) SAU (xóa cả tiêu đề phần đó và nội dung bên dưới nó):
\${sectionsToRemove.map(s => \`- \${s}\`).join('\\n')}

3. ĐẢM BẢO giữ lại các thông số kỹ thuật sau:
\${specsToKeep.map(s => \`- \${s.name}: \${s.value}\`).join('\\n')}

YÊU CẦU BẮT BUỘC:
- GIỮ NGUYÊN cấu trúc HTML của các phần còn lại (các thẻ <h3>, <strong>, <ul>, <li>...), giọng văn và độ dài. 
- Không tự ý thêm nội dung mới nếu không được yêu cầu.
- Nếu bạn xóa một phần nội dung (như "Tính năng nổi bật"), hãy đảm bảo xóa sạch cả tiêu đề và các gạch đầu dòng thuộc phần đó.
- Trả về nguyên đoạn HTML. Không sử dụng markdown bọc code (\`\`\`html).
\`;
    try {
        const response = await generateWithRetry(model, { contents: prompt });
        let newDescription = response.text || originalDescription;
        newDescription = newDescription.replace(/^\`\`\`(?:html)?\\s*/i, '').replace(/\\s*\`\`\`$/i, '').trim();
        return newDescription;
    } catch (error) {
        console.error("Error rewriting description:", error);
        return originalDescription;
    }
}`;

fileContent = fileContent.replace(rewriteCodeToReplace, rewriteCodeReplacement);
fs.writeFileSync('services/geminiService.ts', fileContent);
