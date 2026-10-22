
export interface VariantGroup {
    name: string;
    image: string;
    images?: string[];
}

export interface ScrapedProductData {
    title: string;
    price?: string;
    color?: string;
    main: string[];
    variants: string[];
    variantNames?: Record<string, string>;
    variantGroups?: VariantGroup[];
    description: string[];
    videos: string[];
    descriptionText?: string;
    // For AI refinement
    fullMedia?: {url: string, position: number}[];
    colorGroups?: {name: string, startPos: number}[];
    sizeCharts?: string[];
    fullTextDescription?: string;
}

// Ensure every scraped product has structured variant groups if variants exist
export const ensureVariantGroups = (data: ScrapedProductData): ScrapedProductData => {
    if (!data) return data;
    
    const mainImages = data.main || [];

    // Collect ALL variant images across all groups and variants to prevent cross-contamination
    const allVariantImages = new Set<string>();
    if (data.variantGroups) {
        data.variantGroups.forEach(g => {
            if (g.image) allVariantImages.add(g.image);
            if (g.images) g.images.forEach(u => { if (u) allVariantImages.add(u); });
        });
    }
    if (data.variants) {
        data.variants.forEach(u => { if (u) allVariantImages.add(u); });
    }

    // Common non-variant images (poster, specifications, dimensions)
    const commonImages = mainImages.filter(u => !allVariantImages.has(u));

    // If variant groups already exist, sanitize and ensure each has valid images
    if (data.variantGroups && data.variantGroups.length > 0) {
        data.variantGroups = data.variantGroups.map((g, idx) => {
            const vImg = g.image || '';
            const existingImages = g.images && g.images.length > 0 ? g.images.filter(Boolean) : [];
            
            // Collect other variants' images that MUST NOT leak into this group
            const otherVariantImages = new Set<string>();
            data.variantGroups!.forEach(otherG => {
                if (otherG !== g) {
                    if (otherG.image) otherVariantImages.add(otherG.image);
                    if (otherG.images) otherG.images.forEach(u => { if (u) otherVariantImages.add(u); });
                }
            });

            // If this variant has its own dedicated gallery (> 1 images), isolate strictly
            let cleanDedicated: string[] = [];
            if (existingImages.length > 1) {
                cleanDedicated = existingImages.filter(u => !otherVariantImages.has(u));
            } else if (existingImages.length === 1) {
                cleanDedicated = [existingImages[0], ...commonImages.filter(u => !otherVariantImages.has(u))];
            } else if (vImg) {
                cleanDedicated = [vImg, ...commonImages.filter(u => !otherVariantImages.has(u))];
            } else {
                cleanDedicated = commonImages.filter(u => !otherVariantImages.has(u));
            }

            cleanDedicated = Array.from(new Set(cleanDedicated)).filter(Boolean);

            return {
                name: g.name || `Phân loại ${idx + 1}`,
                image: vImg || cleanDedicated[0] || '',
                images: cleanDedicated.length > 0 ? cleanDedicated : (vImg ? [vImg] : [])
            };
        });
        return data;
    }
    
    const variants = data.variants || [];
    if (variants.length === 0) {
        return data;
    }

    const variantNames = data.variantNames || {};

    const groupsMap = new Map<string, { name: string; image: string; images: string[] }>();
    variants.forEach((vUrl, idx) => {
        const name = variantNames[vUrl] || `Biến thể ${idx + 1}`;
        if (groupsMap.has(name)) {
            const g = groupsMap.get(name)!;
            if (!g.images.includes(vUrl)) g.images.push(vUrl);
        } else {
            groupsMap.set(name, {
                name,
                image: vUrl,
                images: Array.from(new Set([vUrl, ...commonImages])).filter(Boolean)
            });
        }
    });

    if (groupsMap.size > 0) {
        data.variantGroups = Array.from(groupsMap.values());
    }

    return data;
};

// Split a multi-variant product into individual product rows (1 row per variant)
export const splitProductIntoVariantRows = (
    product: ScrapedProductData,
    baseUrl: string
): ScrapedProductData[] => {
    if (!product) return [];

    const variantGroups = product.variantGroups && product.variantGroups.length > 0 
        ? product.variantGroups 
        : (product.variants && product.variants.length > 0 
            ? product.variants.map((vUrl, idx) => ({
                name: product.variantNames?.[vUrl] || `Phân loại ${idx + 1}`,
                image: vUrl,
                images: [vUrl]
            }))
            : []);

    if (variantGroups.length <= 1) {
        return [product];
    }

    // Collect all variant images across ALL groups to prevent cross-contamination
    const allVariantImageUrls = new Set<string>();
    variantGroups.forEach(g => {
        if (g.image) allVariantImageUrls.add(g.image);
        if (g.images) g.images.forEach(u => { if (u) allVariantImageUrls.add(u); });
    });

    // Common non-variant images (e.g. general poster, dimensions, specs)
    const commonImages = (product.main || []).filter(u => !allVariantImageUrls.has(u));
    const baseTitle = product.title || 'Sản phẩm';

    return variantGroups.map((g, idx) => {
        const vName = g.name || `Phân loại ${idx + 1}`;
        const vImage = g.image || (g.images && g.images[0]) || '';
        
        // Find other variants' images that must NEVER leak into this variant
        const otherVariantsImageUrls = new Set<string>();
        variantGroups.forEach(otherG => {
            if (otherG !== g) {
                if (otherG.image) otherVariantsImageUrls.add(otherG.image);
                if (otherG.images) otherG.images.forEach(u => { if (u) otherVariantsImageUrls.add(u); });
            }
        });

        // Dedicated images for this variant:
        // If variant already has its own dedicated gallery (> 1 images), isolate strictly!
        // If it only has 1 swatch image, combine with common non-variant images (e.g. specs).
        let dedicatedMain: string[] = [];
        if (g.images && g.images.length > 1) {
            dedicatedMain = g.images.filter(u => !otherVariantsImageUrls.has(u));
        } else if (vImage) {
            dedicatedMain = [
                vImage,
                ...((g.images || []).filter(u => !otherVariantsImageUrls.has(u) && u !== vImage)),
                ...commonImages.filter(u => !otherVariantsImageUrls.has(u))
            ];
        } else {
            dedicatedMain = (g.images || []).filter(u => !otherVariantsImageUrls.has(u));
        }

        dedicatedMain = Array.from(new Set(dedicatedMain)).filter(Boolean);

        return {
            ...product,
            title: baseTitle.toLowerCase().includes(vName.toLowerCase()) ? baseTitle : `${baseTitle} - ${vName}`,
            color: vName,
            main: dedicatedMain.length > 0 ? dedicatedMain : (vImage ? [vImage] : (product.main || [])),
            variants: vImage ? [vImage] : [],
            variantNames: vImage ? { [vImage]: vName } : undefined,
            variantGroups: [{
                name: vName,
                image: vImage,
                images: dedicatedMain
            }],
            description: product.description || [],
            videos: product.videos || [],
            price: product.price
        };
    });
};

export const parseShopeeRawHtml = (html: string): ScrapedProductData => {
    let title = 'Sản phẩm từ Mã Nguồn';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (titleMatch) {
        title = titleMatch[1].replace(/ - Shopee Việt Nam$/i, '').replace(/ \| Shopee Việt Nam$/i, '').trim();
    }

    const badgeIds = new Set<string>();
    const badgeMatches = html.match(/class=[\"'][^\"']*C0zfAk[^\"']*[\"'][^>]*src=[\"']([^\"']+)[\"']/gi) || [];
    badgeMatches.forEach((b: string) => {
        const m = b.match(/file\/([a-zA-Z0-9-_.]{15,})/);
        if (m) badgeIds.add(m[1]);
    });

    const mainImages = new Set<string>();
    const variantImages = new Set<string>();
    const variantNames: Record<string, string> = {};
    const extractedGroupsMap = new Map<string, { name: string; image: string }>();

    const parseJsonKey = (key: string) => {
        const idx = html.indexOf(`"${key}"`);
        if (idx === -1) return null;
        const startBracket = html.indexOf("[", idx);
        if (startBracket === -1) return null;
        let depth = 0, inString = false, escape = false;
        for (let i = startBracket; i < html.length; i++) {
            const char = html[i];
            if (escape) { escape = false; continue; }
            if (char === "\\") { escape = true; continue; }
            if (char === "\"" && !escape) { inString = !inString; continue; }
            if (!inString) {
                if (char === "[") depth++;
                else if (char === "]") {
                    depth--;
                    if (depth === 0) {
                        try { return JSON.parse(html.substring(startBracket, i + 1)); } catch (_) { return null; }
                    }
                }
            }
        }
        return null;
    };

    const tiers = parseJsonKey("tier_variations");
    if (Array.isArray(tiers)) {
        tiers.forEach((tier: any) => {
            const opts = Array.isArray(tier.options) ? tier.options : [];
            const imgs = Array.isArray(tier.images) ? tier.images : [];
            opts.forEach((optName: string, idx: number) => {
                const cleanOpt = typeof optName === 'string' ? optName.trim() : '';
                if (cleanOpt) {
                    const rawImgId = imgs[idx] || '';
                    const imgId = typeof rawImgId === 'string' ? rawImgId.trim() : '';
                    const fullU = (imgId && !isShopeePromotionalOverlay(imgId) && !badgeIds.has(imgId))
                        ? `https://down-vn.img.susercontent.com/file/${imgId}`
                        : '';
                    if (fullU) {
                        variantImages.add(fullU);
                        variantNames[fullU] = cleanOpt;
                    }
                    if (!extractedGroupsMap.has(cleanOpt)) {
                        extractedGroupsMap.set(cleanOpt, { name: cleanOpt, image: fullU });
                    }
                }
            });
        });
    }

    const models = parseJsonKey("models");
    if (Array.isArray(models)) {
        models.forEach((m: any) => {
            const mName = typeof m.name === 'string' ? m.name.trim() : (typeof m.model_name === 'string' ? m.model_name.trim() : '');
            if (mName) {
                const rawImg = m.image || m.extinfo?.image || '';
                const cleanImg = typeof rawImg === 'string' ? rawImg.trim() : '';
                const fullU = (cleanImg && !isShopeePromotionalOverlay(cleanImg) && !badgeIds.has(cleanImg))
                    ? `https://down-vn.img.susercontent.com/file/${cleanImg}`
                    : '';
                if (fullU) {
                    variantImages.add(fullU);
                }

                // Match with existing parent tier group instead of listing flat
                let matchedGroup: { name: string; image: string } | undefined = undefined;
                for (const g of extractedGroupsMap.values()) {
                    if (mName.toLowerCase().includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(mName.toLowerCase())) {
                        matchedGroup = g;
                        break;
                    }
                }

                if (matchedGroup) {
                    if (!matchedGroup.image && fullU) {
                        matchedGroup.image = fullU;
                    }
                    if (fullU && !variantNames[fullU]) {
                        variantNames[fullU] = matchedGroup.name;
                    }
                } else if (extractedGroupsMap.size === 0) {
                    // Only add as new group if no tier_variations exist
                    const parts = mName.split(/[,/\\|-]/).map((s: string) => s.trim()).filter(Boolean);
                    const groupKey = parts[0] || mName;
                    const existing = extractedGroupsMap.get(groupKey);
                    if (existing) {
                        if (!existing.image && fullU) existing.image = fullU;
                    } else {
                        extractedGroupsMap.set(groupKey, { name: groupKey, image: fullU });
                    }
                    if (fullU) variantNames[fullU] = groupKey;
                }
            }
        });
    }

    // Collect all images in the HTML
    const allMatches = (html.match(/(?:cf\.shopee\.vn\/file\/|down-vn\.img\.susercontent\.com\/file\/)([a-zA-Z0-9-_.]{15,})/g) || []) as string[];
    allMatches.forEach((m: string) => {
        const cleanId = m.replace(/^.*\/file\//, '').split('@')[0].replace(/\.webp$/, '').replace(/["'\\]/g, '').trim();
        if (cleanId && cleanId.length > 10 && !cleanId.includes('<') && !cleanId.includes('>') && !badgeIds.has(cleanId) && !isShopeePromotionalOverlay(cleanId)) {
            const fullU = `https://down-vn.img.susercontent.com/file/${cleanId}`;
            if (!variantImages.has(fullU)) {
                mainImages.add(fullU);
            }
        }
    });

    const cleanMain = Array.from(mainImages);
    const cleanVariants = Array.from(variantImages);

    let variantGroups: VariantGroup[] = [];
    if (extractedGroupsMap.size > 0) {
        variantGroups = Array.from(extractedGroupsMap.values()).map(g => {
            const vImg = g.image || cleanVariants[0] || cleanMain[0] || '';
            return {
                name: g.name,
                image: vImg,
                images: Array.from(new Set([vImg, ...cleanMain])).filter(Boolean)
            };
        });
    } else if (cleanVariants.length > 0) {
        variantGroups = cleanVariants.map((vUrl, idx) => ({
            name: variantNames[vUrl] || `Phân loại ${idx + 1}`,
            image: vUrl,
            images: Array.from(new Set([vUrl, ...cleanMain])).filter(Boolean)
        }));
    }

    return {
        title,
        main: cleanMain.length > 0 ? cleanMain : cleanVariants,
        variants: cleanVariants,
        variantNames: Object.keys(variantNames).length > 0 ? variantNames : undefined,
        variantGroups: variantGroups.length > 0 ? variantGroups : undefined,
        description: [],
        videos: []
    };
};

// List of proxies to try in sequence
const PROXIES = [
    (url: string) => `${typeof window !== 'undefined' ? '' : 'http://localhost:3000'}/api/proxy?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// Cross-environment HTML parser (works in both Browser and Node.js)
const getDOMDocument = (html: string): Document => {
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        return parser.parseFromString(html, 'text/html');
    }
    try {
        // Node.js fallback
        const { JSDOM } = require('jsdom');
        return new JSDOM(html).window.document;
    } catch (e) {
        throw new Error("HTML Parser not available in current runtime");
    }
};

export const fetchWithFallback = async (url: string, type: 'json' | 'text', customHeaders: Record<string, string> = {}): Promise<any> => {
    let lastError: any = null;
    for (const proxy of PROXIES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

            let proxyUrl = proxy(url);
            // Only add cache buster to the proxy request if target site doesn't reject query parameters (e.g. Sunhouse IIS returns 403 on arbitrary query params)
            if (!url.includes('sunhouse.com.vn')) {
                proxyUrl += (proxyUrl.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
            }
            
            const response = await fetch(proxyUrl, { 
                signal: controller.signal,
                headers: {
                    'Accept': type === 'json' ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    ...customHeaders
                }
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Status ${response.status}`);

            if (type === 'json') {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            lastError = error;
            continue; // Try next proxy
        }
    }
    console.warn("All proxies failed for URL:", url, lastError?.message || lastError);
    return null;
};

// Helper to classify image elements by 'data-image-type', 'data-type', 'data-role', 'data-purpose' attributes
export const classifyImageElementByAttributes = (el: Element): boolean => {
    if (!el) return true;
    
    // 1. Check data-image-type and related attributes
    const imageType = (
        el.getAttribute('data-image-type') ||
        el.getAttribute('data-type') ||
        el.getAttribute('data-role') ||
        el.getAttribute('data-purpose') ||
        el.getAttribute('data-category') ||
        ''
    ).toLowerCase().trim();

    if (imageType) {
        if (['logo', 'site-logo', 'brand-logo', 'company-logo', 'icon', 'ui-icon', 'avatar', 'badge', 'sticker', 'overlay', 'banner', 'footer', 'header', 'social', 'payment', 'rating', 'star'].includes(imageType)) {
            return false;
        }
        if (['product', 'gallery', 'primary', 'main', 'variant', 'feature', 'hero', 'zoom', 'detail', 'content'].includes(imageType)) {
            return true;
        }
    }

    // 2. Check src, alt, class attributes for banned keywords
    const src = (el.getAttribute('data-src') || el.getAttribute('src') || '').toLowerCase();
    const alt = (el.getAttribute('alt') || '').toLowerCase();
    const className = (el.getAttribute('class') || '').toLowerCase();

    const bannedKeywords = [
        'logo', 'favicon', 'banner', 'icon', 'payment', 'avatar', 'badge', 
        'info.svg', 'puzzle.svg', 'star', 'rating', 'social', 'widget', 
        'placeholder', 'sprite', 'button', 'arrow', 'close', 'menu'
    ];

    if (bannedKeywords.some(k => src.includes(k) || alt.includes(k) || className.includes(k))) {
        return false;
    }

    return true;
};

// Helper to detect and filter out Shopee promotional overlay frames, badges (Voucher Xtra, Freeship Xtra, Shopee Mall, etc.)
export const isShopeePromotionalOverlay = (urlOrId: string): boolean => {
    if (!urlOrId || typeof urlOrId !== 'string') return false;
    const str = urlOrId.trim().toLowerCase();
    // 1. Shopee platform marketing bucket 11134258 (Voucher Xtra, Freeship Xtra, Mall frames, Hoàn xu Xtra, etc.)
    if (str.includes('11134258')) return true;
    // 2. Specific known voucher extra / promo frame IDs
    if (str.includes('mmpn5o534ft15b') || str.includes('mtclqut2p154c1') || str.includes('mrfmmsxpi3nq8a-frame')) return true;
    // 3. Keywords often in badge URLs, SVGs, or frame assets
    if (str.includes('voucher') || str.includes('xtra') || str.includes('badge') || str.includes('freeship') || str.includes('overlay') || str.includes('promo_frame')) return true;
    // 4. Shopee UI promo assets, svgs, or icons
    if (str.includes('productdetailspage') || str.includes('421d93895226dfa2') || str.includes('84fbad6e8cc150fb') || str.includes('b46a62a6fd61dbe6')) return true;
    return false;
};

const constructShopeeImageUrl = (id: string) => `https://down-vn.img.susercontent.com/file/${id}`;

// Helper to intelligently separate Shopee Main Gallery vs Variant Images from list of image URLs
export const separateShopeeUrls = (urls: string[]): { main: string[]; variants: string[] } => {
    if (urls.length <= 1) return { main: urls, variants: [] };

    const cleanKeys = urls.map(u => {
        const id = u.replace(/^.*\/file\//, '').split('@')[0].replace(/\.webp$/, '').trim();
        const parts = id.split('-');
        return parts.length >= 4 ? parts.slice(3).join('-') : id;
    });

    let splitIndex = -1;
    const basePrefix = cleanKeys[1]?.substring(0, 5);
    if (basePrefix) {
        let mainEnd = 1;
        while (mainEnd < cleanKeys.length && cleanKeys[mainEnd].startsWith(basePrefix)) {
            mainEnd++;
        }
        if (mainEnd < cleanKeys.length && mainEnd >= 2) {
            splitIndex = mainEnd;
        }
    }

    if (splitIndex === -1 && urls.length > 9) {
        splitIndex = 8;
    }

    if (splitIndex !== -1 && splitIndex < urls.length) {
        return {
            main: urls.slice(0, splitIndex),
            variants: urls.slice(splitIndex)
        };
    }

    return { main: urls, variants: [] };
};

// Intelligently infer or detect variant option names from title and specs
export const detectShopeeVariantNames = (title: string, count: number): string[] => {
    if (count <= 0) return [];
    const result: string[] = [];
    
    const storageMatches = title.match(/\b\d+(\+\d+)?(GB|TB)\b/gi) || [];
    const uniqueStorages = Array.from(new Set(storageMatches.map(s => s.toUpperCase())));
    
    const knownColors = ['Tím', 'Trắng', 'Đen', 'Xanh', 'Vàng', 'Hồng', 'Xám', 'Bạc', 'Đỏ', 'Cam', 'Nâu', 'Rêu', 'Purple', 'White', 'Black', 'Blue', 'Green', 'Gold', 'Silver', 'Pink'];
    const titleColors = knownColors.filter(c => new RegExp(`(^|[\\s,|/(-])${c}([\\s,|/)-]|$)`, 'i').test(title));
    
    if (uniqueStorages.length > 0 && count % uniqueStorages.length === 0) {
        const numColors = count / uniqueStorages.length;
        let colors: string[] = [];
        if (titleColors.length === numColors) {
            colors = titleColors;
        } else if (numColors === 2) {
            colors = ['Trắng', 'Đen'];
        } else if (numColors === 3) {
            colors = ['Tím', 'Trắng', 'Đen'];
        } else if (numColors === 4) {
            colors = ['Tím', 'Trắng', 'Đen', 'Xanh'];
        } else {
            colors = Array.from({ length: numColors }, (_, i) => `Màu ${i + 1}`);
        }
        
        uniqueStorages.forEach(st => {
            colors.forEach(col => {
                result.push(`${col} (${st})`);
            });
        });
    }
    
    if (result.length === count) return result;
    if (titleColors.length === count) return titleColors;

    return Array.from({ length: count }, (_, i) => `Phân loại ${i + 1}`);
};

export const extractShopeeIds = (url: string) => {
    const regexStandard = /-i\.(\d+)\.(\d+)/;
    const matchStandard = url.match(regexStandard);
    if (matchStandard) return { shopId: matchStandard[1], itemId: matchStandard[2] };

    const regexProduct = /product\/(\d+)\/(\d+)/;
    const matchProduct = url.match(regexProduct);
    if (matchProduct) return { shopId: matchProduct[1], itemId: matchProduct[2] };

    const shopIdParam = url.match(/[?&]shopid=(\d+)/);
    const itemIdParam = url.match(/[?&]itemid=(\d+)/);
    if (shopIdParam && itemIdParam) return { shopId: shopIdParam[1], itemId: itemIdParam[1] };

    return null;
};

const scrapeShopee = async (url: string): Promise<ScrapedProductData | null> => {
    let serverData: ScrapedProductData | null = null;
    // METHOD 1: Try dedicated Server Scraper
    try {
        const endpoint = (typeof window !== 'undefined' ? '' : 'http://localhost:3000') + '/api/shopee/scrape';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (response.ok) {
            const resJson = await response.json();
            if (resJson && resJson.success && resJson.data) {
                serverData = resJson.data;
                if (Array.isArray(serverData.main)) {
                    serverData.main = serverData.main.filter((u: string) => !isShopeePromotionalOverlay(u));
                }
                if (Array.isArray(serverData.variants)) {
                    serverData.variants = serverData.variants.filter((u: string) => !isShopeePromotionalOverlay(u));
                }
                if (Array.isArray(serverData.description)) {
                    serverData.description = serverData.description.filter((u: string) => !isShopeePromotionalOverlay(u));
                }
            }
        }
    } catch (err) {
        console.warn("Server-side Shopee scrape endpoint fallback:", err);
    }

    // If server succeeded and has variants/groups, return it directly
    if (serverData && ((serverData.variantGroups && serverData.variantGroups.length > 0) || (serverData.variants && serverData.variants.length > 0))) {
        return ensureVariantGroups(serverData);
    }

    // METHOD 2: Fallback to Client HTML Parsing via Proxy (bypasses cloud IP blocking for tier_variations)
    try {
        const html = await fetchWithFallback(url, 'text');
        if (html) {
            const clientData = parseShopeeRawHtml(html);
            if (serverData) {
                if (clientData.variantGroups && clientData.variantGroups.length > 0) {
                    serverData.variantGroups = clientData.variantGroups;
                }
                if (clientData.variantNames) {
                    serverData.variantNames = clientData.variantNames;
                }
                if (clientData.variants && clientData.variants.length > 0) {
                    serverData.variants = Array.from(new Set([...(serverData.variants || []), ...clientData.variants]));
                }
                return ensureVariantGroups(serverData);
            }
            if (clientData.main.length > 0 || clientData.variants.length > 0 || (clientData.variantGroups && clientData.variantGroups.length > 0)) {
                return ensureVariantGroups(clientData);
            }
        }
    } catch (e) {
        console.warn("Client fallback Shopee HTML parsing error:", e);
    }

    if (serverData) return ensureVariantGroups(serverData);

    return null;
};

// --- TIKI LOGIC ---
const scrapeTiki = async (url: string): Promise<ScrapedProductData | null> => {
    const spidMatch = url.match(/spid=(\d+)/);
    const pidMatch = url.match(/-p(\d+)\.html/);
    const productId = spidMatch ? spidMatch[1] : (pidMatch ? pidMatch[1] : null);
    
    if (productId) {
        const apiUrl = `https://tiki.vn/api/v2/products/${productId}`;
        const data = await fetchWithFallback(apiUrl, 'json');
        
        if (data) {
            const result: ScrapedProductData = {
                title: data.name || 'Tiki Product',
                price: data.price ? `${data.price}` : undefined,
                main: [],
                variants: [],
                variantNames: {},
                description: [],
                videos: []
            };

            if (data.images) {
                result.main = data.images.map((img: any) => img.base_url || img.large_url).filter(Boolean);
            }

            if (Array.isArray(data.configurable_options)) {
                data.configurable_options.forEach((opt: any) => {
                    (opt.values || []).forEach((val: any) => {
                        const img = val.image_url;
                        if (img && !result.variants.includes(img)) {
                            result.variants.push(img);
                            result.variantNames![img] = val.label || val.name || opt.name;
                        }
                    });
                });
            }
            if (Array.isArray(data.configurable_products)) {
                data.configurable_products.forEach((cp: any) => {
                    const cImg = cp.thumbnail_url || (cp.images && cp.images[0]?.base_url);
                    if (cImg) {
                        if (!result.variants.includes(cImg)) result.variants.push(cImg);
                        if (cp.name) result.variantNames![cImg] = cp.name;
                    }
                });
            }
            
            if (data.description) {
                 const urls = data.description.match(/https?:\/\/[^"]+/g);
                 if (urls) {
                     result.description = urls.filter((u: string) => u.includes('.jpg') || u.includes('.png') || u.includes('.webp'));
                 }
            }
            return ensureVariantGroups(result);
        }
    }
    
    // Fallback: Try parsing HTML for og:image or gallery
    const html = await fetchWithFallback(url, 'text');
    if (html) {
        const result: ScrapedProductData = { title: 'Tiki Product', main: [], variants: [], description: [], videos: [] };
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        if (titleMatch) result.title = titleMatch[1].replace(' | Tiki', '');

        const galleryRegex = /https:\/\/salt\.tikicdn\.com\/cache\/w\d+\/ts\/product\/[a-z0-9\/]+\.jpg/g;
        const galleryMatches = html.match(galleryRegex);
        if (galleryMatches) {
            result.main = Array.from(new Set(galleryMatches as string[])).map(u => u.replace(/\/cache\/w\d+/, ''));
        }
        if (result.main.length > 0) return result;
    }

    return null;
};

// --- LAZADA LOGIC ---
const scrapeLazada = async (url: string): Promise<ScrapedProductData | null> => {
    const html = await fetchWithFallback(url, 'text');
    if (!html) return null;

    const result: ScrapedProductData = { title: 'Lazada Product', main: [], variants: [], description: [], videos: [] };
    
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    if (titleMatch) result.title = titleMatch[1];

    // High res images pattern from JSON-like structures in HTML
    const highResPattern = /https:\/\/[^"]+(?:sw|alicdn)\.com[^"]+(?:_1200x1200q80|original)\.jpg/g;
    const matches = html.match(highResPattern);
    
    if (matches) {
        result.main = Array.from(new Set(matches as string[]));
    } else {
        // Fallback pattern
        const broadPattern = /https:\/\/[^"]+(?:sw|alicdn)\.com[^"]+\.(jpg|png)/g;
        const broadMatches = html.match(broadPattern);
        if (broadMatches) {
            const candidates = (broadMatches as string[]).filter(u => !u.includes('icon') && !u.includes('banner') && !u.includes('logo'));
            result.main = Array.from(new Set(candidates))
                .map(u => u.replace(/_\d+x\d+q\d+\.jpg_.webp/, '').replace(/_\d+x\d+q\d+\.jpg/, ''));
        }
    }
    
    // Attempt to extract video
    const videoPattern = /https:\/\/[^"]+lazada\.com[^"]+\.mp4/g;
    const videoMatches = html.match(videoPattern);
    if (videoMatches) {
        result.videos = Array.from(new Set(videoMatches as string[]));
    }

    return result.main.length > 0 ? result : null;
}

// --- SHOPIFY LOGIC ---
const scrapeShopify = async (url: string): Promise<ScrapedProductData[] | null> => {
    try {
        const baseUrl = url.split('?')[0];
        const apiUrl = `${baseUrl}.js`;
        const data = await fetchWithFallback(apiUrl, 'json', {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
        });
        
        if (!data || (!data.media && !data.images)) return null;
        
        let colorOptionIndex = -1;
        if (data.options) {
            const opt = data.options.find((o: any) => o.name && (o.name.toLowerCase().includes('màu') || o.name.toLowerCase().includes('color') || o.name.toLowerCase().includes('colour') || o.name === 'Màu Sắc'));
            if (opt) colorOptionIndex = opt.position;
        }

        const colorsMap = new Map();
        if (data.variants && data.variants.length > 0) {
            for (const variant of data.variants) {
                let color = 'Default';
                if (colorOptionIndex === 1) color = variant.option1;
                else if (colorOptionIndex === 2) color = variant.option2;
                else if (colorOptionIndex === 3) color = variant.option3;
                else if (variant.title) color = variant.title.split('/')[0].trim();
                
                if (!colorsMap.has(color)) {
                    colorsMap.set(color, variant);
                }
            }
        }
        
        if (colorsMap.size === 0) {
            colorsMap.set('Default', null);
        }

        const results: ScrapedProductData[] = [];
        
        // Find size charts for ash.vn
        let sizeCharts: string[] = [];
        if (url.includes('ash.vn')) {
            const cleanUrlForHtml = url.split('#')[0];
            const html = await fetchWithFallback(cleanUrlForHtml, 'text').catch(() => null);
            if (html) {
                // More comprehensive image regex for Shopify (including lazy loading attributes)
                const broadImageRegex = /<img[^>]+(?:src|data-src|srcset|data-srcset|data-lazy-src)="([^"> ]+)"/g;
                let match;
                const candidates = [];
                // Keywords from user feedback and common patterns
                const sizeChartKeywords = ['size', 'bang', 'so-do', 'nike_n', 'nike_m', 'nike_w', 'bang-size', 'kich-thuoc', 'quy-doi', 'measurement', 'chart'];
                
                while ((match = broadImageRegex.exec(html)) !== null) {
                    let src = match[1].split(' ')[0]; // Take first item if it's a srcset
                    if (!src || src.startsWith('data:')) continue;
                    
                    const lowerSrc = src.toLowerCase();
                    // Based on user provided URL: .../files/nike_n.png
                    if (lowerSrc.includes('/files/') && !lowerSrc.includes('logo') && !lowerSrc.includes('banner') && !lowerSrc.includes('icon')) {
                        const isSizeChart = sizeChartKeywords.some(kw => lowerSrc.includes(kw));
                        if (isSizeChart) {
                            if (src.startsWith('//')) src = 'https:' + src;
                            else if (src.startsWith('/')) src = 'https://ash.vn' + src;
                            else if (!src.startsWith('http')) src = 'https://' + src;
                            
                            // Map to cdn.shopify.com if it's from ash.vn/cdn/shop/files
                            src = src.replace(/https?:\/\/([^\/]+)\/cdn\/shop\/files\//, 'https://cdn.shopify.com/s/files/1/0572/8603/3595/files/');
                            
                            candidates.push(src);
                        }
                    }
                }
                sizeCharts = Array.from(new Set(candidates));
                console.log(`Found ${sizeCharts.length} size charts for ash.vn`);
            }
        }

        const fullMedia = (data.media || []).map((m: any) => ({
            url: (m.src || m.preview_image?.src || "").startsWith('http') ? (m.src || m.preview_image?.src) : 'https:' + (m.src || m.preview_image?.src),
            position: m.position
        })).filter((m: any) => m.url);

        const colorGroups = Array.from(colorsMap.entries()).map(([name, variant]) => ({
            name,
            startPos: variant?.featured_image?.position || 0
        })).filter(c => c.startPos > 0);

        const allPositions = (data.variants || [])
            .map((v: any) => v.featured_image?.position)
            .filter(Boolean);
        const uniquePositions = Array.from(new Set(allPositions)) as number[];
        uniquePositions.sort((a, b) => a - b);
        
        const varImages = (data.variants || [])
            .map((v: any) => v.featured_image?.src || (v.featured_image && v.featured_image.preview_image?.src))
            .map((src: string) => src ? (src.startsWith('http') ? src : 'https:' + src) : '')
            .filter(Boolean);
        const uniqueVarImages = Array.from(new Set(varImages)) as string[];

        // Extract description images from data.description HTML
        let descriptionImages: string[] = [];
        if (data.description && typeof data.description === 'string') {
            const imgRegex = /(?:src|data-src)="([^"]+)"/gi;
            let match;
            const foundDescUrls = [];
            while ((match = imgRegex.exec(data.description)) !== null) {
                let src = match[1];
                if (src && !src.startsWith('data:')) {
                    if (src.startsWith('//')) src = 'https:' + src;
                    else if (src.startsWith('/')) {
                        try {
                            const parsedUrl = new URL(url);
                            src = parsedUrl.origin + src;
                        } catch (e) {
                            src = 'https:' + src;
                        }
                    }
                    foundDescUrls.push(src);
                }
            }
            descriptionImages = Array.from(new Set(foundDescUrls));
        }

        for (const [colorName, selectedVariant] of colorsMap.entries()) {
             const result: ScrapedProductData = {
                 title: data.title || 'Shopify Product',
                 price: data.price ? `${data.price / 100}` : undefined,
                 color: colorName === 'Default' ? undefined : colorName,
                 main: [],
                 variants: uniqueVarImages,
                 description: descriptionImages,
                 videos: [],
                 fullMedia,
                 colorGroups,
                 sizeCharts
             };
             
             if (selectedVariant && selectedVariant.featured_image && data.media) {
                 const startPos = selectedVariant.featured_image.position;
                 let endPos = data.media.length + 1; 
                 
                 const nextIdx = uniquePositions.indexOf(startPos) + 1;
                 if (nextIdx < uniquePositions.length) {
                     endPos = uniquePositions[nextIdx];
                 }
                 
                 const colorMedia = data.media.filter((m: any) => m.position >= startPos && m.position < endPos);
                 
                 result.main = colorMedia.map((m: any) => m.src || (m.preview_image && m.preview_image.src))
                     .map((src: string) => src ? (src.startsWith('http') ? src : 'https:' + src) : '')
                     .filter(Boolean);
                 
                 if (sizeCharts.length > 0) {
                     result.main = [...result.main, ...sizeCharts];
                 }
             } else if (data.media) {
                 result.main = data.media.map((m: any) => m.src || (m.preview_image && m.preview_image.src)).filter(Boolean).map((src: string) => src.startsWith('http') ? src : 'https:' + src);
                 if (sizeCharts.length > 0) result.main = [...result.main, ...sizeCharts];
             } else if (data.images) {
                 result.main = data.images.map((src: string) => src.startsWith('http') ? src : 'https:' + src);
                 if (sizeCharts.length > 0) result.main = [...result.main, ...sizeCharts];
             }
             
             results.push(result);
        }
        
        return results.length > 0 ? results : null;
    } catch (e) {
        console.warn("Shopify extraction failed:", e);
        return null;
    }
};

// --- SUNHOUSE LOGIC ---

const scrapeFujihome = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const html = await fetchWithFallback(url, 'text');
        if (!html) return null;
        const doc = getDOMDocument(html);

        const titleEl = doc.querySelector('title');
        const title = titleEl ? titleEl.textContent?.replace('FUJIHOME', '').trim() || 'Sản phẩm Fujihome' : 'Sản phẩm Fujihome';

        const mainImages: string[] = [];
        const thumbnailLinks = doc.querySelectorAll('a.thumbnail');
        thumbnailLinks.forEach(a => {
            const href = a.getAttribute('href');
            if (href && (href.endsWith('.jpg') || href.endsWith('.png') || href.endsWith('.webp'))) {
                mainImages.push(href.startsWith('http') ? href : 'https://fujihomevn.com/' + href.replace(/^\//, ''));
            }
        });

        // Also check if there is an og:image
        const ogImage = doc.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.getAttribute('content')) {
            mainImages.unshift(ogImage.getAttribute('content')!);
        }

        const uniqueMainImages = Array.from(new Set(mainImages));

        return {
            title,
            main: uniqueMainImages,
            variants: [],
            description: [],
            videos: []
        };
    } catch (error) {
        console.error("Fujihome scrape failed:", error);
        return null;
    }
};

const scrapeSunhouse = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const html = await fetchWithFallback(url, 'text');
        if (!html) return null;

        const result: ScrapedProductData = {
            title: 'Sunhouse Product',
            price: undefined,
            main: [],
            variants: [],
            variantNames: {},
            description: [],
            videos: [],
            descriptionText: ''
        };

        // 1. Title Extraction
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1Match && h1Match[1]) {
            result.title = h1Match[1].replace(/<[^>]+>/g, '').trim();
        } else {
            const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
            if (ogTitle && ogTitle[1]) {
                result.title = ogTitle[1].replace(/<[^>]+>/g, '').trim();
            } else {
                const jsonLdName = html.match(/"@type":\s*"Product"[\s\S]*?"name":\s*"([^"]+)"/i);
                if (jsonLdName && jsonLdName[1]) {
                    result.title = jsonLdName[1].trim();
                } else {
                    const titleTag = html.match(/<title>([^<]+)<\/title>/i);
                    if (titleTag && titleTag[1]) {
                        result.title = titleTag[1].replace(/<[^>]+>/g, '').trim();
                    }
                }
            }
        }

        // 2. Main Gallery Images
        const mainImageSet = new Set<string>();

        // Cover from og:image / JSON-LD
        const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
        if (ogImg && ogImg[1] && !ogImg[1].includes('logo') && !ogImg[1].includes('noimage')) {
            let cleanOg = ogImg[1].trim();
            if (cleanOg.startsWith('/')) cleanOg = 'https://sunhouse.com.vn' + cleanOg;
            cleanOg = cleanOg.replace(/\/pic\/thumb\/[^\/]+\/product\//, '/pic/product/');
            mainImageSet.add(cleanOg);
        }

        // Gallery slider block
        const largeImagesStart = html.indexOf('largeImages');
        const thumbImagesStart = html.indexOf('thumbImages');
        let gallerySection = '';
        if (largeImagesStart !== -1 && thumbImagesStart !== -1 && thumbImagesStart > largeImagesStart) {
            gallerySection = html.substring(largeImagesStart, thumbImagesStart);
        } else if (largeImagesStart !== -1) {
            gallerySection = html.substring(largeImagesStart, largeImagesStart + 8000);
        } else {
            const slideIdx = html.indexOf('slide_with_thumb');
            if (slideIdx !== -1) {
                gallerySection = html.substring(slideIdx, slideIdx + 8000);
            }
        }

        if (gallerySection) {
            const sliderMatches = (gallerySection.match(/(?:data-src|src)=["']([^"']+)["']/gi) || []) as string[];
            sliderMatches.forEach((m: string) => {
                const srcMatch = m.match(/(?:data-src|src)=["']([^"']+)["']/i);
                if (srcMatch && srcMatch[1]) {
                    let imgUrl = srcMatch[1].trim();
                    if (imgUrl.startsWith('data:') || imgUrl.includes('no-image') || imgUrl.includes('logo')) return;
                    if (imgUrl.startsWith('/')) imgUrl = 'https://sunhouse.com.vn' + imgUrl;
                    const fullRes = imgUrl.replace(/\/pic\/thumb\/[^\/]+\/product\//, '/pic/product/');
                    if (!fullRes.includes('/pic/product/images/')) {
                        mainImageSet.add(fullRes);
                    }
                }
            });
        }

        // Fallback: If no images found in gallerySection, match general product pic matches
        if (mainImageSet.size === 0) {
            const generalMatches = (html.match(/(?:data-src|src)=["']([^"']*(?:\/pic\/product\/|\/pic\/thumb\/[^\/]+\/product\/)[^"']+)["']/gi) || []) as string[];
            generalMatches.forEach((m: string) => {
                const srcMatch = m.match(/(?:data-src|src)=["']([^"']+)["']/i);
                if (srcMatch && srcMatch[1]) {
                    let imgUrl = srcMatch[1].trim();
                    if (imgUrl.startsWith('data:') || imgUrl.includes('no-image') || imgUrl.includes('logo') || imgUrl.includes('banner')) return;
                    if (imgUrl.startsWith('/')) imgUrl = 'https://sunhouse.com.vn' + imgUrl;
                    const fullRes = imgUrl.replace(/\/pic\/thumb\/[^\/]+\/product\//, '/pic/product/');
                    if (!fullRes.includes('/pic/product/images/') && !fullRes.includes('kitchen-tools') && !fullRes.includes('LOA')) {
                        mainImageSet.add(fullRes);
                    }
                }
            });
        }

        result.main = Array.from(mainImageSet);

        // 3. Description Infographic Images
        const descImageSet = new Set<string>();
        const descImgMatches = (html.match(/(?:data-src|src)=["']([^"']*(?:\/pic\/product\/images\/|\/pic\/news\/|\/upload\/)[^"']+)["']/gi) || []) as string[];
        descImgMatches.forEach((m: string) => {
            const srcMatch = m.match(/(?:data-src|src)=["']([^"']+)["']/i);
            if (srcMatch && srcMatch[1]) {
                let imgUrl = srcMatch[1].trim();
                if (imgUrl.startsWith('data:') || imgUrl.includes('no-image') || imgUrl.includes('logo')) return;
                if (imgUrl.startsWith('/')) imgUrl = 'https://sunhouse.com.vn' + imgUrl;
                if (!mainImageSet.has(imgUrl)) {
                    descImageSet.add(imgUrl);
                }
            }
        });
        result.description = Array.from(descImageSet);

        // 4. Color / version variants from itemProductCT
        const variantSet = new Set<string>();
        const productCtIdx = html.indexOf('itemProductCT');
        if (productCtIdx !== -1) {
            const ctSection = html.substring(productCtIdx, productCtIdx + 4000);
            const items = (ctSection.match(/<div class=[\x27"]item[\x27"][\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || []) as string[];
            items.forEach((it: string) => {
                const hrefMatch = it.match(/href=[\x27"]([^\x27"]+)[\x27"]/i);
                const titleAttr = it.match(/class=[\x27"]name[\x27"][^>]*>([^<]+)<\/a>/i) || it.match(/title=[\x27"]([^\x27"]+)[\x27"]/i);
                const imgMatch = it.match(/data-src=[\x27"]([^\x27"]+)[\x27"]/i) || it.match(/src=[\x27"]([^\x27"]+)[\x27"]/i);
                if (imgMatch && imgMatch[1]) {
                    let vImg = imgMatch[1].trim();
                    if (vImg.startsWith('data:') || vImg.includes('no-image')) return;
                    if (vImg.startsWith('/')) vImg = 'https://sunhouse.com.vn' + vImg;
                    vImg = vImg.replace(/\/pic\/thumb\/[^\/]+\/product\//, '/pic/product/');
                    variantSet.add(vImg);
                    const name = titleAttr ? titleAttr[1].trim() : (hrefMatch ? hrefMatch[1].split('/').pop()?.replace('.html', '') || 'Phân loại' : 'Phân loại');
                    if (result.variantNames) {
                        result.variantNames[vImg] = name;
                    }
                }
            });
        }
        result.variants = Array.from(variantSet);
        if (result.variantNames && Object.keys(result.variantNames).length === 0) {
            delete result.variantNames;
        }

        // 5. Technical Specifications & Description Text
        const specMatch = html.match(/class=[\x27"][^\x27"]*thongSoKyThuatSanPham[^\x27"]*[\x27"][\s\S]*?<\/ul>/i);
        let specsText = '';
        if (specMatch && specMatch[0]) {
            const liMatches = (specMatch[0].match(/<li><div class=[\x27"]text[\x27"]>([\s\S]*?)<\/div><div class=[\x27"]val[\x27"]>([\s\S]*?)<\/div><\/li>/gi) || []) as string[];
            const specsList = liMatches.map((li: string) => {
                const parts = li.match(/<div class=[\x27"]text[\x27"]>([\s\S]*?)<\/div><div class=[\x27"]val[\x27"]>([\s\S]*?)<\/div>/i);
                if (parts) {
                    const k = parts[1].replace(/<[^>]+>/g, '').trim();
                    const v = parts[2].replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '').trim();
                    return `${k}: ${v}`;
                }
                return '';
            }).filter(Boolean);
            if (specsList.length > 0) {
                specsText = '\nThông số kỹ thuật:\n' + specsList.join('\n');
            }
        }

        const descMatch = html.match(/<div class=[\x27"]description[\x27"][^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch && descMatch[1]) {
            const rawDesc = descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            result.descriptionText = (rawDesc + specsText).trim();
        } else if (specsText) {
            result.descriptionText = specsText.trim();
        }

        return result;
    } catch (error) {
        console.warn("Lỗi khi đào sunhouse:", error);
    }
    
    return null;
};

// --- GIGADIGITAL LOGIC ---
const scrapeGigadigital = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const cleanUrl = url.split('#')[0].split('?')[0];
        const segments = cleanUrl.split('/').filter(Boolean);
        const slug = segments[segments.length - 1];
        if (!slug) return null;

        const apiUrl = `https://testserver.gigadigital.vn/v1/product?slug=${slug}`;
        const data = await fetchWithFallback(apiUrl, 'json');
        if (!data || !data.name) return null;

        const imgBase = 'https://img.gigadigital.vn/image/';
        const mainImages: string[] = [];
        if (data.thumb) mainImages.push(imgBase + data.thumb);
        if (Array.isArray(data.images)) {
            data.images.forEach(img => {
                if (img) mainImages.push(img.startsWith('http') ? img : imgBase + img);
            });
        }

        const variants: string[] = [];
        const variantNames: Record<string, string> = {};
        const variantGroups: VariantGroup[] = [];

        if (Array.isArray(data.vesion_detail)) {
            data.vesion_detail.forEach(v => {
                const vImg = v.image ? (v.image.startsWith('http') ? v.image : imgBase + v.image) : '';
                if (vImg) {
                    variants.push(vImg);
                    variantNames[vImg] = v.name || 'Phân loại';
                }
                variantGroups.push({
                    name: v.name || 'Phân loại',
                    image: vImg,
                    images: vImg ? [vImg] : []
                });
            });
        }

        const descImages: string[] = [];
        if (data.post) {
            const doc = getDOMDocument(data.post);
            const imgs = Array.from(doc.querySelectorAll('img'));
            imgs.forEach(img => {
                let src = img.getAttribute('src') || img.getAttribute('data-src');
                if (src) {
                    if (src.startsWith('//')) src = 'https:' + src;
                    else if (src.startsWith('/')) src = 'https://gigadigital.vn' + src;
                    else if (!src.startsWith('http')) src = imgBase + src;
                    descImages.push(src);
                }
            });
        }

        return ensureVariantGroups({
            title: data.name,
            price: data.price ? String(data.price) : undefined,
            main: Array.from(new Set(mainImages)),
            variants: Array.from(new Set(variants)),
            variantNames,
            variantGroups,
            description: Array.from(new Set(descImages)),
            videos: data.youtube ? [`https://www.youtube.com/watch?v=${data.youtube}`] : []
        });
    } catch (error) {
        console.error("Gigadigital scrape failed:", error);
        return null;
    }
};

// --- ARISTINO LOGIC ---
const scrapeAristino = async (url: string): Promise<ScrapedProductData | ScrapedProductData[] | null> => {
    try {
        const html = await fetchWithFallback(url, 'text');
        
        let title = 'Aristino Product';
        if (html) {
            const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
            } else {
                const metaTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
                if (metaTitle && metaTitle[1]) title = metaTitle[1].replace(/<[^>]+>/g, '').trim();
            }
            
            // Try to find the detailed product JSON object
            const scriptMatch = html.match(/product\s*=\s*(\{"available"[\s\S]*?\});/);
            if (scriptMatch) {
                try {
                    const prod = JSON.parse(scriptMatch[1]);
                    if (prod.variants && prod.variants.length > 0) {
                        // Group by option1 (Màu sắc) or just return them as separate if option1 exists
                        const colorMap = new Map<string, string[]>();
                        const variantSwatches = new Map<string, string>();
                        
                        // Default images if no options
                        let defaultImages: string[] = [];
                        if (prod.images && Array.isArray(prod.images)) {
                            defaultImages = prod.images.map((img: string) => {
                                let url = img;
                                if (url.startsWith('//')) url = 'https:' + url;
                                return url.split('?')[0];
                            });
                        }
                        
                        // Aristino doesn't strictly group images by color in JSON except for featured_image per variant
                        // It usually relies on the user selecting a variant.
                        // Let's populate the main images based on the unique featured_image of variants.
                        
                        // Actually, Aristino image gallery is often mixed. But they might have color-specific images in variants.
                        // Let's group all featured_image by option1
                        prod.variants.forEach((v: any) => {
                            const color = v.option1;
                            if (color && v.featured_image && v.featured_image.src) {
                                let src = v.featured_image.src;
                                if (src.startsWith('//')) src = 'https:' + src;
                                src = src.split('?')[0];
                                
                                if (!colorMap.has(color)) {
                                    colorMap.set(color, []);
                                }
                                colorMap.get(color)?.push(src);
                                variantSwatches.set(color, src);
                            }
                        });
                        
                        const results: ScrapedProductData[] = [];
                        
                        if (colorMap.size > 0) {
                            for (const [color, images] of colorMap.entries()) {
                                // Aristino usually repeats the same image for different sizes, so we need to deduplicate
                                const uniqueImages = Array.from(new Set(images));
                                // Append default images if needed? No, Aristino's featured_image is usually the color specific image, 
                                // but we might miss the angle shots.
                                // Let's just include the unique variants if they want them separated. 
                                // Wait, the featured_image is only ONE image. The angles are in `prod.images`.
                                // To get all angles per color without AI is hard because Haravan doesn't link them natively in this JSON.
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Failed to parse Aristino product json:", e);
                }
            }
            
            // Fallback: just return all images.
            // The AI grouping in ImageScraperTab will handle separating by color if variantSelector is used!
            const result: ScrapedProductData = {
                title: title,
                price: undefined,
                main: [],
                variants: [],
                description: [],
                videos: []
            };
            
            // Extract Images from Haravan JSON object array
            const imagesArrMatch = html.match(/"images"\s*:\s*(\[[^\]]+\])/);
            if (imagesArrMatch) {
                try {
                    const parsedImages = JSON.parse(imagesArrMatch[1]);
                    if (Array.isArray(parsedImages)) {
                        result.main = parsedImages.map(img => {
                            let url = img;
                            if (url.startsWith('//')) url = 'https:' + url;
                            return url.split('?')[0];
                        });
                    }
                } catch (e) {
                    console.warn("Failed to parse Aristino images array:", e);
                }
            }

            // Fallback to regex if array parsing fails or is empty
            if (result.main.length === 0) {
                const imgRegex = /https:\/\/(?:aristino\.com|cdn\.hstatic\.net|file\.hstatic\.net|theme\.hstatic\.net)\/[^"'\s>]*\.(png|jpg|jpeg|webp)/gi;
                const matches = html.match(imgRegex);
                
                if (matches) {
                    const uniqueImages = Array.from(new Set(matches) as Set<string>).filter((img: string) => {
                        const i = img.toLowerCase();
                        return !i.includes('icon') && !i.includes('logo') && !i.includes('favicon') && !i.includes('banner');
                    }).map(img => img.replace(/ /g, '%20'));
                    
                    result.main = uniqueImages;
                }
            }
            
            // Try to extract variant swatches to feed to AI grouping automatically
            if (scriptMatch) {
                 try {
                     const prod = JSON.parse(scriptMatch[1]);
                     if (prod.variants && prod.variants.length > 0) {
                          const swatches = new Set<string>();
                          const variantNames: Record<string, string> = {};
                          prod.variants.forEach((v: any) => {
                              if (v.featured_image && v.featured_image.src) {
                                  let src = v.featured_image.src;
                                  if (src.startsWith('//')) src = 'https:' + src;
                                  src = src.split('?')[0];
                                  swatches.add(src);
                                  
                                  if (v.option1) {
                                      if (variantNames[src]) {
                                          if (!variantNames[src].split('|||').includes(v.option1)) {
                                              variantNames[src] += "|||" + v.option1;
                                          }
                                      } else {
                                          variantNames[src] = v.option1;
                                      }
                                  }
                              }
                          });
                          result.variants = Array.from(swatches);
                          result.variantNames = variantNames;
                     }
                 } catch (e) {}
            }
            
            return result;
        }
    } catch (error) {
        console.warn("Lỗi khi đào Aristino:", error);
    }
    
    return null;
};

// --- EONWON LOGIC ---
const scrapeEonwon = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const html = await fetchWithFallback(url, 'text');
        
        const result: ScrapedProductData = {
            title: 'Eonwon Product',
            price: undefined,
            main: [],
            variants: [],
            description: [],
            videos: []
        };
        
        if (html) {
            const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            if (titleMatch && titleMatch[1]) {
                result.title = titleMatch[1].trim();
            }
            
            // Look for product gallery container
            const galleryContainerMatch = html.match(/<div class="product-images[^>]+>([\s\S]*?)<\/div>\s*<\/div>/);
            if (galleryContainerMatch && galleryContainerMatch[1]) {
                const galleryHtml = galleryContainerMatch[1];
                const imageMatches = galleryHtml.match(/href="([^"]+\.(?:png|jpg|jpeg|webp))"/gi);
                
                if (imageMatches) {
                    const uniqueImages = Array.from(new Set(imageMatches.map(m => {
                        const match = m.match(/href="([^"]+)"/i);
                        return match ? match[1] : '';
                    }).filter(Boolean))) as string[];
                    
                    result.main = uniqueImages;
                }
            }
            
            // If main is still empty, fallback to raw extraction of wp-content/uploads
            if (result.main.length === 0) {
                const fallbackMatches = html.match(/https:\/\/eonwon\.vn\/wp-content\/uploads\/[0-9]{4}\/[0-9]{2}\/[^\.\"]+\.(?:jpg|jpeg|png|webp)/gi);
                if (fallbackMatches) {
                    const cleanFallback = Array.from(new Set(fallbackMatches
                        .filter((u: string) => !u.match(/-\d+x\d+\./) && !u.toLowerCase().includes('logo'))
                    )) as string[];
                    result.main = cleanFallback;
                }
            }
            
            return result;
        }
    } catch (error) {
        console.warn("Lỗi khi đào eonwon:", error);
    }
    
    return null;
};

// --- NAGAKAWA LOGIC ---
const scrapeNagakawa = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const htmlText = await fetchWithFallback(url, 'text');
        if (!htmlText) return null;

        const result: ScrapedProductData = {
            title: 'Nagakawa Product',
            price: undefined,
            main: [],
            variants: [],
            description: [],
            videos: []
        };

        const titleMatch = htmlText.match(/<h1[^>]*>(.*?)<\/h1>/);
        if (titleMatch) {
            result.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        }

        const priceMatch = htmlText.match(/class="price[^>]*>(.*?)<\/span>/) || htmlText.match(/class="product-price[^>]*>(.*?)<\/span>/);
        if (priceMatch) {
            result.price = priceMatch[1].replace(/[^0-9]/g, '');
            if (result.price === '') result.price = undefined;
        }

        let topHtml = htmlText;
        if (htmlText.indexOf('product-detail-content') > -1) {
             topHtml = htmlText.substring(0, htmlText.indexOf('product-detail-content'));
        } else if (htmlText.indexOf('product-description') > -1) {
             topHtml = htmlText.substring(0, htmlText.indexOf('product-description'));
        } else if (htmlText.indexOf('description-content') > -1) {
             topHtml = htmlText.substring(0, htmlText.indexOf('description-content'));
        }

        const mainImageRegex = /(?:data-src|src)="([^"]+bizweb\.dktcdn\.net[^\"]*\/products\/[^\"]+)"/gi;
        const mainMatches = Array.from(topHtml.matchAll(mainImageRegex));
        
        let mains = mainMatches.map(m => m[1]);
        
        mains = mains.map(imgUrl => {
            let u = imgUrl.replace(/thumb\/[^\/]+\//, '');
            if (u.startsWith('//')) u = 'https:' + u;
            else if (u.startsWith('/')) u = 'https://nagakawa.com.vn' + u;
            else if (!u.startsWith('http')) u = 'https://nagakawa.com.vn/' + u;
            return u;
        });

        result.main = Array.from(new Set(mains));

        const descHtmlStart = htmlText.indexOf('product-detail-content') > -1 ? htmlText.indexOf('product-detail-content') 
                            : (htmlText.indexOf('product-description') > -1 ? htmlText.indexOf('product-description') : 0);
        let descHtmlEnd = htmlText.indexOf('id="product-thongso"');
        if (descHtmlEnd === -1) descHtmlEnd = htmlText.indexOf('related-products');
        if (descHtmlEnd === -1) descHtmlEnd = htmlText.length;
        
        const descHtml = htmlText.substring(descHtmlStart, descHtmlEnd);
        
        const descImageRegex = /(?:data-src|src)="([^"]+bizweb\.dktcdn\.net[^\"]*)"/gi;
        const descMatches = Array.from(descHtml.matchAll(descImageRegex));
        
        let descImages = descMatches.map(m => m[1]).filter(u => u.includes('/files/') || u.includes('/products/'));
        
        descImages = descImages.map(imgUrl => {
            let u = imgUrl.replace(/thumb\/[^\/]+\//, '');
            if (u.startsWith('//')) u = 'https:' + u;
            else if (u.startsWith('/')) u = 'https://nagakawa.com.vn' + u;
            else if (!u.startsWith('http')) u = 'https://nagakawa.com.vn/' + u;
            return u;
        });

        result.description = Array.from(new Set(descImages)).filter(u => !result.main.includes(u));

        // Get description text
        let descText = '';
        const descMatch = descHtml.replace(/<img[^>]*>/gi, '').replace(/<[^>]+>/g, '\n');
        if (descMatch) {
             descText = descMatch.replace(/\n\s*\n/g, '\n').trim();
        }
        if (descText) (result as any).descriptionText = descText;

        return result;

    } catch (e) {
        console.warn("Nagakawa scrape error", e);
        return null;
    }
}

const scrapePanasonic = async (url: string): Promise<ScrapedProductData | null> => {
    const htmlUrl = url.split('?')[0];
    const htmlText = await fetchWithFallback(htmlUrl, 'text');
    if (!htmlText) return null;

    const result: ScrapedProductData = {
        title: 'Panasonic Product',
        main: [],
        variants: [],
        description: [],
        videos: []
    };

    try {
        let modelCode = '';
        const titleMatch = htmlText.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
            result.title = titleMatch[1].trim();
            const titleWords = result.title.split(/\s+/);
            for (const word of titleWords) {
                const cleanWord = word.replace(/[().,]/g, '').trim();
                if (/[0-9]/.test(cleanWord) && /[A-Z]/.test(cleanWord) && cleanWord.length >= 5) {
                    modelCode = cleanWord.toLowerCase();
                    break;
                }
            }
        }

        if (!modelCode) {
            const parts = url.toLowerCase().split('/');
            const lastPart = parts[parts.length - 1];
            const baseName = lastPart.replace('.html', '').replace('.htm', '');
            if (/[0-9]/.test(baseName) && baseName.length >= 3) {
                modelCode = baseName;
            }
        }

        const mainImages = new Set<string>();
        const descImages = new Set<string>();

        // 1. Scene7 Images (Main Gallery)
        const scene7Regex = /https:\/\/image\.panasonic\.com\/is\/image\/Panasonic\/[^?"'&\s>]+/g;
        let scene7Match;
        while ((scene7Match = scene7Regex.exec(htmlText)) !== null) {
            let baseUrl = scene7Match[0];
            if (!baseUrl.includes('_gallery_') && !baseUrl.includes('placeholder')) {
                if (baseUrl.includes('$Thumbnail96$') || baseUrl.includes('wid=') || baseUrl.includes('hei=')) {
                    baseUrl = baseUrl.split('?')[0];
                }
                mainImages.add(baseUrl + '?wid=1200&fmt=png-alpha');
            }
        }

        // 2. Magento Fotorama Gallery
        const regex = /["']full["']\s*:\s*["']([^"']+)["']/g;
        let match;
        while ((match = regex.exec(htmlText)) !== null) {
            let imgUrl = match[1].replace(/\\/g, '');
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            else if (imgUrl.startsWith('/')) imgUrl = new URL(url).origin + imgUrl;
            mainImages.add(imgUrl);
        }

        // 3. Extracted images from img tags (including data-src lazy-loaded images)
        const imgTagRegex = /<img[^>]+(?:src|data-src|data-original|data-lazy)=["']([^"']+)["']/gi;
        let imgTagMatch;
        while ((imgTagMatch = imgTagRegex.exec(htmlText)) !== null) {
            let imgUrl = imgTagMatch[1];
            if (imgUrl.includes('blank.gif') || imgUrl.includes('placeholder')) continue;
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            else if (imgUrl.startsWith('/')) imgUrl = 'https://www.panasonic.com' + imgUrl;

            if (imgUrl.includes('image.panasonic.com/is/image')) {
                let baseUrl = imgUrl.split('?')[0];
                mainImages.add(baseUrl + '?wid=1200&fmt=png-alpha');
            } else if (imgUrl.includes('/content/dam/pim/')) {
                descImages.add(imgUrl);
            }
        }

        let finalMain = Array.from(mainImages).filter(u => !u.includes('placeholder'));
        let finalDesc = Array.from(descImages).filter(u => !u.includes('placeholder'));

        // Smart Filtering to isolate ONLY the exact product's images and remove other models in the same lineup
        if (modelCode && modelCode.length >= 3) {
            const targetModel = modelCode.replace(/[^a-z0-9]/g, '');
            const cleanModelParts = modelCode.split('-').filter(p => p.length >= 3 && /[0-9]/.test(p));

            const filterByModel = (urls: string[]) => {
                return urls.filter(imgUrl => {
                    const normalizedImgUrl = imgUrl.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (normalizedImgUrl.includes(targetModel)) return true;
                    for (const part of cleanModelParts) {
                        const cleanPart = part.replace(/[^a-z0-9]/g, '');
                        if (normalizedImgUrl.includes(cleanPart)) return true;
                    }
                    return false;
                });
            };

            const filteredMain = filterByModel(finalMain);
            if (filteredMain.length > 0) {
                finalMain = filteredMain;
            }
            
            const filteredDesc = filterByModel(finalDesc);
            if (filteredDesc.length > 0) {
                finalDesc = filteredDesc;
            }
        }

        result.main = finalMain;
        result.description = finalDesc;

        // Extract description text (only if no images found, because on panasonic the actual description is usually images)
        let descText = '';
        if (result.description.length === 0) {
            const descMatch = htmlText.match(/<div class="value" itemprop="description">([\s\S]*?)<\/div>/);
            if (descMatch) {
                descText = descMatch[1].replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n').trim();
            } else {
                 const ogDesc = htmlText.match(/property="og:description" content="(.*?)"/);
                 if (ogDesc) descText = ogDesc[1];
            }
        }

        if (descText) {
            (result as any).fullTextDescription = descText;
        }

        return result;
    } catch (e) {
        console.warn("Panasonic scrape error", e);
        return null;
    }
}

// --- GOOGLE DRIVE FOLDER SCRAPER LOGIC ---
const scrapeGoogleDriveFolder = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const cleanUrl = url.trim();
        const folderIdMatch = cleanUrl.match(/\/folders\/([a-zA-Z0-9_-]{25,45})/i) || cleanUrl.match(/id=([a-zA-Z0-9_-]{25,45})/i);
        const folderId = folderIdMatch ? folderIdMatch[1] : '';

        const htmlText = await fetchWithFallback(cleanUrl, 'text', {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        if (!htmlText || typeof htmlText !== 'string') return null;

        let title = 'Google Drive Folder';
        const titleMatch = htmlText.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
            title = titleMatch[1].replace('- Google Drive', '').replace(/ - Google Drive/g, '').trim();
        }

        const fileMap = new Map<string, { id: string; name: string; url: string }>();

        // Regex 1: Match data-id="..." from Google Drive DOM items
        const dataIdRegex = /data-id="([a-zA-Z0-9_-]{25,45})"/g;
        let dIdMatch;
        while ((dIdMatch = dataIdRegex.exec(htmlText)) !== null) {
            const id = dIdMatch[1];
            if (id && !folderId.includes(id) && !fileMap.has(id)) {
                fileMap.set(id, {
                    id,
                    name: `Drive Image ${fileMap.size + 1}`,
                    url: `https://drive.google.com/thumbnail?id=${id}&sz=w2500`
                });
            }
        }

        // Regex 2: Match [[null, "FILE_ID"], ...] followed by filename
        const itemRegex = /\[\[null,"([a-zA-Z0-9_-]{25,45})"\][\s\S]*?\[\[\["([^"]+\.(?:jpg|jpeg|png|webp|gif|svg|mp4|mov))"/gi;
        let m;
        while ((m = itemRegex.exec(htmlText)) !== null) {
            const id = m[1];
            const name = m[2];
            if (id && name && !fileMap.has(id)) {
                fileMap.set(id, {
                    id,
                    name,
                    url: `https://drive.google.com/thumbnail?id=${id}&sz=w2500`
                });
            }
        }

        // Regex 3: Fallback scan for file download & view links
        const downloadRegex = /(?:https:\/\/drive\.google\.com\/uc\?id=|https:\/\/drive\.google\.com\/file\/d\/)([a-zA-Z0-9_-]{25,45})/gi;
        let dMatch;
        while ((dMatch = downloadRegex.exec(htmlText)) !== null) {
            const id = dMatch[1];
            if (id && !folderId.includes(id) && !fileMap.has(id)) {
                fileMap.set(id, {
                    id,
                    name: `Drive Image ${fileMap.size + 1}`,
                    url: `https://drive.google.com/thumbnail?id=${id}&sz=w2500`
                });
            }
        }

        const files = Array.from(fileMap.values());
        if (files.length === 0) return null;

        const mainImages = files.map(f => f.url);

        return ensureVariantGroups({
            title: title || `Google Drive Folder (${files.length} ảnh)`,
            main: mainImages,
            variants: [],
            description: [],
            videos: []
        });
    } catch (e) {
        console.warn("Google Drive folder scrape error:", e);
        return null;
    }
};

// --- CELLPHONES SCRAPER LOGIC ---
const scrapeCellphones = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const cleanUrl = url.trim();
        const htmlText = await fetchWithFallback(cleanUrl, 'text', {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        if (!htmlText || typeof htmlText !== 'string') return null;

        const result: ScrapedProductData = {
            title: 'CellphoneS Product',
            price: undefined,
            main: [],
            variants: [],
            variantNames: {},
            description: [],
            videos: []
        };

        // 1. Title
        const titleMatch = htmlText.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
            || htmlText.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
            || htmlText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch) {
            result.title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\| CellphoneS/i, '').trim();
        }

        // 2. Price
        const priceMatch = htmlText.match(/class="[^"]*(?:sale-price|special-price|product__price)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p|span)>/i)
            || htmlText.match(/"price"\s*:\s*"?(\d+)"?/i);
        if (priceMatch) {
            const rawPrice = priceMatch[1].replace(/<[^>]+>/g, '').replace(/[^0-9]/g, '');
            if (rawPrice) result.price = rawPrice;
        }

        // Helper to normalize CellphoneS images to high resolution
        const normalizeCellphonesImg = (rawUrl: string): string => {
            if (!rawUrl || typeof rawUrl !== 'string') return '';
            let u = rawUrl.trim().replace(/\\"/g, '').replace(/\\/g, '');
            if (u.startsWith('//')) u = 'https:' + u;

            if (u.includes('/plain/')) {
                const plainParts = u.split('/plain/');
                if (plainParts[1]) u = plainParts[1];
            }

            // Remove sizing prefixes like /200x/, /358x/, /50x50/, /x/
            u = u.replace(/cellphones\.com\.vn\/(?:200x|358x|50x50|x)\/media\//gi, 'cellphones.com.vn/media/');
            u = u.replace(/cdn2\.cellphones\.com\.vn\/(?:200x|358x|50x50|x)\/media\//gi, 'cdn2.cellphones.com.vn/media/');

            if (!u.startsWith('http')) {
                u = 'https://cellphones.com.vn/' + u.replace(/^\//, '');
            }
            return u;
        };

        const mainImages = new Set<string>();
        const variantImages = new Set<string>();
        const descImages = new Set<string>();

        // 3. Extract JSON-LD Schema
        const jsonLdMatches = htmlText.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        for (const match of jsonLdMatches) {
            try {
                const parsed = JSON.parse(match[1]);
                const items = Array.isArray(parsed) ? parsed : [parsed];
                for (const item of items) {
                    if (item['@type'] === 'Product' || item.image) {
                        if (item.name && result.title === 'CellphoneS Product') result.title = item.name;
                        if (item.offers?.price && !result.price) result.price = String(item.offers.price);
                        
                        const imgList = Array.isArray(item.image) ? item.image : [item.image];
                        imgList.filter(Boolean).forEach((img: any) => {
                            const imgUrl = typeof img === 'string' ? img : img.url || img.contentUrl;
                            if (imgUrl) {
                                const norm = normalizeCellphonesImg(imgUrl);
                                if (norm) mainImages.add(norm);
                            }
                        });
                    }
                }
            } catch (e) {}
        }

        // 4. Extract Product Gallery Images (catalog/product)
        const catalogRegex = /(?:https?:)?\/\/(?:cdn2\.)?cellphones\.com\.vn\/(?:[a-z0-9_:]+\/plain\/)?(?:https?:\/\/[^\s"'\>]+\/)?media\/catalog\/product\/[^\s"'\>]+\.(?:jpg|jpeg|png|webp)/gi;
        let cMatch;
        while ((cMatch = catalogRegex.exec(htmlText)) !== null) {
            const cleanImg = normalizeCellphonesImg(cMatch[0]);
            const lower = cleanImg.toLowerCase();
            if (cleanImg && !lower.includes('placeholder') && !lower.includes('logo') && !lower.includes('icon') && !lower.includes('sticker')) {
                mainImages.add(cleanImg);
            }
        }

        // 5. Extract Variants & Colors
        const itemVariantMatches = htmlText.matchAll(/<a[^>]*class="[^"]*item-variant[^"]*"[^>]*>([\s\S]*?)<\/a>/gi);
        const mainImgArr = Array.from(mainImages);
        let variantIndex = 0;

        for (const vMatch of itemVariantMatches) {
            const inner = vMatch[1];
            const nameMatch = inner.match(/class="[^"]*item-variant-name[^"]*"[^>]*>([\s\S]*?)<\/(?:strong|span|p|div)>/i)
                || inner.match(/<strong>([\s\S]*?)<\/strong>/i)
                || inner.match(/title=["']([^"']+)["']/i)
                || inner.match(/<span>([\s\S]*?)<\/span>/i);
            const imgMatch = inner.match(/<img[^>]*src=["']([^"']+)["']/i);
            
            const rawName = nameMatch ? (nameMatch[1] || nameMatch[2] || nameMatch[3] || '').replace(/<[^>]+>/g, '').trim() : '';
            let normImg = imgMatch ? normalizeCellphonesImg(imgMatch[1]) : '';

            if (rawName) {
                // If variant button has no thumbnail image tag, associate with catalog image by index
                if (!normImg || normImg.includes('placeholder')) {
                    normImg = mainImgArr[variantIndex] || mainImgArr[0] || '';
                }
                if (normImg) {
                    variantImages.add(normImg);
                    result.variantNames![normImg] = rawName;
                    variantIndex++;
                }
            }
        }

        // Fallback: If no item-variant tags were found, scan for list-variants / box-product-variants
        if (variantImages.size === 0) {
            const variantBlockMatch = htmlText.match(/class="[^"]*(?:list-variants|box-product-variants)[^"]*"[\s\S]*?<\/ul>/i)
                || htmlText.match(/class="[^"]*(?:list-variants|box-product-variants)[^"]*"[\s\S]*?<\/div>\s*<\/div>/i);
            if (variantBlockMatch) {
                const vBlock = variantBlockMatch[0];
                const itemRegex = /<li[^>]*>[\s\S]*?<a[^>]*>(?:[\s\S]*?title=["']([^"']+)["'])?[\s\S]*?(?:<img[^>]*src=["']([^"']+)["'])?[\s\S]*?<\/a>/gi;
                let vMatch;
                while ((vMatch = itemRegex.exec(vBlock)) !== null) {
                    const name = (vMatch[1] || '').trim();
                    const rawImg = vMatch[2];
                    let normImg = rawImg ? normalizeCellphonesImg(rawImg) : '';
                    if (!normImg) normImg = mainImgArr[variantIndex] || mainImgArr[0] || '';
                    if (normImg && name) {
                        variantImages.add(normImg);
                        result.variantNames![normImg] = name;
                        variantIndex++;
                    }
                }
            }
        }

        // 6. Extract Description / Wysiwyg Images
        const wysiwygRegex = /(?:https?:)?\/\/(?:cdn2\.)?cellphones\.com\.vn\/(?:[a-z0-9_:]+\/plain\/)?(?:https?:\/\/[^\s"'\>]+\/)?media\/wysiwyg\/[^\s"'\>]+\.(?:jpg|jpeg|png|webp)/gi;
        let wMatch;
        while ((wMatch = wysiwygRegex.exec(htmlText)) !== null) {
            const cleanImg = normalizeCellphonesImg(wMatch[0]);
            const lower = cleanImg.toLowerCase();
            if (cleanImg && !lower.includes('placehoder') && !lower.includes('placeholder') && !lower.includes('logo') && !lower.includes('icon') && !lower.includes('banner')) {
                descImages.add(cleanImg);
            }
        }

        // 7. Specifications (Technical Specs Table)
        const specTableMatch = htmlText.match(/<table[^>]*class="[^"]*technical-content[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
        if (specTableMatch) {
            const specText = specTableMatch[1]
                .replace(/<tr[^>]*>/gi, '\n')
                .replace(/<td[^>]*>/gi, ': ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/[ \t]+/g, ' ')
                .replace(/\n\s*:/g, '\n')
                .replace(/\n+/g, '\n')
                .trim();
            if (specText) {
                result.fullTextDescription = `Thông số kỹ thuật:\n${specText}`;
            }
        }

        result.main = Array.from(mainImages);
        result.variants = Array.from(variantImages);
        result.description = Array.from(descImages);

        return ensureVariantGroups(result);
    } catch (e) {
        console.warn("CellphoneS scrape error", e);
        return null;
    }
};

// --- SAMSUNG SCRAPER LOGIC ---
const scrapeSamsung = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const cleanUrl = url.split('?')[0].replace(/\/$/, '');
        const htmlText = await fetchWithFallback(cleanUrl, 'text');
        if (!htmlText) return null;

        const doc = getDOMDocument(htmlText);

        // 1. Extract Title
        let title = 'Samsung Product';
        if (doc) {
            const h1 = doc.querySelector('h1.pdd-header__title, .pdd-header-title, .pdp-header__title, h1');
            if (h1 && h1.textContent) title = h1.textContent.trim();
        }
        if (title === 'Samsung Product') {
            const h1Match = htmlText.match(/<h1[^>]*class="[^"]*(?:product-details__title|pd-buying-tool__info-title|pdd-header__title|title)[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
                || htmlText.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1Match) title = h1Match[1].replace(/<[^>]+>/g, '').trim();
            else {
                const titleMatch = htmlText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                if (titleMatch) title = titleMatch[1].split('|')[0].split('- Samsung')[0].trim();
            }
        }
        title = title.replace(/\s+/g, ' ').split('|')[0].split('- Samsung')[0].trim();

        // 2. Extract Price
        let price: string | undefined = undefined;
        if (doc) {
            const priceEl = doc.querySelector('.pdd-header__price .price, .pd-buying-price__price, [data-modelprice]');
            if (priceEl && priceEl.textContent) {
                const p = priceEl.textContent.replace(/[^0-9]/g, '');
                if (p) price = p;
            }
        }
        if (!price) {
            const priceMatch = htmlText.match(/class="[^"]*(?:pd-buying-tool__price|price-main|price__current)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p)>/i)
                || htmlText.match(/"price"\s*:\s*"?(\d+)"?/i)
                || htmlText.match(/itemprop="price"[^>]*content="([^"]+)"/i);
            if (priceMatch) {
                const rawPrice = priceMatch[1].replace(/<[^>]+>/g, '').replace(/[^0-9]/g, '');
                if (rawPrice) price = rawPrice;
            }
        }

        // Normalize Samsung Scene7 image URL to high quality (1440x1152 PNG)
        const normalizeSamsungImg = (rawUrl: string): string => {
            let u = rawUrl.trim().replace(/\\"/g, '').replace(/\\/g, '');
            if (u.startsWith('//')) u = 'https:' + u;
            else if (u.startsWith('/')) u = 'https://www.samsung.com' + u;

            if (u.includes('images.samsung.com/is/image/samsung/')) {
                const base = u.split('?')[0];
                return `${base}?$1440_1152_PNG$`;
            }
            return u;
        };

        // Helper to check if a Samsung image is an excluded non-product/thumbnail image
        const isExcludedSamsungImg = (urlLower: string): boolean => {
            // Exclude thumbnails
            if (urlLower.includes('-thumb-') || urlLower.includes('thumb-') || urlLower.includes('/thumb/') || urlLower.includes('-thumb.') || urlLower.includes('_thumb.') || /[-_.]thumb[-_.]/i.test(urlLower)) {
                return true;
            }
            // Exclude banners, logos, navigation bars, SVG UI icons, promotional badges
            if (urlLower.includes('/gnb/') || urlLower.includes('/assets/') || urlLower.includes('banner') || urlLower.includes('logo') || urlLower.includes('icon') || urlLower.includes('badge') || urlLower.includes('featuredcard')) {
                return true;
            }
            // Exclude common marketing asset folders
            if (urlLower.includes('/common/') || urlLower.includes('/global/') || urlLower.includes('/gro2-2/')) {
                return true;
            }
            return false;
        };

        // Helper to extract gallery images for a specific model code from DOM/HTML
        const extractGalleryImgs = (sourceDoc: Document | null, rawHtml: string, targetModelCode: string): string[] => {
            const list: string[] = [];
            const lowerCode = (targetModelCode || '').toLowerCase();
            const cleanCode = lowerCode.replace(/[^a-z0-9]/g, '');

            if (sourceDoc) {
                const galleryImgEls = sourceDoc.querySelectorAll('.pdd-header-gallery img, .pdp-header__gallery-area img, [class*="gallery"] img');
                galleryImgEls.forEach((el) => {
                    const src = el.getAttribute('data-desktop-src') || el.getAttribute('srcset') || el.getAttribute('src') || el.getAttribute('data-src');
                    if (!src) return;

                    const fullUrl = src.split('?')[0].replace(/^\/\//, 'https://');
                    const lower = fullUrl.toLowerCase();
                    const lowerNoHyphen = lower.replace(/[^a-z0-9]/g, '');

                    // STRICT FILTER: Must be Samsung p6pim gallery image, and not a thumbnail or banner
                    if (lower.includes('/p6pim/') && lower.includes('/gallery/') && !isExcludedSamsungImg(lower)) {
                        if (!lowerCode || lower.includes(lowerCode) || lowerNoHyphen.includes(cleanCode)) {
                            const highRes = normalizeSamsungImg(fullUrl);
                            if (!list.includes(highRes)) list.push(highRes);
                        }
                    }
                });
            }

            // Fallback to regex across raw HTML if needed
            if (list.length === 0) {
                const p6pimRegex = /(?:https?:)?\/\/images\.samsung\.com\/is\/image\/samsung\/p6pim\/[^?"'&\s<>]+\/gallery\/[^?"'&\s<>]+/gi;
                let m;
                while ((m = p6pimRegex.exec(rawHtml)) !== null) {
                    const raw = m[0];
                    const fullUrl = raw.split('?')[0].replace(/^\/\//, 'https://');
                    const lower = fullUrl.toLowerCase();
                    const lowerNoHyphen = lower.replace(/[^a-z0-9]/g, '');

                    if (!isExcludedSamsungImg(lower)) {
                        if (!lowerCode || lower.includes(lowerCode) || lowerNoHyphen.includes(cleanCode)) {
                            const highRes = normalizeSamsungImg(fullUrl);
                            if (!list.includes(highRes)) list.push(highRes);
                        }
                    }
                }
            }

            return list;
        };

        // 3. Extract Color Variants
        interface SamsungColorOption {
            name: string;
            modelCode: string;
            colorSlug: string;
            isChecked: boolean;
        }
        const colorOptions: SamsungColorOption[] = [];

        if (doc) {
            const inputs = doc.querySelectorAll('#option-color input, .option-color input, [name="pd-color"], input[id*="pd-color"]');
            inputs.forEach((el) => {
                const modelCode = (el.getAttribute('data-modelcode') || '').trim();
                if (!modelCode) return;

                const parentLi = el.closest('li') || el.parentElement;
                let labelText = parentLi?.querySelector('.pd-option-selector__text')?.textContent?.trim()
                             || parentLi?.querySelector('label')?.textContent?.trim()
                             || parentLi?.textContent?.replace(/\s+/g, ' ').trim()
                             || el.getAttribute('data-modelname')
                             || '';

                // Clean label text of common badges
                labelText = labelText.replace(/Hết hàng|Còn hàng|Out of stock|In stock/gi, '').trim();

                const anLa = el.getAttribute('an-la') || '';
                let colorSlug = '';
                if (anLa.toLowerCase().includes('color:')) {
                    colorSlug = anLa.split(/color:/i)[1].trim().toLowerCase().replace(/\s+/g, '-');
                }

                const isChecked = (el as HTMLInputElement).checked || el.getAttribute('checked') === 'checked';

                if (!colorOptions.some(c => c.modelCode.toUpperCase() === modelCode.toUpperCase())) {
                    colorOptions.push({
                        name: labelText || colorSlug || modelCode,
                        modelCode: modelCode.toUpperCase(),
                        colorSlug,
                        isChecked
                    });
                }
            });
        }

        // Regex fallback for color options if doc found none
        if (colorOptions.length === 0) {
            const inputRegex = /<input[^>]+name=["']pd-color["'][^>]*>/gi;
            let inputMatch;
            const inputMatches: { tag: string; index: number }[] = [];
            while ((inputMatch = inputRegex.exec(htmlText)) !== null) {
                inputMatches.push({ tag: inputMatch[0], index: inputMatch.index });
            }
            inputMatches.forEach(({ tag, index }) => {
                const modelCodeMatch = tag.match(/data-modelcode=["']([^"']+)["']/i);
                if (!modelCodeMatch) return;
                const modelCode = modelCodeMatch[1].trim();
                const anLaMatch = tag.match(/an-la=["']Color:([^"']+)["']/i);
                const colorSlug = anLaMatch ? anLaMatch[1].trim().toLowerCase().replace(/\s+/g, '-') : '';

                const lookAhead = htmlText.substring(index, index + 600);
                const textMatch = lookAhead.match(/class=["'][^"']*pd-option-selector__text[^"']*["'][^>]*>([^<]+)</i);
                const name = (textMatch ? textMatch[1].trim() : '') || colorSlug || modelCode;
                const isChecked = /checked(?:=["']checked["'])?/i.test(tag) || /data-check=["']Y["']/i.test(tag) || /class=["'][^"']*\bchecked\b[^"']*["']/i.test(tag);

                if (!colorOptions.some(c => c.modelCode.toUpperCase() === modelCode.toUpperCase())) {
                    colorOptions.push({
                        name,
                        modelCode: modelCode.toUpperCase(),
                        colorSlug,
                        isChecked
                    });
                }
            });
        }

        // Additional robust fallback: scan htmlText for variant model codes (e.g. sm-a185...) if colorOptions is sparse
        if (colorOptions.length <= 1) {
            const matches = htmlText.match(/sm-[a-z0-9]{8,15}xxv/gi) || htmlText.match(/sm-a185[a-z0-9]+/gi);
            if (matches) {
                const uniqueCodes: string[] = Array.from(new Set((matches as string[]).map(m => m.toUpperCase())));
                uniqueCodes.forEach((code: string) => {
                    if (!colorOptions.some(c => c.modelCode.toUpperCase() === code)) {
                        let name = code;
                        if (code.includes('LBK')) name = 'Xanh Mây';
                        else if (code.includes('ZKK') || code.includes('GZK')) name = 'Đen Titan';
                        else if (code.includes('ZSK') || code.includes('GZS')) name = 'Xám Bạc';
                        else if (code.includes('ZSL')) name = 'Xạc Bạc / Gold';
                        colorOptions.push({
                            name,
                            modelCode: code,
                            colorSlug: '',
                            isChecked: cleanUrl.toLowerCase().includes(code.toLowerCase())
                        });
                    }
                });
            }
        }

        // Identify primary/active variant: prioritize matching URL model code or slug, then isChecked, then first option
        const activeColor = colorOptions.find(c => c.modelCode && cleanUrl.toLowerCase().includes(c.modelCode.toLowerCase()))
            || colorOptions.find(c => c.colorSlug && cleanUrl.toLowerCase().includes(c.colorSlug.toLowerCase()))
            || colorOptions.find(c => c.isChecked)
            || colorOptions[0]
            || {
                name: 'Mặc định',
                modelCode: '',
                colorSlug: '',
                isChecked: true
            };

        const primaryGallery = extractGalleryImgs(doc, htmlText, activeColor.modelCode);

        const variantGroups: VariantGroup[] = [];
        const variantHeroImages: string[] = [];
        const variantNames: Record<string, string> = {};

        if (primaryGallery.length > 0) {
            const hero = primaryGallery[0];
            variantGroups.push({
                name: activeColor.name,
                image: hero,
                images: primaryGallery
            });
            variantHeroImages.push(hero);
            variantNames[hero] = activeColor.name;
        }

        // 4. Fetch remaining variants asynchronously or construct via modelCode swap fallback
        const otherColors = colorOptions.filter(c => c.modelCode.toUpperCase() !== activeColor.modelCode.toUpperCase());
        if (otherColors.length > 0) {
            const fetchPromises = otherColors.map(async (variant) => {
                try {
                    let varUrl = cleanUrl;
                    if (activeColor.colorSlug && variant.colorSlug && varUrl.toLowerCase().includes(activeColor.colorSlug.toLowerCase())) {
                        varUrl = varUrl.replace(new RegExp(activeColor.colorSlug, 'i'), variant.colorSlug.toLowerCase());
                    } else if (variant.colorSlug) {
                        for (const c of colorOptions) {
                            if (c.colorSlug && varUrl.toLowerCase().includes(c.colorSlug.toLowerCase())) {
                                varUrl = varUrl.replace(new RegExp(c.colorSlug, 'i'), variant.colorSlug.toLowerCase());
                                break;
                            }
                        }
                    }

                    if (activeColor.modelCode && variant.modelCode && varUrl.toLowerCase().includes(activeColor.modelCode.toLowerCase())) {
                        varUrl = varUrl.replace(new RegExp(activeColor.modelCode, 'i'), variant.modelCode.toLowerCase());
                    } else if (variant.modelCode) {
                        for (const c of colorOptions) {
                            if (c.modelCode && varUrl.toLowerCase().includes(c.modelCode.toLowerCase())) {
                                varUrl = varUrl.replace(new RegExp(c.modelCode, 'i'), variant.modelCode.toLowerCase());
                                break;
                            }
                        }
                    }

                    const varHtml = await fetchWithFallback(varUrl, 'text');
                    if (varHtml) {
                        const varDoc = getDOMDocument(varHtml);
                        const varImgs = extractGalleryImgs(varDoc, varHtml, variant.modelCode);
                        if (varImgs.length > 0) {
                            return {
                                name: variant.name,
                                image: varImgs[0],
                                images: varImgs
                            };
                        }
                    }
                } catch (e) {
                    console.warn(`Samsung fetch variant ${variant.name} error:`, e);
                }

                // Fallback: construct variant images by swapping model code in primary gallery URLs
                if (activeColor.modelCode && variant.modelCode && primaryGallery.length > 0) {
                    const fallbackImgs = primaryGallery.map(u => u.replace(new RegExp(activeColor.modelCode, 'gi'), variant.modelCode.toLowerCase()));
                    return {
                        name: variant.name,
                        image: fallbackImgs[0],
                        images: fallbackImgs
                    };
                }
                return null;
            });

            const settled = await Promise.allSettled(fetchPromises);
            settled.forEach((res) => {
                if (res.status === 'fulfilled' && res.value) {
                    const grp = res.value;
                    if (!variantGroups.some(g => g.name.toLowerCase() === grp.name.toLowerCase())) {
                        variantGroups.push(grp);
                        variantHeroImages.push(grp.image);
                        variantNames[grp.image] = grp.name;
                    }
                }
            });
        }

        // 5. Extract Videos (Strict filter for product videos only)
        const videos = new Set<string>();
        const videoRegex = /(?:https?:)?\/\/[^\s"'<>]+\.(?:mp4|webm)/gi;
        let vidMatch;
        while ((vidMatch = videoRegex.exec(htmlText)) !== null) {
            let vidUrl = vidMatch[0];
            if (vidUrl.startsWith('//')) vidUrl = 'https:' + vidUrl;
            if (vidUrl.includes('samsung.com') && !vidUrl.includes('gnb') && !vidUrl.includes('header')) {
                videos.add(vidUrl);
            }
        }

        // 6. Extract Description Text / Features
        const featureTexts: string[] = [];
        const featureSectionMatch = htmlText.match(/<(?:section|div)[^>]*class="[^"]*(?:pd-benefit|feature-benefit|product-details__feature|product-specs)[^"]*"[^>]*>([\s\S]*?)<\/(?:section|div)>/gi);
        if (featureSectionMatch) {
            featureSectionMatch.forEach(sec => {
                const text = sec.replace(/<style[\s\S]*?<\/style>/gi, '')
                                .replace(/<script[\s\S]*?<\/script>/gi, '')
                                .replace(/<[^>]+>/g, '\n')
                                .replace(/\n\s*\n/g, '\n').trim();
                if (text && text.length > 30) featureTexts.push(text);
            });
        }

        const result: ScrapedProductData = {
            title,
            price,
            color: activeColor.name,
            main: primaryGallery,
            variants: variantHeroImages,
            variantNames,
            variantGroups,
            description: [],
            videos: Array.from(videos),
            fullTextDescription: featureTexts.length > 0 ? featureTexts.join('\n\n') : undefined
        };

        return ensureVariantGroups(result);
    } catch (e) {
        console.warn("Samsung scrape error", e);
        return null;
    }
};

// --- WOOCOMMERCE / NUOCHOAROSA LOGIC ---
const scrapeWooCommerce = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const cleanUrl = url.split('#')[0];
        const html = await fetchWithFallback(cleanUrl, 'text');
        if (!html) return null;

        const result: ScrapedProductData = {
            title: 'Nước Hoa Rosa Product',
            price: undefined,
            main: [],
            variants: [],
            description: [],
            videos: []
        };

        // Extract Title
        const h1Match = html.match(/<h1[^>]*class="[^"]*(?:product_title|entry-title)[^"]*"[^>]*>(.*?)<\/h1>/i)
            || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
        if (h1Match) {
            result.title = h1Match[1].replace(/<[^>]+>/g, '').trim();
        } else {
            const titleTag = html.match(/<title[^>]*>(.*?)<\/title>/i);
            if (titleTag) {
                result.title = titleTag[1].split('-')[0].split('|')[0].trim();
            }
        }

        // Extract Price
        const priceMatch = html.match(/<p class="price"[^>]*>(.*?)<\/p>/s) 
            || html.match(/class="[^"]*amount[^"]*"[^>]*>(.*?)<\/bdi>/i)
            || html.match(/class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>(.*?)<\/span>/i);
        if (priceMatch) {
            const rawPrice = priceMatch[1].replace(/<[^>]+>/g, '').replace(/[^0-9]/g, '');
            if (rawPrice) result.price = rawPrice;
        }

        const mainImages = new Set<string>();
        const variantImages = new Set<string>();
        const variantNames: Record<string, string> = {};
        const descImages = new Set<string>();

        // 1. Check for WooCommerce data-product_variations JSON
        const variationsMatch = html.match(/data-product_variations=["']([^"']+)["']/i)
            || html.match(/data-product_variations\s*=\s*['"]([^'"]+)['"]/i);
        if (variationsMatch) {
            try {
                const unescapedJson = variationsMatch[1]
                    .replace(/&quot;/g, '"')
                    .replace(/&amp;/g, '&')
                    .replace(/&#039;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>');
                const parsedVariations = JSON.parse(unescapedJson);
                if (Array.isArray(parsedVariations)) {
                    parsedVariations.forEach((v: any) => {
                        let imgUrl = v.image?.full_src || v.image?.url || v.image?.src;
                        if (imgUrl) {
                            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
                            imgUrl = imgUrl.replace(/-\d+x\d+(\.(?:jpg|jpeg|png|webp))/i, '$1');
                            variantImages.add(imgUrl);

                            if (v.attributes) {
                                const attrValues = Object.values(v.attributes).filter(Boolean).map(a => String(a).replace(/[-_]/g, ' '));
                                if (attrValues.length > 0) {
                                    variantNames[imgUrl] = attrValues.join(' - ');
                                }
                            }
                        }
                    });
                }
            } catch (e) {
                console.warn("Error parsing WooCommerce variations JSON:", e);
            }
        }

        // Helper function to normalize image url and remove thumb suffix
        const normalizeImg = (rawUrl: string): string => {
            let u = rawUrl.trim();
            if (u.startsWith('//')) u = 'https:' + u;
            else if (u.startsWith('/')) {
                try { u = new URL(cleanUrl).origin + u; } catch (e) {}
            }
            u = u.replace(/-\d+x\d+(\.(?:jpg|jpeg|png|webp))/i, '$1');
            return u;
        };

        const isBannedUiImage = (imgUrl: string): boolean => {
            if (!imgUrl) return true;
            const lower = imgUrl.toLowerCase();
            const bannedKeywords = [
                'logo', 'favicon', 'banner', 'icon', 'payment', 'avatar', 'badge', 
                'info.svg', 'puzzle.svg', 'star', 'rating', 'social', 'widget', 
                'placeholder', 'sprite', 'button', 'arrow', 'close', 'menu'
            ];
            return bannedKeywords.some(k => lower.includes(k));
        };

        // 2. Extract specifically from WooCommerce product gallery containers
        const galleryRegex = /<(?:div|figure|ol|ul)[^>]*class="[^"]*(?:woocommerce-product-gallery|product-gallery|easyzoom|gallery-item|flickity-slider|owl-stage|product-images|flex-control-thumbs|flex-control-nav)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|figure|ol|ul)>/gi;
        let galMatch;
        while ((galMatch = galleryRegex.exec(html)) !== null) {
            const galHtml = galMatch[1];
            const imgSrcMatches = galHtml.match(/(?:data-large_image|data-src|data-lazy-src|data-zoom-image|href|src)=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi);
            if (imgSrcMatches) {
                imgSrcMatches.forEach(m => {
                    const uMatch = m.match(/["']([^"']+)["']/);
                    if (uMatch) {
                        const cleanImg = normalizeImg(uMatch[1]);
                        if (!isBannedUiImage(cleanImg)) {
                            mainImages.add(cleanImg);
                        }
                    }
                });
            }
        }

        // 3. Fallback: If no gallery containers matched, look inside main product section (stripping related products)
        if (mainImages.size === 0) {
            const productBlockMatch = html.match(/<(?:div|article)[^>]*class="[^"]*(?:product|type-product|single-product)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article)>/i);
            let rawProductHtml = productBlockMatch ? productBlockMatch[1] : html;

            // Strip out related products, upsells, cross-sells, widgets, headers and footers
            const cleanProductHtml = rawProductHtml
                .replace(/<(?:div|section)[^>]*class="[^"]*(?:related|products|up-sells|upsells|cross-sells|related-products|yith-wfbt|widget)[^"]*"[\s\S]*?<\/(?:div|section)>/gi, '')
                .replace(/<footer[\s\S]*?<\/footer>/gi, '')
                .replace(/<header[\s\S]*?<\/header>/gi, '');

            const wpUploadsRegex = /(?:https?:)?\/\/[^\s"'<>]+\/wp-content\/uploads\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi;
            const matches = cleanProductHtml.match(wpUploadsRegex) || [];
            matches.forEach((rawImg: string) => {
                const cleanImg = normalizeImg(rawImg);
                if (!isBannedUiImage(cleanImg)) {
                    if (mainImages.size < 15) {
                        mainImages.add(cleanImg);
                    }
                }
            });
        }

        // 4. Extract Description images and text
        const descMatch = html.match(/<div[^>]*id="tab-description"[^>]*>([\s\S]*?)<\/div>/i)
            || html.match(/<div[^>]*class="[^"]*(?:woocommerce-Tabs-panel--description|product-description|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) {
            const descHtml = descMatch[1];
            const descImgMatches = descHtml.match(/(?:data-src|data-lazy-src|src)=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi);
            if (descImgMatches) {
                descImgMatches.forEach(m => {
                    const uMatch = m.match(/["']([^"']+)["']/);
                    if (uMatch) {
                        const cleanImg = normalizeImg(uMatch[1]);
                        if (!cleanImg.includes('logo') && !cleanImg.includes('icon')) {
                            descImages.add(cleanImg);
                        }
                    }
                });
            }

            const textOnly = descHtml.replace(/<style[\s\S]*?<\/style>/gi, '')
                                    .replace(/<script[\s\S]*?<\/script>/gi, '')
                                    .replace(/<[^>]+>/g, '\n')
                                    .replace(/\n\s*\n/g, '\n').trim();
            if (textOnly) {
                (result as any).fullTextDescription = textOnly;
            }
        }

        result.main = Array.from(mainImages);
        result.variants = Array.from(variantImages);
        if (Object.keys(variantNames).length > 0) {
            result.variantNames = variantNames;
        }
        result.description = Array.from(descImages).filter(u => !result.main.includes(u));

        if (result.main.length > 0 || result.variants.length > 0 || result.description.length > 0) {
            return result;
        }

        return null;
    } catch (e) {
        console.warn("Lỗi khi cào WooCommerce / Nuochoarosa:", e);
        return null;
    }
};

export const scrapeTitleist = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const cleanUrl = url.split('#')[0];
        const html = await fetchWithFallback(cleanUrl, 'text');
        if (!html) return null;

        const doc = getDOMDocument(html);

        const normalizeTitleistImg = (rawUrl: string): string => {
            if (!rawUrl) return '';
            let u = rawUrl.trim();
            if (u.startsWith('//')) u = 'https:' + u;
            else if (u.startsWith('/')) {
                try { u = new URL(cleanUrl).origin + u; } catch (e) {}
            }
            // High-res for Scene7
            if (u.includes('scene7.com/is/image')) {
                const base = u.split('?')[0];
                return `${base}?wid=1600&qlt=95&resMode=sharp2`;
            }
            // High-res for Demandware / Salesforce Commerce Cloud
            if (u.includes('/dw/image/')) {
                try {
                    const urlObj = new URL(u);
                    urlObj.searchParams.set('sw', '1600');
                    urlObj.searchParams.set('sh', '1600');
                    urlObj.searchParams.set('sm', 'fit');
                    urlObj.searchParams.set('sfrm', 'png');
                    return urlObj.toString();
                } catch (e) {
                    return u.replace(/sw=\d+/, 'sw=1600').replace(/sh=\d+/, 'sh=1600');
                }
            }
            return u;
        };

        const getBaseKey = (imgUrl: string): string => {
            try { return imgUrl.split('?')[0].toLowerCase(); } catch (e) { return imgUrl; }
        };

        const isUnwanted = (u: string): boolean => {
            const low = u.toLowerCase();
            return low.includes('logo') || low.includes('icon') || low.includes('thumbnail-800x600') ||
                   low.includes('fb_default') || low.includes('facebook') || low.includes('avatar') || 
                   low.includes('badge') || low.includes('.svg') || low.includes('bing.net') || 
                   low.includes('compare_putter') || low.includes('specthumb') || low.includes('default-shaft') ||
                   low.includes('default_grip') || low.includes('400x40.jpg') || low.includes('compare-product');
        };

        // Helper to extract clean image from an element
        const getElImgSrc = (el: Element): string => {
            if (el.tagName.toLowerCase() === 'picture') {
                const source = el.querySelector('source');
                const src = source?.getAttribute('data-srcset')?.split(',').pop()?.trim()?.split(' ')[0] ||
                            source?.getAttribute('srcset')?.split(',').pop()?.trim()?.split(' ')[0] ||
                            el.querySelector('img')?.getAttribute('data-src') ||
                            el.querySelector('img')?.getAttribute('src');
                return src || '';
            }
            let src = el.getAttribute('srcset')?.split(',').pop()?.trim()?.split(' ')[0] || 
                      el.getAttribute('data-src') || 
                      el.getAttribute('src');
            if (src && src.startsWith('data:image') && el.parentElement?.tagName.toLowerCase() === 'picture') {
                const source = el.parentElement.querySelector('source');
                src = source?.getAttribute('data-srcset')?.split(',').pop()?.trim()?.split(' ')[0] || 
                      source?.getAttribute('srcset')?.split(',').pop()?.trim()?.split(' ')[0] || src;
            }
            return src || '';
        };

        // Title: Prefer h1, then og:title or title tag
        const titleTag = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.split('|')[0]?.trim() || 
                         doc.querySelector('title')?.textContent?.split('|')[0]?.trim();
        const h1Text = doc.querySelector('h1')?.textContent?.trim();
        const title = (h1Text && h1Text.length > 2) ? h1Text : (titleTag || 'Titleist Product');

        // Price (if available)
        let price: string | undefined = undefined;
        const priceEl = doc.querySelector('.price, .product-price, [class*="price"], .sales-price');
        if (priceEl) {
            const rawPrice = priceEl.textContent?.replace(/[^0-9]/g, '');
            if (rawPrice) price = rawPrice;
        }

        const mainImagesMap = new Map<string, string>();
        const descImagesMap = new Map<string, string>();
        const variantImagesMap = new Map<string, string>();
        const variantNames: Record<string, string> = {};
        const videos = new Set<string>();

        // 1. Primary Product Gallery Containers (Main PDP product image gallery & zoom modal)
        const primaryElements = Array.from(doc.querySelectorAll(
            '.product-primary-image img, .zoom-image-wrapper img, .product-col-1 .product-image img, .slider-for img, .has-slideshow img, .m-photo-gallery img'
        ));

        primaryElements.forEach(el => {
            const rawSrc = getElImgSrc(el);
            if (!rawSrc || rawSrc.startsWith('data:image') || isUnwanted(rawSrc)) return;
            if (!rawSrc.includes('demandware.static') && !rawSrc.includes('scene7') && !rawSrc.includes('titleist')) return;

            const highRes = normalizeTitleistImg(rawSrc);
            const key = getBaseKey(highRes);
            
            // Skip grips/shafts in the main gallery
            if (key.includes('/grips/') || key.includes('/shafts/')) {
                return;
            }

            if (!mainImagesMap.has(key)) {
                mainImagesMap.set(key, highRes);
            }
        });

        // If main gallery is still empty, scan top container images
        if (mainImagesMap.size === 0) {
            const fallbackMainImgs = Array.from(doc.querySelectorAll('#pdpMain .product-image img, .product-main img'));
            fallbackMainImgs.forEach(el => {
                if (el.closest('.compare-product-image, .related-products, .product-listing, .recommendations, .cross-sell, .thumb-link, .product-swatches, .product-family-tabs-content')) return;
                const rawSrc = getElImgSrc(el);
                if (!rawSrc || isUnwanted(rawSrc)) return;
                const highRes = normalizeTitleistImg(rawSrc);
                const key = getBaseKey(highRes);
                if (!key.includes('/grips/') && !key.includes('/shafts/') && !mainImagesMap.has(key)) {
                    mainImagesMap.set(key, highRes);
                }
            });
        }

        // 2. Sister models in the same line (from swatches/thumb links) -> put into variants
        const modelLinks = Array.from(doc.querySelectorAll('.product-family-tabs-content .thumb-link, .product-swatches a, .swatch-anchor'));
        modelLinks.forEach(link => {
            const img = link.querySelector('img');
            if (!img) return;
            const rawSrc = getElImgSrc(img);
            if (!rawSrc || isUnwanted(rawSrc)) return;

            const highRes = normalizeTitleistImg(rawSrc);
            const key = getBaseKey(highRes);
            const modelTitle = link.getAttribute('title') || link.getAttribute('aria-label') || link.textContent?.trim();

            if (!mainImagesMap.has(key) && !variantImagesMap.has(key)) {
                variantImagesMap.set(key, highRes);
                if (modelTitle && modelTitle !== 'Standard Steel') {
                    variantNames[highRes] = modelTitle;
                } else {
                    const codeMatch = key.match(/([a-z0-9\-_]+)\.(?:png|jpg)/i);
                    variantNames[highRes] = codeMatch ? `Model (${codeMatch[1].toUpperCase()})` : "Phiên bản";
                }
            }
        });

        // 3. Custom Grip / Shaft options -> put into variants
        const optionElements = Array.from(doc.querySelectorAll('.js-grip-image-container img, .js-shaft-image-container img, .grip-selector img, .shaft-selector img'));
        optionElements.forEach(el => {
            const rawSrc = getElImgSrc(el);
            if (!rawSrc || isUnwanted(rawSrc)) return;
            const highRes = normalizeTitleistImg(rawSrc);
            const key = getBaseKey(highRes);
            if (!variantImagesMap.has(key) && !mainImagesMap.has(key)) {
                variantImagesMap.set(key, highRes);
                let optName = "Tùy chọn phụ kiện";
                if (key.includes('/grips/')) {
                    const fileName = key.split('/').pop()?.replace(/\.[^.]+$/, '').toUpperCase() || '';
                    optName = `Tay cầm Grip (${fileName})`;
                } else if (key.includes('/shafts/')) {
                    const fileName = key.split('/').pop()?.replace(/\.[^.]+$/, '').toUpperCase() || '';
                    optName = `Cán gậy Shaft (${fileName})`;
                }
                variantNames[highRes] = optName;
            }
        });

        // 4. Feature & Description Images (Scene7 & Demandware banners)
        const featureElements = Array.from(doc.querySelectorAll(
            '.content-feature img, .content-feature picture, .product-feature img, .pdp-section img, .pdp-technology img, .pdp-details img, .m-section-inner img, .content-asset img'
        ));

        featureElements.forEach(el => {
            const rawSrc = getElImgSrc(el);
            if (!rawSrc || rawSrc.startsWith('data:image') || isUnwanted(rawSrc)) return;
            if (!rawSrc.includes('scene7') && !rawSrc.includes('demandware.static') && !rawSrc.includes('titleist')) return;

            const highRes = normalizeTitleistImg(rawSrc);
            const key = getBaseKey(highRes);

            if (!mainImagesMap.has(key) && !variantImagesMap.has(key) && !descImagesMap.has(key)) {
                descImagesMap.set(key, highRes);
            }
        });

        // 5. Scan all remaining Scene7 images for smart classification (e.g. Golf ball highlights)
        const allImgs = Array.from(doc.querySelectorAll("img, picture"));
        allImgs.forEach(el => {
            if (el.closest('.compare-product-image, .related-products, .product-listing, .recommendations, .cross-sell, .thumb-link, .product-swatches, .product-family-tabs-content')) return;
            const rawSrc = getElImgSrc(el);
            if (!rawSrc || rawSrc.startsWith("data:image") || !rawSrc.includes("scene7") || isUnwanted(rawSrc)) return;

            const highRes = normalizeTitleistImg(rawSrc);
            const key = getBaseKey(highRes);

            const isBallProductPhoto = key.includes('dozen') || key.includes('sleeve') || key.includes('hero') || 
                                       key.includes('view01') || key.includes('view02') || key.includes('view03') ||
                                       key.includes('view04') || key.includes('silo') || key.includes('_dz_') || 
                                       key.includes('_sl_') || key.includes('_b0_') || key.includes('_b1_');

            if (mainImagesMap.size === 0 && isBallProductPhoto) {
                mainImagesMap.set(key, highRes);
            } else {
                if (!mainImagesMap.has(key) && !variantImagesMap.has(key) && !descImagesMap.has(key)) {
                    descImagesMap.set(key, highRes);
                }
            }
        });

        // 6. If main gallery is still empty, check meta og:image
        if (mainImagesMap.size === 0) {
            const og = doc.querySelector('meta[property="og:image"]')?.getAttribute("content");
            if (og && !isUnwanted(og)) {
                const highRes = normalizeTitleistImg(og);
                mainImagesMap.set(getBaseKey(highRes), highRes);
            }
        }

        // 7. Generate clean Vietnamese names for Main Images
        const mainImagesList = Array.from(mainImagesMap.values());
        mainImagesList.forEach((imgUrl, idx) => {
            const key = getBaseKey(imgUrl);
            let name = `Ảnh chi tiết ${idx + 1}`;
            if (key.includes('_01') || key.includes('view01') || key.includes('_b1_')) name = "Mặt gậy / Góc chụp chính diện (View 1)";
            else if (key.includes('_02') || key.includes('view02') || key.includes('_b2_')) name = "Góc nhìn từ trên / Address (View 2)";
            else if (key.includes('_03') || key.includes('view03') || key.includes('_b3_')) name = "Mặt đáy / Sole & Back (View 3)";
            else if (key.includes('_04') || key.includes('view04')) name = "Góc chụp nghiêng / Cạnh bên (View 4)";
            else if (key.includes('ssh') || key.includes('headcover') || key.includes('cover')) name = "Bao đầu gậy (Headcover)";
            else if (key.includes('dozen') || key.includes('_dz')) name = "Hộp 1 tá (Dozen Box)";
            else if (key.includes('sleeve') || key.includes('_sl')) name = "Hộp 3 quả (Sleeve)";
            else if (key.includes('hero') || key.includes('_b0_')) name = "Ảnh toàn cảnh (Hero)";

            variantNames[imgUrl] = name;
        });

        // 8. Videos
        const ytImgs = Array.from(doc.querySelectorAll('img[src*="ytimg.com/vi/"], iframe[src*="youtube"]'));
        ytImgs.forEach(el => {
            const src = el.getAttribute("src") || el.getAttribute("data-src") || "";
            const m = src.match(/(?:\/vi\/|embed\/|v=)([a-zA-Z0-9_-]{11})/);
            if (m) videos.add(`https://www.youtube.com/watch?v=${m[1]}`);
        });

        // 9. Full text description
        const paragraphs = Array.from(doc.querySelectorAll(".product-description p, .product-details p, .m-section-inner p, .feature-list li, .pdp-benefits li, .pdp-specs li"))
            .map(p => p.textContent?.trim())
            .filter(Boolean);
        const uniqueParagraphs = Array.from(new Set(paragraphs));
        const fullTextDescription = uniqueParagraphs.join("\n\n");

        return {
            title,
            price,
            main: mainImagesList,
            variants: Array.from(variantImagesMap.values()),
            variantNames: Object.keys(variantNames).length > 0 ? variantNames : undefined,
            description: Array.from(descImagesMap.values()),
            videos: Array.from(videos),
            fullTextDescription: fullTextDescription || undefined,
            descriptionText: uniqueParagraphs[0] || undefined
        };
    } catch (e) {
        console.warn("Lỗi khi cào Titleist:", e);
        return null;
    }
};

export const scrapeFootjoy = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const cleanUrl = url.split('#')[0];
        const html = await fetchWithFallback(cleanUrl, 'text');
        if (!html) return null;

        const doc = getDOMDocument(html);

        const normalizeFjImg = (u: string): string => {
            if (!u) return '';
            let clean = u.trim();
            if (clean.startsWith('//')) clean = 'https:' + clean;
            else if (clean.startsWith('/')) {
                try { clean = new URL(cleanUrl).origin + clean; } catch (e) {}
            }
            if (clean.includes('/dw/image/')) {
                const base = clean.split('?')[0];
                return `${base}?sw=1200&sh=1200&sm=fit&sfrm=png`;
            }
            if (clean.includes('scene7.com')) {
                const base = clean.split('?')[0];
                return `${base}?wid=1200&hei=1200&fmt=png-alpha`;
            }
            return clean.split('?')[0];
        };

        const getBaseKey = (u: string): string => {
            try {
                const p = u.split('?')[0].toLowerCase();
                const parts = p.split('/');
                return parts[parts.length - 1];
            } catch {
                return u;
            }
        };

        let title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.split('|')[0]?.trim() ||
                    doc.querySelector('h1.product-name, h1')?.textContent?.trim() || 'FootJoy Product';
        if (!title.toLowerCase().includes('footjoy')) {
            title = `${title} - FootJoy`;
        }

        let price: string | undefined = undefined;
        const priceEl = doc.querySelector('.prices .price, .product-price .sales, .price .value, .sales .value');
        if (priceEl) {
            const rawPrice = priceEl.textContent?.replace(/[^0-9]/g, '');
            if (rawPrice) price = rawPrice;
        }

        const mainImagesMap = new Map<string, string>();
        const descImagesMap = new Map<string, string>();
        const variantImagesMap = new Map<string, string>();
        const variantNames: Record<string, string> = {};
        const videos = new Set<string>();

        // 1. Primary gallery elements
        const galleryImgs = Array.from(doc.querySelectorAll('.primary-images img, [class*="productthumbnail"], .product-main-images img, .main-image-carousel img, .pdp-image-carousel img, .product-image-container img'));
        galleryImgs.forEach(el => {
            const src = el.getAttribute('src') || el.getAttribute('data-src');
            if (src && !src.startsWith('data:') && (src.includes('Sites-footjoy-master') || src.includes('FJ_') || src.includes('scene7'))) {
                const highRes = normalizeFjImg(src);
                const key = getBaseKey(highRes);
                if (!mainImagesMap.has(key)) {
                    mainImagesMap.set(key, highRes);
                }
            }
        });

        // 2. Swatches & variants
        const swatches = Array.from(doc.querySelectorAll('.product-variations .swatches.color a, .color-swatches a, [class*="color-attribute"] a, .swatchanchor'));
        swatches.forEach(a => {
            const rawTitle = a.getAttribute('title') || a.getAttribute('aria-label') || a.getAttribute('data-color-name') || '';
            const cleanTitle = rawTitle.replace(/^Select Color:\s*/i, '').trim();
            const imgEl = a.querySelector('img');
            const src = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src')) : null;
            if (src && (src.includes('Sites-footjoy-master') || src.includes('FJ_') || src.includes('scene7'))) {
                const highRes = normalizeFjImg(src);
                const key = getBaseKey(highRes);
                if (!variantImagesMap.has(key)) {
                    variantImagesMap.set(key, highRes);
                    if (cleanTitle) {
                        variantNames[highRes] = cleanTitle;
                    }
                }
            }
        });

        // 3. JSON-LD enrichment for variants and price
        const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
        jsonLdScripts.forEach(s => {
            try {
                const data = JSON.parse(s.textContent || '');
                const items = Array.isArray(data) ? data : [data];
                items.forEach(item => {
                    if (item['@type'] === 'Product' && item.image) {
                        const highRes = normalizeFjImg(item.image);
                        const key = getBaseKey(highRes);
                        if (!variantImagesMap.has(key)) {
                            variantImagesMap.set(key, highRes);
                        }
                        if (item.color) {
                            variantNames[highRes] = item.color;
                        }
                    }
                    if (!price && item.offers) {
                        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                        if (offer?.price) price = String(offer.price);
                    }
                });
            } catch {}
        });

        // 4. Description & specs
        let descText = '';
        const descEl = doc.querySelector('.product-description, .pdp-description, #collapsible-description-1, .details-content');
        if (descEl) descText = descEl.textContent?.replace(/\s+/g, ' ').trim() || '';

        const featureList: string[] = [];
        doc.querySelectorAll('.features-and-benefits, .product-features, .content-asset').forEach(el => {
            const text = el.textContent?.trim();
            if (text && (text.includes('WARRANTY') || text.includes('LEATHER') || text.includes('COMFORT') || text.includes('FIT') || text.includes('SUPPORT') || text.includes('CONSTRUCTION'))) {
                const cleaned = text.replace(/\s+/g, ' ');
                if (cleaned.length < 300 && !featureList.includes(cleaned)) {
                    featureList.push(cleaned);
                }
            }
        });
        if (featureList.length > 0) {
            descText += (descText ? '\n\n' : '') + 'Tính năng nổi bật:\n- ' + featureList.join('\n- ');
        }

        // Fallback main images from variants or og:image if none found
        if (mainImagesMap.size === 0) {
            const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
            if (og) {
                const highRes = normalizeFjImg(og);
                mainImagesMap.set(getBaseKey(highRes), highRes);
            } else if (variantImagesMap.size > 0) {
                const firstVar = Array.from(variantImagesMap.values())[0];
                mainImagesMap.set(getBaseKey(firstVar), firstVar);
            }
        }

        return {
            title,
            price,
            main: Array.from(mainImagesMap.values()),
            variants: Array.from(variantImagesMap.values()),
            variantNames: Object.keys(variantNames).length > 0 ? variantNames : undefined,
            description: Array.from(descImagesMap.values()),
            videos: Array.from(videos),
            fullTextDescription: descText || undefined,
            descriptionText: descText.split('\n\n')[0] || undefined
        };
    } catch (e) {
        console.warn("Lỗi khi cào FootJoy:", e);
        return null;
    }
};

export const scrapeGenericWebsite = async (url: string): Promise<ScrapedProductData | null> => {
    try {
        const cleanUrl = url.split('#')[0];
        const html = await fetchWithFallback(cleanUrl, 'text');
        if (!html) return null;

        const doc = getDOMDocument(html);

        const normalizeImg = (rawUrl: string): string => {
            if (!rawUrl) return '';
            let u = rawUrl.trim();
            if (u.startsWith('//')) u = 'https:' + u;
            else if (u.startsWith('/')) {
                try { u = new URL(cleanUrl).origin + u; } catch (e) {}
            }
            if (u.includes('acushnet.scene7.com/is/image')) {
                const base = u.split('?')[0];
                return `${base}?wid=1600&qlt=95&resMode=sharp2`;
            }
            u = u.replace(/-\d+x\d+(\.(?:jpg|jpeg|png|webp))/i, '$1');
            return u;
        };

        const getBaseKey = (imgUrl: string): string => {
            try { return imgUrl.split('?')[0].toLowerCase(); } catch (e) { return imgUrl; }
        };

        const title = doc.querySelector('h1')?.textContent?.trim() || 
                      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                      doc.querySelector('title')?.textContent?.split('|')[0]?.split('-')[0]?.trim() || 
                      'Sản phẩm';

        let price: string | undefined = undefined;
        const priceEl = doc.querySelector('.price, .product-price, [class*="price"], .sales-price, [itemprop="price"]');
        if (priceEl) {
            const rawPrice = priceEl.textContent?.replace(/[^0-9]/g, '');
            if (rawPrice) price = rawPrice;
        }

        const mainImagesMap = new Map<string, string>();
        const descImagesMap = new Map<string, string>();
        const videos = new Set<string>();

        // Check JSON-LD
        const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
        jsonLdScripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent || '');
                const items = Array.isArray(data) ? data : [data];
                items.forEach(item => {
                    if (item && (item['@type'] === 'Product' || item.image)) {
                        const imgs = Array.isArray(item.image) ? item.image : [item.image];
                        imgs.forEach((im: any) => {
                            const u = typeof im === 'string' ? im : im?.url;
                            if (u) {
                                const clean = normalizeImg(u);
                                mainImagesMap.set(getBaseKey(clean), clean);
                            }
                        });
                    }
                });
            } catch (e) {}
        });

        // Search primary product gallery containers
        const galleryContainers = Array.from(doc.querySelectorAll('.slider, .slick-slider, .swiper-wrapper, .carousel, .product-images, [class*="gallery"], [class*="slideshow"], .has-slideshow, #gallery, .pdp-gallery'));
        galleryContainers.forEach(container => {
            const imgs = Array.from(container.querySelectorAll('img, picture source'));
            imgs.forEach(el => {
                let src = el.getAttribute('data-src') || 
                          el.getAttribute('data-original') || 
                          el.getAttribute('data-zoom-image') || 
                          el.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0] || 
                          el.getAttribute('src');
                if (src && !src.startsWith('data:image')) {
                    const lower = src.toLowerCase();
                    if (!lower.includes('logo') && !lower.includes('icon') && !lower.includes('avatar') && !lower.includes('badge')) {
                        const clean = normalizeImg(src);
                        mainImagesMap.set(getBaseKey(clean), clean);
                    }
                }
            });
        });

        // If still no main images, check og:image
        if (mainImagesMap.size === 0) {
            const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                       doc.querySelector('meta[property="og:image:secure_url"]')?.getAttribute('content');
            if (og) {
                const clean = normalizeImg(og);
                mainImagesMap.set(getBaseKey(clean), clean);
            }
        }

        // Search detail / description images from primary content area, excluding related products, header, footer, sidebars
        const mainContentEl = doc.querySelector('.product, .type-product, .single-product, .entry-content, #content, main, article') || doc.body;
        
        if (mainContentEl) {
            const cloneEl = mainContentEl.cloneNode(true) as Element;
            // Remove related products, cross-sells, upsells, footers, headers, sidebars
            cloneEl.querySelectorAll('.related, .products, .up-sells, .upsells, .cross-sells, .related-products, footer, header, nav, .widget, #secondary, .comments, .site-footer, .elementor-location-footer').forEach(el => el.remove());

            const contentImgs = Array.from(cloneEl.querySelectorAll('img'));
            contentImgs.forEach(img => {
                let src = img.getAttribute('data-src') || img.getAttribute('src');
                if (src && !src.startsWith('data:image')) {
                    const lower = src.toLowerCase();
                    const banned = ['logo', 'icon', 'avatar', 'footer', 'header', 'favicon', 'banner', 'payment', 'badge', 'info.svg', 'puzzle.svg', 'star', 'rating', 'social', 'widget'];
                    if (!banned.some(b => lower.includes(b))) {
                        const clean = normalizeImg(src);
                        const key = getBaseKey(clean);
                        if (!mainImagesMap.has(key) && !descImagesMap.has(key)) {
                            descImagesMap.set(key, clean);
                        }
                    }
                }
            });
        }

        // Videos
        const ytEls = Array.from(doc.querySelectorAll('iframe[src*="youtube"], img[src*="ytimg.com"]'));
        ytEls.forEach(el => {
            const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
            const m = src.match(/(?:\/vi\/|embed\/|v=)([a-zA-Z0-9_-]{11})/);
            if (m) videos.add(`https://www.youtube.com/watch?v=${m[1]}`);
        });

        if (mainImagesMap.size > 0 || descImagesMap.size > 0) {
            return {
                title,
                price,
                main: Array.from(mainImagesMap.values()),
                variants: [],
                description: Array.from(descImagesMap.values()).slice(0, 30),
                videos: Array.from(videos)
            };
        }

        return null;
    } catch (e) {
        console.warn("Lỗi khi cào generic website:", e);
        return null;
    }
};

// Helper function to safely query elements even with complex or malformed selectors
function safeQuerySelector(doc: Document | Element, selector: string): Element | null {
    if (!selector || typeof selector !== 'string' || !selector.trim()) return null;
    
    // Quick sanitize
    const cleaned = selector
        .replace(/\.craper-\.elected-target/g, '')
        .replace(/\.scraper-selected-target/g, '')
        .replace(/\.scraper-hover-target/g, '')
        .trim();

    try {
        const el = doc.querySelector(cleaned);
        if (el) return el;
    } catch (err) {
        // Selector syntax error - attempt intelligent cleanup
    }

    try {
        // Fix spaces inside class names caused by old /s+/ bug, e.g. "div.m-.ection-inner image-left:nth-child(1)"
        const sanitized = cleaned
            .split('>')
            .map(part => {
                const p = part.trim();
                if (p.includes(' ') && !p.includes('[')) {
                    const tagMatch = p.match(/^[a-zA-Z0-9_-]+/);
                    const idMatch = p.match(/#[a-zA-Z0-9_-]+/);
                    const nthMatch = p.match(/:nth-child\(\d+\)/);
                    if (idMatch) {
                        return (tagMatch ? tagMatch[0] : '') + idMatch[0] + (nthMatch ? nthMatch[0] : '');
                    }
                    if (tagMatch) {
                        return tagMatch[0] + (nthMatch ? nthMatch[0] : '');
                    }
                }
                return p;
            })
            .join(' > ');
        
        const el = doc.querySelector(sanitized);
        if (el) return el;
    } catch (e2) {}

    // Fallback 1: Extract ID if present anywhere in selector
    try {
        const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
        if (idMatch) {
            const el = doc.querySelector(`#${idMatch[1]}`);
            if (el) return el;
        }
    } catch (e3) {}

    // Fallback 2: Extract last tag
    try {
        const parts = selector.split('>').map(p => p.trim()).filter(Boolean);
        if (parts.length > 0) {
            const lastPart = parts[parts.length - 1];
            const cleanLast = lastPart.replace(/:nth-child\([^)]+\)/g, '').trim();
            const tagOnly = cleanLast.match(/^[a-zA-Z0-9_-]+/);
            if (tagOnly) {
                const el = doc.querySelector(tagOnly[0]);
                if (el) return el;
            }
        }
    } catch (e4) {}

    return null;
}

function extractImagesFromVisualTarget(targetEl: Element, pageUrl: string): { src: string; name?: string }[] {
    const list: { src: string; name?: string }[] = [];
    const seen = new Set<string>();

    let imgElements: Element[] = targetEl.tagName.toLowerCase() === 'img' 
        ? [targetEl] 
        : Array.from(targetEl.querySelectorAll('img'));

    // If target is a single img, or single child inside a slider/gallery/swatch group, check parent container
    if (imgElements.length <= 1 && targetEl.parentElement) {
        const parentImgs = Array.from(targetEl.parentElement.querySelectorAll('img'));
        if (parentImgs.length > 1) {
            imgElements = parentImgs;
        } else {
            const container = targetEl.closest('.slider, .slick-slider, .slick-track, .swiper-wrapper, ul, ol, div[class*="gallery"], div[class*="product"], div[class*="slideshow"], .has-slideshow');
            if (container) {
                const containerImgs = Array.from(container.querySelectorAll('img'));
                if (containerImgs.length > 1) {
                    imgElements = containerImgs;
                }
            }
        }
    }

    imgElements.forEach(img => {
        let src = img.getAttribute('data-src') || img.getAttribute('src') || img.getAttribute('data-original') || img.getAttribute('data-zoom-image');
        if ((!src || src.startsWith('data:image')) && img.parentElement?.tagName.toLowerCase() === 'picture') {
            const source = img.parentElement.querySelector('source');
            if (source) {
                src = source.getAttribute('data-srcset')?.split(',')[0]?.trim()?.split(' ')[0] || 
                      source.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0] || src;
            }
        }
        if (!src && img.getAttribute('srcset')) {
            src = img.getAttribute('srcset')!.split(',')[0].trim().split(' ')[0];
        }
        if (src && !src.startsWith('data:image')) {
            if (src.startsWith('//')) src = 'https:' + src;
            else if (src.startsWith('/')) {
                try { src = new URL(pageUrl).origin + src; } catch (e) {}
            }
            if (src.includes('image.panasonic.com/is/image')) {
                src = src.split('?')[0] + '?scl=1&fmt=png-alpha';
            }
            if (src.includes('acushnet.scene7.com/is/image')) {
                src = src.split('?')[0] + '?wid=1600&qlt=95&resMode=sharp2';
            }
            if (!seen.has(src)) {
                seen.add(src);
                let name = img.getAttribute('alt') || img.getAttribute('title');
                if (!name) {
                    let parent = img.parentElement;
                    while (parent && parent !== targetEl) {
                        if (parent.getAttribute('title')) {
                            name = parent.getAttribute('title');
                            break;
                        }
                        if (parent.getAttribute('data-color') || parent.getAttribute('data-variant')) {
                            name = parent.getAttribute('data-color') || parent.getAttribute('data-variant');
                            break;
                        }
                        parent = parent.parentElement;
                    }
                }
                list.push({ src, name: name ? name.trim() : undefined });
            }
        }
    });

    return list;
}

// --- MAIN ENTRY POINT ---
export const specializedScrape = async (url: string, platform: string = 'auto', visualSelector?: string, variantSelector?: string): Promise<ScrapedProductData | ScrapedProductData[] | null> => {
    
    // If user provided a specific CSS selector, scrape directly from that element
    if (visualSelector || variantSelector) {
        try {
            const html = await fetchWithFallback(url, 'text');
            if (html) {
                const doc = getDOMDocument(html);
                
                let mainImages: string[] = [];
                let variantImages: string[] = [];
                const variantNames: Record<string, string> = {};

                if (visualSelector) {
                    const targetEl = safeQuerySelector(doc, visualSelector);
                    if (targetEl) {
                        const items = extractImagesFromVisualTarget(targetEl, url);
                        mainImages = items.map(i => i.src);
                    }
                }

                if (variantSelector) {
                    const targetEl = safeQuerySelector(doc, variantSelector);
                    if (targetEl) {
                        const items = extractImagesFromVisualTarget(targetEl, url);
                        variantImages = items.map(i => i.src);
                        items.forEach(i => {
                            if (i.name) variantNames[i.src] = i.name;
                        });
                    }
                }

                const uniqueMain = Array.from(new Set(mainImages));
                const uniqueVariants = Array.from(new Set(variantImages));

                // If visual selector matched images, return immediately
                if (visualSelector && (uniqueMain.length > 0 || uniqueVariants.length > 0)) {
                    return {
                        title: doc.querySelector('title')?.textContent || 'Sản phẩm',
                        main: uniqueMain,
                        variants: uniqueVariants,
                        variantNames: Object.keys(variantNames).length > 0 ? variantNames : undefined,
                        description: [],
                        videos: []
                    };
                }
                
                if (variantImages.length > 0) {
                     (doc as any).__variantImages = uniqueVariants;
                     (doc as any).__variantNames = variantNames;
                }
                
                if (!visualSelector && variantSelector && uniqueVariants.length > 0) {
                    (globalThis as any).__lastVariantOverride = uniqueVariants;
                    (globalThis as any).__lastVariantNamesOverride = variantNames;
                }
            }
        } catch (e) {
            console.warn("Visual selector scrape warning (falling back to auto scrape):", e);
        }
    }

    const lowerUrl = url.toLowerCase();
    const mode = platform.toLowerCase();
    
    let result: ScrapedProductData | ScrapedProductData[] | null = null;
    
    // Explicit platform checks first
    if (mode === 'drive' || mode === 'gdrive' || mode === 'googledrive') result = await scrapeGoogleDriveFolder(url);
    else if (mode === 'shopee') result = await scrapeShopee(url);
    else if (mode === 'cellphones' || mode === 'cps') result = await scrapeCellphones(url);
    else if (mode === 'samsung') result = await scrapeSamsung(url);
    else if (mode === 'titleist') result = await scrapeTitleist(url);
    else if (mode === 'footjoy') result = await scrapeFootjoy(url);
    else if (mode === 'tiki') result = await scrapeTiki(url);
    else if (mode === 'lazada') result = await scrapeLazada(url);
    else if (mode === 'ash.vn' || mode === 'shopify' || mode === 'greencook' || mode === 'greencook.vn') result = await scrapeShopify(url);
    else if (mode === 'eonwon') result = await scrapeEonwon(url);
    else if (mode === 'fujihome') result = await scrapeFujihome(url);
    else if (mode === 'sunhouse') result = await scrapeSunhouse(url);
    else if (mode === 'gigadigital') result = await scrapeGigadigital(url);
    else if (mode === 'panasonic') result = await scrapePanasonic(url);
    else if (mode === 'nagakawa') result = await scrapeNagakawa(url);
    else if (mode === 'aristino') result = await scrapeAristino(url);
    else if (mode === 'nuochoarosa' || mode === 'woocommerce' || mode === 'wordpress') result = await scrapeWooCommerce(url);
    
    // Auto mode or fallback
    else if (lowerUrl.includes('drive.google.com/drive/folders/') || lowerUrl.includes('drive.google.com/folders/')) {
        result = await scrapeGoogleDriveFolder(url);
    }
    else if (lowerUrl.includes('shopee.vn') || lowerUrl.includes('shopee.com')) {
        result = await scrapeShopee(url);
    }
    else if (lowerUrl.includes('titleist.')) {
        result = await scrapeTitleist(url);
    }
    else if (lowerUrl.includes('footjoy.')) {
        result = await scrapeFootjoy(url);
    }
    else if (lowerUrl.includes('cellphones.com.vn')) {
        result = await scrapeCellphones(url);
    }
    else if (lowerUrl.includes('samsung.com')) {
        result = await scrapeSamsung(url);
    }
    else if (lowerUrl.includes('greencook.vn')) {
        result = await scrapeShopify(url);
    }
    else if (lowerUrl.includes('nagakawa.com.vn')) {
        result = await scrapeNagakawa(url);
    }
    else if (lowerUrl.includes('tiki.vn')) {
        result = await scrapeTiki(url);
    }
    else if (lowerUrl.includes('lazada.vn')) {
        result = await scrapeLazada(url);
    }
    else if (lowerUrl.includes('aristino.com')) {
        result = await scrapeAristino(url);
    }
    else if (lowerUrl.includes('panasonic.com')) {
        result = await scrapePanasonic(url);
    }
    else if (lowerUrl.includes('ash.vn') || lowerUrl.includes('shopify')) {
        result = await scrapeShopify(url);
    }
    else if (lowerUrl.includes('eonwon.vn')) {
        result = await scrapeEonwon(url);
    }
    else if (lowerUrl.includes('fujihomevn.com')) {
        result = await scrapeFujihome(url);
    }
    else if (lowerUrl.includes('sunhouse.com.vn')) {
        result = await scrapeSunhouse(url);
    }
    else if (lowerUrl.includes('gigadigital.vn')) {
        result = await scrapeGigadigital(url);
    }
    else if (lowerUrl.includes('nuochoarosa.com') || lowerUrl.includes('/san-pham/') || lowerUrl.includes('/product/') || lowerUrl.includes('wp-content')) {
        result = await scrapeWooCommerce(url);
    }

    // Generic fallback for any other custom website
    if (!result) {
        result = await scrapeWooCommerce(url);
    }
    if (!result) {
        result = await scrapeGenericWebsite(url);
    }
    
    if (result) {
        if ((globalThis as any).__lastVariantOverride) {
            if (Array.isArray(result)) {
                if (result.length > 0) {
                    result[0].variants = (globalThis as any).__lastVariantOverride;
                    result[0].variantNames = (globalThis as any).__lastVariantNamesOverride;
                }
            } else {
                result.variants = (globalThis as any).__lastVariantOverride;
                result.variantNames = (globalThis as any).__lastVariantNamesOverride;
            }
        }

        if (Array.isArray(result)) {
            result.forEach(r => ensureVariantGroups(r));
        } else {
            ensureVariantGroups(result);
        }
    }
    
    (globalThis as any).__lastVariantOverride = undefined;
    (globalThis as any).__lastVariantNamesOverride = undefined;
    return result;
};

/**
 * Primary Product Fetching Engine (`fetchProductData`)
 * 
 * Features:
 * 1. Prioritizes 'data-image-type', 'data-type', 'data-role', 'data-purpose' attribute filtering.
 * 2. Employs a Set ('seenUrlSet') to eliminate duplicate URLs before processing.
 * 3. Sanitizes and structures product data with valid high-resolution image links.
 */
export const fetchProductData = async (
    url: string,
    platform: string = 'auto',
    mainSelector?: string,
    variantSelector?: string
): Promise<ScrapedProductData | ScrapedProductData[] | null> => {
    if (!url || typeof url !== 'string' || !url.trim()) return null;

    const cleanUrl = url.trim();

    const rawResult = await specializedScrape(cleanUrl, platform, mainSelector, variantSelector);
    if (!rawResult) return null;

    const sanitizeProduct = (pData: ScrapedProductData): ScrapedProductData => {
        // Scoped sets per category to prevent stripping valid variant images that also appear in the main carousel
        const mainSeen = new Set<string>();
        const varSeen = new Set<string>();
        const descSeen = new Set<string>();
        const videoSeen = new Set<string>();

        const cleanMain: string[] = [];
        const cleanVariants: string[] = [];
        const cleanDesc: string[] = [];
        const cleanVideos: string[] = [];

        (pData.main || []).forEach(u => {
            if (!u) return;
            const normKey = u.split('?')[0].toLowerCase();
            if (!mainSeen.has(normKey)) {
                mainSeen.add(normKey);
                cleanMain.push(u);
            }
        });

        (pData.variants || []).forEach(u => {
            if (!u) return;
            const normKey = u.split('?')[0].toLowerCase();
            if (!varSeen.has(normKey)) {
                varSeen.add(normKey);
                cleanVariants.push(u);
            }
        });

        (pData.description || []).forEach(u => {
            if (!u) return;
            const normKey = u.split('?')[0].toLowerCase();
            if (!descSeen.has(normKey)) {
                descSeen.add(normKey);
                cleanDesc.push(u);
            }
        });

        (pData.videos || []).forEach(v => {
            if (!v) return;
            const normKey = v.toLowerCase();
            if (!videoSeen.has(normKey)) {
                videoSeen.add(normKey);
                cleanVideos.push(v);
            }
        });

        return ensureVariantGroups({
            ...pData,
            main: cleanMain,
            variants: cleanVariants,
            description: cleanDesc,
            videos: cleanVideos
        });
    };

    const processItem = async (item: ScrapedProductData): Promise<ScrapedProductData> => {
        const validMain = await filterValidProductImagesAsync(item.main || []);
        const validVariants = await filterValidProductImagesAsync(item.variants || []);
        const validDesc = await filterValidProductImagesAsync(item.description || []);
        const processed = {
            ...item,
            main: validMain.length > 0 ? validMain : (item.main || []),
            variants: validVariants.length > 0 ? validVariants : (item.variants || []),
            description: validDesc.length > 0 ? validDesc : (item.description || [])
        };
        return sanitizeProduct(processed);
    };

    if (Array.isArray(rawResult)) {
        const expanded: ScrapedProductData[] = [];
        for (const item of rawResult) {
            const processed = await processItem(item);
            if (processed.variantGroups && processed.variantGroups.length > 1) {
                expanded.push(...splitProductIntoVariantRows(processed, cleanUrl));
            } else {
                expanded.push(processed);
            }
        }
        return expanded;
    } else {
        const processed = await processItem(rawResult);
        if (processed.variantGroups && processed.variantGroups.length > 1) {
            return splitProductIntoVariantRows(processed, cleanUrl);
        }
        return processed;
    }
};

/**
 * Kiểm tra kích thước thực tế (yêu cầu trên 200x200 pixel) và so sánh tỷ lệ khung hình
 * để loại bỏ logo thương hiệu, banner banner dài hoặc icon nhỏ không phải ảnh sản phẩm.
 */
export const checkImageDimensionsAndAspectRatio = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !url) {
            resolve(true);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const timer = setTimeout(() => resolve(true), 4000); // 4s timeout fallback
        img.onload = () => {
            clearTimeout(timer);
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if (w === 0 || h === 0) {
                resolve(true);
                return;
            }
            // 1. Kiểm tra kích thước thực tế trên 200x200 pixel
            if (w < 200 || h < 200) {
                resolve(false);
                return;
            }
            // 2. So sánh tỷ lệ khung hình (Aspect Ratio) để loại bỏ logo / banner / dải băng ngang/dọc cực đoan
            const ratio = w / h;
            if (ratio < 0.2 || ratio > 5.0) {
                resolve(false);
                return;
            }
            resolve(true);
        };
        img.onerror = () => {
            clearTimeout(timer);
            resolve(true);
        };
        img.src = url;
    });
};

export const filterValidProductImagesAsync = async (urls: string[]): Promise<string[]> => {
    if (!urls || urls.length === 0) return [];
    const valid: string[] = [];
    for (const u of urls) {
        if (!u) continue;
        const low = u.toLowerCase();
        if (low.includes('logo') || low.includes('icon') || low.includes('badge') || low.includes('favicon') || low.includes('watermark') || low.includes('brand_logo')) {
            continue;
        }
        const isValid = await checkImageDimensionsAndAspectRatio(u);
        if (isValid) {
            valid.push(u);
        }
    }
    return valid;
};

