
import React from 'react';
import { Sparkles } from 'lucide-react';
import { FileText, Image as ImageIcon, ScanLine, ImageDown, MessageSquare, FileInput, Tag, Video, DownloadCloud, Monitor, LayoutTemplate } from 'lucide-react';

const GuideTab: React.FC = () => {

  const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-zinc-800/50 p-6 sm:p-8 rounded-2xl border border-zinc-700">
      <h2 className="text-2xl font-bold text-sky-300 flex items-center gap-3 mb-4">
        {icon}
        {title}
      </h2>
      <div className="prose prose-invert prose-zinc max-w-none text-zinc-300 space-y-4">
        {children}
      </div>
    </div>
  );
  
  const DeveloperPromptSection: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <details className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-700">
        <summary className="text-lg font-semibold text-sky-400 cursor-pointer hover:text-sky-300 transition-colors">
            {title}
        </summary>
        <div className="prose prose-invert prose-zinc max-w-none text-zinc-300 mt-4 pt-4 border-t border-zinc-700">
            <pre className="whitespace-pre-wrap font-sans text-sm bg-zinc-800 p-4 rounded-md border border-zinc-600">
                {children}
            </pre>
        </div>
    </details>
  )

  return (
    <div className="animate-fade-in space-y-8 max-w-4xl mx-auto">
      <div className="text-center">
        <Sparkles className="w-12 h-12 text-sky-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-zinc-100">Hướng dẫn Sử dụng</h1>
        <p className="text-zinc-400 mt-2">
          Khám phá cách tận dụng tối đa bộ công cụ AI đa năng phiên bản mới nhất.
        </p>
      </div>

      {/* 1. Description Generator */}
      <Section title="Tạo Mô tả Sản phẩm" icon={<FileText className="w-6 h-6" />}>
        <p>
          Công cụ giúp tạo mô tả sản phẩm chuẩn SEO dựa trên thông tin từ internet và các nguyên tắc tùy chỉnh.
        </p>
        <h3 className="text-xl font-semibold text-zinc-200">Các bước thực hiện:</h3>
        <ul>
          <li><strong>Bước 1: Nhập Tên Sản phẩm:</strong> Nhập một hoặc nhiều tên sản phẩm (mỗi dòng một tên).</li>
          <li><strong>Bước 2: Cấu hình:</strong>
            <ul>
                <li><strong>Chế độ Tiêu chuẩn:</strong> Nhập quy chuẩn chi tiết (cấu trúc, từ khóa, giọng văn). Có thể lưu/tải mẫu có sẵn.</li>
                <li><strong>Chế độ Đồng bộ:</strong> Dùng cho danh sách lớn cần mô tả ngắn gọn, thống nhất (VD: "Viết 1 đoạn 50 từ về tính năng").</li>
            </ul>
          </li>
          <li><strong>Bước 3: Tạo và Xuất:</strong> Nhấn "Tạo Mô tả". Kết quả có thể sao chép (HTML/Text) hoặc xuất ra Excel/CSV hàng loạt.</li>
        </ul>
      </Section>
      
      {/* 2. Product Extractor */}
       <Section title="Lấy thuộc tính sản phẩm" icon={<ScanLine className="w-6 h-6" />}>
        <p>
          Tự động tìm kiếm và trích xuất thông số kỹ thuật (Thương hiệu, Công suất, Kích thước...) từ tên hoặc link sản phẩm.
        </p>
        <h3 className="text-xl font-semibold text-zinc-200">Cách sử dụng:</h3>
        <ul>
          <li><strong>Bước 1: Cấu hình Thuộc tính:</strong> Nhấn "Chọn / Chỉnh sửa" để định nghĩa các trường thông tin cần lấy (VD: Màu sắc, Chất liệu).</li>
          <li><strong>Bước 2: Nhập liệu:</strong> Dán danh sách tên sản phẩm hoặc đường dẫn URL.</li>
          <li><strong>Bước 3: Trích xuất:</strong> AI sẽ quét thông tin và điền vào bảng. Bạn có thể xuất kết quả ra Excel để nhập liệu lên sàn.</li>
        </ul>
      </Section>

      {/* 3. Product Name Standardizer */}
      <Section title="Chuẩn hóa Tên Sản phẩm" icon={<Tag className="w-6 h-6" />}>
        <p>
          Công cụ giúp làm sạch và viết lại tên sản phẩm theo quy chuẩn sàn TMĐT (Shopee, Lazada, TikTok), loại bỏ từ ngữ spam và tối ưu hiển thị.
        </p>
        <ul>
            <li><strong>Nhập liệu:</strong> Dán danh sách tên sản phẩm lộn xộn.</li>
            <li><strong>Công cụ nhanh:</strong> Sử dụng các nút tiện ích để chuyển đổi nhanh: Chữ hoa/thường, Viết Hoa Đầu Từ, hoặc Loại bỏ dấu tiếng Việt (để tạo mã SKU).</li>
            <li><strong>Chuẩn hóa AI:</strong> Nhấn nút "Chuẩn hóa" để AI viết lại tên theo cấu trúc: <code>[Loại] [Thương hiệu] [Model] [Thông số]</code>.</li>
        </ul>
      </Section>

      {/* 4. Image Editor */}
      <Section title="Chỉnh sửa Ảnh & AI Magic" icon={<ImageIcon className="w-6 h-6" />}>
        <p>
          Bộ công cụ chỉnh sửa ảnh toàn diện tích hợp AI thế hệ mới (Gemini 2.5 Flash Image).
        </p>
        <h3 className="text-xl font-semibold text-zinc-200">Tính năng AI Magic:</h3>
        <ul>
            <li><strong>Chỉ thị (Instruction):</strong> Nhập lệnh văn bản để sửa ảnh (VD: "Đổi màu áo sang đỏ", "Thêm hiệu ứng tuyết rơi", "Sửa lỗi chính tả trên ảnh").</li>
            <li><strong>Studio Phông nền:</strong> Tự động tách nền và ghép sản phẩm vào các bối cảnh chuyên nghiệp (Studio trắng, Bàn gỗ, Đá Marble...) chỉ với 1 cú click.</li>
            <li><strong>Xóa vật (Cleanup):</strong> Xóa người, vật thể thừa hoặc watermark khỏi ảnh một cách tự nhiên.</li>
        </ul>
        <h3 className="text-xl font-semibold text-zinc-200">Công cụ cơ bản:</h3>
        <ul>
          <li><strong>So sánh (Compare):</strong> Nhấn giữ nút <strong>"Giữ để xem gốc"</strong> trên ảnh để xem sự thay đổi trước và sau khi sửa.</li>
          <li><strong>Cắt & Xoay:</strong> Cắt theo tỷ lệ chuẩn (1:1, 4:3, 16:9).</li>
          <li><strong>Resize & Upscale:</strong> Thay đổi kích thước hoặc dùng AI để tăng độ nét cho ảnh mờ (2x, 4x).</li>
          <li><strong>Khung & Watermark:</strong> Chèn khung trang trí, logo, hoặc ghép ảnh dạng quà tặng/combo.</li>
        </ul>
      </Section>

      {/* 5. Batch Frame (NEW) */}
      <Section title="Tạo Khung Hàng Loạt" icon={<LayoutTemplate className="w-6 h-6" />}>
        <p>
          Tự động ghép khung, thông tin sản phẩm và quà tặng vào hàng loạt ảnh dựa trên dữ liệu Excel.
        </p>
        <ul>
            <li><strong>Bước 1:</strong> Upload file Excel chứa thông tin (SKU, Tên, Đặc điểm, Quà tặng...).</li>
            <li><strong>Bước 2:</strong> Upload hoặc kéo thả hàng loạt ảnh sản phẩm (Tên ảnh phải khớp với SKU hoặc Tên trong Excel).</li>
            <li><strong>Bước 3:</strong> Nhấn "Chỉnh sửa Bố cục" để kéo thả vị trí chữ, khung, màu sắc trực quan.</li>
            <li><strong>Bước 4:</strong> Xuất toàn bộ ảnh đã ghép khung dưới dạng file ZIP.</li>
        </ul>
      </Section>

      {/* 6. Video Editor */}
      <Section title="Chỉnh sửa Video" icon={<Video className="w-6 h-6" />}>
        <p>
          Biên tập video nhanh chóng ngay trên trình duyệt.
        </p>
        <ul>
            <li><strong>Cắt (Trim):</strong> Chọn đoạn video cần giữ lại.</li>
            <li><strong>Cắt khung hình (Crop):</strong> Chuyển đổi video ngang sang dọc (9:16) hoặc vuông (1:1) cho mạng xã hội.</li>
            <li><strong>Resize thông minh:</strong> Thay đổi kích thước video với các chế độ lấp đầy nền mờ (Blur background) chuyên nghiệp.</li>
            <li><strong>Âm thanh & Tốc độ:</strong> Tăng giảm tốc độ video, tắt âm thanh gốc hoặc chèn nhạc nền mới.</li>
        </ul>
      </Section>

      {/* 7. Image Scraper */}
      <Section title="Đào Ảnh (Shopee Save)" icon={<ImageDown className="w-6 h-6" />}>
        <p>
          Tải xuống toàn bộ hình ảnh và video chất lượng gốc từ các trang thương mại điện tử (Shopee, Tiki, Lazada...).
        </p>
        <ul>
          <li>Dán link sản phẩm (hỗ trợ nhiều link cùng lúc).</li>
          <li>Hệ thống sẽ quét và hiển thị: Ảnh chính, Ảnh phân loại, Ảnh mô tả và Video.</li>
          <li>Nhấn "Tải tất cả" để lưu về máy (có tùy chọn tự động nén ZIP và đặt tên thư mục).</li>
        </ul>
      </Section>

      {/* 8. Bulk Download */}
      <Section title="Tải Ảnh Hàng Loạt" icon={<DownloadCloud className="w-6 h-6" />}>
        <p>
          Công cụ xử lý file Excel chứa link ảnh với cơ chế quét thông minh.
        </p>
        <ul>
            <li><strong>Chế độ Tải về máy:</strong> 
                <br/>- Upload file Excel bất kỳ. Hệ thống sẽ quét từng hàng ngang.
                <br/>- Cứ tìm thấy một ô chứa Link ảnh (http/https), nó sẽ lấy ô ngay bên trái làm Tên file.
                <br/>- Tự động tải và nén ZIP.
            </li>
            <li><strong>Chế độ Excel {'->'} Cloudinary:</strong> 
                <br/>- Upload ảnh từ máy tính hoặc đọc link từ Excel.
                <br/>- Upload lên Cloudinary để lấy link ảnh trực tuyến.
                <br/>- <strong>Mới:</strong> Tự động thêm hậu tố ngẫu nhiên vào tên file nếu bị trùng (unique_filename), tránh tình trạng ảnh bị ghi đè (link lệch).
            </li>
        </ul>
      </Section>
      
      {/* 9. Chatbot */}
      <Section title="Chatbot Trợ lý" icon={<MessageSquare className="w-6 h-6" />}>
        <p>
          Trợ lý ảo thông minh giải đáp mọi thắc mắc, viết nội dung marketing, lên ý tưởng bài viết hoặc hỗ trợ kỹ thuật.
        </p>
      </Section>
      
      {/* 10. File Converter */}
      <Section title="Chuyển đổi File" icon={<FileInput className="w-6 h-6" />}>
        <p>
            Tự động điền dữ liệu (VLOOKUP) giữa 2 file Excel.
        </p>
        <ul>
            <li>Upload "File Dữ liệu" (chứa thông tin nguồn) và "File Đích" (mẫu cần điền).</li>
            <li>Chọn "Cột Khóa" (VD: Mã SKU) để đối chiếu.</li>
            <li>Thiết lập quy tắc: Lấy cột A từ file nguồn điền vào cột B của file đích.</li>
            <li>Nhấn chuyển đổi và tải file kết quả.</li>
        </ul>
      </Section>

      {/* 11. Install App */}
      <Section title="Cài đặt Ứng dụng (PC)" icon={<Monitor className="w-6 h-6" />}>
        <p>
          Biến website này thành phần mềm trên máy tính (PWA) để hoạt động mượt mà hơn.
        </p>
        <ul>
            <li>Vào tab <strong>"Tải App"</strong> và nhấn <strong>"Cài đặt ngay"</strong>.</li>
            <li>Hoặc trên trình duyệt Chrome/Edge: Nhấn vào biểu tượng <strong>"Cài đặt ứng dụng"</strong> (hình màn hình có mũi tên xuống) ở thanh địa chỉ.</li>
            <li>Lợi ích: Có icon trên Desktop, chạy cửa sổ riêng biệt, hỗ trợ phím tắt và ổn định hơn.</li>
        </ul>
      </Section>
      
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center text-zinc-300 pt-8">Dành cho nhà phát triển (Developer Prompts)</h2>
        <DeveloperPromptSection title="Feature: Product Description Generator">
{`## Feature: Product Description Generator

### Core Functionality
Create an AI-powered tool to generate product descriptions. The tool should operate in two modes: a detailed "Standard Mode" for complex guidelines and a "Sync Mode" for applying a simple, consistent prompt across multiple products. It must handle single and batch product processing, manage user-created templates, and maintain a history of generated results.

### UI/UX Design
- **Layout:** A two-column layout. The left column contains the input form and history panel. The right column displays the generated results and export options.
- **Input Form:**
    - A multi-line textarea for "Product Names," where each product is on a new line.
    - A toggle switch for "Sync Mode."
    - **Standard Mode (Sync Mode OFF):**
        - A large textarea for "Guidelines & Standards."
        - A "Load Example" dropdown with predefined templates (e.g., Tech, Fashion, Food).
        - A "Save" icon button to save the current guidelines as a new template.
        - A "Manage" icon button to open a modal for viewing/deleting saved templates.
    - **Sync Mode (Sync Mode ON):**
        - The guidelines textarea is replaced with a smaller textarea for a "Simple Prompt."
    - **Action Button:** A primary "Generate Description" button that shows a loading spinner and progress text during generation.
- **Results View:**
    - Displays results as they are generated. Each result is a card containing:
        - Product Name.
        - Tabs for "HTML" and "Text" views of the description.
        - "Copy" and "Download" icon buttons.
        - A collapsible section for "Sources" (web links used by the AI).
    - When results are present, "Export to CSV" and "Export to XLSX" buttons appear below the results list.
- **History Panel:**
    - A list of past generation sessions, showing product names and a timestamp.
    - Each entry has a "Load" button to repopulate the results view and a "Delete" button.
    - A "Clear All" button is available.

### Logic & State Management
- **State:** Manage state for product input, guidelines/simple prompt, loading status, progress text, results array, history array, and custom templates array.
- **Generation Logic:**
    - On submit, split the product input by newlines to get an array of products.
    - If in "Sync Mode," call a batch generation function ('generateBatchSimpleDescriptions') with all products and the simple prompt. Handle batching for very large lists (e.g., 50+ products).
    - If in "Standard Mode":
        - If the number of products is small (e.g., <= 5), process them individually using 'generateProductDescription' to retrieve grounding sources for each.
        - If the list is large, use an efficient batch function ('generateBatchDetailedDescriptions') that doesn't return sources.
    - Update the results view progressively as each product or batch is completed.
- **API Integration:**
    - All API calls must use the 'generateContentWithFallback' service function, which prioritizes 'gemini-2.5-pro', falls back to 'gemini-2.5-flash' on quota errors, and makes a final attempt without web grounding if necessary.
    - The service must parse the AI's JSON response, clean it, and handle potential malformations.
- **Persistence:** Use 'localStorage' to save the history and custom templates, loading them when the component mounts.`}
        </DeveloperPromptSection>
        
        <DeveloperPromptSection title="Feature: AI Product Attribute Extractor">
{`## Feature: AI Product Attribute Extractor

### Core Functionality
Build a tool that automatically extracts structured data (attributes) for a list of products using their name, model, or URL. Users must be able to define custom sets of attributes to extract. The results should be displayed progressively in a detailed table and be exportable.

### UI/UX Design
- **Layout:** A single-view interface. The configuration and input form is at the top. The results table appears directly below it after an extraction is run.
- **Input Form (Two-column layout):**
    - **Left Column (Attribute Configuration):**
        - A display area showing the currently selected attributes or set name.
        - A "Select / Edit" button that opens the Attribute Configuration Modal.
    - **Right Column (Product Input):**
        - A large textarea for pasting product names, models, or URLs (one per line).
        - An inactive "Upload File" button for future implementation.
- **Action Button:** A prominent "Extract Data" button centered below the form.
- **Results View (appears after extraction):**
    - A progress bar is displayed during the extraction process.
    - The main component is a data table with the following columns: "Status," "Input" (sticky), "Model Used," and one column for each requested attribute.
    - **Status Column:** Displays a visual badge for "Success," "Error," or a spinner for "Loading."
    - **Export:** Buttons to "Export to Excel" and "Export to CSV" are visible above the table.
    - A "New Extraction" button allows the user to clear the results and start over.
- **Attribute Configuration Modal:**
    - A dropdown to load predefined or user-saved attribute sets.
    - An input field to name the current configuration for saving/updating.
    - "Save" and "Delete" buttons for managing user-created sets.
    - A dynamic list editor to add, remove, and define attributes. Each attribute has:
        - A name (text input).
        - A type selector ("Free Text" or "Fixed Values").
        - If "Fixed Values," a tag-like input for adding predefined options.

### Logic & State Management
- **State:** Manage state for the list of products, the current attribute definitions, the result rows array, loading status, and progress percentage.
- **Extraction Logic:**
    - On submit, parse the product textarea into a list of items.
    - Initialize the results state with an entry for each product, with a 'loading' status.
    - Process the product list sequentially in a loop (NOT in parallel, to avoid rate limiting and to show progress).
    - For each product, call the 'extractProductAttributesForSingleItem' service function.
    - On success, update the corresponding row in the results state with 'success' status, the extracted data, and the model name returned from the service.
    - On failure, update the row with 'error' status and the error message.
    - Update the progress bar after each item is processed.
- **API Integration:**
    - The 'extractProductAttributesForSingleItem' service function constructs a detailed prompt asking the AI to find the product online and return a JSON object with keys matching the requested attributes.
    - This service must also use the 'generateContentWithFallback' logic for resilience against API quota errors.
- **Persistence:** User-created attribute sets should be saved to and loaded from 'localStorage'.`}
        </DeveloperPromptSection>

        <DeveloperPromptSection title="Feature: Image Editor">
{`## Feature: Image Editor

### Core Functionality
Develop a comprehensive, multi-tool image editor. It must support loading multiple images, non-destructive editing via an undo history, single and batch editing modes, and a variety of tools including cropping, resizing, color adjustments, and generative AI edits.

### UI/UX Design
- **Layout:** A multi-pane interface:
    - **Header:** Contains global actions like Undo, Save, and Image Info, along with a breadcrumb trail showing the active image and tool.
    - **Left Sidebar:** A vertical bar with icon buttons for selecting the main tool (e.g., Crop, Resize, AI, Color).
    - **Tool Panel:** A contextual panel that appears next to the Left Sidebar, displaying the specific controls for the currently active tool.
    - **Main Canvas:** A large central area where the active image is displayed for editing.
    - **Right Sidebar:** Displays thumbnails of all uploaded images. It includes controls for adding more images, switching the active image, and managing batch edit selections.
- **Tool Panels:**
    - **Crop & Rotate:** Buttons for 90° rotations, horizontal/vertical flip. A grid of aspect ratio presets (1:1, 16:9, etc.). "Apply" and "Cancel" buttons.
    - **Resize:** Inputs for width and height, a lock icon to toggle aspect ratio constraint, a list of user-configurable size presets, and an "Auto-resize" button.
    - **AI Magic:** A textarea for freeform prompts (e.g., "add a hat"), a "Generate" button, and a one-click "Remove Background" button.
    - **Color Adjustments:** Sliders for Brightness, Contrast, and Saturation, with a live preview on the main canvas. Includes "Apply," "Cancel," and "Reset" buttons.
- **Batch Editing:**
    - A "Batch Edit" toggle on the Right Sidebar.
    - When enabled, users can select multiple image thumbnails. A checkbox appears on each thumbnail.
    - Edits made in the Tool Panel (e.g., Resize, Color Adjust) are applied to all selected images.

### Logic & State Management
- **State:**
    - An array of 'ImageState' objects. Each object contains the image's ID, File object, current data URL, dimensions, and a 'history' array (stack of previous data URLs for undo).
    - State for the active image index, active tool, batch edit mode, and any tool-specific values (e.g., crop coordinates, slider values).
- **Image Handling:**
    - Support image upload via file input and drag-and-drop.
    - When an edit is applied, use a <canvas> element to perform the transformation.
    - After drawing the change on the canvas, convert the canvas content back to a Blob, then to a new data URL.
    - Push this new URL onto the 'history' stack of the corresponding ImageState object and update its current URL.
- **Undo Logic:**
    - The "Undo" action pops the last URL from the active image's history array and sets the second-to-last URL as the new current URL.
- **API Integration:**
    - For AI tools, use the 'editImageWithPrompt' service function. This function sends the base image (as base64) and a text prompt to the 'gemini-2.5-flash-image' model and receives a new base64 image string in return.
- **Saving:** A save modal allows the user to select the file format (JPG, PNG, WebP) and quality (for JPG/WebP) before downloading the final image(s).`}
        </DeveloperPromptSection>
      </div>
    </div>
  );
};

export default GuideTab;
