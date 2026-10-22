import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, Image as ImageIcon, Trash2, CheckCircle2, AlertCircle, Link as LinkIcon, ChevronDown, FileSpreadsheet, Layers, FileText, Video, Copy } from 'lucide-react';
import Button from '../Button';
import TextInput from '../TextInput';
import { fetchWithFallback, isShopeePromotionalOverlay } from '../../utils/ecommerceScraper';
import { ImageHoverPreview } from '../ImageHoverPreview';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { exportShopeeDataToXLSX } from '../../utils/exportUtils';
import { db, auth } from '../../src/firebase';
import { addHistory, listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';
import { pushDataToPipeline } from '../../utils/pipelineCache';
import { toast } from 'react-hot-toast';

export interface ShopeeModelItem {
    modelId: string | number;
    name: string;
    combinedName?: string;     // Tên kết hợp cả 2 tầng (vd: "Standard Bundle - Không Phụ Kiện")
    tier0Option?: string;      // Giá trị tầng 1 (vd: "Standard Bundle")
    tier1Option?: string;      // Giá trị tầng 2 (vd: "Không Phụ Kiện")
    sku?: string;
    price?: number | string;
    stock?: number;
    image: string;
    tierIndex?: number[];
    groupId?: string;
}

export interface ShopeeTierInfo {
    name: string;
    options: string[];
    images?: string[];
}

export interface ShopeeVariantGroup {
    groupId: string;          // ID của nhóm biến thể (vd: tier_0_opt_0)
    groupName: string;        // Tên phân loại (vd: "Standard Bundle", "Đen")
    name: string;             // Alias tên phân loại để tương thích với các hàm xuất XLSX (g.name)
    tierName: string;         // Tên tầng (vd: "Phân Loại", "Màu sắc")
    tierIndex: number;        // Index trong tier_variations
    image: string;            // Ảnh đại diện của phân loại
    images: string[];         // Toàn bộ ảnh thuộc nhóm này
    models: ShopeeModelItem[]; // Danh sách các SKU/Model con thuộc nhóm này
    subTierName?: string;     // Tên tầng 2 nếu có (vd: "Mic", "Dung lượng")
    subOptions?: string[];    // Các tùy chọn tầng 2 (vd: ["Air Transmitter", "Memory 128GB", ...])
}

export interface ExtractShopeeVariationsResult {
    groups: ShopeeVariantGroup[];
    variantImages: string[];
    variantNames: Record<string, string>;
    models: ShopeeModelItem[];
    allTiers?: ShopeeTierInfo[];
    hasTwoTiers?: boolean;
    debugInfo: {
        rawTierCount: number;
        rawModelCount: number;
        groupedCount: number;
        primaryTierName?: string;
        secondaryTierName?: string;
        mappingSummary?: any;
    };
}

interface ScrapeResult {
    url: string;
    status: 'loading' | 'success' | 'error';
    main: string[];
    variants: string[];
    variantNames?: Record<string, string>;
    variantGroups?: (ShopeeVariantGroup | any)[];
    allTiers?: ShopeeTierInfo[];
    hasTwoTiers?: boolean;
    description: string[];
    videos: string[];
    title: string;
    descriptionText?: string;
    color: string;
    error?: string;
    isExpanded: boolean;
    activeCategory: 'all' | 'main' | 'variants' | 'description' | 'video';
}

/**
 * Hàm trích xuất và ánh xạ chính xác các phân loại (SKU/Model) từ dữ liệu Shopee API
 * Đảm bảo:
 * 1. Log chi tiết cấu trúc JSON trả về từ API Shopee (tier_variations và models)
 * 2. Nhóm biến thể theo ID nhóm (Group ID) thay vì liệt kê phẳng
 * 3. Ánh xạ chính xác SKU/Model với danh sách ảnh tương ứng thông qua tier_index khi model.image rỗng
 * 4. Không dùng ảnh fallback imgs[0] cho các phân loại khác khiến sai lệch màu sắc
 */
export function extractShopeeVariations(
    tierVariationsRaw: any, 
    modelsRaw: any, 
    badgeIds?: Set<string>
): ExtractShopeeVariationsResult {
    console.group('🛒 [Shopee API Log] extractShopeeVariations - Bắt đầu phân tích cấu trúc dữ liệu JSON Shopee');
    console.log('📌 [Shopee API Log] Raw tier_variations nhận được:', tierVariationsRaw);
    console.log('📌 [Shopee API Log] Raw models count nhận được:', Array.isArray(modelsRaw) ? modelsRaw.length : 0);

    const tierVariations = Array.isArray(tierVariationsRaw) ? tierVariationsRaw : [];
    const rawModels = Array.isArray(modelsRaw) ? modelsRaw : [];

    // Log chi tiết từng tầng tier_variations
    tierVariations.forEach((t: any, idx: number) => {
        console.log(`  👉 Tier [${idx}]: name="${t?.name || 'N/A'}", optionsCount=${t?.options?.length || 0}, imagesCount=${t?.images?.length || 0}`, {
            name: t?.name,
            options: t?.options,
            images: t?.images
        });
    });

    if (rawModels.length > 0) {
        console.log('📌 [Shopee API Log] Mẫu model đầu tiên [0]:', rawModels[0]);
        console.log('📌 [Shopee API Log] Danh sách tóm tắt toàn bộ raw models:', rawModels.map((m: any, idx: number) => ({
            index: idx,
            model_id: m?.modelid || m?.model_id || m?.id,
            name: m?.name || m?.model_name,
            tier_index: m?.tier_index || m?.extinfo?.tier_index,
            hasDirectImage: Boolean(m?.image || m?.extinfo?.image),
            rawImage: m?.image || m?.extinfo?.image || 'N/A',
            sku: m?.sku || m?.seller_sku || m?.extinfo?.seller_sku || 'N/A'
        })));
    }

    const helperMakeUrl = (imgIdOrUrl: any): string => {
        if (!imgIdOrUrl || typeof imgIdOrUrl !== 'string') return '';
        const clean = imgIdOrUrl.trim();
        if (!clean) return '';
        if (clean.startsWith('http')) {
            const match = clean.match(/file\/([a-zA-Z0-9-_.]{15,})/);
            const hashId = match ? match[1].split('@')[0].replace(/\.webp$/, '') : '';
            if (hashId && ((badgeIds && badgeIds.has(hashId)) || isShopeePromotionalOverlay(hashId))) return '';
            return clean;
        }
        const id = clean.replace(/^.*\/file\//, '').split('@')[0].replace(/\.webp$/, '').replace(/["'\\]/g, '').trim();
        if (!id || id.length < 10) return '';
        if (badgeIds && badgeIds.has(id)) return '';
        if (isShopeePromotionalOverlay(id)) return '';
        return `https://down-vn.img.susercontent.com/file/${id}`;
    };

    const variantImages = new Set<string>();
    const variantNames: Record<string, string> = {};
    const groupsMap = new Map<string, ShopeeVariantGroup>();

    // 1. Xác định Primary Tier (Tier phân loại chính, thường là Màu sắc chứa ảnh)
    // Ưu tiên tier có chứa mảng images hợp lệ (không rỗng)
    let primaryTierIdx = -1;
    let maxImagesFound = 0;
    tierVariations.forEach((t: any, idx: number) => {
        const count = Array.isArray(t?.images) ? t.images.filter((img: any) => Boolean(img && String(img).trim())).length : 0;
        if (count > maxImagesFound) {
            maxImagesFound = count;
            primaryTierIdx = idx;
        }
    });

    // Nếu không tier nào có ảnh, chọn tier đầu tiên có options
    if (primaryTierIdx === -1) {
        primaryTierIdx = tierVariations.findIndex((t: any) => Array.isArray(t?.options) && t.options.length > 0);
    }
    if (primaryTierIdx === -1 && tierVariations.length > 0) {
        primaryTierIdx = 0;
    }

    const primaryTier = primaryTierIdx >= 0 ? tierVariations[primaryTierIdx] : null;
    console.log(`🎯 [Shopee API Log] Primary Tier được chọn: Index=${primaryTierIdx}, Name="${primaryTier?.name || 'N/A'}", Số options=${primaryTier?.options?.length || 0}`);

    // 2. Khởi tạo các nhóm biến thể theo Group ID từ Primary Tier
    if (primaryTier && Array.isArray(primaryTier.options)) {
        const tierName = primaryTier.name || 'Phân loại';
        const opts = primaryTier.options;
        const imgs = Array.isArray(primaryTier.images) ? primaryTier.images : [];

        opts.forEach((opt: any, optIdx: number) => {
            const cleanOpt = typeof opt === 'string' ? opt.trim() : String(opt || '').trim();
            if (!cleanOpt) return;

            // QUAN TRỌNG: Chỉ lấy ảnh đúng tại vị trí optIdx! Tuyệt đối không fallback về imgs[0]!
            const rawImg = imgs[optIdx] ? imgs[optIdx] : '';
            const fullU = helperMakeUrl(rawImg);

            const groupId = `tier_${primaryTierIdx}_opt_${optIdx}`;

            if (fullU) {
                variantImages.add(fullU);
                variantNames[fullU] = cleanOpt;
            }

            const groupItem: ShopeeVariantGroup = {
                groupId,
                groupName: cleanOpt,
                name: cleanOpt, // Alias để tương thích với các hàm export (g.name)
                tierName,
                tierIndex: optIdx,
                image: fullU,
                images: fullU ? [fullU] : [],
                models: []
            };

            groupsMap.set(groupId, groupItem);
            console.log(`  ➕ Tạo nhóm [${groupId}]: Name="${cleanOpt}", Image=${fullU || '(chưa có, sẽ lấy từ model con)'}`);
        });
    }

    // 3. Xử lý và ánh xạ từng Model/SKU vào Group ID tương ứng
    const allParsedModels: ShopeeModelItem[] = [];

    rawModels.forEach((m: any, mIdx: number) => {
        const mName = typeof m.name === 'string' ? m.name.trim() : (typeof m.model_name === 'string' ? m.model_name.trim() : `Phân loại ${mIdx + 1}`);
        const sku = m.sku || m.extinfo?.seller_sku || m.seller_sku || '';
        const price = m.price_before_discount ? `${m.price_before_discount / 100000}` : (m.price ? `${m.price / 100000}` : undefined);
        const stock = typeof m.stock === 'number' ? m.stock : (typeof m.normal_stock === 'number' ? m.normal_stock : undefined);
        
        // Trích xuất tier_index của model này (vd: [0, 1])
        const tierIndex: number[] = Array.isArray(m.tier_index) 
            ? m.tier_index 
            : (Array.isArray(m.extinfo?.tier_index) ? m.extinfo.tier_index : []);

        // Ánh xạ ảnh cho Model:
        // Bước A: Kiểm tra xem Model có ảnh riêng trực tiếp không
        let modelImg = helperMakeUrl(m.image || m.extinfo?.image || m.normal_image || m.item_image);
        let imgSource = modelImg ? 'Trực tiếp từ model.image' : '';

        // Bước B: Nếu Model không có ảnh riêng -> Tra cứu ảnh từ tier_variations thông qua tier_index!
        if (!modelImg && tierIndex.length > 0) {
            // Thử lấy từ primaryTier trước
            if (primaryTierIdx >= 0 && typeof tierIndex[primaryTierIdx] === 'number') {
                const pOptIdx = tierIndex[primaryTierIdx];
                const tierImg = tierVariations[primaryTierIdx]?.images?.[pOptIdx];
                if (tierImg) {
                    modelImg = helperMakeUrl(tierImg);
                    if (modelImg) imgSource = `Từ Primary Tier [${primaryTierIdx}], option [${pOptIdx}]`;
                }
            }

            // Nếu vẫn chưa có, thử tra cứu các tier khác
            if (!modelImg) {
                for (let t = 0; t < tierVariations.length; t++) {
                    const optIdx = tierIndex[t];
                    if (typeof optIdx === 'number' && tierVariations[t]?.images?.[optIdx]) {
                        modelImg = helperMakeUrl(tierVariations[t].images[optIdx]);
                        if (modelImg) {
                            imgSource = `Từ Tier [${t}], option [${optIdx}]`;
                            break;
                        }
                    }
                }
            }
        }

        const modelItem: ShopeeModelItem = {
            modelId: m.modelid || m.model_id || m.id || m.itemid || `model_${mIdx}`,
            name: mName,
            sku,
            price,
            stock,
            image: modelImg,
            tierIndex
        };
        allParsedModels.push(modelItem);

        // 4. Tìm Group ID cha để nhóm model này vào (không để liệt kê phẳng)
        let targetGroup: ShopeeVariantGroup | undefined = undefined;

        // Cách 1: Ánh xạ chuẩn theo tier_index của Primary Tier
        if (tierIndex.length > 0 && primaryTierIdx >= 0 && typeof tierIndex[primaryTierIdx] === 'number') {
            const parentOptIdx = tierIndex[primaryTierIdx];
            targetGroup = groupsMap.get(`tier_${primaryTierIdx}_opt_${parentOptIdx}`);
        }

        // Cách 2: Nếu chưa tìm thấy và có nhiều tier, thử tìm khớp theo bất kỳ tier_index nào
        if (!targetGroup && tierIndex.length > 0) {
            for (let t = 0; t < tierVariations.length; t++) {
                const optIdx = tierIndex[t];
                const candidate = groupsMap.get(`tier_${t}_opt_${optIdx}`);
                if (candidate) {
                    targetGroup = candidate;
                    break;
                }
            }
        }

        // Cách 3: So khớp tên phân loại (groupName) trong tên Model (mName)
        if (!targetGroup) {
            const mNameLower = mName.toLowerCase();
            targetGroup = Array.from(groupsMap.values()).find(g => {
                const gNameLower = g.groupName.toLowerCase();
                return mNameLower === gNameLower || 
                       mNameLower.includes(gNameLower) || 
                       gNameLower.includes(mNameLower);
            });
        }

        // Cách 4: Nếu không có tier_variations (groupsMap rỗng), nhóm thông minh theo ID nhóm thay vì liệt kê phẳng!
        if (!targetGroup) {
            // Tách tên nhóm cơ sở từ model name (ví dụ "Đen, Size M" -> lấy "Đen", "MP-712W Hồng" -> lấy "Hồng")
            const parts = mName.split(/[,/\\|-]/).map((s: string) => s.trim()).filter(Boolean);
            const candidateGroupName = parts.length > 0 ? parts[0] : mName;
            
            // Tìm nhóm đã có trùng candidateGroupName
            targetGroup = Array.from(groupsMap.values()).find(g => g.groupName.toLowerCase() === candidateGroupName.toLowerCase());

            if (!targetGroup) {
                const cleanSlug = candidateGroupName.toLowerCase().replace(/[^a-z0-9]/g, '_') || `opt_${groupsMap.size}`;
                const autoGroupId = `group_${groupsMap.size}_${cleanSlug}`;
                targetGroup = {
                    groupId: autoGroupId,
                    groupName: candidateGroupName,
                    name: candidateGroupName,
                    tierName: 'Phân loại',
                    tierIndex: groupsMap.size,
                    image: modelImg,
                    images: modelImg ? [modelImg] : [],
                    models: []
                };
                groupsMap.set(autoGroupId, targetGroup);
                console.log(`  ➕ Tự động nhóm SKU vào Group ID mới [${autoGroupId}]: Name="${candidateGroupName}"`);
            }
        }

        if (targetGroup) {
            targetGroup.models.push(modelItem);
            modelItem.groupId = targetGroup.groupId;

            // Nếu nhóm chưa có ảnh đại diện mà model con này có ảnh -> Gán ảnh của model cho nhóm!
            if (!targetGroup.image && modelImg) {
                targetGroup.image = modelImg;
                console.log(`  📸 Gán ảnh đại diện cho nhóm [${targetGroup.groupId}] từ model "${mName}": ${modelImg}`);
            }

            // Bổ sung ảnh vào danh sách ảnh của nhóm
            if (modelImg) {
                if (!targetGroup.images.includes(modelImg)) {
                    targetGroup.images.push(modelImg);
                }
                variantImages.add(modelImg);
                if (!variantNames[modelImg]) {
                    variantNames[modelImg] = targetGroup.groupName;
                }
            }

            console.log(`  🔗 Ánh xạ Model [${mIdx}] "${mName}" (SKU: ${sku || 'N/A'}) ➔ Nhóm [${targetGroup.groupId}] ("${targetGroup.groupName}"). Ảnh: ${modelImg || 'Không có'} (${imgSource || 'Không xác định'})`);
        }
    });

    const groups = Array.from(groupsMap.values());

    // Đảm bảo mọi ảnh đại diện của group đều có trong variantImages và variantNames
    groups.forEach(g => {
        if (g.image) {
            variantImages.add(g.image);
            if (!variantNames[g.image]) {
                variantNames[g.image] = g.groupName;
            }
        }
        g.images.forEach(img => {
            variantImages.add(img);
            if (!variantNames[img]) {
                variantNames[img] = g.groupName;
            }
        });
    });

    console.log(`[Shopee Variations] ✅ Đã hoàn tất phân tích: Nhóm thành công ${groups.length} nhóm biến thể theo Group ID.`);
    console.table(groups.map(g => ({
        'Group ID': g.groupId,
        'Tên phân loại': g.groupName,
        'Ảnh đại diện': g.image ? 'Có ảnh' : 'Trống',
        'Tổng ảnh': g.images.length,
        'Số Model/SKU con': g.models.length,
        'SKU': g.models.map(m => m.sku).filter(Boolean).join(', ') || 'N/A'
    })));
    console.groupEnd();

    return {
        groups,
        variantImages: Array.from(variantImages),
        variantNames,
        models: allParsedModels,
        debugInfo: {
            rawTierCount: tierVariations.length,
            rawModelCount: rawModels.length,
            groupedCount: groups.length,
            primaryTierName: primaryTier?.name || undefined,
            mappingSummary: groups.map(g => ({
                id: g.groupId,
                name: g.groupName,
                modelsCount: g.models.length,
                imagesCount: g.images.length
            }))
        }
    };
}

const SHOPEE_BOOKMARKLET = `javascript:(function(){var html=document.documentElement.innerHTML;var matches=html.match(/(?:cf.shopee.vn\\/file\\/|down-vn.img.susercontent.com\\/file\\/)([a-zA-Z0-9-_.]{15,})/g)||[];var ids=new Set();matches.forEach(m=>{var id=m.replace('cf.shopee.vn/file/','').replace('down-vn.img.susercontent.com/file/','').replace(/%22/g,'').replace(/&quot;/g,'').replace(/"/g,'');if(id&&id.length>10&&!id.includes('<')&&!id.includes('>')&&!id.includes('11134258')&&!id.includes('mmpn5o534ft15b')&&!id.includes('mtclqut2p154c1')&&!id.toLowerCase().includes('voucher')&&!id.toLowerCase().includes('xtra'))ids.add(id);});if(ids.size>0){var text='SHOPEE_HTML_EXTRACT|'+Array.from(ids).join(',');try{navigator.clipboard.writeText(text).then(function(){alert('Đã copy '+ids.size+' ảnh (đã lọc Voucher Xtra)! Trở lại ứng dụng và dán (Ctrl+V) vào ô link để tải.');}).catch(function(){prompt('Không thể copy tự động, hãy COPY ĐOẠN MÃ DƯỚI ĐÂY và dán vào ứng dụng:',text);});}catch(e){prompt('Không thể copy tự động, hãy COPY ĐOẠN MÃ DƯỚI ĐÂY và dán vào ứng dụng:',text);}}else{alert('Không tìm thấy ảnh trên trang này!');}})();`;

const ShopeeScraperTab: React.FC = () => {
    const [urls, setUrls] = useState<string>('');
    const [filterPromoBadges, setFilterPromoBadges] = useState<boolean>(() => {
        const saved = localStorage.getItem('shopee_filter_promo_badges');
        return saved !== null ? saved === 'true' : true;
    });
    const [apiIntegrationType, setApiIntegrationType] = useState<'shopify' | 'wordpress' | 'custom'>(() => (localStorage.getItem('api_integration_type') as any) || 'shopify');
    const [apiEndpoint, setApiEndpoint] = useState<string>(() => localStorage.getItem('api_endpoint') || '');
    const [apiToken, setApiToken] = useState<string>(() => localStorage.getItem('api_token') || '');
    const [autoPush, setAutoPush] = useState<boolean>(() => localStorage.getItem('api_auto_push') === 'true');
    const [results, setResults] = useState<ScrapeResult[]>([]);
    const [isScraping, setIsScraping] = useState(false);
    const [progressStats, setProgressStats] = useState({ total: 0, done: 0 });
    const [realtimeValidation, setRealtimeValidation] = useState<{message: string, isError: boolean} | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const bookmarkletRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        let es: EventSource | null = null;
        try {
            es = new EventSource('/api/bookmarklet/stream');
            es.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'SHOPEE' && data.images && data.images.length > 0) {
                    let processedImages = (data.images as string[]).filter((u: string) => !isShopeePromotionalOverlay(u));
                    setRealtimeValidation({ message: `Đã nhận thành công ${processedImages.length} ảnh trực tiếp từ Bookmarklet (đã loại bỏ Voucher Xtra)!`, isError: false });

                    const newResult: ScrapeResult = {
                        url: data.url || `Gửi từ Bookmarklet lúc ${new Date().toLocaleTimeString()}`,
                        status: 'success',
                        main: processedImages,
                        variants: [],
                        description: [],
                        videos: [],
                        title: data.title || 'Sản phẩm từ Bookmarklet Shopee',
                        color: '',
                        isExpanded: false,
                        activeCategory: 'all'
                    };

                    setResults(prev => [newResult, ...prev]);
                    if (autoPush) {
                        pushDataToAPI(newResult, 'product');
                    }

                    setTimeout(() => setRealtimeValidation(null), 3000);
                }
            };
        } catch (err) {
            console.error("SSE Error:", err);
        }
        return () => {
            if (es) es.close();
        };
    }, [autoPush, apiEndpoint, apiToken, apiIntegrationType]);

    useEffect(() => {
        localStorage.setItem('api_integration_type', apiIntegrationType);
        localStorage.setItem('api_endpoint', apiEndpoint);
        localStorage.setItem('api_token', apiToken);
        localStorage.setItem('api_auto_push', autoPush.toString());
        localStorage.setItem('shopee_filter_promo_badges', filterPromoBadges.toString());
    }, [apiIntegrationType, apiEndpoint, apiToken, autoPush, filterPromoBadges]);

    const getBookmarkletUrl = () => {
        const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `javascript:(function(){var html=document.documentElement.innerHTML;var matches=html.match(/(?:cf.shopee.vn\\/file\\/|down-vn.img.susercontent.com\\/file\\/)([a-zA-Z0-9-_.]{15,})/g)||[];var ids=new Set();matches.forEach(m=>{var id=m.replace('cf.shopee.vn/file/','').replace('down-vn.img.susercontent.com/file/','').replace(/%22/g,'').replace(/&quot;/g,'').replace(/"/g,'');if(id&&id.length>10&&!id.includes('<')&&!id.includes('>')&&!id.includes('11134258')&&!id.includes('mmpn5o534ft15b')&&!id.includes('mtclqut2p154c1')&&!id.toLowerCase().includes('voucher')&&!id.toLowerCase().includes('xtra'))ids.add(id);});if(ids.size>0){var images=Array.from(ids).map(id=>'https://down-vn.img.susercontent.com/file/'+id);var div=document.createElement('div');div.style.cssText='position:fixed;top:20px;right:20px;background:#f97316;color:white;padding:15px;border-radius:8px;z-index:999999;font-family:sans-serif;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);';div.innerText='Đang gửi '+images.length+' ảnh về ứng dụng...';document.body.appendChild(div);fetch('${appUrl}/api/bookmarklet/receive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'SHOPEE',images:images,url:window.location.href,title:document.title})}).then(r=>r.json()).then(data=>{var m=data.success?data.message:'Lỗi: '+data.error;div.innerText=m;div.style.background=data.success?'#10b981':'#ef4444';setTimeout(function(){div.remove();},4000);}).catch(e=>{div.innerText='Lỗi nối mạng! Vui lòng thử lại hoặc tắt chặn QC.';div.style.background='#ef4444';setTimeout(function(){div.remove();},4000);});}else{alert('Không tìm thấy ảnh trên trang này!');}})();`;
    };

    useEffect(() => {
        if (bookmarkletRef.current) {
            bookmarkletRef.current.href = getBookmarkletUrl();
        }
    }, [filterPromoBadges]);

    const handleUrlsChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setUrls(val);
        setRealtimeValidation(null);

        if (!val.trim()) return;

        try {
            // 1. Detect Bookmarklet paste
            const matchBookmarklet = val.match(/SHOPEE_HTML_EXTRACT\|([a-zA-Z0-9-_.+,]+)/);
            if (matchBookmarklet) {
                let ids = matchBookmarklet[1].split(',');
                if (filterPromoBadges) {
                    ids = ids.filter(id => !isShopeePromotionalOverlay(id));
                }
                if (ids.length > 0) {
                    setRealtimeValidation({ message: `Đã dán ${ids.length} ảnh trực tiếp từ Bookmarklet (đã lọc Voucher Xtra). Đang tự động xử lý...`, isError: false });
                    
                    let processedImages = ids.map(id => `https://down-vn.img.susercontent.com/file/${id}`);
                    
                    setTimeout(async () => {
                        setUrls(''); 
                        setRealtimeValidation(null);

                        const newResult: ScrapeResult = {
                            url: `Qua Bookmarklet lúc ${new Date().toLocaleTimeString()}`,
                            status: 'success',
                            main: processedImages,
                            variants: [],
                            description: [],
                            videos: [],
                            title: 'Sản phẩm từ Bookmarklet',
                            color: '',
                            isExpanded: false,
                            activeCategory: 'all'
                        };

                        setResults(prev => [newResult, ...prev]);
                        if (autoPush) {
                            pushDataToAPI(newResult, 'product');
                        }
                    }, 500);
                    return;
                }
            }

            // 2. Detect Raw HTML paste
            if (val.length > 1000 && (val.includes('<html') || val.includes('cf.shopee.vn/file/'))) {
                const { parseShopeeRawHtml } = await import('../../utils/ecommerceScraper');
                const parsed = parseShopeeRawHtml(val);
                const totalImgs = parsed.main.length + parsed.variants.length;

                if (totalImgs > 0) {
                    setRealtimeValidation({ message: `Đã tìm thấy ${totalImgs} ảnh và ${parsed.variantGroups?.length || 0} phân loại từ mã nguồn! Đang tự động xử lý...`, isError: false });
                    
                    setTimeout(async () => {
                        setUrls(''); // Clear the massive HTML to prevent lag
                        setRealtimeValidation(null);

                        let cleanMain = filterPromoBadges ? parsed.main.filter(u => !isShopeePromotionalOverlay(u)) : parsed.main;
                        let cleanVariants = filterPromoBadges ? parsed.variants.filter(u => !isShopeePromotionalOverlay(u)) : parsed.variants;

                        const newResult: ScrapeResult = {
                            url: `Mã nguồn dán lúc ${new Date().toLocaleTimeString()}`,
                            status: 'success',
                            main: cleanMain,
                            variants: cleanVariants,
                            variantNames: parsed.variantNames,
                            variantGroups: parsed.variantGroups,
                            description: parsed.description || [],
                            videos: parsed.videos || [],
                            title: parsed.title || 'Sản phẩm từ Mã Nguồn',
                            color: '',
                            isExpanded: true,
                            activeCategory: 'all'
                        };

                        setResults(prev => [newResult, ...prev]);
                        if (autoPush) {
                            pushDataToAPI(newResult, 'product');
                        }
                    }, 800);
                    return;
                }
            }

            // 2. Normal URL list handline
            const lines = val.split('\n').map(u => u.trim()).filter(u => u.length > 5);
            if (lines.length === 0) return;

            const { extractShopeeIds } = await import('../../utils/ecommerceScraper');
            let hasNewValid = false;
            let lastValidId = '';
            const urlsToProcess: string[] = [];
            const remainingUrls: string[] = [];
            
            for (const line of lines) {
                const url = line.startsWith('http') ? line : `https://${line}`;
                const ids = extractShopeeIds(url);
                if (ids) {
                    if (!results.some(r => r.url === url || r.url.startsWith(url + '#'))) {
                        hasNewValid = true;
                        lastValidId = ids.itemId;
                        urlsToProcess.push(url);
                    } else {
                        remainingUrls.push(line);
                    }
                } else {
                    remainingUrls.push(line);
                }
            }

            if (hasNewValid) {
                setRealtimeValidation({ message: `Đã tìm thấy ID ${lastValidId}. Đang tự động xử lý...`, isError: false });
                setUrls(remainingUrls.join('\n'));
                
                setTimeout(() => setRealtimeValidation(null), 3000);
                executeScrape(urlsToProcess);
            } else if (lines.length > 0 && urlsToProcess.length === 0 && !remainingUrls.some(line => { const url = line.startsWith('http') ? line : `https://${line}`; return extractShopeeIds(url) !== null; })) {
                const isLookingLikeUrl = lines.some(l => l.includes('shopee') && !l.includes(' '));
                if (isLookingLikeUrl && val.length < 1000) {
                    setRealtimeValidation({ message: 'URL không hợp lệ hoặc không có ID sản phẩm', isError: true });
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const pushDataToAPI = async (data: any, type: string) => {
        if (!autoPush || !apiEndpoint || !apiToken) return;
        try {
            const res = await fetch('/api/integration/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ integrationType: apiIntegrationType, endpoint: apiEndpoint, token: apiToken, data, type })
            });
            const result = await res.json();
            if (!res.ok) {
                setRealtimeValidation({ message: `Lỗi đồng bộ: ${result.error || 'Server error'}`, isError: true });
            } else {
                setRealtimeValidation({ message: `Đã đồng bộ ${type} thành công.`, isError: false });
            }
        } catch (e: any) {
             setRealtimeValidation({ message: `Lỗi kết nối API: ${e.message}`, isError: true });
        }
    };

    const handleSyncSelected = async (result: ScrapeResult) => {
        setRealtimeValidation({ message: `Đang đồng bộ dữ liệu...`, isError: false });
        await pushDataToAPI(result, 'product');
    };

    const executeScrape = async (urlList: string[]) => {
        if (urlList.length === 0) return;

        const initialResults: ScrapeResult[] = urlList.map(url => ({
            url,
            status: 'loading',
            main: [],
            variants: [],
            description: [],
            videos: [],
            title: '',
            color: '',
            isExpanded: false,
            activeCategory: 'all'
        }));

        setResults(prev => [...initialResults, ...prev]);
        setIsScraping(true);
        setProgressStats(prev => ({ total: prev.total + urlList.length, done: prev.done }));

        for (const url of urlList) {
            try {
                // Attempt specialized scrape first (can detect colors/variants)
                try {
                    const { specializedScrape, splitProductIntoVariantRows } = await import('../../utils/ecommerceScraper');
                    const { groupMediaByColorWithAI } = await import('../../services/geminiService');

                    let productData: any = await specializedScrape(url, 'shopee');
                    if (productData && !Array.isArray(productData) && productData.variantGroups && productData.variantGroups.length > 1) {
                        productData = splitProductIntoVariantRows(productData, url);
                    }
                    
                    if (Array.isArray(productData) && productData.length > 1 && productData[0].fullMedia && productData[0].colorGroups) {
                        try {
                            const refinedGrouping = await groupMediaByColorWithAI(productData[0].fullMedia, productData[0].colorGroups);
                            if (Object.keys(refinedGrouping).length > 0) {
                                productData = productData.map(d => {
                                    if (d.color && refinedGrouping[d.color]) {
                                        let newMain = refinedGrouping[d.color];
                                        if (d.sizeCharts && d.sizeCharts.length > 0) {
                                            newMain = [...newMain, ...d.sizeCharts];
                                        }
                                        return { ...d, main: newMain };
                                    }
                                    return d;
                                });
                            }
                        } catch (e) {
                            console.error("AI grouping failed in raw scraper:", e);
                        }
                    }

                    if (Array.isArray(productData) && productData.length > 0) {
                        
                        setResults(prev => {
                            const others = prev.filter(r => r.url !== url);
                            
                            const newItems: ScrapeResult[] = (productData as any[]).map(d => {
                                const cleanMain = Array.from(new Set((d.main || []).map((x: any) => String(x)))) as string[];
                                const cleanVariants = Array.from(new Set((d.variants || []).map((x: any) => String(x)))) as string[];
                                const cleanDesc = Array.from(new Set((d.description || []).map((x: any) => String(x)))) as string[];
                                return {
                                    url: (productData as any[]).length > 1 && d.color ? `${url}#${d.color}` : url,
                                    status: 'success' as const,
                                    main: filterPromoBadges ? cleanMain.filter(u => !isShopeePromotionalOverlay(u)) : cleanMain,
                                    variants: filterPromoBadges ? cleanVariants.filter(u => !isShopeePromotionalOverlay(u)) : cleanVariants,
                                    description: filterPromoBadges ? cleanDesc.filter(u => !isShopeePromotionalOverlay(u)) : cleanDesc,
                                    descriptionText: d.descriptionText || '',
                                    videos: Array.from(new Set((d.videos || []).map((x: any) => String(x)))) as string[],
                                    title: d.title || '',
                                    color: d.color || '',
                                    isExpanded: false,
                                    activeCategory: 'all' as const
                                };
                            });
                            
                            if (autoPush) {
                                newItems.forEach(item => pushDataToAPI(item, 'product'));
                            }

                            // Insert in place of the loading item
                            const idx = prev.findIndex(r => r.url === url && r.status === 'loading');
                            if (idx !== -1) {
                                const newPrev = [...prev];
                                newPrev.splice(idx, 1, ...newItems);
                                return newPrev;
                            }
                            return [...newItems, ...others];
                        });
                        continue; // specialized scrape succeeded, move to next URL
                    } else if (productData && !Array.isArray(productData) && ((productData.main as any)?.length > 0 || (productData.variants as any)?.length > 0)) {
                        let main = Array.from(new Set(((productData as any).main || []).map((x: any) => String(x)))) as string[];
                        let variants = Array.from(new Set(((productData as any).variants || []).map((x: any) => String(x)))) as string[];
                        let description = Array.from(new Set(((productData as any).description || []).map((x: any) => String(x)))) as string[];

                        if (filterPromoBadges) {
                            main = main.filter(u => !isShopeePromotionalOverlay(u));
                            variants = variants.filter(u => !isShopeePromotionalOverlay(u));
                            description = description.filter(u => !isShopeePromotionalOverlay(u));
                        }

                        const newItem: ScrapeResult = { 
                            url, 
                            status: 'success', 
                            main, 
                            variants, 
                            variantNames: (productData as any).variantNames,
                            variantGroups: (productData as any).variantGroups,
                            description, 
                            descriptionText: (productData as any).descriptionText || '', 
                            videos: Array.from(new Set(((productData as any).videos || []).map((x: any) => String(x)))) as string[], 
                            title: (productData as any).title || '', 
                            color: (productData as any).color || '',
                            isExpanded: true,
                            activeCategory: 'all'
                        };

                        setResults(prev => prev.map(r => 
                            (r.url === url && r.status === 'loading') 
                                ? newItem 
                                : r
                        ));

                        if (autoPush) {
                            pushDataToAPI(newItem, 'product');
                        }
                        continue; // specialized scrape succeeded, move to next URL
                    }
                } catch (e) {
                    console.warn("Specialized scrape fallback:", e);
                }

                // Fallback to HTML parsing if specialized scrape returned null or threw
                const html = await fetchWithFallback(url, 'text');
                
                if (!html) {
                    throw new Error("Shopee đang chặn lấy dữ liệu từ link này. Bạn có thể sử dụng tab 'Đào Ảnh Hàng Loạt' với link webcache của Google.");
                }

                // Parse structured JSON data (tier_variations & models) from HTML scripts
                const parseShopeeJson = (key: string) => {
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

                const rawTiers = parseShopeeJson("tier_variations");
                const rawModels = parseShopeeJson("models");
                const varResult = extractShopeeVariations(rawTiers, rawModels);

                // Regex to find image URLs
                const regex = /https?:\/\/[^\s"',]+\.(?:jpg|jpeg|png|webp)/gi;
                const matches: string[] = html.match(regex) || [];
                
                // Get title
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                let title = titleMatch ? titleMatch[1].trim() : '';
                // remove redundant info if any
                title = title.split('|')[0].split('-')[0].trim();

                // Deduplicate and filter out small icons/svgs or tracking images
                let uniqueImages: string[] = Array.from(new Set(matches));
                
                uniqueImages = uniqueImages.filter((img: string) => {
                    if (filterPromoBadges && isShopeePromotionalOverlay(img)) return false;
                    const l = img.toLowerCase();
                    return !l.includes('icon') && 
                           !l.includes('favicon') && 
                           !l.includes('logo') &&
                           !l.includes('tracking') &&
                           !l.includes('transparent') &&
                           img.length > 25;
                });

                if (uniqueImages.length === 0 && varResult.variantImages.length === 0) {
                    throw new Error("Shopee đang chặn hệ thống tự động bóc tách dữ liệu từ link này. Mẹo: Bạn có thể lưu trang Shopee thành file HTML (.html) rồi dán vào tab 'Đào Ảnh' để lấy ảnh gốc thành công.");
                }

                let mainImages = uniqueImages.filter(img => !varResult.variantImages.includes(img));
                if (mainImages.length === 0 && uniqueImages.length > 0) {
                    mainImages = uniqueImages;
                }

                const { splitProductIntoVariantRows } = await import('../../utils/ecommerceScraper');

                if (varResult.groups && varResult.groups.length > 1) {
                    const splitRows = splitProductIntoVariantRows({
                        title,
                        main: mainImages,
                        variants: varResult.variantImages,
                        variantNames: varResult.variantNames,
                        variantGroups: varResult.groups,
                        description: [],
                        videos: []
                    }, url);

                    const newItems: ScrapeResult[] = splitRows.map(d => ({
                        url: `${url}#${d.color}`,
                        status: 'success' as const,
                        main: d.main,
                        variants: d.variants,
                        variantNames: d.variantNames,
                        variantGroups: d.variantGroups as any,
                        description: [],
                        videos: [],
                        title: d.title,
                        color: d.color || '',
                        isExpanded: false,
                        activeCategory: 'all' as const
                    }));

                    setResults(prev => {
                        const idx = prev.findIndex(r => r.url === url && r.status === 'loading');
                        if (idx !== -1) {
                            const next = [...prev];
                            next.splice(idx, 1, ...newItems);
                            return next;
                        }
                        return [...newItems, ...prev.filter(r => r.url !== url)];
                    });

                    if (autoPush) {
                        newItems.forEach(item => pushDataToAPI(item, 'product'));
                    }
                } else {
                    const newItem: ScrapeResult = {
                        url,
                        status: 'success', 
                        main: mainImages, 
                        variants: varResult.variantImages,
                        variantNames: varResult.variantNames,
                        variantGroups: varResult.groups,
                        description: [],
                        videos: [],
                        title,
                        color: '',
                        isExpanded: true,
                        activeCategory: 'all'
                    };
                    setResults(prev => prev.map(r => 
                        (r.url === url && r.status === 'loading') 
                            ? newItem
                            : r
                    ));
                    if (autoPush) {
                        pushDataToAPI(newItem, 'product');
                    }
                }
            } catch (error: any) {
                setResults(prev => prev.map(r => 
                    (r.url === url && r.status === 'loading') 
                        ? { ...r, status: 'error', error: error.message } 
                        : r
                ));
            } finally {
                setProgressStats(prev => ({ ...prev, done: prev.done + 1 }));
            }
        }

        setIsScraping(false);

        // Save history
        if (auth.currentUser) {
            try {
                await addHistory(STORE_NAMES.SCRAPINGS, {
                    uid: auth.currentUser.uid,
                    userEmail: auth.currentUser.email || 'N/A',
                    actionType: 'Đào Shopee',
                    details: {
                        urls: urlList.length,
                        target: urlList[0] || ''
                    },
                    status: 'success',
                    createdAt: Date.now()
                });
            } catch (err) {
                console.error("Failed to save history", err);
            }
        }
    };

    const handleScrape = async () => {
        const urlList = urls.split('\n')
            .map(u => u.trim())
            .filter(u => u.length > 5)
            .map(u => u.startsWith('http') ? u : `https://${u}`);
            
        setUrls(''); // clear input after starting
        setProgressStats({ total: 0, done: 0 }); // reset stats
        await executeScrape(urlList);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files) as File[];
        const htmlFiles = files.filter((f: File) => f.name.endsWith('.html') || f.name.endsWith('.htm') || f.type === 'text/html');
        
        if (htmlFiles.length === 0) return;

        const newResults: ScrapeResult[] = [];
        
        for (const file of htmlFiles) {
            try {
                const html = await file.text();
                let processedImages: string[] = [];
                let title = file.name.replace(/\.html?$/i, '');
                
                // For Shopee specalized check
                const fullUrlMatches = (html.match(/(?:cf\.shopee\.vn\/file\/|down-vn\.img\.susercontent\.com\/file\/)([a-zA-Z0-9-_.]{15,})/g) as string[]) || [];
                const allFoundIds = new Set<string>();
                fullUrlMatches.forEach((m) => {
                    const id = m.replace('cf.shopee.vn/file/', '')
                                .replace('down-vn.img.susercontent.com/file/', '')
                                .replace(/\"/g, '');
                    if (id && id.length > 10 && !id.includes('<') && !id.includes('>')) {
                        if (!filterPromoBadges || !isShopeePromotionalOverlay(id)) {
                            allFoundIds.add(id);
                        }
                    }
                });
                
                if (allFoundIds.size > 0) {
                    processedImages = Array.from(allFoundIds).map(id => `https://down-vn.img.susercontent.com/file/${id}`);
                }
                
                if (processedImages.length > 0) {
                    const newItem: ScrapeResult = {
                        url: `File: ${file.name}`,
                        status: 'success',
                        main: processedImages,
                        variants: [],
                        description: [],
                        videos: [],
                        title: title,
                        color: '',
                        isExpanded: false,
                        activeCategory: 'all'
                    };
                    newResults.push(newItem);
                    if (autoPush) {
                        pushDataToAPI(newItem, 'product');
                    }
                }
            } catch (err) {
                console.error("Error reading dropped file:", err);
            }
        }
        
        if (newResults.length > 0) {
            setResults(prev => [...newResults, ...prev]);
        } else {
            alert('Không tìm thấy ảnh Shopee hợp lệ trong file HTML này!');
        }
    };

    const handleRemoveResult = (urlToRemove: string) => {
        setResults(prev => prev.filter(r => r.url !== urlToRemove));
    };

    const toggleExpand = (urlToToggle: string) => {
        setResults(prev => prev.map(r => r.url === urlToToggle ? { ...r, isExpanded: !r.isExpanded } : r));
    }

    const clearAll = () => {
        if (confirm("Bạn có chắc muốn xóa tất cả kết quả?")) {
            setResults([]);
        }
    }

    const updateResultMetadata = (url: string, field: 'title' | 'color', value: string) => {
        setResults(prev => prev.map(r => r.url === url ? { ...r, [field]: value } : r));
    }

    const handleExportExcel = () => {
        if (results.length === 0) {
            alert('Không có dữ liệu để xuất');
            return;
        }

        const exportData = results.map((r, idx) => ({
            stt: idx + 1,
            url: r.url,
            title: r.title || r.url,
            color: r.color,
            main: r.main || [],
            variants: r.variants || [],
            variantNames: r.variantNames || {},
            variantGroups: r.variantGroups || [],
            description: r.description || [],
            descriptionText: r.descriptionText,
            videos: r.videos || [],
            status: r.status,
            error: (r as any).error
        }));

        exportShopeeDataToXLSX(exportData);
    }

    const handleCopyAllLinks = async (result: ScrapeResult) => {
        const allImages = Array.from(new Set([...result.main, ...result.variants, ...result.description]));
        const itemsToCopy = result.activeCategory === 'all' ? allImages :
                                result.activeCategory === 'main' ? result.main :
                                result.activeCategory === 'variants' ? result.variants :
                                result.activeCategory === 'description' ? result.description :
                                result.activeCategory === 'video' ? result.videos :
                                allImages;
        
        if (!itemsToCopy.length) return;
        
        try {
            await navigator.clipboard.writeText(itemsToCopy.join('\n'));
            alert('Đã copy ' + itemsToCopy.length + ' link ' + (result.activeCategory === 'video' ? 'video' : 'ảnh') + ' vào clipboard!');
        } catch (e) {
            console.error('Failed to copy', e);
            alert('Lỗi khi copy link!');
        }
    }

    const handleDownloadAll = async (result: ScrapeResult) => {
        const allImages = Array.from(new Set([...result.main, ...result.variants, ...result.description]));
        const itemsToDownload = result.activeCategory === 'all' ? allImages :
                                result.activeCategory === 'main' ? result.main :
                                result.activeCategory === 'variants' ? result.variants :
                                result.activeCategory === 'description' ? result.description :
                                result.activeCategory === 'video' ? result.videos :
                                allImages;
        
        if (!itemsToDownload.length) return;
        
        try {
            const zip = new JSZip();
            let hostname = 'unknown';
            try { hostname = new URL(result.url).hostname.replace(/\./g, '_'); } catch {}
            
            const folderName = `RAW_Media_${hostname}`;
            const folder = zip.folder(folderName);
            
            if (!folder) throw new Error("Could not create ZIP folder");

            const downloadPromises = itemsToDownload.map(async (mediaUrl, idx) => {
                try {
                    const response = await fetch(`/api/proxy?url=${encodeURIComponent(mediaUrl)}`);
                    const blob = await response.blob();
                    
                    let ext = 'jpg';
                    const lowerUrl = mediaUrl.toLowerCase();
                    if (lowerUrl.includes('.png')) ext = 'png';
                    if (lowerUrl.includes('.webp')) ext = 'webp';
                    if (lowerUrl.includes('.jpeg')) ext = 'jpeg';
                    if (lowerUrl.includes('.mp4')) ext = 'mp4';
                    
                    folder.file(`${idx.toString().padStart(3, '0')}.${ext}`, blob);
                } catch (e) {
                    console.error("Failed to download", mediaUrl, e);
                }
            });

            await Promise.allSettled(downloadPromises);
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `${folderName}.zip`);
        } catch (error) {
            console.error(error);
            alert("Có lỗi khi tạo file ZIP");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800/50">
                    {isScraping && (
                        <motion.div 
                            className="h-full bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${(progressStats.done / progressStats.total) * 100}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    )}
                </div>

                <div className="flex items-start gap-5 mb-8 relative">
                    <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-400 border border-orange-500/20 shadow-inner">
                        <LinkIcon className="w-7 h-7" />
                    </div>
                    <div className="pt-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Máy Xúc Shopee</h2>
                            <span className="px-2.5 py-1 rounded-md bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest border border-orange-500/20">Data Miner</span>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                            Dán liên kết sản phẩm Shopee để tự động bóc tách ảnh chính, phân loại màu sắc và video. Hỗ trợ hệ thống quét tự động thông minh.
                        </p>
                    </div>
                </div>

                <div className="space-y-5">
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative rounded-xl transition-all duration-200 border-2 ${isDragOver ? 'border-orange-500 bg-orange-500/5' : 'border-transparent'}`}
                    >
                        {isDragOver && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 rounded-xl backdrop-blur-sm pointer-events-none">
                                <div className="text-orange-400 font-bold flex flex-col items-center gap-2">
                                    <Download className="w-8 h-8 animate-bounce" />
                                    <span>Thả file HTML của Shopee vào đây</span>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-sm font-semibold text-zinc-300">Nhập Link, Dán Mã nguồn (Ctrl+U), File HTML hoặc Bookmarklet</label>
                            
                            <a
                                ref={bookmarkletRef}
                                onClick={(e) => { e.preventDefault(); alert('Kéo nút này lên thanh Dấu trang (Bookmarks bar) của bạn. Khi đang xem sản phẩm Shopee, hãy bấm vào Dấu trang đó để lấy ngay tất cả ảnh!'); }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full hover:bg-orange-500/20 transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                                + Shopee Lấy Ảnh (Kéo lên Bookmarks)
                            </a>
                        </div>
                        <textarea
                            value={urls}
                            onChange={handleUrlsChange}
                            placeholder="🔗 Gợi ý tải ảnh siêu nhanh: 
1. Kéo mục '+ Shopee Lấy Ảnh' ở trên lên thanh dấu trang trình duyệt.
2. Mở một trang sản phẩm Shopee, click vào dấu trang đó.
3. Quay lại đây và dán (Ctrl+V) để tải toàn bộ ảnh!"
                            rows={8}
                            className={`w-full bg-zinc-900/70 border rounded-md py-2 px-3 text-zinc-200 placeholder-zinc-500 focus:ring-2 outline-none transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs focus:border-orange-500/50 ${realtimeValidation?.isError ? 'border-red-500/50 focus:border-red-500/50 ring-red-500/50' : isDragOver ? 'border-orange-500/50 ring-2 ring-orange-500/50' : 'border-zinc-600 focus:ring-orange-500/50'}`}
                        />
                        <AnimatePresence>
                            {realtimeValidation && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={`text-xs mt-2 flex items-center font-semibold ${realtimeValidation.isError ? 'text-red-400' : 'text-emerald-400'}`}
                                >
                                    {realtimeValidation.isError ? <AlertCircle className="w-4 h-4 mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                                    {realtimeValidation.message}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    
                    <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-zinc-200">Đồng bộ Dữ liệu Tự động (API Integration)</h3>
                                <p className="text-xs text-zinc-500 mt-1">Gửi dữ liệu trực tiếp lên Shopify, WooCommerce hoặc PIM nội bộ.</p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="form-checkbox bg-zinc-900 border-zinc-700 rounded text-orange-500 focus:ring-orange-500/50"
                                    checked={autoPush}
                                    onChange={(e) => setAutoPush(e.target.checked)}
                                    disabled={isScraping}
                                />
                                <span className="text-xs font-semibold text-zinc-300">Kích hoạt</span>
                            </label>
                        </div>
                        {autoPush && (
                            <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Nền tảng</label>
                                    <select 
                                        value={apiIntegrationType}
                                        onChange={e => setApiIntegrationType(e.target.value as any)}
                                        className="w-full bg-zinc-900/70 border border-zinc-600 rounded-md py-2 px-3 text-zinc-200 focus:ring-2 outline-none transition duration-200 text-xs focus:ring-orange-500/50 focus:border-orange-500/50"
                                    >
                                        <option value="shopify">Shopify</option>
                                        <option value="wordpress">WordPress (WooCommerce)</option>
                                        <option value="custom">Custom API / PIM</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">API Endpoint / Domain</label>
                                        <TextInput
                                            value={apiEndpoint}
                                            onChange={(e) => setApiEndpoint(e.target.value)}
                                            placeholder={apiIntegrationType === 'shopify' ? "VD: mystore.myshopify.com" : "https://api.yourdomain.com/v1/products"}
                                            disabled={isScraping}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">API Token / Secret Key</label>
                                        <input
                                            type="password"
                                            value={apiToken}
                                            onChange={(e) => setApiToken(e.target.value)}
                                            placeholder="xxxxxxxxxxxxxxxxxxxx"
                                            disabled={isScraping}
                                            className="w-full bg-zinc-900/70 border border-zinc-600 rounded-md py-2 px-3 text-zinc-200 placeholder-zinc-500 focus:ring-2 outline-none transition duration-200 disabled:opacity-50 font-mono text-xs focus:ring-orange-500/50 focus:border-orange-500/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-900/60 px-3.5 py-2 rounded-xl border border-zinc-700/50 hover:border-orange-500/30 transition-colors">
                            <input 
                                type="checkbox" 
                                className="form-checkbox bg-zinc-900 border-zinc-600 rounded text-orange-500 focus:ring-orange-500/50"
                                checked={filterPromoBadges}
                                onChange={(e) => setFilterPromoBadges(e.target.checked)}
                            />
                            <span className="text-xs font-medium text-zinc-300">
                                Mặc định loại bỏ ảnh Voucher Xtra & Khung KM Shopee
                            </span>
                            <span className="ml-auto sm:ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                Đang bật
                            </span>
                        </label>

                        <Button 
                            onClick={handleScrape}
                            className="bg-orange-500 hover:bg-orange-600 text-white min-w-[160px] py-2.5 rounded-xl shadow-lg shadow-orange-500/20 font-semibold"
                            disabled={isScraping || !urls.trim()}
                        >
                            {isScraping ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-3" />
                                    Đang xử lý {progressStats.done}/{progressStats.total}
                                </>
                            ) : (
                                "Tiến Hành Đào Dữ Liệu"
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {results.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-4 gap-4 px-2">
                    <div>
                        <h3 className="font-bold text-white text-xl tracking-tight">Kết Quả Thu Thập</h3>
                        <p className="text-sm text-zinc-500 mt-1">Đã xử lý xong {results.length} liên kết</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button 
                            onClick={clearAll}
                            disabled={isScraping}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            Xóa Bản Nháp
                        </button>

                        <div className="relative flex-1 sm:flex-none">
                            <Button 
                                onClick={handleExportExcel} 
                                colorScheme="green" 
                                className="!w-full sm:!w-auto !px-5 !py-2.5 text-sm font-semibold shadow-xl shadow-green-900/20 rounded-xl flex items-center justify-center gap-2"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Xuất File Excel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-5">
                <AnimatePresence mode="popLayout">
                    {results.map((result, idx) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            key={`${result.url}-${idx}`}
                            className="bg-zinc-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden shadow-lg transition-colors group"
                        >
                            <div className="p-5 flex flex-col lg:flex-row gap-5 items-start justify-between">
                                <div className="flex-1 min-w-0 w-full md:w-[60%] lg:w-[45%]">
                                    <div className="flex items-center gap-2.5 mb-4">
                                        {result.status === 'loading' && <Loader2 className="w-5 h-5 text-orange-400 animate-spin flex-shrink-0" />}
                                        {result.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                                        {result.status === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />}
                                        
                                        <div className="px-3 py-1 rounded-md bg-black/40 border border-white/5 text-zinc-400 font-mono text-[10px] sm:text-xs truncate max-w-[200px] sm:max-w-md w-fit">
                                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 hover:underline transition-colors block truncate">
                                                {result.url}
                                            </a>
                                        </div>
                                    </div>

                                    {result.status === 'success' && (
                                        <div className="flex flex-col gap-3">
                                            <div className="w-full">
                                                <input 
                                                    type="text" 
                                                    value={result.title}
                                                    onChange={e => updateResultMetadata(result.url, 'title', e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm font-semibold text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                                                    placeholder="Tên sản phẩm..."
                                                />
                                            </div>
                                            <div className="w-full sm:w-1/2">
                                                <input 
                                                    type="text" 
                                                    value={result.color}
                                                    onChange={e => updateResultMetadata(result.url, 'color', e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm font-medium text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                                                    placeholder="Phân loại / Màu sắc..."
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {result.status === 'error' && (
                                        <div className="mt-2 text-rose-400/90 text-sm font-medium p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                            Lỗi bóc tách: {result.error}
                                        </div>
                                    )}
                                    {result.status === 'success' && result.main.length === 0 && result.variants.length === 0 && result.description.length === 0 && result.videos.length === 0 && (
                                        <div className="mt-2 text-amber-400/90 text-sm font-medium p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                            Không tìm thấy ảnh hoặc video. Thử dán trực tiếp link chi tiết.
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 lg:ml-auto w-full lg:w-auto h-full lg:self-stretch justify-end">
                                    {result.status === 'success' && (result.main.length > 0 || result.variants.length > 0 || result.description.length > 0 || result.videos.length > 0) && (
                                        <>
                                            <div className="hidden md:flex flex-wrap items-center gap-4 mr-2 text-xs font-medium text-zinc-500 p-3 bg-black/40 rounded-xl border border-white/5">
                                                <div className="flex items-center gap-1.5" title="Ảnh chính"><ImageIcon className="w-4 h-4 text-zinc-400"/> <span className="text-white">{result.main.length}</span></div>
                                                <div className="flex items-center gap-1.5" title="Phân loại"><Layers className="w-4 h-4 text-zinc-400"/> <span className="text-white">{Math.max(result.variants.length, result.variantGroups?.length || 0)}</span></div>
                                                <div className="flex items-center gap-1.5" title="Mô tả"><FileText className="w-4 h-4 text-zinc-400"/> <span className="text-white">{result.description.length}</span></div>
                                                <div className="flex items-center gap-1.5" title="Video"><Video className="w-4 h-4 text-zinc-400"/> <span className="text-white">{result.videos.length}</span></div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleCopyAllLinks(result)}
                                                className="flex items-center justify-center p-3 sm:px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm border border-white/5 active:scale-95"
                                                title="Copy toàn bộ link"
                                            >
                                                <Copy className="w-4 h-4 sm:mr-2" />
                                                <span className="hidden sm:inline">Copy Link</span>
                                            </button>

                                            <button 
                                                onClick={() => handleDownloadAll(result)}
                                                className="flex items-center justify-center p-3 sm:px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm border border-white/5 active:scale-95"
                                                title="Tải nén ZIP"
                                            >
                                                <Download className="w-4 h-4 sm:mr-2" />
                                                <span className="hidden sm:inline">Tải ZIP</span>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    const allImgs = [...(result.main || []), ...(result.variants || []), ...(result.description || [])];
                                                    const headers = ['STT', 'Tên sản phẩm', 'Giá', 'Link Shopee', 'Ảnh chính', 'Tất cả link ảnh'];
                                                    const mainImg = (result.main && result.main[0]) || '';
                                                    const priceVal = (result.variantGroups && (result.variantGroups[0] as any)?.models?.[0]?.price) 
                                                        ? String((result.variantGroups[0] as any).models[0].price) 
                                                        : '';
                                                    const row = [
                                                        idx + 1,
                                                        `"${(result.title || '').replace(/"/g, '""')}"`,
                                                        `"${priceVal.replace(/"/g, '""')}"`,
                                                        result.url,
                                                        mainImg,
                                                        `"${allImgs.join(' ; ').replace(/"/g, '""')}"`
                                                    ];
                                                    const tsvText = `${headers.join('\t')}\n${row.join('\t')}`;
                                                    navigator.clipboard.writeText(tsvText).then(() => {
                                                        toast.success(`Đã copy dữ liệu "${(result.title || '').substring(0, 30)}..."! Dán (Ctrl+V) vào Excel ngay.`);
                                                    }).catch(() => {
                                                        toast.error('Không thể copy vào clipboard.');
                                                    });
                                                }}
                                                className="flex items-center justify-center p-3 sm:px-4 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/40 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95"
                                                title="Sao chép thông tin sản phẩm dạng bảng (TSV) để nhấn Ctrl+V trực tiếp vào Excel"
                                            >
                                                <Copy className="w-4 h-4 sm:mr-1.5 text-teal-400" />
                                                <span className="hidden sm:inline">Copy Excel</span>
                                            </button>

                                            <button
                                                onClick={() => {
                                                    const allImgs = [...(result.main || []), ...(result.variants || []), ...(result.description || [])];
                                                    pushDataToPipeline({
                                                        title: result.title,
                                                        url: result.url,
                                                        sourceType: 'shopee',
                                                        images: allImgs,
                                                        description: result.descriptionText,
                                                        sourceTabLabel: 'Đào Shopee'
                                                    });
                                                    toast.success("Đã đẩy sang Luồng 1-Step!");
                                                }}
                                                className="flex items-center justify-center p-3 sm:px-4 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95"
                                                title="Chuyển dữ liệu sang Luồng 1-Step (Pipeline)"
                                            >
                                                <Layers className="w-4 h-4 sm:mr-1.5 text-emerald-400" />
                                                <span className="hidden sm:inline">Đẩy sang Luồng 1-Step</span>
                                            </button>

                                            <button
                                                onClick={() => toggleExpand(result.url)}
                                                className={`flex items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold transition-all border outline-none active:scale-95
                                                    ${result.isExpanded 
                                                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' 
                                                        : 'bg-transparent border-zinc-700 hover:border-zinc-500 text-white hover:bg-zinc-800'
                                                    }
                                                `}
                                            >
                                                {result.isExpanded ? 'Thu Gọn' : 'Xem Media'}
                                                <ChevronDown className={`w-4 h-4 ml-2 transition-transform duration-300 ${result.isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        </>
                                    )}

                                    <button 
                                        onClick={() => handleRemoveResult(result.url)} 
                                        className="p-3 text-zinc-500 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20 active:scale-95 flex-shrink-0"
                                        title="Xóa kết quả này"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence>
                                {result.isExpanded && (result.main.length > 0 || result.variants.length > 0 || result.description.length > 0 || result.videos.length > 0) && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden border-t border-zinc-800 bg-zinc-900/50"
                                    >
                                        <div className="p-4 sm:p-5">
                                            {/* Filter Tabs */}
                                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                                {(() => {
                                                    const allCount = result.main.length + result.variants.length + result.description.length;
                                                    
                                                    const FilterTab = ({ id, label, count, icon }: { id: 'all' | 'main' | 'variants' | 'description' | 'video', label: string, count: number, icon?: React.ReactNode }) => {
                                                        const isActive = result.activeCategory === id;
                                                        if (count === 0 && id !== 'all') return null;
                                                        
                                                        return (
                                                            <button
                                                                onClick={() => updateResultMetadata(result.url, 'activeCategory' as any, id)}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border
                                                                    ${isActive 
                                                                        ? 'bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-900/20' 
                                                                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                                                    }`}
                                                            >
                                                                {icon}
                                                                {label}
                                                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isActive ? 'bg-black/20 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                                                    {count}
                                                                </span>
                                                            </button>
                                                        );
                                                    };

                                                    return (
                                                        <>
                                                            <FilterTab id="all" label="Tất cả" count={allCount} />
                                                            <FilterTab id="main" label="Ảnh chính" count={result.main.length} icon={<ImageIcon className="w-3.5 h-3.5"/>} />
                                                            <FilterTab id="variants" label="Phân loại" count={Math.max(result.variants.length, result.variantGroups?.length || 0)} icon={<Layers className="w-3.5 h-3.5"/>} />
                                                            <FilterTab id="description" label="Mô tả" count={result.description.length} icon={<FileText className="w-3.5 h-3.5"/>} />
                                                            <FilterTab id="video" label="Video" count={result.videos.length} icon={<Video className="w-3.5 h-3.5"/>} />
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            {result.activeCategory === 'variants' && result.variantGroups && result.variantGroups.length > 0 && (
                                                <div className="mb-4 p-3 bg-zinc-950/70 rounded-xl border border-zinc-800 animate-in fade-in duration-200">
                                                    <div className="text-xs font-semibold text-zinc-300 mb-2 flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <Layers className="w-3.5 h-3.5 text-orange-400" />
                                                            <span>Các nhóm phân loại ({result.variantGroups.length} nhóm):</span>
                                                        </div>
                                                        <span className="text-[11px] text-zinc-500 font-mono">Đã nhóm theo Group ID</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {result.variantGroups.map((g, gIdx) => (
                                                            <div key={g.groupId || gIdx} className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs hover:border-zinc-700 transition-colors">
                                                                {g.image ? (
                                                                    <img src={g.image} alt={g.groupName} className="w-6 h-6 object-cover rounded border border-zinc-700/60 flex-shrink-0" />
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[9px] text-zinc-500 font-mono">N/A</div>
                                                                )}
                                                                <span className="font-medium text-white">{g.groupName || g.name}</span>
                                                                {g.models && g.models.length > 0 && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                                                                        {g.models.length} SKU{g.models.length > 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {(() => {
                                                    const getDisplayItems = () => {
                                                        switch (result.activeCategory) {
                                                            case 'main': return { images: result.main, category: 'main' };
                                                            case 'variants': {
                                                                const grpImgs = (result.variantGroups || []).map(g => g.image).filter(Boolean);
                                                                const combined = Array.from(new Set([...(result.variants || []), ...grpImgs]));
                                                                return { images: combined.length > 0 ? combined : result.main, category: 'variants' };
                                                            }
                                                            case 'description': return { images: result.description, category: 'description' };
                                                            case 'video': return { images: result.videos, category: 'videos' };
                                                            default: return { images: Array.from(new Set([...result.main, ...result.variants, ...result.description])), category: 'all' };
                                                        }
                                                    };
                                                    
                                                    const { images: displayImages, category } = getDisplayItems();

                                                    if (result.activeCategory === 'video') {
                                                        return displayImages.map((vid, idx) => (
                                                            <div key={idx} className="aspect-square bg-zinc-800 rounded-lg overflow-hidden relative group border border-zinc-700/50">
                                                                <video src={vid} controls className="w-full h-full object-cover" />
                                                            </div>
                                                        ))
                                                    }

                                                    return displayImages.map((img, idx) => (
                                                        <ImageHoverPreview
                                                            key={idx}
                                                            src={img}
                                                            alt={`Mục ${idx+1}`}
                                                            title={result.title}
                                                            category={category === 'all' ? undefined : (category === 'main' ? 'Ảnh chính' : category === 'variants' ? 'Phân loại' : 'Mô tả')}
                                                            variantLabel={result.variantNames?.[img]}
                                                            onDownload={(u) => {
                                                                const link = document.createElement('a');
                                                                link.href = u;
                                                                link.download = `shopee_${idx + 1}.jpg`;
                                                                link.target = '_blank';
                                                                link.click();
                                                            }}
                                                            previewWidth={420}
                                                            previewHeight={440}
                                                        >
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setResults(prev => prev.map(r => {
                                                                        if (r.url !== result.url) return r;
                                                                        const updatedMain = r.main.filter(i => i !== img);
                                                                        const updatedVariants = r.variants.filter(i => i !== img);
                                                                        const updatedDescription = r.description.filter(i => i !== img);
                                                                        return { ...r, main: updatedMain, variants: updatedVariants, description: updatedDescription };
                                                                    }));
                                                                }}
                                                                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 z-20"
                                                                title="Loại bỏ ảnh này"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </ImageHoverPreview>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ShopeeScraperTab;
