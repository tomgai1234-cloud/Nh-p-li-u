/**
 * HTML Optimizer Engine - Chuyên gia tối ưu hóa & chuẩn hóa cấu trúc HTML Mô tả Sản phẩm
 * 
 * QUY CHUẨN:
 * 1. Làm sạch cấu trúc HTML (Dỡ bỏ div thừa, xóa thẻ rỗng, sửa heading trong li, loại bỏ style rác...)
 * 2. Bảo toàn 100% nội dung chữ, ký tự và ngữ nghĩa ban đầu.
 * 3. Tuyệt đối không tự bịa thông tin, không tự thêm/bớt thông tin, không tự chế alt ảnh hay tự đổi heading.
 */

export interface HtmlOptimizeOptions {
  unwrapDivs: boolean;            // Dỡ bỏ các thẻ div rỗng / lồng nhau không cần thiết
  removeEmptyTags: boolean;       // Xóa thẻ rỗng (<p></p>, <div></div>, <li></li>, <img> không src...)
  cleanJunkStylesAndAttrs: boolean; // Dọn dẹp inline style rác & class rác từ Docs/Word/Shopee
  fixHeadingsInList: boolean;     // Sửa thẻ heading trong <li> thành <strong> chuẩn W3C
  boldHeadings: boolean;          // Bọc <strong> cho thẻ Heading (Chuẩn SEO TMĐT)
  boldKeyValueLabels: boolean;    // In đậm nhãn "Thuộc tính: Giá trị" (Mặc định: TẮT để bảo toàn nội dung)
  headingStyle: 'keep' | 'h3' | 'h4' | 'p-strong' | 'p-b'; // Chuẩn hóa heading (Mặc định: keep)
  autoAddEmoji: boolean;          // Tự động gắn emoji (Mặc định: TẮT)
  listStyle: 'keep' | 'ul' | 'p-bullet'; // Định dạng danh sách (Mặc định: keep)
  imageHandling: 'keep-in-place' | 'gather-at-bottom' | 'remove-all'; // Xử lý ảnh
  imageResponsive: boolean;       // Thêm loading="lazy" và style responsive (không tự chế alt)
  cleanConsecutiveBreaks: boolean;// Xóa <br> dư thừa, liên tiếp hoặc sát heading/p
  wrapInContainer: boolean;       // Bọc toàn bộ trong thẻ container div
  containerClass: string;         // Tên class container
  outputFormat: 'beautify' | 'minify' | 'clean-lines'; // Định dạng đầu ra
}

export const DEFAULT_HTML_OPTIMIZE_OPTIONS: HtmlOptimizeOptions = {
  unwrapDivs: true,
  removeEmptyTags: true,
  cleanJunkStylesAndAttrs: true,
  fixHeadingsInList: true,
  boldHeadings: true,             // Mặc định bọc <strong> cho heading để chuẩn SEO sàn TMĐT
  boldKeyValueLabels: false,      // Tuân thủ: không tự thay đổi nội dung văn bản
  headingStyle: 'keep',           // Tuân thủ: giữ nguyên cấp độ heading gốc của người dùng
  autoAddEmoji: false,            // Tuân thủ: không tự ý thêm emoji
  listStyle: 'keep',
  imageHandling: 'keep-in-place',
  imageResponsive: false,         // Giữ nguyên kích thước ảnh gốc, không chèn inline style làm méo ảnh
  cleanConsecutiveBreaks: true,
  wrapInContainer: false,
  containerClass: 'product-description',
  outputFormat: 'beautify'
};

export interface OptimizationStats {
  originalLength: number;
  optimizedLength: number;
  reductionPercentage: number;
  emptyTagsRemoved: number;
  divsUnwrapped: number;
  headingsFixedInList: number;
  imagesFound: number;
}

const EMOJI_MAP: Record<string, string> = {
  'GIỚI THIỆU': '✨',
  'ĐẶC ĐIỂM': '🌟',
  'TÍNH NĂNG': '⚡',
  'NỔI BẬT': '🔥',
  'THÔNG SỐ': '⚙️',
  'THÔNG TIN': '📋',
  'THÀNH PHẦN': '🌿',
  'CÔNG NGHỆ': '🔬',
  'THIẾT KẾ': '🎨',
  'HƯỚNG DẪN': '💡',
  'SỬ DỤNG': '📖',
  'BẢO QUẢN': '🛡️',
  'BẢO HÀNH': '🎖️',
  'XUẤT XỨ': '🌍',
  'LƯU Ý': '⚠️',
  'CHÍNH SÁCH': '📜',
  'CAM KẾT': '✅',
  'MÔ TẢ': '📌',
  'CÂU HỎI': '❓',
  'FAQ': '❓',
  'DIỆT KHUẨN': '🧼',
  'TIẾT KIỆM': '💰',
  'VỆ SINH': '🧽'
};

export const getEmojiForHeading = (headingText: string): string => {
  const upper = headingText.toUpperCase();
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (upper.includes(key)) {
      return `${emoji} `;
    }
  }
  return '📌 ';
};

// Safe DOM parser helper (Browser DOMParser + Node fallback for tests/SSR)
function createDOMDocument(html: string): Document {
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const parser = new window.DOMParser();
    return parser.parseFromString(html, 'text/html');
  }
  if (typeof (globalThis as any).DOMParser !== 'undefined') {
    const parser = new (globalThis as any).DOMParser();
    return parser.parseFromString(html, 'text/html');
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    return dom.window.document;
  } catch (e) {
    throw new Error('Không tìm thấy trình phân tích cú pháp DOM (DOMParser/JSDOM).');
  }
}

/**
 * Hàm định dạng Beautify HTML chuẩn W3C:
 * - Thụt lề 2 spaces rõ ràng.
 * - Thẻ dòng đơn (p, h1-h6, li, td, th...) chứa text/inline được giữ gọn trên 1 dòng.
 * - TUYỆT ĐỐI KHÔNG xóa khoảng trắng giữa các thẻ inline (tránh dính chữ).
 */
export const beautifyHtml = (html: string): string => {
  if (!html || !html.trim()) return '';

  const blockTags = new Set([
    'html', 'head', 'body', 'div', 'section', 'article', 'header', 'footer',
    'ul', 'ol', 'li', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'blockquote', 'figure', 'figcaption', 'hr'
  ]);

  const containerTags = new Set([
    'div', 'section', 'article', 'header', 'footer',
    'ul', 'ol', 'table', 'thead', 'tbody', 'tfoot', 'tr',
    'blockquote', 'figure'
  ]);

  const doc = createDOMDocument(html);
  const body = doc.body;

  const serializeNode = (node: Node, indentLevel: number): string => {
    const indent = '  '.repeat(indentLevel);

    if (node.nodeType === 3) { // Text node
      const text = node.nodeValue || '';
      return text;
    }

    if (node.nodeType === 1) { // Element node
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // Void / self-closing tags
      if (tag === 'img') {
        return el.outerHTML;
      }
      if (tag === 'br') {
        return '<br>';
      }
      if (tag === 'hr') {
        return '<hr>';
      }

      // Check if this is a block container element (has block children)
      const hasBlockChildren = Array.from(el.childNodes).some(child => {
        return child.nodeType === 1 && blockTags.has((child as HTMLElement).tagName.toLowerCase());
      });

      // Format attributes
      const attrs = Array.from(el.attributes)
        .map(a => `${a.name}="${a.value}"`)
        .join(' ');
      const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
      const closeTag = `</${tag}>`;

      if (hasBlockChildren || containerTags.has(tag)) {
        // Multi-line container
        const childrenFormatted: string[] = [];
        el.childNodes.forEach(child => {
          if (child.nodeType === 3) {
            const txt = (child.nodeValue || '').trim();
            if (txt) {
              childrenFormatted.push('  '.repeat(indentLevel + 1) + `<p>${txt}</p>`);
            }
          } else if (child.nodeType === 1) {
            const res = serializeNode(child, indentLevel + 1);
            if (res) childrenFormatted.push(res);
          }
        });

        if (childrenFormatted.length === 0) {
          return `${indent}${openTag}${closeTag}`;
        }
        return `${indent}${openTag}\n${childrenFormatted.join('\n')}\n${indent}${closeTag}`;
      } else {
        // Leaf block element or inline element (p, h1-h6, li, td, th...)
        const inner = el.innerHTML.trim();
        if (blockTags.has(tag)) {
          return `${indent}${openTag}${inner}${closeTag}`;
        }
        return `${openTag}${inner}${closeTag}`;
      }
    }

    return '';
  };

  const lines: string[] = [];
  body.childNodes.forEach(node => {
    if (node.nodeType === 3) {
      const txt = (node.nodeValue || '').trim();
      if (txt) lines.push(`<p>${txt}</p>`);
    } else if (node.nodeType === 1) {
      const res = serializeNode(node, 0);
      if (res) lines.push(res);
    }
  });

  return lines.join('\n\n').trim();
};

/**
 * Hàm nén HTML thành 1 dòng (Minify)
 */
export const minifyHtml = (html: string): string => {
  return html
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+(<[a-zA-Z0-9_-]+)/g, '>$1')
    .replace(/(<\/[a-zA-Z0-9_-]+>)\s+</g, '$1<')
    .trim();
};

/**
 * Định dạng Clean Lines: Mỗi thẻ khối nằm trên 1 dòng riêng, không thụt lề sâu
 */
export const cleanLinesHtml = (html: string): string => {
  return beautifyHtml(html)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
};

/**
 * Tiền xử lý chuỗi HTML thô:
 * - Dỡ bỏ các ký tự escape \ trước thẻ HTML (\<h3>, \ <h3>, \</h3>, \<p>, \<div>)
 * - Khắc phục URL ảnh markdown bên trong thuộc tính src (src="![](url)")
 * - Chuyển đổi cú pháp ảnh Markdown ![alt](url) hoặc ![](url) sang thẻ <img> chuẩn
 */
export const preprocessRawHtml = (raw: string): string => {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw;
  // 1. Dỡ bỏ các ký tự escape \ trước thẻ HTML (VD: \<h3>, \ <h3>, \</h3>, \<p>, \<div>)
  s = s.replace(/\\+(\s*)(<[/a-zA-Z0-9])/g, '$2');
  s = s.replace(/\\+([<>/"])/g, '$1');

  // 2. Sửa lỗi thuộc tính src bị bọc cú pháp markdown
  s = s.replace(/src=["']!\[.*?\]\((https?:\/\/[^\s)"]+)\)["']/gi, 'src="$1"');

  // 3. Chuẩn hóa ảnh Markdown dạng ![alt](url) hoặc ![](url) thành thẻ <img>
  s = s.replace(/!\[(.*?)\]\((https?:\/\/[^\s)"]+)\)/g, '<img src="$2" alt="$1">');

  return s;
};

/**
 * Lọc style rác: Loại bỏ tất cả inline style của Shopee / Docs / Word,
 * chỉ giữ lại căn chỉnh text-align (center, right, justify) nếu có.
 */
export const cleanElementStyle = (styleAttr: string): string => {
  if (!styleAttr || !styleAttr.trim()) return '';
  const parts = styleAttr.split(';');
  const kept: string[] = [];
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = part.substring(0, colonIdx).trim().toLowerCase();
    const val = part.substring(colonIdx + 1).trim().toLowerCase();
    if (prop === 'text-align' && ['center', 'right', 'justify'].includes(val)) {
      kept.push(`${prop}: ${val}`);
    }
  }
  return kept.length ? kept.join('; ') + ';' : '';
};

/**
 * Engine chính: Tối ưu hóa & Làm sạch Cấu trúc HTML
 * Tuân thủ tuyệt đối: Không tự thêm/bớt thông tin, không thay đổi nội dung chữ.
 */
export const optimizeHtml = (
  rawHtml: string,
  userOptions: Partial<HtmlOptimizeOptions> = {}
): { html: string; stats: OptimizationStats } => {
  const options: HtmlOptimizeOptions = { ...DEFAULT_HTML_OPTIMIZE_OPTIONS, ...userOptions };

  let emptyTagsRemoved = 0;
  let divsUnwrapped = 0;
  let headingsFixedInList = 0;
  let imagesFound = 0;

  if (!rawHtml || typeof rawHtml !== 'string' || !rawHtml.trim()) {
    return {
      html: '',
      stats: {
        originalLength: 0,
        optimizedLength: 0,
        reductionPercentage: 0,
        emptyTagsRemoved: 0,
        divsUnwrapped: 0,
        headingsFixedInList: 0,
        imagesFound: 0
      }
    };
  }

  const originalLength = rawHtml.length;

  try {
    // Tiền xử lý: Unescape và chuẩn hóa ảnh Markdown
    const preprocessedHtml = preprocessRawHtml(rawHtml);
    const doc = createDOMDocument(preprocessedHtml);
    const body = doc.body;

    // 1. Xóa các thẻ rác/mã độc không thuộc nội dung (Scripts, Styles, Iframes, Meta, Links, Form inputs)
    const dangerousElements = body.querySelectorAll('script, style, iframe, meta, link, noscript, button, input, form, select, textarea');
    dangerousElements.forEach(el => {
      el.remove();
      emptyTagsRemoved++;
    });

    // 2. Sửa lỗi thẻ Heading (h1-h6) bị bọc nhầm toàn bộ khối nội dung (div, p, img, table...)
    const blockElementSelector = 'h1, h2, h3, h4, h5, h6, p, ul, ol, table, div, blockquote, hr, img, section, article';
    const allHeadings = Array.from(body.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    allHeadings.forEach(h => {
      if (h.querySelector(blockElementSelector)) {
        const parent = h.parentNode;
        if (!parent) return;

        const properH = doc.createElement(h.tagName);
        const nodesToEject: Node[] = [];
        let foundBlock = false;

        Array.from(h.childNodes).forEach(child => {
          const isBlock = child.nodeType === 1 && (
            (child as HTMLElement).matches(blockElementSelector) ||
            (child as HTMLElement).querySelector(blockElementSelector) !== null
          );
          if (!foundBlock && !isBlock) {
            properH.appendChild(child);
          } else {
            foundBlock = true;
            nodesToEject.push(child);
          }
        });

        // Nếu heading có chữ và bật boldHeadings: bọc strong nếu chưa có
        const headingText = (properH.textContent || '').trim();
        if (headingText && options.boldHeadings && !properH.querySelector('strong, b')) {
          properH.innerHTML = `<strong>${properH.innerHTML.trim()}</strong>`;
        }

        if (headingText || properH.children.length > 0) {
          parent.replaceChild(properH, h);
          const ref = properH.nextSibling;
          nodesToEject.forEach(node => parent.insertBefore(node, ref));
        } else {
          // Heading rỗng không có chữ trước block -> chỉ gỡ bỏ heading và giữ lại các con
          const ref = h.nextSibling;
          nodesToEject.forEach(node => parent.insertBefore(node, ref));
          h.remove();
        }
      } else if (options.boldHeadings) {
        // Heading đơn thông thường: nếu bật boldHeadings thì bọc strong nếu chưa có
        const headingText = (h.textContent || '').trim();
        if (headingText && !h.querySelector('strong, b')) {
          h.innerHTML = `<strong>${h.innerHTML.trim()}</strong>`;
        }
      }
    });

    // 3. Dọn dẹp thuộc tính và Style rác từ Shopee / Google Docs / Word
    if (options.cleanJunkStylesAndAttrs) {
      const allElements = Array.from(body.querySelectorAll('*'));
      allElements.forEach(el => {
        const styleAttr = el.getAttribute('style') || '';
        const classAttr = el.getAttribute('class') || '';
        const idAttr = el.getAttribute('id') || '';

        // Chuyển đổi style ngữ nghĩa cốt lõi sang thẻ chuẩn nếu chưa có
        const hasBold = /font-weight\s*:\s*(700|800|900|bold)/i.test(styleAttr);
        const hasItalic = /font-style\s*:\s*italic/i.test(styleAttr);
        const hasUnderline = /text-decoration\s*:\s*underline/i.test(styleAttr);
        const hasStrike = /text-decoration\s*:\s*(line-through|strike)/i.test(styleAttr);

        if (hasBold && el.tagName !== 'STRONG' && el.tagName !== 'B' && !el.closest('strong, b')) {
          el.innerHTML = `<strong>${el.innerHTML}</strong>`;
        }
        if (hasItalic && el.tagName !== 'EM' && el.tagName !== 'I' && !el.closest('em, i')) {
          el.innerHTML = `<em>${el.innerHTML}</em>`;
        }
        if (hasUnderline && el.tagName !== 'U' && !el.closest('u')) {
          el.innerHTML = `<u>${el.innerHTML}</u>`;
        }
        if (hasStrike && el.tagName !== 'S' && el.tagName !== 'DEL' && !el.closest('s, del')) {
          el.innerHTML = `<s>${el.innerHTML}</s>`;
        }

        // Xóa các class rác của Google Docs (c0, c1, c2, lst-kix_..., doc-content-item) hoặc MS Word (MsoNormal)
        if (classAttr) {
          const cleanedClasses = classAttr
            .split(/\s+/)
            .filter(cls => !/^c\d+$/i.test(cls) && !cls.startsWith('lst-kix') && !cls.includes('doc-content-item') && !cls.startsWith('Mso'))
            .join(' ')
            .trim();
          if (cleanedClasses) {
            el.setAttribute('class', cleanedClasses);
          } else {
            el.removeAttribute('class');
          }
        }

        // Xóa id rác của Google Docs (docs-internal-guid-...)
        if (idAttr && idAttr.startsWith('docs-internal-guid')) {
          el.removeAttribute('id');
        }

        // Dọn sạch toàn bộ style rác của Shopee/Docs/Word trên mọi thẻ
        if (styleAttr) {
          const cleanedStyle = cleanElementStyle(styleAttr);
          if (cleanedStyle) {
            el.setAttribute('style', cleanedStyle);
          } else {
            el.removeAttribute('style');
          }
        }
      });

      // Dỡ bỏ các thẻ <span> không còn bất kỳ thuộc tính nào (unwrap spans)
      let spanCleaned = true;
      let spanPasses = 0;
      while (spanCleaned && spanPasses < 10) {
        spanCleaned = false;
        spanPasses++;
        const allSpans = Array.from(body.querySelectorAll('span'));
        allSpans.forEach(span => {
          const hasAttr = span.getAttribute('class') || span.getAttribute('id') || span.getAttribute('style');
          if (!hasAttr) {
            const parent = span.parentNode;
            if (parent) {
              while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
              }
              span.remove();
              spanCleaned = true;
            }
          }
        });
      }
    }

    // 4. Dỡ bỏ các thẻ <div> lồng nhau vô nghĩa (Unwrap Divs)
    if (options.unwrapDivs) {
      let changed = true;
      let passes = 0;
      const blockSelector = 'h1, h2, h3, h4, h5, h6, p, ul, ol, table, div, blockquote, hr, img, section, article';

      while (changed && passes < 25) {
        changed = false;
        passes++;
        const allDivs = Array.from(body.querySelectorAll('div'));
        for (const div of allDivs) {
          const parent = div.parentNode;
          if (!parent) continue;

          // Nếu bật wrapInContainer và đây là div container chính
          if (options.wrapInContainer && div.getAttribute('class') === options.containerClass) {
            continue;
          }

          // Kiểm tra xem div có id hoặc class chức năng quan trọng cần giữ không
          const hasImportantAttrs = div.getAttribute('id') || (div.getAttribute('class') && div.getAttribute('class') !== options.containerClass);
          if (hasImportantAttrs) {
            continue;
          }

          const hasBlockChild = div.querySelector(blockSelector) !== null;
          const text = (div.textContent || '').replace(/\u00A0/g, ' ').trim();
          const hasMedia = div.querySelectorAll('img, video, iframe, table, svg').length > 0;

          if (!hasMedia && !text && div.children.length === 0) {
            div.remove();
            emptyTagsRemoved++;
            changed = true;
            continue;
          }

          if (hasBlockChild) {
            // Div chứa thẻ khối con hoặc img -> Dỡ bỏ div, đẩy con ra ngoài
            while (div.firstChild) {
              parent.insertBefore(div.firstChild, div);
            }
            div.remove();
            divsUnwrapped++;
            changed = true;
          } else {
            // Div chỉ chứa text hoặc inline tags -> Chuyển thành thẻ <p> để đúng chuẩn HTML
            const p = doc.createElement('p');
            while (div.firstChild) {
              p.appendChild(div.firstChild);
            }
            parent.replaceChild(p, div);
            divsUnwrapped++;
            changed = true;
          }
        }
      }

      // Gom các text node hoặc inline element trơ trọi trực tiếp ở root body vào <p>
      const bodyChildren = Array.from(body.childNodes);
      let inlineBuffer: Node[] = [];

      const flushInlineBuffer = () => {
        if (inlineBuffer.length > 0) {
          const hasContent = inlineBuffer.some(n => {
            if (n.nodeType === 3) return (n.nodeValue || '').trim().length > 0;
            if (n.nodeType === 1) return true;
            return false;
          });
          if (hasContent) {
            const p = doc.createElement('p');
            const ref = inlineBuffer[0];
            body.insertBefore(p, ref);
            inlineBuffer.forEach(n => p.appendChild(n));
          } else {
            inlineBuffer.forEach(n => n.parentNode?.removeChild(n));
          }
          inlineBuffer = [];
        }
      };

      bodyChildren.forEach(child => {
        if (child.nodeType === 3) {
          if ((child.nodeValue || '').trim()) {
            inlineBuffer.push(child);
          }
        } else if (child.nodeType === 1) {
          const tag = (child as HTMLElement).tagName.toLowerCase();
          const isBlock = /^(h[1-6]|p|ul|ol|table|div|blockquote|section|article|header|footer|hr|img)$/i.test(tag);
          if (isBlock) {
            flushInlineBuffer();
          } else {
            inlineBuffer.push(child);
          }
        }
      });
      flushInlineBuffer();
    }

    // 4. Sửa lỗi thẻ Heading nằm bên trong <li> (Chuẩn W3C: Heading không được nằm trong li)
    if (options.fixHeadingsInList) {
      const headingsInLi = body.querySelectorAll('li h1, li h2, li h3, li h4, li h5, li h6');
      headingsInLi.forEach(heading => {
        const parentLi = heading.closest('li');
        if (parentLi) {
          // Bảo toàn 100% nội dung (innerHTML), bọc trong <strong> hợp lệ
          const strong = doc.createElement('strong');
          strong.innerHTML = heading.innerHTML;
          heading.replaceWith(strong);
          headingsFixedInList++;
        }
      });
    }

    // 5. In đậm nhãn Key-Value (Chỉ chạy khi người dùng chủ động BẬT tùy chọn)
    if (options.boldKeyValueLabels) {
      const listItems = body.querySelectorAll('li');
      listItems.forEach(li => {
        const text = li.textContent?.trim() || '';
        const html = li.innerHTML.trim();
        if (text.includes(':') && !html.startsWith('<strong>') && !html.startsWith('<b>')) {
          const match = text.match(/^([^:]{2,40}):\s*(.+)$/);
          if (match) {
            const label = match[1].trim();
            const val = match[2].trim();
            li.innerHTML = `<strong>${label}:</strong> ${val}`;
          }
        }
      });
    }

    // 6. Xử lý & Tối ưu Thẻ Hình Ảnh (Images)
    // QUY TẮC: Tuyệt đối KHÔNG tự chế alt rác. Giữ alt gốc nếu có, hoặc để alt=""
    const validImages: HTMLImageElement[] = [];
    const allImgs = Array.from(body.querySelectorAll('img'));
    allImgs.forEach(img => {
      const src = img.getAttribute('src')?.trim();
      // Loại bỏ img không có src hoặc spacer pixel base64 1px rác
      if (!src || src === '' || src.includes('data:image/gif;base64') || src.includes('blank.gif') || src.includes('pixel.gif')) {
        img.remove();
        emptyTagsRemoved++;
        return;
      }

      imagesFound++;
      if (options.imageResponsive) {
        img.setAttribute('loading', 'lazy');
        img.removeAttribute('width');
        img.removeAttribute('height');
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
      }

      // Giữ alt gốc của người dùng nếu có, nếu chưa có thì để rỗng alt="" chuẩn W3C (KHÔNG BỊA TEXT)
      if (img.getAttribute('alt') === null) {
        img.setAttribute('alt', '');
      }

      validImages.push(img);
    });

    if (options.imageHandling === 'remove-all') {
      validImages.forEach(img => {
        const parent = img.parentElement;
        img.remove();
        if (parent && parent.tagName.toLowerCase() === 'p' && !parent.textContent?.trim()) {
          parent.remove();
          emptyTagsRemoved++;
        }
      });
    } else if (options.imageHandling === 'gather-at-bottom' && validImages.length > 0) {
      const imageContainer = doc.createElement('div');
      imageContainer.className = 'product-gallery-bottom';
      validImages.forEach(img => {
        const parent = img.parentElement;
        const cloned = img.cloneNode(true) as HTMLElement;
        const pWrapper = doc.createElement('p');
        pWrapper.className = 'product-image-block';
        pWrapper.appendChild(cloned);
        imageContainer.appendChild(pWrapper);

        img.remove();
        if (parent && parent.tagName.toLowerCase() === 'p' && !parent.textContent?.trim()) {
          parent.remove();
          emptyTagsRemoved++;
        }
      });
      body.appendChild(imageContainer);
    }

    // 7. Chuẩn hóa Headings (H1, H2, H3, H4, H5, H6)
    // QUY TẮC: Mặc định 'keep' giữ nguyên cấp độ. Nếu chuyển đổi thì bảo toàn 100% innerHTML.
    if (options.headingStyle !== 'keep') {
      const headings = Array.from(body.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      headings.forEach(h => {
        const text = h.textContent?.trim() || '';
        if (!text) {
          h.remove();
          emptyTagsRemoved++;
          return;
        }

        let emojiPrefix = '';
        if (options.autoAddEmoji) {
          emojiPrefix = getEmojiForHeading(text);
        }

        let newTag: HTMLElement;
        if (options.headingStyle === 'h4') {
          newTag = doc.createElement('h4');
        } else if (options.headingStyle === 'p-strong') {
          newTag = doc.createElement('p');
        } else if (options.headingStyle === 'p-b') {
          newTag = doc.createElement('p');
        } else {
          // Default H3
          newTag = doc.createElement('h3');
        }

        // Bảo toàn toàn bộ nội dung HTML con bên trong heading
        if (options.headingStyle === 'p-strong') {
          newTag.innerHTML = `<strong>${emojiPrefix}${h.innerHTML}</strong>`;
        } else if (options.headingStyle === 'p-b') {
          newTag.innerHTML = `<b>${emojiPrefix}${h.innerHTML}</b>`;
        } else {
          newTag.innerHTML = `${emojiPrefix}${h.innerHTML}`;
        }

        h.replaceWith(newTag);
      });
    }

    // 8. Dọn dẹp thẻ <br> dư thừa và liên tiếp
    if (options.cleanConsecutiveBreaks) {
      const allBr = Array.from(body.querySelectorAll('br'));
      allBr.forEach(br => {
        const parent = br.parentElement;
        // Nếu <br> đứng ở đầu hoặc cuối thẻ chứa nó (p, div, li)
        if (parent && /^(P|DIV|LI)$/i.test(parent.tagName)) {
          if (parent.firstElementChild === br || !br.previousSibling) {
            br.remove();
            emptyTagsRemoved++;
            return;
          }
          if (parent.lastElementChild === br || !br.nextSibling) {
            br.remove();
            emptyTagsRemoved++;
            return;
          }
        }

        // Xóa nhiều <br> liên tiếp (chỉ giữ 1)
        const next = br.nextElementSibling;
        if (next && next.tagName === 'BR') {
          next.remove();
          emptyTagsRemoved++;
        }
      });
    }

    // 9. Xóa các thẻ rỗng (Empty Tags) - Chạy nhiều vòng đến khi sạch
    if (options.removeEmptyTags) {
      let emptyCleaned = true;
      let passes = 0;
      while (emptyCleaned && passes < 8) {
        emptyCleaned = false;
        passes++;

        const elementsToCheck = Array.from(body.querySelectorAll('p, div, span, b, strong, i, em, u, s, h1, h2, h3, h4, h5, h6, li, ul, ol'));
        elementsToCheck.forEach(el => {
          const hasMedia = el.querySelectorAll('img, video, iframe, svg, table, hr').length > 0;
          const text = (el.textContent || '').replace(/\u00A0/g, ' ').trim();
          const inner = el.innerHTML.replace(/\u00A0/g, ' ').trim();

          // Nếu là thẻ danh sách ul/ol nhưng không còn thẻ li nào bên trong
          if ((el.tagName === 'UL' || el.tagName === 'OL') && el.querySelectorAll('li').length === 0) {
            el.remove();
            emptyTagsRemoved++;
            emptyCleaned = true;
            return;
          }

          if (!hasMedia && !text && (!inner || inner === '' || inner === '<br>' || inner === '<br/>' || inner === '&nbsp;')) {
            el.remove();
            emptyTagsRemoved++;
            emptyCleaned = true;
          }
        });
      }
    }

    let cleanedInnerHtml = body.innerHTML.trim();

    // 10. Bọc trong container nếu yêu cầu
    if (options.wrapInContainer) {
      const cls = options.containerClass ? ` class="${options.containerClass}"` : '';
      cleanedInnerHtml = `<div${cls}>\n${cleanedInnerHtml}\n</div>`;
    }

    // 11. Định dạng đầu ra
    let finalHtml = cleanedInnerHtml;
    if (options.outputFormat === 'minify') {
      finalHtml = minifyHtml(cleanedInnerHtml);
    } else if (options.outputFormat === 'clean-lines') {
      finalHtml = cleanLinesHtml(cleanedInnerHtml);
    } else {
      // Default: Beautify
      finalHtml = beautifyHtml(cleanedInnerHtml);
    }

    const optimizedLength = finalHtml.length;
    const reductionPercentage = originalLength > 0 
      ? Math.max(0, Math.round(((originalLength - optimizedLength) / originalLength) * 100))
      : 0;

    return {
      html: finalHtml,
      stats: {
        originalLength,
        optimizedLength,
        reductionPercentage,
        emptyTagsRemoved,
        divsUnwrapped,
        headingsFixedInList,
        imagesFound
      }
    };
  } catch (err) {
    console.error('HTML Optimizer error:', err);
    return {
      html: rawHtml,
      stats: {
        originalLength: rawHtml.length,
        optimizedLength: rawHtml.length,
        reductionPercentage: 0,
        emptyTagsRemoved: 0,
        divsUnwrapped: 0,
        headingsFixedInList: 0,
        imagesFound: 0
      }
    };
  }
};
