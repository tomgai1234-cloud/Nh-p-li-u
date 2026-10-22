import * as XLSX from 'xlsx';
import type { SingleGenerationResult, ExtractedResult, StandardizedNameResult } from '../types';

function escapeCSV(field: string): string {
    if (field === null || field === undefined) {
        return '';
    }
    let str = String(field);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = str.replace(/"/g, '""');
        return `"${str}"`;
    }
    return str;
}

export function exportToCSV(results: SingleGenerationResult[]) {
    if (results.length === 0) return;

    const headers = ['Trạng thái', 'Lỗi', 'Tên sản phẩm', 'Mô tả (Văn bản)', 'Mô tả (HTML)', 'Nguồn'];
    
    const rows = results.map(result => {
        const status = escapeCSV(result.status === 'success' ? 'Thành công' : 'Thất bại');
        const error = escapeCSV(result.error || '');
        const productName = escapeCSV(result.productName);
        const descriptionText = escapeCSV(result.descriptionText);
        const descriptionHtml = escapeCSV(result.descriptionHtml);
        const sources = escapeCSV(result.sources.map(s => `${s.title} (${s.uri})`).join('; '));
        return [status, error, productName, descriptionText, descriptionHtml, sources].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `product_descriptions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function exportToXLSX(results: SingleGenerationResult[]) {
    if (results.length === 0) return;

    const headers = ['Trạng thái', 'Lỗi', 'Tên sản phẩm', 'Mô tả (Văn bản)', 'Mô tả (HTML)', 'Nguồn'];
    
    const data = results.map(result => [
        result.status === 'success' ? 'Thành công' : 'Thất bại',
        result.error || '',
        result.productName,
        result.descriptionText,
        result.descriptionHtml,
        result.sources.map(s => `${s.title} (${s.uri})`).join('; '),
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Đặt chiều rộng cột để dễ đọc hơn
    const columnWidths = [
        { wch: 15 }, // Trạng thái
        { wch: 40 }, // Lỗi
        { wch: 30 }, // Tên sản phẩm
        { wch: 80 }, // Mô tả (Văn bản)
        { wch: 80 }, // Mô tả (HTML)
        { wch: 80 }, // Nguồn
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mô tả sản phẩm');

    XLSX.writeFile(workbook, `product_descriptions_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportStandardizedNamesToCSV(results: StandardizedNameResult[]) {
    if (results.length === 0) return;

    const headers = ['Tên Gốc', 'Tên Chuẩn Hóa', 'Phân loại'];
    
    const rows = results.map(result => {
        const original = escapeCSV(result.original);
        const standardized = escapeCSV(result.standardized);
        const category = escapeCSV(result.category || '');
        return [original, standardized, category].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `standardized_names_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function exportStandardizedNamesToXLSX(results: StandardizedNameResult[]) {
    if (results.length === 0) return;

    const headers = ['Tên Gốc', 'Tên Chuẩn Hóa', 'Phân loại'];
    
    const data = results.map(result => [
        result.original,
        result.standardized,
        result.category || '',
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Set column widths for better readability
    const columnWidths = [
        { wch: 60 }, // Tên Gốc
        { wch: 60 }, // Tên Chuẩn Hóa
        { wch: 30 }, // Phân loại
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tên Chuẩn Hóa');

    XLSX.writeFile(workbook, `standardized_names_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportExtractorResultsToCSV(results: ExtractedResult[], attributes: string[]) {
    if (results.length === 0) return;

    const headers = ['Tên sản phẩm', ...attributes];
    
    const rows = results.map(result => {
        const rowData = [
            result.productName,
            ...attributes.map(attr => result[attr] || '')
        ];
        return rowData.map(escapeCSV).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `product_attributes_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function exportExtractorResultsToXLSX(results: ExtractedResult[], attributes: string[]) {
    if (results.length === 0) return;

    const headers = ['Tên sản phẩm', ...attributes];
    
    const data = results.map(result => [
        result.productName,
        ...attributes.map(attr => result[attr] || '')
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Đặt chiều rộng cột để dễ đọc hơn
    const columnWidths = [
        { wch: 30 }, // Tên sản phẩm
        ...attributes.map(() => ({ wch: 25 })) // Width for each attribute
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Thuộc tính sản phẩm');

    XLSX.writeFile(workbook, `product_attributes_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export interface ScrapedExportItem {
    stt?: number;
    url: string;
    title: string;
    color?: string;
    main: string[];
    variants: string[];
    variantNames?: Record<string, string>;
    variantGroups?: {
        name: string;
        image: string;
        sku?: string;
        price?: string;
        images?: string[];
    }[];
    description: string[];
    videos: string[];
    fullTextDescription?: string;
    status?: 'success' | 'error' | 'loading' | string;
    error?: string;
}

// Helper to extract clean variant color string if single row or fallback
function getVariantColorSummary(res: ScrapedExportItem): string {
    if (res.color && res.color.trim()) return res.color.trim();
    if (res.variantGroups && res.variantGroups.length > 0) {
        return res.variantGroups.map(g => g.name).filter(Boolean).join(' | ');
    }
    if (res.variantNames && Object.keys(res.variantNames).length > 0) {
        return Array.from(new Set(Object.values(res.variantNames))).filter(Boolean).join(' | ');
    }
    if (res.variants && res.variants.length > 0) {
        return res.variants.map((vUrl, idx) => res.variantNames?.[vUrl] || `Phân loại ${idx + 1}`).join(' | ');
    }
    return 'Mặc định';
}

export function exportScrapedImagesToCSV(results: ScrapedExportItem[]) {
    if (results.length === 0) return;

    let maxImages = 0;
    results.forEach(res => {
        if (res.status !== 'error') {
            const total = (res.main?.length || 0) + (res.variants?.length || 0) + (res.description?.length || 0) + (res.videos?.length || 0);
            if (total > maxImages) maxImages = total;
        }
    });

    const headers = ['STT', 'Tên Sản Phẩm', 'Link web', 'Trạng thái', 'Phân loại màu', 'Link ảnh tổng'];
    for (let i = 1; i <= maxImages; i++) {
        headers.push(`Link ảnh/video ${i}`);
    }

    let currentRowNum = 1;
    const rows: string[] = [];

    results.forEach((result) => {
        const isError = result.status === 'error';
        const statusText = isError 
            ? (result.error ? `Thất bại: ${result.error}` : 'Thất bại') 
            : (result.status === 'loading' ? 'Đang xử lý' : 'Thành công');

        if (isError) {
            const emptyMedia = Array(maxImages).fill('');
            const rowData = [
                currentRowNum++,
                result.title || result.url,
                result.url,
                statusText,
                result.color || 'Thất bại',
                'Thất bại',
                ...emptyMedia
            ];
            rows.push(rowData.map(escapeCSV).join(','));
            return;
        }

        // Check if item has distinct variant color names
        const hasVariants = (result.variants && result.variants.length > 0) || (result.variantGroups && result.variantGroups.length > 0);
        
        if (hasVariants) {
            const vList = result.variantGroups && result.variantGroups.length > 0 
                ? result.variantGroups.map(g => ({ name: g.name, image: g.image, images: g.images || [g.image, ...(result.main || [])] }))
                : (result.variants || []).map((vUrl, vIdx) => ({
                    name: result.variantNames?.[vUrl] || `Phân loại ${vIdx + 1}`,
                    image: vUrl,
                    images: [vUrl, ...(result.main || [])]
                }));

            vList.forEach((v) => {
                const variantMedia = Array.from(new Set([...v.images, ...(result.description || []), ...(result.videos || [])]));
                const allMediaStr = Array.from(new Set(v.images)).join('\n');
                
                const rowData = [
                    currentRowNum++,
                    `${result.title} - ${v.name}`,
                    result.url,
                    statusText,
                    v.name,
                    allMediaStr,
                    ...variantMedia
                ];

                while (rowData.length < headers.length) {
                    rowData.push('');
                }
                rows.push(rowData.map(escapeCSV).join(','));
            });
        } else {
            const productImages = [...(result.main || []), ...(result.variants || [])];
            const allMedia = Array.from(new Set(productImages)).join('\n');
            const media = [...(result.main || []), ...(result.variants || []), ...(result.description || []), ...(result.videos || [])];
            const colorName = getVariantColorSummary(result);
            
            const rowData = [
                currentRowNum++,
                result.title,
                result.url,
                statusText,
                colorName,
                allMedia,
                ...media
            ];

            while (rowData.length < headers.length) {
                rowData.push('');
            }

            rows.push(rowData.map(escapeCSV).join(','));
        }
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `scraped_images_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function generateScrapedImagesTSV(results: ScrapedExportItem[], mode: 'all' | 'main' | 'by-variants' = 'all'): string {
    if (results.length === 0) return '';

    let maxImages = 0;
    results.forEach(res => {
        if (res.status !== 'error') {
            const mediaCount = (res.main?.length || 0) + (res.variants?.length || 0) + (res.description?.length || 0) + (res.videos?.length || 0);
            if (mediaCount > maxImages) maxImages = mediaCount;
        }
    });

    const headers = ['STT', 'Tên Sản Phẩm', 'Link web', 'Trạng thái', 'Phân loại màu', mode === 'main' ? 'Link ảnh chính' : 'Link ảnh tổng'];
    for (let i = 1; i <= maxImages; i++) {
        headers.push(`Link ảnh/video ${i}`);
    }

    const rows: (string | number)[][] = [];
    let currentRowNum = 1;

    results.forEach((result) => {
        const isError = result.status === 'error';
        const statusText = isError 
            ? (result.error ? `Thất bại: ${result.error}` : 'Thất bại')
            : (result.status === 'loading' ? 'Đang xử lý' : 'Thành công');

        if (isError) {
            const emptyMedia = Array(maxImages).fill('');
            rows.push([
                currentRowNum++,
                result.title || result.url,
                result.url,
                statusText,
                result.color || 'Thất bại',
                'Thất bại',
                ...emptyMedia
            ]);
            return;
        }

        const hasVariants = (result.variants && result.variants.length > 0) || (result.variantGroups && result.variantGroups.length > 0);

        if (hasVariants && mode !== 'main') {
            const vList = result.variantGroups && result.variantGroups.length > 0 
                ? result.variantGroups.map(g => ({ name: g.name, image: g.image, images: g.images || [g.image, ...(result.main || [])] }))
                : (result.variants || []).map((vUrl, vIdx) => ({
                    name: result.variantNames?.[vUrl] || `Phân loại ${vIdx + 1}`,
                    image: vUrl,
                    images: [vUrl, ...(result.main || [])]
                }));

            vList.forEach((v) => {
                const variantMedia = Array.from(new Set([...v.images, ...(result.main || []), ...(result.variants || []), ...(result.description || []), ...(result.videos || [])]));
                const allMediaStr = variantMedia.join('\n');

                const row: (string | number)[] = [
                    currentRowNum++,
                    `${result.title} - ${v.name}`,
                    result.url,
                    statusText,
                    v.name,
                    allMediaStr,
                    ...variantMedia
                ];

                while (row.length < headers.length) {
                    row.push('');
                }
                rows.push(row);
            });
        } else {
            const media = mode === 'main'
                ? [...(result.main || [])]
                : [...(result.main || []), ...(result.variants || []), ...(result.description || []), ...(result.videos || [])];
                
            const productImages = Array.from(new Set([...(result.main || []), ...(result.variants || []), ...(result.description || []), ...(result.videos || [])]));
                const allMedia = productImages.join('\n');
            const colorName = getVariantColorSummary(result);
            
            const row: (string | number)[] = [
                currentRowNum++,
                result.title,
                result.url,
                statusText,
                colorName,
                allMedia,
                ...media
            ];

            while (row.length < headers.length) {
                row.push('');
            }
            rows.push(row);
        }
    });

    const allData = [headers, ...rows];
    return allData.map(row => row.map(cell => {
        const cellStr = String(cell ?? '');
        if (cellStr.includes('\t') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
    }).join('\t')).join('\n');
}

export interface DetailedVariantExportItem {
    name: string;
    image: string;
    images: string[];
    price?: number | string;
    stock?: number;
    sku?: string;
}

/**
 * Trích xuất danh sách phân loại chi tiết cho việc xuất file Excel.
 * Tự động hỗ trợ cả 1 tầng (Màu sắc) và 2 tầng (Phân loại combo x Phụ kiện/Mic/Dung lượng)
 * để mỗi dòng SKU con đều có tên kết hợp đầy đủ và ảnh đại diện chính xác.
 */
export function resolveDetailedVariantList(result: any): DetailedVariantExportItem[] {
    if (result.variantGroups && result.variantGroups.length > 0) {
        const list: DetailedVariantExportItem[] = [];

        result.variantGroups.forEach((g: any) => {
            const gName = g.name || g.groupName || '';
            const gImage = g.image || (g.images && g.images[0]) || '';
            const gImages = g.images && g.images.length > 0 ? g.images : (gImage ? [gImage, ...(result.main || [])] : [...(result.main || [])]);

            // Kiểm tra xem nhóm có các models con (SKU con của 2 tầng biến thể) không
            const hasSubModels = Array.isArray(g.models) && g.models.length > 0 && (
                g.models.length > 1 || 
                (g.models[0] && (g.models[0].combinedName || g.models[0].name) && (g.models[0].combinedName !== gName && g.models[0].name !== gName))
            );

            if (hasSubModels) {
                g.models.forEach((m: any) => {
                    const mName = m.combinedName || m.name || gName;
                    const mImg = m.image || gImage;
                    const mImages = Array.from(new Set([mImg, ...gImages])).filter(Boolean);
                    list.push({
                        name: mName,
                        image: mImg,
                        images: mImages,
                        price: m.price,
                        stock: m.stock,
                        sku: m.sku
                    });
                });
            } else {
                list.push({
                    name: gName,
                    image: gImage,
                    images: gImages
                });
            }
        });

        if (list.length > 0) return list;
    }

    if (result.variants && result.variants.length > 0) {
        return result.variants.map((vUrl: string, vIdx: number) => ({
            name: result.variantNames?.[vUrl] || `Phân loại ${vIdx + 1}`,
            image: vUrl,
            images: [vUrl, ...(result.main || [])]
        }));
    }

    return [];
}

export function exportScrapedImagesToXLSX(results: ScrapedExportItem[], mode: 'all' | 'main' | 'by-variants' = 'all') {
    if (results.length === 0) return;

    let maxImages = 0;
    results.forEach(res => {
        if (res.status !== 'error') {
            const count = (res.main?.length || 0) + (res.variants?.length || 0) + (res.description?.length || 0) + (res.videos?.length || 0);
            if (count > maxImages) maxImages = count;
        }
    });

    const headers = ['STT', 'Tên Sản Phẩm', 'Link web', 'Trạng thái', 'Phân loại màu', mode === 'main' ? 'Link ảnh chính' : 'Link ảnh tổng'];
    for (let i = 1; i <= maxImages; i++) {
        headers.push(`Link ảnh/video ${i}`);
    }

    const data: (string | number)[][] = [];
    let currentRowNum = 1;

    results.forEach((result) => {
        const isError = result.status === 'error';
        const statusText = isError 
            ? (result.error ? `Thất bại: ${result.error}` : 'Thất bại')
            : (result.status === 'loading' ? 'Đang xử lý' : 'Thành công');

        if (isError) {
            const emptyMedia = Array(maxImages).fill('');
            data.push([
                currentRowNum++,
                result.title || result.url,
                result.url,
                statusText,
                result.color || 'Thất bại',
                'Thất bại',
                ...emptyMedia
            ]);
            return;
        }

        const hasVariants = (result.variants && result.variants.length > 0) || (result.variantGroups && result.variantGroups.length > 0);

        // If product has variant colors and mode isn't purely main images only, output distinct rows for each variant color!
        if (hasVariants && mode !== 'main') {
            const vList = resolveDetailedVariantList(result);

            vList.forEach((v) => {
                const variantMedia = Array.from(new Set([...v.images, ...(result.main || []), ...(result.variants || []), ...(result.description || []), ...(result.videos || [])]));
                const allMediaStr = variantMedia.join('\n');

                const row: (string | number)[] = [
                    currentRowNum++,
                    `${result.title} - ${v.name}`,
                    result.url,
                    statusText,
                    v.name,
                    allMediaStr,
                    ...variantMedia
                ];

                while (row.length < headers.length) {
                    row.push('');
                }
                data.push(row);
            });
        } else {
            const media = mode === 'main'
                ? [...(result.main || [])]
                : [...(result.main || []), ...(result.variants || []), ...(result.description || []), ...(result.videos || [])];
                
            const productImages = Array.from(new Set([...(result.main || []), ...(result.variants || []), ...(result.description || []), ...(result.videos || [])]));
                const allMedia = productImages.join('\n');
            const colorName = getVariantColorSummary(result);
            
            const row: (string | number)[] = [
                currentRowNum++,
                result.title,
                result.url,
                statusText,
                colorName,
                allMedia,
                ...media
            ];

            while (row.length < headers.length) {
                row.push('');
            }
            data.push(row);
        }
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

    const columnWidths = [
        { wch: 8 },  // STT
        { wch: 50 }, // Tên Sản Phẩm
        { wch: 50 }, // Link web
        { wch: 18 }, // Trạng thái
        { wch: 25 }, // Phân loại màu
        { wch: 80 }, // Link ảnh tổng
    ];
    for (let i = 1; i <= maxImages; i++) {
        columnWidths.push({ wch: 60 });
    }
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    const sheetName = mode === 'main' ? 'Ảnh Chính' : 'Phân Loại Biến Thể & Ảnh';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fileName = mode === 'main' ? 'scraped_main_images' : 'scraped_products_with_variants';
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportShopeeDataToXLSX(results: { 
    stt?: number;
    url: string; 
    title: string; 
    color?: string; 
    descriptionText?: string; 
    main: string[]; 
    variants: string[]; 
    variantNames?: Record<string, string>;
    variantGroups?: any[];
    description: string[]; 
    videos: string[];
    status?: string;
    error?: string;
}[]) {
    if (results.length === 0) return;

    const headers = ['STT', 'Tên Sản Phẩm', 'Link web', 'Trạng thái', 'Phân loại màu', 'Mô tả sản phẩm', 'Link ảnh tổng', 'Video'];

    const data: (string | number)[][] = [];
    let currentRowNum = 1;

    results.forEach((result) => {
        const isError = result.status === 'error';
        const statusText = isError 
            ? (result.error ? `Thất bại: ${result.error}` : 'Thất bại')
            : (result.status === 'loading' ? 'Đang xử lý' : 'Thành công');

        if (isError) {
            data.push([
                currentRowNum++,
                result.title || result.url,
                result.url,
                statusText,
                result.color || 'Thất bại',
                'N/A',
                'Thất bại',
                ''
            ]);
            return;
        }

        let desc = result.descriptionText || '';
        let fullDesc = `<h3><strong>${result.title}</strong></h3>\n${desc}`;
        const videos = Array.from(new Set([...(result.videos || [])])).join('\n');

        const hasVariants = (result.variants && result.variants.length > 0) || (result.variantGroups && result.variantGroups.length > 0);

        if (hasVariants) {
            const vList = resolveDetailedVariantList(result);

            vList.forEach((v) => {
                const media = Array.from(new Set([...v.images, ...(result.description || [])]));
                const allMedia = media.join('\n');

                data.push([
                    currentRowNum++,
                    `${result.title} - ${v.name}`,
                    result.url,
                    statusText,
                    v.name,
                    fullDesc,
                    allMedia,
                    videos
                ]);
            });
        } else {
            const media = Array.from(new Set([...(result.main || []), ...(result.variants || []), ...(result.description || [])]));
            const allMedia = media.join('\n');
            const colorName = getVariantColorSummary(result as any);

            data.push([
                currentRowNum++,
                result.title,
                result.url,
                statusText,
                colorName,
                fullDesc,
                allMedia,
                videos
            ]);
        }
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

    const columnWidths = [
        { wch: 8 },  // STT
        { wch: 45 }, // Tên
        { wch: 50 }, // URL
        { wch: 18 }, // Trạng thái
        { wch: 25 }, // Phân loại màu
        { wch: 80 }, // Mô tả
        { wch: 80 }, // Link ảnh tổng
        { wch: 50 }, // Video
    ];
    
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Shopee Data');

    XLSX.writeFile(workbook, `shopee_data_${new Date().toISOString().split('T')[0]}.xlsx`);
}
