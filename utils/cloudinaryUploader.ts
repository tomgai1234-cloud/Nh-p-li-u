import { useProviderAccounts, CloudinaryAccount } from '../src/hooks/useProviderAccounts';
import { fetchImageBlob, processImage } from './imageProcessor';

/**
 * Tạo chữ ký SHA-1 cho Cloudinary upload
 */
export const generateCloudinarySignature = async (
  timestamp: number,
  apiSecret: string,
  extraParams: Record<string, string> = { use_filename: 'true', unique_filename: 'true' }
): Promise<string> => {
  const params: Record<string, any> = { timestamp, ...extraParams };
  const stringToSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + apiSecret;
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(stringToSign));
  return Array.from(new Uint8Array(hash)).map(v => v.toString(16).padStart(2, '0')).join('');
};

/**
 * Upload 1 ảnh từ URL gốc hoặc Blob lên Cloudinary bằng cấu hình hiện có
 */
export const uploadUrlToCloudinary = async (
  imageUrl: string,
  config: { cloudName: string; apiKey: string; apiSecret: string },
  fileNameHint?: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    return { success: false, error: 'Chưa cấu hình tài khoản Cloudinary (vào Cài đặt tài khoản/Tải ảnh hàng loạt)' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await generateCloudinarySignature(timestamp, config.apiSecret);

  // 1. Chuẩn bị file tải
  let uploadPayload: Blob | string = imageUrl;
  let isFile = false;
  const outputFormat = 'jpg';

  try {
    const fetchResult = await fetchImageBlob(imageUrl);
    if (fetchResult) {
      try {
        const proc = await processImage(fetchResult.blob, outputFormat, 90, true, false);
        uploadPayload = proc.blob;
        isFile = true;
      } catch (e) {
        uploadPayload = fetchResult.blob;
        isFile = true;
      }
    }
  } catch (err) {
    console.warn("Lỗi fetch ảnh gốc trước khi đẩy lên Cloudinary, thử đẩy trực tiếp URL:", err);
  }

  const safeFileName = (fileNameHint || 'image')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_\-]/gi, '_')
    .slice(0, 40);

  const fd = new FormData();
  if (isFile && uploadPayload instanceof Blob) {
    fd.append('file', uploadPayload, `${safeFileName}_${timestamp}.${outputFormat}`);
  } else {
    fd.append('file', uploadPayload);
  }

  fd.append('api_key', config.apiKey);
  fd.append('timestamp', String(timestamp));
  fd.append('use_filename', 'true');
  fd.append('unique_filename', 'true');
  fd.append('signature', signature);

  try {
    let res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
      method: 'POST',
      body: fd
    });
    let data = await res.json();

    // Nếu đẩy URL trực tiếp không thành công, thử fetch blob fallback
    if (!res.ok && !isFile && typeof uploadPayload === 'string') {
      const fetchRes = await fetchImageBlob(uploadPayload);
      if (fetchRes) {
        let blobToUpload: Blob = fetchRes.blob;
        try {
          const proc = await processImage(fetchRes.blob, outputFormat, 90, true, false);
          blobToUpload = proc.blob;
        } catch {}
        
        const fallbackFd = new FormData();
        fallbackFd.append('file', blobToUpload, `${safeFileName}_${timestamp}.${outputFormat}`);
        fallbackFd.append('api_key', config.apiKey);
        fallbackFd.append('timestamp', String(timestamp));
        fallbackFd.append('use_filename', 'true');
        fallbackFd.append('unique_filename', 'true');
        fallbackFd.append('signature', signature);

        res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
          method: 'POST',
          body: fallbackFd
        });
        data = await res.json();
      }
    }

    if (res.ok && data.secure_url) {
      return { success: true, url: data.secure_url };
    } else {
      return { success: false, error: data.error?.message || 'Upload Cloudinary thất bại' };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Lỗi mạng khi kết nối Cloudinary' };
  }
};
