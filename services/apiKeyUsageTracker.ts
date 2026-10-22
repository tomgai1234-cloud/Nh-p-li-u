export type FeatureKey = 'description' | 'seo' | 'scraper' | 'extractor' | 'chat' | 'other';

export type KeyState = 'checking' | 'valid' | 'quota_exceeded' | 'permission_denied' | 'invalid' | 'unknown';

export interface KeyStatusInfo {
  state: KeyState;
  message?: string;
  checkedAt?: number;
  date?: string; // YYYY-MM-DD
}

export interface FeatureUsage {
  description: number; // Tạo mô tả sản phẩm
  seo: number;         // Tạo tên SEO
  scraper: number;     // Cào ảnh & nhóm màu AI
  extractor: number;   // Trích xuất thuộc tính / thông số
  chat: number;        // Chatbot & trợ lý AI
  other: number;       // Kiểm tra thực tế / Khác
}

export interface KeyDailyStats {
  date: string; // YYYY-MM-DD
  requests: number;
  tokens: number;
  byFeature: FeatureUsage;
}

export interface KeyUsageData {
  totalRequests: number;
  totalTokens: number;
  today: KeyDailyStats;
  lastUsed?: number;
}

const STORAGE_KEY = 'gemini_api_key_usage_v1';
const STATUS_STORAGE_KEY = 'gemini_api_key_statuses_v1';
const FREE_TIER_DAILY_REQUEST_LIMIT = 1500; // 1,500 requests/day per key (Gemini Free Tier)
const FREE_TIER_DAILY_TOKEN_LIMIT = 1000000; // ~1,000,000 tokens/day

export const FEATURE_INFO: Record<FeatureKey, { name: string, icon: string, avgTokens: number }> = {
  description: { name: 'Tạo mô tả sản phẩm', icon: '📝', avgTokens: 1200 },
  seo: { name: 'Tạo tên SEO chuẩn', icon: '🏷️', avgTokens: 400 },
  scraper: { name: 'Cào ảnh & Phân nhóm màu AI', icon: '🖼️', avgTokens: 800 },
  extractor: { name: 'Trích xuất thông số / thuộc tính', icon: '🔍', avgTokens: 600 },
  chat: { name: 'Hỏi đáp Chatbot AI', icon: '💬', avgTokens: 500 },
  other: { name: 'Tác vụ AI khác', icon: '⚡', avgTokens: 500 }
};

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getInitialFeatureUsage(): FeatureUsage {
  return {
    description: 0,
    seo: 0,
    scraper: 0,
    extractor: 0,
    chat: 0,
    other: 0
  };
}

function getInitialDailyStats(): KeyDailyStats {
  return {
    date: getTodayString(),
    requests: 0,
    tokens: 0,
    byFeature: getInitialFeatureUsage()
  };
}

export function getAllKeyStatuses(): Record<string, KeyStatusInfo> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STATUS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, KeyStatusInfo> = JSON.parse(raw);
    const today = getTodayString();
    
    // Auto reset quota exceeded state if date changed to a new day
    let changed = false;
    for (const key of Object.keys(parsed)) {
      if (parsed[key].date && parsed[key].date !== today) {
        if (parsed[key].state === 'quota_exceeded') {
          parsed[key].state = 'valid';
          parsed[key].message = undefined;
          parsed[key].date = today;
          changed = true;
        }
      }
    }
    if (changed) {
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    return {};
  }
}

export function getKeyStatus(rawKey: string): KeyStatusInfo {
  if (!rawKey) return { state: 'unknown' };
  const cleanKey = rawKey.replace(/[^a-zA-Z0-9_\-]/g, '');
  const all = getAllKeyStatuses();
  return all[cleanKey] || { state: 'unknown' };
}

export function setKeyStatus(rawKey: string, status: Partial<KeyStatusInfo> & { state: KeyState }) {
  if (typeof window === 'undefined' || !rawKey) return;
  try {
    const cleanKey = rawKey.replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!cleanKey) return;
    const all = getAllKeyStatuses();
    const today = getTodayString();
    all[cleanKey] = {
      ...status,
      checkedAt: Date.now(),
      date: today
    };
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('apiKeyStatusUpdated', { detail: { key: cleanKey, status: all[cleanKey] } }));
  } catch (e) {}
}

export function markKeyQuotaExhausted(rawKey: string) {
  if (typeof window === 'undefined' || !rawKey) return;
  try {
    const cleanKey = rawKey.replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!cleanKey) return;
    
    // 1. Set key status to quota_exceeded
    setKeyStatus(cleanKey, {
      state: 'quota_exceeded',
      message: 'Hết hạn ngạch hôm nay (429 Quota Exceeded): Key đã dùng hết 1,500 lượt miễn phí của ngày hôm nay.'
    });

    // 2. Set today requests to 1500 in usage
    const allUsage = getAllKeysUsage();
    const today = getTodayString();
    let keyData = allUsage[cleanKey];
    if (!keyData) {
      keyData = {
        totalRequests: 1500,
        totalTokens: 500000,
        today: getInitialDailyStats(),
        lastUsed: Date.now()
      };
    }
    if (keyData.today?.date !== today) {
      keyData.today = getInitialDailyStats();
    }
    keyData.today.requests = Math.max(1500, keyData.today.requests);
    allUsage[cleanKey] = keyData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allUsage));

    window.dispatchEvent(new CustomEvent('apiKeyUsageUpdated', { detail: { key: cleanKey } }));
  } catch (e) {}
}

export function getAllKeysUsage(): Record<string, KeyUsageData> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, KeyUsageData> = JSON.parse(raw);
    const today = getTodayString();
    
    // Check if daily stats need reset for new day
    let changed = false;
    for (const key of Object.keys(parsed)) {
      if (parsed[key].today?.date !== today) {
        parsed[key].today = getInitialDailyStats();
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    console.error("Lỗi đọc thống kê API Key:", e);
    return {};
  }
}

export function getKeyUsage(rawKey: string): KeyUsageData {
  if (!rawKey) {
    return {
      totalRequests: 0,
      totalTokens: 0,
      today: getInitialDailyStats()
    };
  }
  const cleanKey = rawKey.replace(/[^a-zA-Z0-9_\-]/g, '');
  const all = getAllKeysUsage();
  const found = all[cleanKey];
  const today = getTodayString();

  if (found) {
    if (found.today?.date !== today) {
      found.today = getInitialDailyStats();
    }
    return found;
  }

  return {
    totalRequests: 0,
    totalTokens: 0,
    today: getInitialDailyStats()
  };
}

export function trackKeyUsage(rawKey: string, feature: FeatureKey = 'other', customTokens?: number) {
  if (typeof window === 'undefined' || !rawKey) return;
  try {
    const cleanKey = rawKey.replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!cleanKey) return;

    const all = getAllKeysUsage();
    const today = getTodayString();
    
    let keyData = all[cleanKey];
    if (!keyData) {
      keyData = {
        totalRequests: 0,
        totalTokens: 0,
        today: getInitialDailyStats(),
        lastUsed: Date.now()
      };
    }

    if (keyData.today?.date !== today) {
      keyData.today = getInitialDailyStats();
    }

    const tokensToAdd = customTokens || FEATURE_INFO[feature]?.avgTokens || 500;

    keyData.totalRequests += 1;
    keyData.totalTokens += tokensToAdd;
    keyData.lastUsed = Date.now();

    keyData.today.requests += 1;
    keyData.today.tokens += tokensToAdd;
    if (!keyData.today.byFeature) {
      keyData.today.byFeature = getInitialFeatureUsage();
    }
    keyData.today.byFeature[feature] = (keyData.today.byFeature[feature] || 0) + 1;

    all[cleanKey] = keyData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    window.dispatchEvent(new CustomEvent('apiKeyUsageUpdated', { detail: { key: cleanKey, feature } }));
  } catch (e) {
    console.warn("Không thể lưu thống kê API Key usage:", e);
  }
}

export function getQuotaEstimates(usage: KeyUsageData, status?: KeyStatusInfo) {
  const isQuotaExhausted = status?.state === 'quota_exceeded' || (usage.today?.requests || 0) >= FREE_TIER_DAILY_REQUEST_LIMIT;
  const isInvalid = status?.state === 'permission_denied' || status?.state === 'invalid';

  if (isQuotaExhausted) {
    const requestsUsedToday = Math.max(FREE_TIER_DAILY_REQUEST_LIMIT, usage.today?.requests || FREE_TIER_DAILY_REQUEST_LIMIT);
    return {
      requestsUsedToday,
      remainingRequestsToday: 0,
      requestLimit: FREE_TIER_DAILY_REQUEST_LIMIT,
      requestPercent: 100,
      tokensUsedToday: usage.today?.tokens || 0,
      remainingTokensToday: 0,
      tokenLimit: FREE_TIER_DAILY_TOKEN_LIMIT,
      tokenPercent: 100,
      estRemainingDesc: 0,
      estRemainingSeo: 0,
      estRemainingScraper: 0,
      estRemainingExtractor: 0,
      isExhausted: true,
      isInvalid: false
    };
  }

  if (isInvalid) {
    return {
      requestsUsedToday: usage.today?.requests || 0,
      remainingRequestsToday: 0,
      requestLimit: FREE_TIER_DAILY_REQUEST_LIMIT,
      requestPercent: 0,
      tokensUsedToday: usage.today?.tokens || 0,
      remainingTokensToday: 0,
      tokenLimit: FREE_TIER_DAILY_TOKEN_LIMIT,
      tokenPercent: 0,
      estRemainingDesc: 0,
      estRemainingSeo: 0,
      estRemainingScraper: 0,
      estRemainingExtractor: 0,
      isExhausted: false,
      isInvalid: true
    };
  }

  const requestsUsedToday = usage.today?.requests || 0;
  const tokensUsedToday = usage.today?.tokens || 0;

  const remainingRequestsToday = Math.max(0, FREE_TIER_DAILY_REQUEST_LIMIT - requestsUsedToday);
  const remainingTokensToday = Math.max(0, FREE_TIER_DAILY_TOKEN_LIMIT - tokensUsedToday);

  // Estimates for specific operations based on remaining requests and tokens
  const estRemainingDesc = remainingRequestsToday;
  const estRemainingSeo = remainingRequestsToday;
  const estRemainingScraper = remainingRequestsToday;
  const estRemainingExtractor = remainingRequestsToday;

  const requestPercent = Math.min(100, Math.round((requestsUsedToday / FREE_TIER_DAILY_REQUEST_LIMIT) * 100));
  const tokenPercent = Math.min(100, Math.round((tokensUsedToday / FREE_TIER_DAILY_TOKEN_LIMIT) * 100));

  return {
    requestsUsedToday,
    remainingRequestsToday,
    requestLimit: FREE_TIER_DAILY_REQUEST_LIMIT,
    requestPercent,
    tokensUsedToday,
    remainingTokensToday,
    tokenLimit: FREE_TIER_DAILY_TOKEN_LIMIT,
    tokenPercent,
    estRemainingDesc,
    estRemainingSeo,
    estRemainingScraper,
    estRemainingExtractor,
    isExhausted: false,
    isInvalid: false
  };
}

export function resetKeyUsage(rawKey?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (rawKey) {
      const cleanKey = rawKey.replace(/[^a-zA-Z0-9_\-]/g, '');
      const all = getAllKeysUsage();
      delete all[cleanKey];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

      const allStatuses = getAllKeyStatuses();
      if (allStatuses[cleanKey]?.state === 'quota_exceeded') {
        allStatuses[cleanKey] = { state: 'valid', date: getTodayString() };
        localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(allStatuses));
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      const allStatuses = getAllKeyStatuses();
      for (const k of Object.keys(allStatuses)) {
        if (allStatuses[k].state === 'quota_exceeded') {
          allStatuses[k] = { state: 'valid', date: getTodayString() };
        }
      }
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(allStatuses));
    }
    window.dispatchEvent(new CustomEvent('apiKeyUsageUpdated'));
    window.dispatchEvent(new CustomEvent('apiKeyStatusUpdated'));
  } catch (e) {}
}
