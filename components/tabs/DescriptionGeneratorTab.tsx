
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import TextArea from '../TextArea';
import Button from '../Button';
import { generateProductDescription, generateBatchSimpleDescriptions, generateBatchDetailedDescriptions, suggestGuidelines, rewriteDescriptionWithSpecs } from '../../services/geminiService';
import type { HistoryEntry, SingleGenerationResult, CustomTemplate } from '../../types';
import ResultsView from '../ResultsView';
import HistoryPanel from '../HistoryPanel';
import { exportToCSV, exportToXLSX } from '../../utils/exportUtils';
import Spinner from '../Spinner';
import ManageTemplatesModal from '../ManageTemplatesModal';
import { motion } from 'framer-motion';
import { Save, Library, StopCircle, Download, FileSpreadsheet, Plus, Trash2, Clipboard, Table as TableIcon, Type as TypeIcon, AlertCircle, Database, ChevronDown, History, Wand2 } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../src/firebase';
import { addHistory, listHistory, subscribeToStore, deleteHistory, clearHistory, STORE_NAMES } from '../../services/idbService';

const EXAMPLES = {
  defaultStandard: {
    productQuery: `Tên sản phẩm mẫu`,
    guidelines: `QUY CHUẨN MÔ TẢ SẢN PHẨM

I. GIỚI HẠN ĐỘ DÀI
- Độ dài mô tả: Bắt buộc từ 3.000 – 4.900 ký tự (viết chi tiết, đầy đủ các mục, phân tích sâu công năng, đặc điểm kỹ thuật và trải nghiệm người dùng để đạt dung lượng theo yêu cầu).

1. Cấu trúc nội dung

Dòng đầu tiên: luôn bắt đầu bằng <h3><strong>Giới thiệu tổng quan về [Tên sản phẩm đầy đủ]</strong></h3>.

Quan trọng: Sau dòng tiêu đề <h3> này, hãy đi thẳng vào nội dung mô tả công dụng và lợi ích. TUYỆT ĐỐI không viết thêm một dòng phụ kiểu "Giới thiệu sản phẩm..." hay nhắc lại tên sản phẩm một lần nữa dưới dạng in đậm ngay sát phía dưới.

Phần nội dung chính: 4–6 câu tóm tắt công dụng chính, lợi ích nổi bật của sản phẩm (viết tự nhiên, rõ ràng, không gượng ép).

Các phần tiếp theo có tiêu đề in đậm:

Thông tin sản phẩm

Tính năng nổi bật

Hướng dẫn sử dụng

(Thêm mục khác tùy loại sản phẩm nếu cần: Chính sách bảo hành, Thành phần, Thông số kỹ thuật, Công nghệ, Hướng dẫn bảo quản
…)

2. Trình bày

Sử dụng gạch đầu dòng “-” để liệt kê, không dùng ký tự đặc biệt (❌ không dùng ☀️, ✨, • …).

Nội dung được chia khối rõ ràng, dễ nhìn, không gộp hết thành 1 đoạn dài.

Không chèn các dòng phân cách (❌ “-----” hoặc dấu gạch ngang dài).

3. Nội dung đưa vào

Chỉ đưa các thông tin chính xác từ website chính hãng hoặc nguồn uy tín (VD: thành phần, xuất xứ, chất liệu, màu sắc, công nghệ…).

Nếu không tìm được thông tin chính xác, thì không cho vào mô tả (tránh bịa đặt).

Phần giới thiệu sản phẩm được phép viết khái quát, tự nhiên, nhưng phải phù hợp với sản phẩm.

Có thể bổ sung thêm nội dung khác để khách hàng hiểu rõ hơn về sản phẩm.

4. Từ khóa

Chèn từ khóa tự nhiên, hợp lý, tránh nhồi nhét.

Nêu bật sự khác biệt và lợi ích của sản phẩm so với sản phẩm khác.

5. Tính chính xác tuyệt đối (Không Hallucination)

Tuyệt đối không sử dụng kiến thức bên ngoài (ngoài dữ liệu được cấp hoặc trang web chính thức của sản phẩm).

Nếu các thông số kỹ thuật (như công suất, kích thước, khối lượng, chất liệu, màu sắc...) không xuất hiện rõ ràng trong nội dung gốc/URL/nguồn chính thức, AI bắt buộc phải bỏ qua (omit) thay vì tự phỏng đoán hay tự tạo ra thông số giả. "Thà có một mô tả ngắn hơn là một mô tả sai thông số kỹ thuật".`
  },
  tech: {
    productQuery: `iPhone 15 Pro Max 256GB
Laptop Dell XPS 15 9530
Tai nghe Sony WH-1000XM5`,
    guidelines: `QUY CHUẨN NỘI DUNG MÔ TẢ SẢN PHẨM CÔNG NGHỆ

I. GIỚI HẠN VÀ CẤU TRÚC
- Giới hạn ký tự: 5.000 – 7.000 ký tự.
- Dòng tiêu đề chính: <h3><strong>Giới thiệu tổng quan về [Tên sản phẩm đầy đủ]</strong></h3>.
- KHÔNG nhắc lại tiêu đề hay viết "Giới thiệu sản phẩm" ngay dưới dòng <h3>.
- Đoạn tóm tắt: 3–5 câu tóm tắt công nghệ cốt lõi và lợi ích chính.
- Cấu trúc chi tiết:
  1. <strong>TÍNH NĂNG NỔI BẬT</strong>: Tập trung vào 3-5 tính năng đắt giá nhất (ví dụ: Chip A17 Pro, Camera Telephoto 5x, Màn hình ProMotion). Giải thích lợi ích của từng tính năng.
  2. <strong>THIẾT KẾ & VẬT LIỆU</strong>: Mô tả vật liệu (Titanium), cảm giác cầm nắm, chất lượng hiển thị.
  3. <strong>HIỆU NĂNG & THỜI LƯỢNG PIN</strong>: Cung cấp thông tin về hiệu suất trong sử dụng thực tế (chơi game, làm việc) và thời lượng pin.
  4. <strong>THÔNG SỐ KỸ THUẬT</strong>: Liệt kê các thông số quan trọng (CPU, RAM, Màn hình, Camera, Pin...).
  5. <strong>BỘ SẢN PHẨM GỒM</strong>: Ghi rõ các phụ kiện đi kèm trong hộp.

II. QUY TẮC TRÌNH BÀY
- Liệt kê: Dùng gạch đầu dòng “-”.
- Định dạng: <strong>In đậm (Bold)</strong> tên tính năng, thông số quan trọng.

III. NỘI DUNG VÀ TỪ KHÓA
- Tính xác thực: Chỉ dùng thông tin từ trang chủ hãng hoặc nguồn đánh giá uy tín.
- Ngôn ngữ: Hiện đại, tập trung vào công nghệ và lợi ích thực tế.
- Kết thúc: Luôn kết thúc bằng Lời Kêu gọi Hành động (CTA) rõ ràng. Ví dụ: "Đặt hàng ngay để sở hữu siêu phẩm công nghệ!"`,
  },
  fashion: {
    productQuery: `Áo Sơ Mi Lụa Tay Dài
Quần Jeans Skinny Fit
Váy Hoa Nhí Vintage`,
    guidelines: `TIÊU CHUẨN MÔ TẢ SẢN PHẨM THỜI TRANG

I. CẤU TRÚC & GIỚI HẠN
- Tiêu đề chính: <h3><strong>Giới thiệu tổng quan về [Tên sản phẩm đầy đủ]</strong></h3>.
- Đi thẳng vào nội dung mở đầu sau tiêu đề, không lặp lại tên sản phẩm.
- Đoạn mở đầu: 2-3 câu giới thiệu cảm hứng, phong cách chủ đạo của sản phẩm.
- Chi tiết sản phẩm:
  1. <strong>ĐIỂM NHẤN THIẾT KẾ</strong>: Mô tả các chi tiết đặc sắc (cổ áo, tay áo, họa tiết, form dáng).
  2. <strong>CHẤT LIỆU & CẢM NHẬN</strong>: Ghi rõ chất liệu (Vải Lụa, Cotton, Voan...) và cảm giác khi mặc (mềm mại, thoáng mát, co giãn).
  3. <strong>GỢI Ý PHỐI ĐỒ (MIX & MATCH)</strong>: Đưa ra 2-3 gợi ý cách kết hợp sản phẩm với trang phục/phụ kiện khác.
  4. <strong>THÔNG SỐ SIZE</strong>: Bảng size tham khảo nếu có.
- Lời kết: "Thêm vào giỏ hàng ngay để sở hữu phong cách của riêng bạn!"

II. TRÌNH BÀY & NGÔN NGỮ
- Dùng gạch đầu dòng "-" cho các danh sách.
- <strong>In đậm</strong> các ưu điểm chính.
- Ngôn ngữ: bay bổng, thời thượng, tập trung vào cảm xúc và phong cách sống mà sản phẩm mang lại.`,
  },
  home_decor: {
    productQuery: `Ghế Sofa Văng Da Cao Cấp
Bộ Chăn Ga Gối Lụa Tencel
Đèn Bàn Học Chống Cận Thị`,
    guidelines: `TIÊU CHUẨN MÔ TẢ SẢN PHẨM GIA DỤNG & TRANG TRÍ

I. CẤU TRÚC
- Tiêu đề: <h3><strong>Giới thiệu tổng quan về [Tên sản phẩm đầy đủ]</strong></h3>.
- Không viết thêm dòng phụ in đậm ngay dưới tiêu đề.
- Đoạn giới thiệu (2-3 câu): Khơi gợi không gian sống lý tưởng, cảm giác ấm cúng mà sản phẩm mang lại.
- Chi tiết:
  1. <strong>VẬT LIỆU & CHẤT LƯỢNG</strong>: Ghi rõ vật liệu (Gỗ Sồi, Da Bò, Vải Lụa...) và quy trình hoàn thiện. Nhấn mạnh độ bền.
  2. <strong>THIẾT KẾ & CÔNG NĂNG</strong>: Mô tả phong cách thiết kế (Hiện đại, Tối giản, Cổ điển). Nêu bật các công năng, tiện ích sử dụng.
  3. <strong>KÍCH THƯỚC & LẮP ĐẶT</strong>: Cung cấp kích thước chi tiết (Dài x Rộng x Cao). Hướng dẫn lắp đặt nếu có.
- Lời kết: "Kiến tạo không gian sống mơ ước của bạn ngay hôm nay!"

II. VĂN PHONG
- Ngôn ngữ: Sang trọng, ấm cúng.
- **In đậm** các đặc tính về vật liệu và kích thước.`
  },
  food_beverage: {
    productQuery: `Cà Phê Hạt Rang Mộc Robusta
Trà Oolong Túi Lọc Cao Cấp
Mật Ong Rừng Nguyên Chất`,
    guidelines: `QUY CHUẨN MÔ TẢ SẢN PHẨM THỰC PHẨM & ĐỒ UỐNG

I. NỘI DUNG BẮT BUỘC
- Tiêu đề: <h3><strong>Giới thiệu tổng quan về [Tên sản phẩm đầy đủ]</strong></h3>.
- Tránh lặp lại câu giới thiệu thừa ngay sau tiêu đề.
- Xuất xứ: Ghi rõ vùng trồng/sản xuất.
- Thành phần: 100% tự nhiên, không chất bảo quản...
- Hương vị đặc trưng: Mô tả chi tiết (đắng nhẹ, hậu vị ngọt, hương thơm trái cây...).
- Hướng dẫn sử dụng: Cách pha chế, gợi ý kết hợp.
- Hướng dẫn bảo quản: Nơi khô ráo, tránh ánh nắng...

II. CẤU TRÚC & TRÌNH BÀY
- Tiêu đề: <h3><strong>Giới thiệu tổng quan về [Tên sản phẩm đầy đủ]</strong></h3>.
- Đoạn mở đầu: Kể một câu chuyện ngắn về nguồn gốc hoặc quy trình sản xuất.
- Dùng gạch đầu dòng "-" để liệt kê các đặc điểm.
- **In đậm** các từ khóa về hương vị và xuất xứ.
- CTA: "Thưởng thức ngay hôm nay!"`
  },
  cosmetics: {
    productQuery: `Serum Cấp Ẩm Hyaluronic Acid
Kem Chống Nắng Phổ Rộng SPF 50+
Son Kem Lì Lâu Trôi`,
    guidelines: `TIÊU CHUẨN MÔ TẢ SẢN PHẨM MỸ PHẨM

I. CẤU TRÚC
- Tiêu đề: <h3><strong>Giới thiệu tổng quan về [Tên sản phẩm đầy đủ]</strong></h3>.
- Bắt đầu mô tả ngay sau tiêu đề, không tạo dòng tiêu đề phụ lặp lại.
- Đoạn giới thiệu (2-4 câu): Nêu bật vấn đề da/nhu cầu trang điểm và giải pháp mà sản phẩm mang lại.
- Chi tiết:
  1. **CÔNG DỤNG VƯỢT TRỘI**: Liệt kê 3-4 công dụng chính (cấp ẩm, chống lão hóa, kiềm dầu...).
  2. **THÀNH PHẦN CHÍNH**: Ghi rõ các thành phần nổi bật (Hyaluronic Acid, Niacinamide, Vitamin C...) và vai trò của chúng.
  3. **LOẠI DA PHÙ HỢP**: Chỉ định rõ sản phẩm dành cho loại da nào (da dầu, da khô, da nhạy cảm...).
  4. **HƯỚNG DẪN SỬ DỤNG**: Các bước sử dụng trong chu trình dưỡng da/trang điểm.
- Cam kết: "Sản phẩm không chứa cồn, paraben, hương liệu."

II. LƯU Ý
- Ngôn ngữ: Khoa học, thuyết phục, nhấn mạnh hiệu quả.
- **In đậm** tên thành phần và công dụng.
- Không sử dụng các từ ngữ cam kết hiệu quả 100%.`
  },
  simple: {
    productQuery: `Bút bi xanh`,
    guidelines: `- Viết 1 đoạn văn ngắn khoảng 50 từ.
- Nêu 3 đặc điểm chính.
- Không dùng HTML.`
  }
};


const DescriptionGeneratorTab: React.FC = () => {
  const [productQuery, setProductQuery] = usePersistedState<string>('descGen_productQuery', '');
  const [guidelines, setGuidelines] = usePersistedState<string>('descGen_guidelines', '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [currentResults, setCurrentResults] = usePersistedState<SingleGenerationResult[]>('descGen_currentResults', []);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState<boolean>(false);
  const [isSimpleMode, setIsSimpleMode] = usePersistedState<boolean>('descGen_isSimpleMode', false);
  const [isBatchMode, setIsBatchMode] = usePersistedState<boolean>('descGen_isBatchMode', true);
  const [isLinkMode, setIsLinkMode] = usePersistedState<boolean>('descGen_isLinkMode', false);
  const [isRawMode, setIsRawMode] = usePersistedState<boolean>('descGen_isRawMode', false);
  const [isTableMode, setIsTableMode] = usePersistedState<boolean>('descGen_isTableMode', true);
  const [showHistory, setShowHistory] = usePersistedState<boolean>('descGen_showHistory', false);
  const [showGuidelines, setShowGuidelines] = usePersistedState<boolean>('descGen_showGuidelines', false);
  const [useWebSearch, setUseWebSearch] = usePersistedState<boolean>('descGen_useWebSearch', true);
  const [selectedModel, setSelectedModel] = usePersistedState<string>('descGen_selectedModel', 'gemini-3.8-flash');
  const [simplePrompt, setSimplePrompt] = usePersistedState<string>(
    'descGen_simplePrompt',
    `- Viết 1 đoạn văn ngắn khoảng 50 từ.\n- Nêu 3 đặc điểm chính.\n- Không dùng HTML.`
  );
  
  const stopSignal = useRef<boolean>(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!guidelines || (guidelines.includes('QUY CHUẨN MÔ TẢ SẢN PHẨM') && !guidelines.includes('3.000') && !guidelines.includes('3000'))) {
      setGuidelines(EXAMPLES.defaultStandard.guidelines);
    }
  }, []);

  useEffect(() => {
    setIsSyncing(true);
    const loadData = async () => {
      try {
        let results = await listHistory(STORE_NAMES.DESCRIPTIONS, 50);
        if (auth.currentUser?.email !== 'tungnguyen.0612993@gmail.com') {
            results = results.filter((item: any) => item.uid === auth.currentUser?.uid);
        }
        
        const historyData: HistoryEntry[] = results.map((data: any) => ({
          id: data.id?.toString(),
          timestamp: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
          productNames: data.productNames || [data.productName],
          results: data.results || [{
            productName: data.productName,
            descriptionText: data.description,
            descriptionHtml: data.description,
            sources: [],
            status: data.status || 'success'
          }],
          userEmail: data.userEmail || 'N/A'
        }));
        
        setHistory(historyData);
      } catch (err) {
        console.error("Error loading history:", err);
      } finally {
        setIsSyncing(false);
      }
    };
    
    loadData();
    const unsubscribe = subscribeToStore(STORE_NAMES.DESCRIPTIONS, loadData);
    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleSaveHistory = useCallback(async (newEntry: HistoryEntry) => {
    if (!auth.currentUser) return;

    try {
      // Save each result as a separate document for better querying if needed, 
      // but for now we'll match the HistoryEntry structure to keep it simple
      await addHistory(STORE_NAMES.DESCRIPTIONS, {
        uid: auth.currentUser.uid,
        userEmail: auth.currentUser.email || 'N/A',
        productNames: newEntry.productNames,
        results: newEntry.results,
        createdAt: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'descriptions');
    }
  }, [auth.currentUser]);
  
  const handleLoadHistory = (entry: HistoryEntry) => {
    setCurrentResults(entry.results);
    const products = entry.results.map(r => r.productName).join('\n');
    setProductQuery(products);
  };

  const handleClearHistory = async () => {
    if (!auth.currentUser || !window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử không?")) return;
    
    try {
      await clearHistory(STORE_NAMES.DESCRIPTIONS);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteHistoryItem = async (entryId: string) => {
    try {
      await deleteHistory(STORE_NAMES.DESCRIPTIONS, Number(entryId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleLoadExample = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const exampleKey = e.target.value as keyof typeof EXAMPLES;
    if (EXAMPLES[exampleKey]) {
      setProductQuery(EXAMPLES[exampleKey].productQuery);
      setGuidelines(EXAMPLES[exampleKey].guidelines);
      setShowGuidelines(true);
    }
    e.target.value = "";
  };

  const parseEntries = (query: string): { name: string, url: string, raw: string }[] => {
    const lines = query.split('\n').filter(l => l.trim());
    if (lines.length === 0) return [{ name: '', url: '', raw: '' }];
    return lines.map(line => {
      if (line.includes('|')) {
        const parts = line.split('|');
        const name = parts[0] ? parts[0].trim() : '';
        const url = parts[1] ? parts[1].trim() : '';
        const raw = parts[2] ? parts[2].trim() : '';
        return { name, url, raw };
      }
      // If no separator, decide based on mode
      if (isRawMode) return { name: '', url: '', raw: line.trim() };
      return isLinkMode ? { name: '', url: line.trim(), raw: '' } : { name: line.trim(), url: '', raw: '' };
    });
  };

  const [entries, setEntries] = useState<{ name: string, url: string, raw: string }[]>(() => parseEntries(productQuery));

  // Sync entries when productQuery changes externally (like loading history/example)
  useEffect(() => {
    const newEntries = parseEntries(productQuery);
    // Only update if significantly different to avoid loops
    if (JSON.stringify(newEntries) !== JSON.stringify(entries)) {
        setEntries(newEntries);
    }
  }, [productQuery, isLinkMode, isRawMode]);

  // Sync productQuery when entries change
  const updateProductQueryFromEntries = (newEntries: { name: string, url: string, raw: string }[]) => {
    const query = newEntries
      .filter(e => e.name.trim() || e.url.trim() || (e.raw && e.raw.trim()))
      .map(e => {
        // ALWAYS use the separator to preserve column intent
        return `${e.name.trim()} | ${e.url.trim()} | ${(e.raw || '').trim()}`;
      })
      .join('\n');
    setProductQuery(query);
  };

  const handleEntryChange = (index: number, field: 'name' | 'url' | 'raw', value: string) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    setEntries(newEntries);
    updateProductQueryFromEntries(newEntries);
  };

  const addEntry = () => {
    const newEntries = [...entries, { name: '', url: '', raw: '' }];
    setEntries(newEntries);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) {
        setEntries([{ name: '', url: '', raw: '' }]);
        setProductQuery('');
        return;
    }
    const newEntries = entries.filter((_, i) => i !== index);
    setEntries(newEntries);
    updateProductQueryFromEntries(newEntries);
  };

  const clearAllEntries = () => {
    setEntries([{ name: '', url: '', raw: '' }]);
    setProductQuery('');
  };

  const handlePaste = (e: React.ClipboardEvent, index: number, field: 'name' | 'url' | 'raw') => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    e.preventDefault();
    
    // Robust TSV/Excel parsing that respects quotes (for multi-line cells)
    const parseExcelPaste = (text: string): string[][] => {
        const result: string[][] = [];
        let row: string[] = [];
        let col = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i+1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    col += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    col += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === '\t') {
                    row.push(col.trim());
                    col = '';
                } else if (char === '\n' || char === '\r') {
                    row.push(col.trim());
                    result.push(row);
                    row = [];
                    col = '';
                    if (char === '\r' && nextChar === '\n') i++;
                } else {
                    col += char;
                }
            }
        }
        if (col || row.length > 0) {
            row.push(col.trim());
            result.push(row);
        }
        return result;
    };

    const parsedRows = parseExcelPaste(pasteData);

    // HEURISTIC: If pasting into 'raw', check if it's actually a multi-column table.
    // If no row has more than 1 non-empty column, it's just text (even if indented with tabs).
    if (field === 'raw') {
        const hasMultipleColumns = parsedRows.some(row => {
            return row.filter(cell => cell.trim().length > 0).length > 1;
        });

        if (!hasMultipleColumns) {
            let cleanText = pasteData;
            // Clean up Excel quotes if it's a single copied cell
            if (cleanText.startsWith('"') && cleanText.endsWith('"') && cleanText.includes('\n')) {
                 cleanText = cleanText.substring(1, cleanText.length - 1).replace(/""/g, '"');
            }
            
            // Insert the text as a single block
            document.execCommand('insertText', false, cleanText);
            return;
        }
    }

    const newEntries = [...entries];
    let currentLogicalIndex = index;
    let lastLogicalRowIndex = -1;
    let logicalRowStartColumnCount = 0;

    parsedRows.forEach((columns, rowIndex) => {
        if (columns.length === 0 || (columns.length === 1 && columns[0] === '')) {
            if (rowIndex === parsedRows.length - 1) return;
        }

        const contentColumns = columns.filter(c => c.length > 0);
        const isSingleLogicalCol = contentColumns.length <= 1;
        
        const isContinuation = rowIndex > 0 && isSingleLogicalCol && (logicalRowStartColumnCount > 1 || field === 'raw');

        if (isContinuation && lastLogicalRowIndex !== -1) {
            const entry = newEntries[lastLogicalRowIndex];
            
            let targetField: 'name' | 'url' | 'raw' = field;
            if (field === 'raw') targetField = 'raw';
            else if (logicalRowStartColumnCount >= 3) targetField = 'raw';
            else if (logicalRowStartColumnCount === 2) {
                targetField = isRawMode ? 'raw' : 'url';
            }
            
            // Fix: Append the actual non-empty content of the continuation row, not just columns[0]
            const textToAppend = columns.join('\t').trim();
            entry[targetField] = (entry[targetField] ? entry[targetField] + '\n' : '') + textToAppend;
        } else {
            if (rowIndex > 0) {
                currentLogicalIndex++;
            }
            lastLogicalRowIndex = currentLogicalIndex;
            logicalRowStartColumnCount = columns.length;

            if (currentLogicalIndex >= newEntries.length) {
                newEntries.push({ name: '', url: '', raw: '' });
            } else {
                newEntries[currentLogicalIndex] = { ...newEntries[currentLogicalIndex] };
            }

            if (columns.length >= 3) {
                newEntries[currentLogicalIndex].name = columns[0];
                newEntries[currentLogicalIndex].url = columns[1];
                newEntries[currentLogicalIndex].raw = columns[2];
            } else if (columns.length === 2) {
                if (isLinkMode && isRawMode) {
                    newEntries[currentLogicalIndex].name = columns[0];
                    newEntries[currentLogicalIndex].url = columns[1];
                } else if (isRawMode) {
                    newEntries[currentLogicalIndex].name = columns[0];
                    newEntries[currentLogicalIndex].raw = columns[1];
                } else {
                    newEntries[currentLogicalIndex].name = columns[0];
                    newEntries[currentLogicalIndex].url = columns[1];
                }
            } else {
                newEntries[currentLogicalIndex][field] = columns[0];
            }
        }
    });

    setEntries(newEntries);
    updateProductQueryFromEntries(newEntries);
  };
  
  const handleSuggestGuidelines = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setLoadingProgress("Đang phân tích và gợi ý nguyên tắc...");
    try {
        const suggested = await suggestGuidelines(guidelines, entries[0]?.name);
        setGuidelines(suggested);
        setLoadingProgress("");
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Không thể gợi ý nguyên tắc.';
        setLoadingProgress(`Lỗi: ${errorMessage}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSaveTemplate = (name: string) => {
    const newTemplate: CustomTemplate = {
      id: new Date().toISOString(),
      name: name,
      content: guidelines.trim(),
    };
    const updatedTemplates = [newTemplate, ...customTemplates];
    setCustomTemplates(updatedTemplates);
    localStorage.setItem('productGenTemplates', JSON.stringify(updatedTemplates));
  };

  const handleLoadTemplate = (template: CustomTemplate) => {
    setGuidelines(template.content);
    setShowGuidelines(true);
    setIsTemplatesModalOpen(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa mẫu này không?")) {
      const updatedTemplates = customTemplates.filter(t => t.id !== templateId);
      setCustomTemplates(updatedTemplates);
      localStorage.setItem('productGenTemplates', JSON.stringify(updatedTemplates));
    }
  };

  const handleStop = useCallback((e?: React.MouseEvent) => {
      if (e) {
          e.preventDefault();
          e.stopPropagation();
      }
      console.log('Stopping generation...');
      stopSignal.current = true;
      setLoadingProgress('Đang dừng quá trình theo yêu cầu.');
      setIsLoading(false);
  }, []);

  const handleApplyReviewToAll = async (specsToRemove: {name: string, value: string}[], sectionsToRemove: string[]) => {
      if (currentResults.length === 0) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
          const newResults = currentResults.map(r => ({ ...r }));
          let completed = 0;

          const batchSize = 3;
          for (let i = 0; i < newResults.length; i += batchSize) {
              const batch = newResults.slice(i, i + batchSize);
              await Promise.all(batch.map(async (res) => {
                  if (res.status === 'success') {
                      const newHtml = await rewriteDescriptionWithSpecs(
                          res.descriptionHtml,
                          [], // specsToKeep
                          specsToRemove,
                          sectionsToRemove
                      );
                      res.descriptionHtml = newHtml;
                      const stripHtml = (html: string) => { const tmp = document.createElement('DIV'); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || ''; };
                      res.descriptionText = stripHtml(newHtml);
                  }
                  completed++;
              }));
              setLoadingProgress(`Đang áp dụng thay đổi hàng loạt: ${completed}/${newResults.length}`);
          }
          
          setCurrentResults(newResults);
          setLoadingProgress('');
      } catch (err: any) {
          setError(err.message || "Có lỗi xảy ra khi áp dụng thay đổi hàng loạt.");
      } finally {
          setIsLoading(false);
          setLoadingProgress('');
      }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const productsToProcess = productQuery.split('\n').map(p => p.trim()).filter(Boolean);

    if (productsToProcess.length === 0) {
      setError('Vui lòng nhập ít nhất một tên sản phẩm.');
      return;
    }
    
    if (isSimpleMode) {
        if (!simplePrompt.trim()) {
            setError('Vui lòng nhập yêu cầu mô tả đồng bộ.');
            return;
        }
    } else {
        if (!guidelines.trim()) {
          setError('Vui lòng nhập Nguyên tắc & Tiêu chuẩn Mô tả hoặc tải một ví dụ.');
          return;
        }
    }

    setIsLoading(true);
    stopSignal.current = false;
    setError(null);
    setCurrentResults([]);
    setLoadingProgress('');
    
    let allResults: SingleGenerationResult[] = [];

    try {
        if (isSimpleMode) {
             const BATCH_SIZE = 8; // Increased from 5
             for (let i = 0; i < productsToProcess.length; i += BATCH_SIZE) {
                if (stopSignal.current) break;

                const batch = productsToProcess.slice(i, i + BATCH_SIZE);
                const startNum = i + 1;
                const endNum = Math.min(i + BATCH_SIZE, productsToProcess.length);
                
                setLoadingProgress(`Đang xử lý sản phẩm ${startNum}-${endNum} / ${productsToProcess.length}...`);
                
                try {
                    const batchResults = await generateBatchSimpleDescriptions(batch, simplePrompt, selectedModel, useWebSearch, isLinkMode, isRawMode);
                    allResults.push(...batchResults);
                } catch (batchErr) {
                    console.error(`Error in batch ${i}:`, batchErr);
                    const failedBatchResults: SingleGenerationResult[] = batch.map(p => ({
                        productName: p,
                        descriptionText: '',
                        descriptionHtml: '',
                        sources: [],
                        status: 'error',
                        error: batchErr instanceof Error ? batchErr.message : 'Lỗi xử lý đợt này',
                    }));
                    allResults.push(...failedBatchResults);
                }
                
                setCurrentResults([...allResults]);
            }
        } else {
            // Detailed mode - Optimized to use batching
            // Detailed descriptions are rich HTML (~500-800 words each). A batch size of 3 prevents token truncation.
            const BATCH_SIZE = 3; 
            
            for (let i = 0; i < productsToProcess.length; i += BATCH_SIZE) {
                if (stopSignal.current) break;

                const batch = productsToProcess.slice(i, i + BATCH_SIZE);
                const startNum = i + 1;
                const endNum = Math.min(i + BATCH_SIZE, productsToProcess.length);
                
                setLoadingProgress(`Đang tạo ${startNum}-${endNum} / ${productsToProcess.length}...`);
                
                try {
                    const batchResults = await generateBatchDetailedDescriptions(
                        batch, 
                        guidelines, 
                        selectedModel, 
                        useWebSearch, 
                        isLinkMode,
                        isRawMode
                    );
                    allResults.push(...batchResults);
                } catch (batchErr) {
                    console.warn(`Error in detailed batch ${i}, attempting item-by-item fallback:`, batchErr);
                    // Fallback to process items individually in this batch so partial success is preserved
                    for (const item of batch) {
                        if (stopSignal.current) break;
                        try {
                            const singleResults = await generateBatchDetailedDescriptions(
                                [item],
                                guidelines,
                                selectedModel,
                                useWebSearch,
                                isLinkMode,
                                isRawMode
                            );
                            allResults.push(...singleResults);
                        } catch (singleErr) {
                            let name = item;
                            if (item.includes('|')) {
                                name = item.split('|')[0].trim();
                            } else if (isLinkMode) {
                                name = 'Sản phẩm từ Link';
                            }
                            allResults.push({
                                productName: name,
                                descriptionText: '',
                                descriptionHtml: '',
                                sources: [],
                                status: 'error' as const,
                                error: singleErr instanceof Error ? singleErr.message : 'Lỗi tạo mô tả',
                            });
                        }
                    }
                }
                
                if (stopSignal.current) break;
                setCurrentResults([...allResults]);
            }
        }
        
          if (allResults.length > 0) {
            const newHistoryEntry: HistoryEntry = {
                id: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                productNames: productsToProcess,
                results: allResults,
            };
            handleSaveHistory(newHistoryEntry);
        }

    } catch (globalErr) {
        if (!stopSignal.current) {
            const errorMessage = globalErr instanceof Error ? globalErr.message : 'Đã xảy ra lỗi hệ thống nghiêm trọng.';
            setError(errorMessage);
        }
    } finally {
      if (!stopSignal.current) {
          setIsLoading(false);
          setLoadingProgress('');
      }
    }
  }, [productQuery, guidelines, history, isSimpleMode, simplePrompt, selectedModel, useWebSearch, isLinkMode, handleSaveHistory]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <>
        <style>
            {`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #ccc;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #bbb;
                }
            `}
        </style>
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-12"
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div variants={itemVariants}>
                    <form onSubmit={handleSubmit} className="bg-zinc-800/50 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-2xl border border-zinc-700 hover:border-zinc-600 transition-colors">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-zinc-700/60">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <h3 className="text-base sm:text-lg font-bold text-sky-400 whitespace-nowrap shrink-0">
                                        {isBatchMode ? (isLinkMode ? 'Danh sách Link' : 'Danh sách Sản phẩm') : (isLinkMode ? 'Link Sản phẩm' : 'Tên Sản phẩm')}
                                    </h3>
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30 shrink-0">
                                        {isBatchMode ? 'Hàng loạt' : 'Đơn lẻ'}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                                    <div className="relative flex items-center min-w-[170px] sm:min-w-[190px]">
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-full text-xs sm:text-sm bg-zinc-900/90 border border-zinc-700 hover:border-sky-500/50 rounded-xl py-1.5 sm:py-2 pl-3 pr-8 text-zinc-200 focus:ring-2 focus:ring-sky-500 outline-none transition duration-200 cursor-pointer shadow-sm appearance-none"
                                            title="Chọn mô hình Gemini"
                                        >
                                            <option value="gemini-3.8-flash">Default (Gemini 3.8 Flash)</option>
                                            <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                                            <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                                            <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                                            <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                                            <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                                            <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                                        </select>
                                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 pointer-events-none" />
                                    </div>

                                    {!isSimpleMode && (
                                    <div className="relative flex items-center min-w-[130px] sm:min-w-[150px]">
                                        <select
                                            onChange={handleLoadExample}
                                            defaultValue=""
                                            className="w-full text-xs sm:text-sm bg-zinc-900/90 border border-zinc-700 hover:border-sky-500/50 rounded-xl py-1.5 sm:py-2 pl-3 pr-8 text-zinc-200 focus:ring-2 focus:ring-sky-500 outline-none transition duration-200 cursor-pointer shadow-sm appearance-none"
                                        >
                                            <option value="" disabled>Tải ví dụ...</option>
                                            <option value="defaultStandard">Quy chuẩn mặc định</option>
                                            <option value="tech">Công nghệ</option>
                                            <option value="fashion">Thời trang</option>
                                            <option value="home_decor">Gia dụng</option>
                                            <option value="food_beverage">Thực phẩm</option>
                                            <option value="cosmetics">Mỹ phẩm</option>
                                            <option value="simple">Tối giản</option>
                                        </select>
                                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 pointer-events-none" />
                                    </div>
                                    )}
                                </div>
                            </div>

                            {/* Mode Control Toolbar */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
                                <label className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/40 hover:border-zinc-600" title="Bật để nhập nhiều sản phẩm cùng lúc">
                                    <span className={isBatchMode ? 'text-sky-300' : 'text-zinc-400'}>Hàng loạt</span>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isBatchMode}
                                        onChange={(e) => setIsBatchMode(e.target.checked)}
                                    />
                                    <div className={`w-7 h-4 rounded-full p-0.5 transition-colors ${isBatchMode ? 'bg-sky-500' : 'bg-zinc-700'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isBatchMode ? 'translate-x-3' : 'translate-x-0'}`} />
                                    </div>
                                </label>

                                <label className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/40 hover:border-zinc-600" title="Sử dụng link để lấy thông tin chi tiết cho sản phẩm">
                                    <span className={isLinkMode ? 'text-sky-300' : 'text-zinc-400'}>Link</span>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isLinkMode}
                                        onChange={(e) => setIsLinkMode(e.target.checked)}
                                    />
                                    <div className={`w-7 h-4 rounded-full p-0.5 transition-colors ${isLinkMode ? 'bg-sky-500' : 'bg-zinc-700'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isLinkMode ? 'translate-x-3' : 'translate-x-0'}`} />
                                    </div>
                                </label>

                                <label className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/40 hover:border-zinc-600" title="Sử dụng dữ liệu văn bản thô có sẵn">
                                    <span className={isRawMode ? 'text-sky-300' : 'text-zinc-400'}>Dữ liệu Thô</span>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isRawMode}
                                        onChange={(e) => setIsRawMode(e.target.checked)}
                                    />
                                    <div className={`w-7 h-4 rounded-full p-0.5 transition-colors ${isRawMode ? 'bg-sky-500' : 'bg-zinc-700'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isRawMode ? 'translate-x-3' : 'translate-x-0'}`} />
                                    </div>
                                </label>

                                <label className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/40 hover:border-zinc-600" title="Tìm kiếm thông tin trên Google (Chậm hơn nhưng chính xác)">
                                    <span className={useWebSearch ? 'text-sky-300' : 'text-zinc-400'}>Web</span>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={useWebSearch}
                                        onChange={(e) => setUseWebSearch(e.target.checked)}
                                    />
                                    <div className={`w-7 h-4 rounded-full p-0.5 transition-colors ${useWebSearch ? 'bg-sky-500' : 'bg-zinc-700'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${useWebSearch ? 'translate-x-3' : 'translate-x-0'}`} />
                                    </div>
                                </label>

                                <label className="col-span-2 sm:col-span-1 flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none transition-all bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/40 hover:border-zinc-600" title="Chế độ đồng bộ">
                                    <span className={isSimpleMode ? 'text-sky-300' : 'text-zinc-400'}>Đồng bộ</span>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isSimpleMode}
                                        onChange={(e) => setIsSimpleMode(e.target.checked)}
                                    />
                                    <div className={`w-7 h-4 rounded-full p-0.5 transition-colors ${isSimpleMode ? 'bg-sky-500' : 'bg-zinc-700'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isSimpleMode ? 'translate-x-3' : 'translate-x-0'}`} />
                                    </div>
                                </label>
                            </div>
                        {isBatchMode ? (
                            <div className="border border-zinc-700 rounded-xl overflow-hidden bg-zinc-900/30 backdrop-blur-sm">
                                <div className={`grid ${isLinkMode && isRawMode ? 'grid-cols-[1fr_1.2fr_1.5fr_40px]' : isLinkMode ? 'grid-cols-[1fr_1.5fr_40px]' : isRawMode ? 'grid-cols-[1fr_2fr_40px]' : 'grid-cols-[1fr_40px]'} bg-sky-900/20 border-b border-zinc-700`}>
                                    <div className="p-2 text-center font-bold text-sky-300 border-r border-zinc-700 text-sm">
                                        Tên sp
                                    </div>
                                    {isLinkMode && (
                                        <div className="p-2 text-center font-bold text-red-400 border-r border-zinc-700 text-sm">
                                            Link sp
                                        </div>
                                    )}
                                    {isRawMode && (
                                        <div className="p-2 text-center font-bold text-emerald-400 border-r border-zinc-700 text-sm">
                                            Dữ liệu Mô tả thô
                                        </div>
                                    )}
                                    <div className="bg-sky-900/20"></div>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {entries.map((entry, idx) => (
                                        <div key={idx} className={`grid ${isLinkMode && isRawMode ? 'grid-cols-[1fr_1.2fr_1.5fr_40px]' : isLinkMode ? 'grid-cols-[1fr_1.5fr_40px]' : isRawMode ? 'grid-cols-[1fr_2fr_40px]' : 'grid-cols-[1fr_40px]'} border-b border-zinc-800 group hover:bg-sky-500/5 transition-colors items-stretch`}>
                                            <input
                                                type="text"
                                                value={entry.name}
                                                onChange={(e) => handleEntryChange(idx, 'name', e.target.value)}
                                                onPaste={(e) => handlePaste(e, idx, 'name')}
                                                placeholder="Tên sp..."
                                                className="p-3 text-sm text-zinc-100 bg-transparent outline-none border-r border-zinc-800 transition-colors focus:bg-sky-500/10"
                                            />
                                            {isLinkMode && (
                                                <input
                                                    type="text"
                                                    value={entry.url}
                                                    onChange={(e) => handleEntryChange(idx, 'url', e.target.value)}
                                                    onPaste={(e) => handlePaste(e, idx, 'url')}
                                                    placeholder="Link..."
                                                    className="p-3 text-sm text-zinc-100 bg-transparent outline-none border-r border-zinc-800 transition-colors focus:bg-sky-500/10"
                                                />
                                            )}
                                            {isRawMode && (
                                                <textarea
                                                    value={entry.raw}
                                                    onChange={(e) => handleEntryChange(idx, 'raw', e.target.value)}
                                                    onPaste={(e) => handlePaste(e, idx, 'raw')}
                                                    placeholder="Dữ liệu thô..."
                                                    rows={1}
                                                    className="p-3 text-sm text-zinc-100 bg-transparent outline-none border-r border-zinc-800 resize-none min-h-[44px] custom-scrollbar overflow-y-auto whitespace-pre-wrap flex-grow transition-all focus:min-h-[120px] focus:bg-sky-500/10 placeholder:text-zinc-600"
                                                />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeEntry(idx)}
                                                className="flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-2 bg-zinc-900/50 flex justify-between items-center border-t border-zinc-700">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={addEntry}
                                            className="flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                                        >
                                            <Plus className="w-4 h-4" /> Thêm dòng
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearAllEntries}
                                            className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" /> Xóa tất cả
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 italic">
                                        <Clipboard className="w-3 h-3" /> Mẹo: Có thể dán trực tiếp từ Excel (Tab-separated)
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-500 mb-1 ml-1">Tên sản phẩm</label>
                                        <input
                                            type="text"
                                            value={entries[0]?.name || ''}
                                            onChange={(e) => handleEntryChange(0, 'name', e.target.value)}
                                            placeholder="Nhập tên sản phẩm..."
                                            className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                        />
                                    </div>
                                    {isLinkMode && (
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1 ml-1">Link thông tin sản phẩm</label>
                                            <input
                                                type="text"
                                                value={entries[0]?.url || ''}
                                                onChange={(e) => handleEntryChange(0, 'url', e.target.value)}
                                                placeholder="https://example.com/product..."
                                                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                            />
                                        </div>
                                    )}
                                    {isRawMode && (
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1 ml-1">Dữ liệu Mô tả thô</label>
                                            <TextArea
                                                value={entries[0]?.raw || ''}
                                                onChange={(e) => handleEntryChange(0, 'raw', e.target.value)}
                                                placeholder="Dán nội dung mô tả thô tại đây..."
                                                rows={3}
                                                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-100 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        </div>
                        
                        {isSimpleMode ? (
                        <div>
                            <label htmlFor="simple-prompt" className="block text-sm font-medium text-sky-300 mb-2">
                                Yêu cầu mô tả đồng bộ
                            </label>
                            <TextArea
                                id="simple-prompt"
                                value={simplePrompt}
                                onChange={(e) => setSimplePrompt(e.target.value)}
                                placeholder="VD: Viết 1 đoạn văn ngắn 50 từ nêu 3 đặc điểm chính."
                                rows={10}
                                disabled={isLoading}
                            />
                        </div>
                        ) : (
                        <div className="space-y-4">
                            <button
                                type="button"
                                onClick={() => setShowGuidelines(!showGuidelines)}
                                className="w-full flex items-center justify-between p-3 bg-zinc-900/50 hover:bg-zinc-900/80 rounded-xl border border-zinc-700 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-sky-500/10 rounded-lg group-hover:bg-sky-500/20 transition-colors">
                                        <Database className="w-5 h-5 text-sky-400" />
                                    </div>
                                    <span className="font-semibold text-zinc-200">Nguyên tắc & Tiêu chuẩn</span>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform duration-300 ${showGuidelines ? 'rotate-180' : ''}`} />
                            </button>

                            {showGuidelines && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    <TextArea
                                        id="guidelines"
                                        value={guidelines}
                                        onChange={(e) => setGuidelines(e.target.value)}
                                        placeholder="Nhập hướng dẫn chi tiết của bạn..."
                                        rows={10}
                                        disabled={isLoading}
                                    />
                                    <div className="flex justify-end items-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={handleSuggestGuidelines}
                                            disabled={isLoading}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition-all rounded-lg border border-sky-500/30 text-xs font-medium"
                                            title="AI gợi ý & tối ưu nguyên tắc"
                                        >
                                            <Wand2 className="w-4 h-4" />
                                            Gợi ý
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsTemplatesModalOpen(true)}
                                            disabled={isLoading}
                                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 transition-all rounded-lg border border-zinc-700 text-sm font-medium"
                                            title="Quản lý và Lưu mẫu Nguyên tắc"
                                        >
                                            <Library className="w-5 h-5" />
                                            Thư viện Template
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                        )}
                    </div>
                    <div className="mt-8">
                        {isLoading ? (
                            <Button 
                                type="button" 
                                onClick={handleStop}
                                colorScheme="red"
                            >
                                <StopCircle className="w-5 h-5 mr-2" />
                                Dừng
                            </Button>
                        ) : (
                            <Button type="submit" disabled={!productQuery.trim()}>
                                Tạo Mô tả
                            </Button>
                        )}
                        {isLoading && loadingProgress && (
                            <p className="text-center mt-4 text-sm text-sky-300 animate-pulse">
                                {loadingProgress}
                            </p>
                        )}
                        {!isLoading && loadingProgress && (
                            <p className="text-center mt-4 text-sm text-yellow-400">
                                {loadingProgress}
                            </p>
                        )}
                    </div>
                    </form>
                </motion.div>

                {/* Results Section */}
                <motion.div variants={itemVariants} className="w-full flex flex-col h-full">
                    {error && (
                        <div className="mb-6 bg-red-900/50 text-red-300 p-4 rounded-lg border border-red-700">
                            <p className="font-semibold">Lỗi</p>
                            <p>{error}</p>
                        </div>
                    )}
                    
                    <div className="flex-1">
                        <ResultsView results={currentResults} onApplyReviewToAll={handleApplyReviewToAll} />
                    </div>

                    {currentResults.length > 0 && !isLoading && (
                        <div className="mt-6 flex flex-col sm:flex-row gap-4 pt-4 border-t border-zinc-700">
                            <Button onClick={() => exportToCSV(currentResults)} disabled={isLoading} className="flex-1">
                                <Download className="w-5 h-5 mr-2" />
                                Xuất CSV
                            </Button>
                            <Button 
                                onClick={() => exportToXLSX(currentResults)} 
                                disabled={isLoading}
                                colorScheme="green"
                                className="flex-1"
                            >
                                <FileSpreadsheet className="w-5 h-5 mr-2" />
                                Xuất Excel
                            </Button>
                        </div>
                    )}
                </motion.div>
            </div>
          
            {/* History Section */}
            <div className="mt-8 border-t border-zinc-800 pt-8">
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-zinc-300 transition-all border border-zinc-700 group"
                >
                    <Database className={`w-5 h-5 transition-transform duration-300 ${showHistory ? 'text-sky-400' : 'text-zinc-500'}`} />
                    <span className="font-medium">Lịch sử tạo mô tả</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showHistory ? 'rotate-180' : ''}`} />
                </button>

                {showHistory && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6"
                    >
                        <HistoryPanel
                            history={history}
                            onLoad={handleLoadHistory}
                            onClear={handleClearHistory}
                            onDeleteItem={handleDeleteHistoryItem}
                        />
                    </motion.div>
                )}
            </div>
        </motion.div>

        <ManageTemplatesModal
            isOpen={isTemplatesModalOpen}
            onClose={() => setIsTemplatesModalOpen(false)}
            templates={customTemplates}
            onLoad={handleLoadTemplate}
            onDelete={handleDeleteTemplate}
            onSave={handleSaveTemplate}
            currentGuidelines={guidelines}
        />
    </>
  );
};

export default DescriptionGeneratorTab;
