import fs from 'fs';
import path from 'path';

export type TrialFeature = 'scraperLinks' | 'aiGenerations' | 'cloudinaryUploads';

export interface FeatureQuota {
  used: number;
  limit: number;
}

export interface DeviceQuotaRecord {
  deviceId: string;
  ip?: string;
  createdAt: number;
  lastActiveAt: number;
  isPro: boolean;
  proExpiresAt: number | null;
  quotas: {
    scraperLinks: FeatureQuota;
    aiGenerations: FeatureQuota;
    cloudinaryUploads: FeatureQuota;
  };
}

const DEFAULT_LIMITS: Record<TrialFeature, number> = {
  scraperLinks: 5,
  aiGenerations: 10,
  cloudinaryUploads: 10,
};

const DB_FILE = path.join(process.cwd(), 'trial_quotas.json');
let memoryStore: Record<string, DeviceQuotaRecord> = {};
let isLoaded = false;

function loadStore() {
  if (isLoaded) return;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      memoryStore = JSON.parse(raw) || {};
    }
  } catch (err) {
    console.error('[TrialManager] Error loading trial_quotas.json:', err);
    memoryStore = {};
  }
  isLoaded = true;
}

let saveTimeout: NodeJS.Timeout | null = null;
function persistStore() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
    } catch (err) {
      console.error('[TrialManager] Error writing trial_quotas.json:', err);
    }
  }, 500);
}

export function getOrCreateDevice(deviceId: string, ip?: string): DeviceQuotaRecord {
  loadStore();
  const cleanId = (deviceId || '').trim() || (ip ? `ip_${ip.replace(/[^a-zA-Z0-9]/g, '_')}` : 'anonymous_device');
  
  if (!memoryStore[cleanId]) {
    memoryStore[cleanId] = {
      deviceId: cleanId,
      ip,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isPro: false,
      proExpiresAt: null,
      quotas: {
        scraperLinks: { used: 0, limit: DEFAULT_LIMITS.scraperLinks },
        aiGenerations: { used: 0, limit: DEFAULT_LIMITS.aiGenerations },
        cloudinaryUploads: { used: 0, limit: DEFAULT_LIMITS.cloudinaryUploads },
      },
    };
    persistStore();
  } else {
    memoryStore[cleanId].lastActiveAt = Date.now();
    if (ip && !memoryStore[cleanId].ip) {
      memoryStore[cleanId].ip = ip;
    }
  }

  return memoryStore[cleanId];
}

export function getTrialStatus(deviceId: string, ip?: string) {
  const record = getOrCreateDevice(deviceId, ip);
  const now = Date.now();
  const isPro = Boolean(record.isPro && (!record.proExpiresAt || record.proExpiresAt > now));

  const formatQuota = (feature: TrialFeature) => {
    const q = record.quotas[feature] || { used: 0, limit: DEFAULT_LIMITS[feature] };
    const remaining = isPro ? 999999 : Math.max(0, q.limit - q.used);
    return {
      used: q.used,
      limit: q.limit,
      remaining,
      isExhausted: !isPro && remaining <= 0,
    };
  };

  return {
    deviceId: record.deviceId,
    isPro,
    proExpiresAt: record.proExpiresAt,
    quotas: {
      scraperLinks: formatQuota('scraperLinks'),
      aiGenerations: formatQuota('aiGenerations'),
      cloudinaryUploads: formatQuota('cloudinaryUploads'),
    },
    serverConfig: {
      hasSystemGemini: Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY),
      hasSystemCloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
    },
  };
}

export function consumeTrialQuota(
  deviceId: string,
  feature: TrialFeature,
  count = 1,
  isCustomKey = false,
  ip?: string
): { success: boolean; remaining: number; error?: string; message?: string } {
  // If the user uses their own API key, no quota is consumed!
  if (isCustomKey) {
    return { success: true, remaining: 999999 };
  }

  const record = getOrCreateDevice(deviceId, ip);
  const now = Date.now();
  const isPro = Boolean(record.isPro && (!record.proExpiresAt || record.proExpiresAt > now));

  if (isPro) {
    return { success: true, remaining: 999999 };
  }

  const quota = record.quotas[feature] || { used: 0, limit: DEFAULT_LIMITS[feature] };
  const currentRemaining = Math.max(0, quota.limit - quota.used);

  if (currentRemaining < count) {
    const featureNames: Record<TrialFeature, string> = {
      scraperLinks: 'cào dữ liệu link web',
      aiGenerations: 'tạo nội dung AI & SEO',
      cloudinaryUploads: 'tải & xử lý ảnh Cloudinary',
    };
    return {
      success: false,
      remaining: currentRemaining,
      error: 'QUOTA_EXCEEDED',
      message: `Bạn đã dùng hết ${quota.limit} lượt ${featureNames[feature]} miễn phí. Vui lòng nhập API Key riêng hoặc nâng cấp gói Pro để tiếp tục.`,
    };
  }

  quota.used += count;
  record.lastActiveAt = now;
  persistStore();

  const newRemaining = Math.max(0, quota.limit - quota.used);
  return {
    success: true,
    remaining: newRemaining,
  };
}

export function activateLicense(deviceId: string, licenseKey: string): { success: boolean; message: string; proExpiresAt?: number } {
  loadStore();
  const cleanKey = (licenseKey || '').trim().toUpperCase();
  if (!cleanKey) {
    return { success: false, message: 'Mã bản quyền không hợp lệ' };
  }

  // Sample license verification logic: PRO-30D-... / PRO-LIFETIME-...
  let days = 30;
  if (cleanKey.includes('365D') || cleanKey.includes('1Y')) {
    days = 365;
  } else if (cleanKey.includes('LIFETIME') || cleanKey.includes('VIP')) {
    days = 3650;
  }

  const record = getOrCreateDevice(deviceId);
  record.isPro = true;
  record.proExpiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  persistStore();

  return {
    success: true,
    message: `Kích hoạt thành công gói Pro (${days >= 3650 ? 'Vĩnh viễn' : `${days} ngày`})!`,
    proExpiresAt: record.proExpiresAt,
  };
}
