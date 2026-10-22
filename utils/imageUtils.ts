
import heic2any from 'heic2any';

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // result is a data URL (e.g., "data:image/jpeg;base64,.....")
      // We only need the base64 part
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const resolveGooglePhotosUrl = async (url: string): Promise<string | null> => {
    if (!/photos\.app\.goo\.gl|photos\.google\.com/.test(url)) return null;
    
    // Attempt to resolve the short link or find the direct image URL from the OG tag
    // Note: This relies on a proxy to fetch the HTML content
    const fetchHtml = async (u: string) => {
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error("Failed to fetch Google Photos page");
        return await res.text();
    };

    try {
        const html = await fetchHtml(url);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const ogImage = doc.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.getAttribute('content')) {
            let imgUrl = ogImage.getAttribute('content')!;
            // Replace size parameters (e.g. =w1200-h630) with =s0 for full resolution
            // Google Photos URLs typically have parameters after an '=' sign
            if (imgUrl.includes('=') && imgUrl.includes('googleusercontent.com')) {
                imgUrl = imgUrl.split('=')[0] + '=s0';
            }
            return imgUrl;
        }
    } catch (e) {
        console.warn("Error parsing HTML for Google Photos OG Image", e);
    }
    return null;
};

export const fetchImageFromUrl = async (url: string): Promise<Blob> => {
    let targetUrl = url;
    
    // 1. Resolve URL if it's Google Photos
    const resolved = await resolveGooglePhotosUrl(url);
    if (resolved) targetUrl = resolved;

    const isValidBlob = (blob: Blob) => blob.size > 0 && blob.type.startsWith('image/');

    // 2. Try direct fetch (will succeed if CORS is allowed)
    try {
        const response = await fetch(targetUrl);
        if (response.ok) {
            const blob = await response.blob();
            if (isValidBlob(blob)) return blob;
        }
    } catch (e) {
        // CORS error expected for many external images
    }

    // 3. Try via proxies
    const proxyServices = [
        (u: string) => `https://wsrv.nl/?url=${encodeURIComponent(u)}`,
        (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
        (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`
    ];

    for (const makeProxyUrl of proxyServices) {
        try {
            const response = await fetch(makeProxyUrl(targetUrl));
            if (response.ok) {
                const blob = await response.blob();
                if (isValidBlob(blob)) return blob;
            }
        } catch (e) {
            console.warn("Proxy fetch failed", e);
        }
    }

    throw new Error("Không thể tải ảnh từ URL này do giới hạn bảo mật (CORS).");
};

/**
 * Normalizes an image file to a standard format (JPEG/PNG).
 * Specifically converts HEIC files to JPEG using heic2any.
 */
export const normalizeImageFile = async (file: File): Promise<File> => {
    // Check if it's a HEIC file
    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        try {
            // @ts-ignore - heic2any is loaded via importmap
            const blobOrBlobs = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.9
            });

            const blob = Array.isArray(blobOrBlobs) ? blobOrBlobs[0] : blobOrBlobs;
            
            return new File(
                [blob], 
                file.name.replace(/\.heic$/i, '.jpg'), 
                { type: 'image/jpeg' }
            );
        } catch (error) {
            console.error("Error converting HEIC:", error);
            throw new Error("Không thể chuyển đổi file HEIC. Vui lòng thử định dạng khác.");
        }
    }
    return file;
};
