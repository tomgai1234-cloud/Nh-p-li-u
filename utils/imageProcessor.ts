export const CANVAS_SIZE = 800; // default for 800x800
export const MAX_DIMENSION = 800;

export const applySmartSharpen = (ctx: CanvasRenderingContext2D, width: number, height: number, amount: number = 0.4, threshold: number = 12) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const size = width * height * 4;
    const blurred = new Uint8ClampedArray(size);
    const w = width * 4;

    for (let i = 0; i < size; i++) blurred[i] = data[i];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * w) + (x * 4);
            [0, 1, 2].forEach(c => {
                const i = idx + c;
                blurred[i] = (
                    data[i - w - 4] + 2 * data[i - w] + data[i - w + 4] +
                    2 * data[i - 4] + 4 * data[i] + 2 * data[i + 4] +
                    data[i + w - 4] + 2 * data[i + w] + data[i + w + 4]
                ) / 16;
            });
        }
    }

    for (let i = 0; i < size; i += 4) {
        for (let c = 0; c < 3; c++) {
            const idx = i + c;
            const diff = data[idx] - blurred[idx];
            if (Math.abs(diff) > threshold) {
                const val = data[idx] + (diff * amount);
                data[idx] = Math.max(0, Math.min(255, val));
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
};

export const resolveGoogleDriveUrl = (url: string): string | null => {
    if (!url.includes('drive.google.com')) return null;
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}=s0`;
    }
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${idParamMatch[1]}=s0`;
    }
    return null;
};

export const resolveGooglePhotosUrl = async (url: string): Promise<string | null> => {
    if (!/photos\.app\.goo\.gl|photos\.google\.com/.test(url)) return null;
    try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
        if (!res.ok) return null;
        let html: string;
        try {
            html = await res.text();
            if(!html) return null;
        } catch (e) {
            // Might be binary if already direct image link
            return null;
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const ogImage = doc.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.getAttribute('content')) {
            let imgUrl = ogImage.getAttribute('content')!;
            if (imgUrl.includes('=') && imgUrl.includes('googleusercontent.com')) {
                imgUrl = imgUrl.split('=')[0] + '=s0';
            }
            return imgUrl;
        }
    } catch (e) {
        console.warn("Error parsing HTML for OG Image", e);
    }
    return null;
};

export const fetchImageBlob = async (url: string): Promise<{ blob: Blob, originalType: string } | null> => {
    try {
        let fetchUrl = url;
        if (fetchUrl.startsWith('//')) fetchUrl = 'https:' + fetchUrl;
        
        let driveFileId: string | null = null;
        if (url.includes('drive.google.com')) {
            const m = url.match(/(?:id=|d\/)([a-zA-Z0-9_-]+)/);
            if (m && m[1]) driveFileId = m[1];
        }

        const driveResolved = resolveGoogleDriveUrl(fetchUrl);
        if (driveResolved) fetchUrl = driveResolved;
        else if (driveFileId) {
            fetchUrl = `https://lh3.googleusercontent.com/d/${driveFileId}=s0`;
        } else {
            const photosResolved = await resolveGooglePhotosUrl(fetchUrl);
            if (photosResolved) fetchUrl = photosResolved;
        }
        
        // Clean up accidental double slashes in paths (except the protocol part)
        fetchUrl = fetchUrl.replace(/([^:]\/)\/+/g, "$1");
        
        // Also ensure url is valid
        try { new URL(fetchUrl); } catch { return null; }
        
        // Try direct fetch first for any URL (handles CDNs with open CORS and lh3 googleusercontent immediately)
        try {
            const directRes = await fetch(fetchUrl);
            if (directRes.ok) {
                const directBlob = await directRes.blob();
                if (directBlob.type && !directBlob.type.includes('text/html') && !directBlob.type.includes('application/json') && directBlob.size > 100) {
                    return { blob: directBlob, originalType: directBlob.type || 'image/jpeg' };
                }
            }
        } catch (_) {
            // Direct fetch blocked by CORS or network, proceed to proxies
        }

        if (driveFileId) {
            try {
                const thumbUrl = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w2500`;
                const thumbRes = await fetch(thumbUrl);
                if (thumbRes.ok) {
                    const thumbBlob = await thumbRes.blob();
                    if (thumbBlob.type && !thumbBlob.type.includes('text/html') && thumbBlob.size > 100) {
                        return { blob: thumbBlob, originalType: thumbBlob.type || 'image/jpeg' };
                    }
                }
            } catch (e) {
                console.warn("Direct fetch for drive thumbnail failed", e);
            }
        }
        
        const PROXIES = [
            (u: string) => `/api/proxy?url=${encodeURIComponent(u)}&type=image`,
            (u: string) => `https://images.weserv.nl/?url=${encodeURIComponent(u)}`,
            (u: string) => `https://wsrv.nl/?url=${encodeURIComponent(u)}`,
            (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
            (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
            (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
        ];

        let urlsToTry = [fetchUrl];
        if (driveFileId) {
            urlsToTry.push(`https://drive.google.com/thumbnail?id=${driveFileId}&sz=w2500`);
            urlsToTry.push(`https://drive.google.com/uc?id=${driveFileId}&export=download&confirm=t`);
        }

        let lastError = null;
        for (const targetUrl of urlsToTry) {
            for (const proxy of PROXIES) {
                try {
                    const proxyUrl = proxy(targetUrl);
                    const isLocalProxy = proxyUrl.startsWith('/api/proxy');
                    const timeoutMs = isLocalProxy ? 35000 : 15000;
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                    
                    const res = await fetch(proxyUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    
                    if (!res.ok) throw new Error("Proxy error " + res.status);
                    let blob = await res.blob();

                    if (blob.type && (blob.type.includes('text/') || blob.type.includes('application/json'))) {
                        throw new Error("Invalid image format: Non-image content received (" + blob.type + ")");
                    }
                    if (blob.size < 100) {
                        throw new Error("Blob too small, likely error response (" + blob.size + " bytes)");
                    }
                    return { blob, originalType: blob.type || 'image/jpeg' };
                } catch (e: any) {
                    lastError = e;
                    const msg = e?.name === 'AbortError' ? 'Timeout (AbortError)' : (e?.message || e);
                    console.warn(`Proxy ${proxy(targetUrl)} failed (${msg}), trying next`);
                    continue;
                }
            }
        }
        throw lastError;
    } catch (e: any) {
        console.warn("Fetch blob failed in imageProcessor:", e?.message || e);
        return null;
    }
};

export const processImage = (
    originalBlob: Blob, 
    targetFormat: 'jpg' | 'png' | 'webp', 
    quality: number,
    keepOriginalDimensions: boolean,
    shouldEnhance: boolean 
): Promise<{ blob: Blob, extension: string }> => {
    return new Promise((resolve, reject) => {
        if (!originalBlob || originalBlob.size < 100) {
            return reject(new Error("Invalid image blob (empty or too small)"));
        }
        if (originalBlob.type && (originalBlob.type.includes('text/') || originalBlob.type.includes('application/json'))) {
            return reject(new Error("Invalid image blob (non-image format: " + originalBlob.type + ")"));
        }
        const img = new Image();
        const url = URL.createObjectURL(originalBlob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let canvasWidth, canvasHeight, drawX, drawY, drawWidth, drawHeight;
            const MAX_SAFE_DIMENSION = 4096;
            if (keepOriginalDimensions) {
                let scale = 1;
                if (img.naturalWidth > MAX_SAFE_DIMENSION || img.naturalHeight > MAX_SAFE_DIMENSION) {
                    scale = MAX_SAFE_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight);
                }
                canvasWidth = Math.round(img.naturalWidth * scale);
                canvasHeight = Math.round(img.naturalHeight * scale);
                drawX = 0; drawY = 0;
                drawWidth = canvasWidth; drawHeight = canvasHeight;
            } else {
                canvasWidth = CANVAS_SIZE; canvasHeight = CANVAS_SIZE;
                const scale = Math.max(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
                drawWidth = Math.round(img.naturalWidth * scale);
                drawHeight = Math.round(img.naturalHeight * scale);
                drawX = (CANVAS_SIZE - drawWidth) / 2;
                drawY = (CANVAS_SIZE - drawHeight) / 2;
            }
            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth; canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas error"));
            
            const mimeType = targetFormat === 'jpg' ? 'image/jpeg' : `image/${targetFormat}`;
            if (targetFormat === 'jpg') {
                ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            } else {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            }
            
            ctx.imageSmoothingEnabled = true; 
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

            if (shouldEnhance) {
                applySmartSharpen(ctx, canvasWidth, canvasHeight, 0.4, 12); 
            }

            const qualityParam = targetFormat === 'png' ? undefined : quality / 100;
            canvas.toBlob((blob) => {
                if (blob) resolve({ blob, extension: targetFormat });
                else reject(new Error("Blob error"));
            }, mimeType, qualityParam);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load error")); };
        img.src = url;
    });
};
