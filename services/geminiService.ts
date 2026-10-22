
import { GoogleGenAI, Modality, Chat, Type, GenerateContentResponse, ThinkingLevel } from "@google/genai";
import type { GroundingChunk, GenerationResult, GroundingSource, ExtractedResult, AttributeDefinition, SingleGenerationResult, StandardizedNameResult } from '../types';
import { trackKeyUsage, markKeyQuotaExhausted, setKeyStatus, getAllKeyStatuses, FeatureKey } from './apiKeyUsageTracker';
import { getDeviceId } from './trialClient';

let activeFeatureContext: FeatureKey = 'other';

export function setActiveFeatureContext(feature: FeatureKey) {
  activeFeatureContext = feature;
}

export function getActiveApiKey(): string {
  const keys = getApiKeys();
  if (keys.length === 0) return '';
  return keys[currentKeyIndex % keys.length] || '';
}

// API Key rotation logic
let currentKeyIndex = 0;
const failedKeys = new Set<string>();

function getApiKeys(): string[] {
  let keysInput = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  
  if (typeof window !== 'undefined') {
      const storedKeys = localStorage.getItem('user_api_keys');
      if (storedKeys) {
          // If we have stored keys, user keys take precedence with env keys as fallback
          keysInput = `${storedKeys},${keysInput}`;
      }
  }

  // Split by comma, semicolon, newline; trim and deduplicate
  const rawKeys = keysInput.split(/[,;\n]+/).map(k => k.trim()).filter(Boolean);
  const keys = Array.from(new Set(rawKeys));

  // Prioritize keys that are known to be healthy/valid
  if (typeof window !== 'undefined') {
      const allStatuses = getAllKeyStatuses();
      const healthyKeys = keys.filter(k => {
          const cleanKey = k.replace(/[^a-zA-Z0-9_\-]/g, '');
          const st = allStatuses[cleanKey]?.state;
          return st !== 'quota_exceeded' && st !== 'permission_denied' && st !== 'invalid' && !failedKeys.has(k);
      });
      if (healthyKeys.length > 0) {
          return healthyKeys;
      }
  }

  // Filter out known failed keys, but if ALL fail, reset to try again
  const validKeys = keys.filter(k => !failedKeys.has(k));
  if (validKeys.length === 0 && keys.length > 0) {
      failedKeys.clear();
      return keys;
  }
  return validKeys.length > 0 ? validKeys : keys;
}

function getAI(forceNextKey = false): GoogleGenAI {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error("API_KEY environment variable not set. Vui lòng kiểm tra cấu hình hoặc thêm API Key trong mục Quản lý API Key.");
  }
  
  if (forceNextKey && keys.length > 1) {
    // If the key strictly failed, add to temporary blacklist
    const currentKey = keys[currentKeyIndex % keys.length];
    failedKeys.add(currentKey);
    
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.log(`[Rotation] Đã đổi sang API Key tiếp theo (Số ${currentKeyIndex + 1}/${keys.length}) do lỗi hạn mức hoặc quyền truy cập.`);
  }
  
  const selectedKey = keys[currentKeyIndex % keys.length];
  return new GoogleGenAI({ apiKey: selectedKey });
}

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isNetworkError(error: unknown): boolean {
    let message = '';
    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    } else {
        try { message = JSON.stringify(error); } catch(e) {}
    }
    const lower = message.toLowerCase();
    return lower.includes('failed to fetch') ||
           lower.includes('fetch failed') ||
           lower.includes('network error') ||
           lower.includes('networkerror') ||
           lower.includes('econnreset') ||
           lower.includes('etimedout') ||
           lower.includes('socket hang up') ||
           lower.includes('load failed') ||
           lower.includes('offline');
}

function isRetryableError(error: unknown): boolean {
    let message = '';
    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    } else {
        try { message = JSON.stringify(error); } catch(e) {}
    }
    const lower = message.toLowerCase();

    return lower.includes('resource_exhausted') ||
           lower.includes('"code":429') ||
           lower.includes('429') ||
           lower.includes('exceeded quota') ||
           lower.includes('too many requests') ||
           lower.includes('quota') ||
           lower.includes('fetch failed') ||
           lower.includes('failed to fetch') ||
           lower.includes('network error') ||
           lower.includes('econnreset') ||
           lower.includes('etimedout') ||
           lower.includes('500') ||
           lower.includes('502') ||
           lower.includes('503') ||
           lower.includes('504') ||
           lower.includes('unreachable') ||
           lower.includes('socket hang up') ||
           lower.includes('timeout');
}

function isQuotaError(error: unknown): boolean {
    let message = '';
    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    } else {
        try { message = JSON.stringify(error); } catch(e) {}
    }
    const lower = message.toLowerCase();

    return lower.includes('resource_exhausted') ||
           lower.includes('"code":429') ||
           lower.includes('429') ||
           lower.includes('exceeded quota') ||
           lower.includes('too many requests') ||
           lower.includes('quota');
}

function isPermissionError(error: unknown): boolean {
    let message = '';
    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    } else {
        try { message = JSON.stringify(error); } catch(e) {}
    }
    const lower = message.toLowerCase();

    return lower.includes('403') ||
           lower.includes('permission_denied') ||
           lower.includes('the caller does not have permission') ||
           lower.includes('api_key_invalid') ||
           lower.includes('api key not valid') ||
           lower.includes('not have permission');
}

function removeCitations(text: string): string {
  if (!text) return '';
  return text
    .replace(/(\[\s*\d+(?:[,\s]*\d+)*\s*\])+/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function minifyHtml(html: string): string {
    if (!html) return '';
    return html
        .replace(/(\[\s*\d+(?:[,\s]*\d+)*\s*\])+/g, '')
        .replace(/>\s+</g, '><')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function stripHtmlToText(html: string): string {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<li>/gi, '- ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]*>?/gm, '')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
}

function sanitizeJsonString(jsonString: string): string {
    let inString = false;
    let isEscaped = false;
    let result = '';
    
    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];
        
        if (inString) {
            if (isEscaped) {
                result += char;
                isEscaped = false;
            } else {
                if (char === '\\') {
                    isEscaped = true;
                    result += char;
                } else if (char === '"') {
                    inString = false;
                    result += char;
                } else {
                    if (char === '\n') {
                        result += '\\n';
                    } else if (char === '\r') {
                        result += '\\r';
                    } else if (char === '\t') {
                        result += '\\t';
                    } else if (char.charCodeAt(0) < 32) {
                        // ignore
                    } else {
                        result += char;
                    }
                }
            }
        } else {
            if (char === '"') {
                inString = true;
            }
            result += char;
        }
    }
    return result;
}

async function callServerGemini(model: string, params: any): Promise<GenerateContentResponse> {
    const keys = getApiKeys();
    const customApiKey = keys.length > 0 ? keys[0] : undefined;

    const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-device-id': getDeviceId()
        },
        body: JSON.stringify({
            model,
            contents: params.contents,
            prompt: typeof params.contents === 'string' ? params.contents : undefined,
            config: params.config,
            customApiKey,
        })
    });

    if (!res.ok) {
        let errMsg = `Server proxy error (Status ${res.status})`;
        try {
            const errData = await res.json();
            if (errData.message) errMsg = errData.message;
            else if (errData.error) errMsg = errData.error;
            if (errData.error === 'QUOTA_EXCEEDED' && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-upgrade-modal', { detail: { reason: errMsg } }));
            }
        } catch (_) {}
        throw new Error(errMsg);
    }

    const data = await res.json();
    const text = data.text || '';
    const activeKey = getActiveApiKey();
    if (activeKey) {
        trackKeyUsage(activeKey, activeFeatureContext);
    }
    return {
        text,
        candidates: data.candidates || [{
            content: { parts: [{ text }] },
            finishReason: 'STOP',
            index: 0
        }]
    } as unknown as GenerateContentResponse;
}

// Wrapper for generateContent with retry logic
async function generateWithRetry(model: string, params: any, retries = 3): Promise<GenerateContentResponse> {
    const isFlash = model.includes('flash') || model.includes('lite');
    let currentDelay = isFlash ? 800 : 1500;
    let lastError: any;

    for (let i = 0; i < retries; i++) {
        try {
            const ai = getAI();
            const result = await ai.models.generateContent({
                model,
                ...params
            });
            const activeKey = getActiveApiKey();
            if (activeKey) {
                trackKeyUsage(activeKey, activeFeatureContext);
            }
            return result;
        } catch (error) {
            lastError = error;
            const isQuota = isQuotaError(error);
            const isPerm = isPermissionError(error);
            const isNetwork = isNetworkError(error);
            const isRetryable = isRetryableError(error);

            // If network failed (e.g. Failed to fetch, CORS, browser blocked), immediately try server proxy!
            if (isNetwork) {
                console.warn(`[Network] Lỗi kết nối client (${error instanceof Error ? error.message : 'Failed to fetch'}). Đang chuyển sang server proxy...`);
                try {
                    const serverResult = await callServerGemini(model, params);
                    return serverResult;
                } catch (srvErr) {
                    console.warn(`[Server Proxy] Lần thử thất bại:`, srvErr);
                    lastError = srvErr;
                }
            }

            // If it's a Quota error (429) or Permission error (403), rotate key if multiple keys are available
            if (isQuota || isPerm) {
                const currentActiveKey = getActiveApiKey();
                if (currentActiveKey) {
                    if (isQuota) {
                        markKeyQuotaExhausted(currentActiveKey);
                    } else if (isPerm) {
                        setKeyStatus(currentActiveKey, { 
                            state: 'permission_denied', 
                            message: 'The caller does not have permission (403): Chưa bật API hoặc bị chặn quyền.' 
                        });
                    }
                }

                const keys = getApiKeys();
                if (keys.length > 1 && i < keys.length) {
                    console.warn(`[Key Switch] Đổi key do lỗi ${isPerm ? '403 (Permission Denied)' : '429 (Quota)'}. Thử key tiếp theo...`);
                    getAI(true);
                    await delay(300);
                    continue;
                }
            }

            if (isRetryable) {
                if (i === retries - 1) break; // Reached max retries
                console.warn(`Retryable error with ${model}: ${error instanceof Error ? error.message : 'Unknown'}. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
                await delay(currentDelay);
                currentDelay *= 2; // Exponential backoff
                continue;
            }
            break;
        }
    }

    // Last resort: Server-side proxy attempt if not already successful
    try {
        console.warn(`[Last Resort] Thử lại qua máy chủ proxy...`);
        return await callServerGemini(model, params);
    } catch (finalSrvErr) {
        console.warn(`Server-side proxy fallback attempt failed:`, finalSrvErr);
    }
    
    if (isQuotaError(lastError)) {
        throw new Error("Lỗi Hạn ngạch (Quota): Hệ thống đang quá tải hoặc hết lượt tải. Vui lòng kiểm tra API Key hoặc thử lại sau.");
    }
    if (isPermissionError(lastError)) {
        throw new Error("Lỗi quyền truy cập API (403 - Permission Denied): API Key hiện tại không có quyền gọi mô hình AI hoặc chưa kích hoạt thanh toán. Vui lòng kiểm tra lại API Key hoặc thêm API Key hợp lệ trong mục Quản lý API Key.");
    }
    if (isNetworkError(lastError)) {
        throw new Error("Lỗi kết nối mạng (Failed to fetch): Trình duyệt không thể kết nối trực tiếp đến Google AI. Vui lòng kiểm tra kết nối mạng hoặc thử lại.");
    }
    throw lastError || new Error("Unreachable - Execution fallthrough.");
}

async function generateContentWithFallback(prompt: string, config: any, allowUngroundedFallback: boolean = true, model: string = 'gemini-3.8-flash'): Promise<{response: GenerateContentResponse, model: string}> {
  const isFlash = model.includes('flash') || model.includes('lite');
  const originalConfig = config ? { ...config } : {};
  const hasGrounding = Array.isArray(originalConfig.tools) && originalConfig.tools.some((tool: any) => tool.hasOwnProperty('googleSearch'));
  
  // FIX: Gemini currently rejects responseMimeType='application/json' when tools (like googleSearch) are used.
  if (hasGrounding && originalConfig.responseMimeType === 'application/json') {
      delete originalConfig.responseMimeType;
  }

  // 1. Primary attempt (with grounding if specified)
  try {
    const response = await generateWithRetry(model, {
      contents: prompt,
      config: originalConfig,
    }, 2);
    return { response, model };
  } catch (error) {
    // If grounding was requested and failed (permission denied 403, quota 429, or tool error), fall back to ungrounded
    if (!hasGrounding || !allowUngroundedFallback) {
      // If no grounding to drop, try alternative fallback models directly
      const fallbackModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'].filter(m => m !== model);
      for (const altModel of fallbackModels) {
        try {
          console.warn(`Attempting fallback model ${altModel} directly...`);
          const response = await generateWithRetry(altModel, {
            contents: prompt,
            config: originalConfig,
          }, 2);
          return { response, model: altModel };
        } catch (altErr) {
          console.warn(`Direct fallback model ${altModel} failed:`, altErr);
        }
      }
      throw error;
    }
    console.warn(`Grounding attempt with ${model} failed (${error instanceof Error ? error.message : 'Error'}). Falling back to ungrounded model.`);
  }
  
  // 2. Ungrounded fallback
  const ungroundedConfig = { ...originalConfig };
  if (ungroundedConfig.tools) {
      ungroundedConfig.tools = ungroundedConfig.tools.filter((tool: any) => !tool.hasOwnProperty('googleSearch'));
      if (ungroundedConfig.tools.length === 0) {
          delete ungroundedConfig.tools;
      }
  }
  if (!ungroundedConfig.responseMimeType) {
      ungroundedConfig.responseMimeType = 'application/json';
  }

  await delay(isFlash ? 200 : 500);

  // Try ungrounded with current model
  try {
    const response = await generateWithRetry(model, {
      contents: prompt,
      config: ungroundedConfig,
    }, 2);
    return { response, model: `${model} (no search)` };
  } catch (ungroundedErr) {
    console.warn(`Ungrounded generation with ${model} failed, trying alternative models...`, ungroundedErr);
    
    // Try fallback models (e.g. gemini-3.8-flash, gemini-3.1-flash-lite)
    const fallbackModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'].filter(m => m !== model);
    for (const altModel of fallbackModels) {
      try {
        const response = await generateWithRetry(altModel, {
          contents: prompt,
          config: ungroundedConfig,
        }, 2);
        return { response, model: `${altModel} (fallback)` };
      } catch (altErr) {
        console.warn(`Alternative fallback model ${altModel} failed:`, altErr);
      }
    }

    // Attempt server-side fallback proxy
    try {
      console.warn("Attempting server-side fallback /api/gemini/generate...");
      const srvRes = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, config: ungroundedConfig, model: 'gemini-3.8-flash' })
      });
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData.text) {
          return {
            response: {
              text: srvData.text,
              candidates: srvData.candidates || [{ content: { parts: [{ text: srvData.text }] } }]
            } as any,
            model: 'server-gemini-fallback'
          };
        }
      }
    } catch (srvErr) {
      console.warn("Server-side fallback also failed:", srvErr);
    }

    throw ungroundedErr;
  }
}

function cleanAndExtractJson(rawString: string): string {
    if (!rawString) return '';
    let cleaned = rawString.trim();
    // Remove markdown code blocks if present (even if closing fence is missing due to truncation)
    const markdownMatch = cleaned.match(/```(?:json|jsonc|any)?\s*([\s\S]*?)(?:```|$)/i);
    if (markdownMatch && markdownMatch[1]) {
        cleaned = markdownMatch[1].trim();
    }
    
    // Remove citations like [cite: 1] or [1]
    cleaned = cleaned.replace(/\[\s*cite:\s*\w+\s*\]/gi, '');
    cleaned = cleaned.replace(/\[\s*\d+\s*\]/g, '');
    
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIndex = -1;
    let isArray = false;
    
    if (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) {
        startIndex = firstBracket;
        isArray = true;
    } else if (firstBrace !== -1) {
        startIndex = firstBrace;
        isArray = false;
    }
    
    if (startIndex === -1) return '';
    
    let endIndex = isArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}');
    
    // If an array was truncated without closing ']', salvage up to the last complete object '}'
    if (isArray && (endIndex === -1 || endIndex < startIndex)) {
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace > startIndex) {
            const truncatedArray = cleaned.substring(startIndex, lastBrace + 1) + ']';
            return sanitizeJsonString(truncatedArray);
        }
        return '';
    }

    if (endIndex === -1 || endIndex < startIndex) return '';
    const extracted = cleaned.substring(startIndex, endIndex + 1);
    return sanitizeJsonString(extracted);
}

function parseJsonArraySafely(rawString: string): any[] {
    if (!rawString || typeof rawString !== 'string') return [];

    // 1. Try standard JSON extraction
    const extracted = cleanAndExtractJson(rawString);
    if (extracted) {
        try {
            const parsed = JSON.parse(extracted);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            if (parsed && typeof parsed === 'object') return [parsed];
        } catch (_) {}
    }

    // 2. Try dirtyJsonParse directly on the raw text
    const dirty = dirtyJsonParse(rawString);
    if (Array.isArray(dirty) && dirty.length > 0) {
        return dirty;
    }

    // 3. Try regex extraction of individual JSON objects { ... } with productName or descriptionHtml
    try {
        const objectMatches = rawString.match(/\{[\s\S]*?"(?:productName|name|seoName|original)"[\s\S]*?\}/g);
        if (objectMatches && objectMatches.length > 0) {
            const results: any[] = [];
            for (const objStr of objectMatches) {
                try {
                    const parsed = JSON.parse(sanitizeJsonString(objStr));
                    if (parsed) results.push(parsed);
                } catch {
                    try {
                        const parsed = JSON.parse(objStr);
                        if (parsed) results.push(parsed);
                    } catch {}
                }
            }
            if (results.length > 0) return results;
        }
    } catch (_) {}

    return [];
}

function normalizeNameForMatching(name: string): string {
    if (!name) return "";
    return name.toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .normalize('NFC');
}

function findMatchingItem(data: any[], target: string, originalInput: string): any {
    const normalizedTarget = normalizeNameForMatching(target);
    const normalizedInput = normalizeNameForMatching(originalInput);
    
    // 1. Exact match (case insensitive, normalized)
    let found = data.find(d => {
        const dName = normalizeNameForMatching(d.productName || d.name || "");
        return dName === normalizedTarget || dName === normalizedInput;
    });
    if (found) return found;

    // 2. Contains match
    found = data.find(d => {
        const dName = normalizeNameForMatching(d.productName || d.name || "");
        return normalizedTarget.includes(dName) || dName.includes(normalizedTarget) || normalizedInput.includes(dName);
    });
    return found;
}

function dirtyJsonParse(jsonString: string): any[] {
    if (!jsonString) return [];
    const results = [];
    let braceCount = 0;
    let currentObjectStartIndex = -1;
    let inString = false;
    let escapeNext = false;
    const startIndex = jsonString.indexOf('{');
    if (startIndex === -1) return [];
    for (let i = startIndex; i < jsonString.length; i++) {
        const char = jsonString[i];
        if (inString) {
            if (escapeNext) { escapeNext = false; }
            else if (char === '\\') { escapeNext = true; }
            else if (char === '"') { inString = false; }
            continue;
        }
        if (char === '"') {
            inString = true;
            escapeNext = false;
        } else if (char === '{') {
            if (braceCount === 0) { currentObjectStartIndex = i; }
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && currentObjectStartIndex !== -1) {
                const objectString = jsonString.substring(currentObjectStartIndex, i + 1);
                try {
                    const sanitizedObjectString = sanitizeJsonString(objectString);
                    results.push(JSON.parse(sanitizedObjectString));
                } catch (e) {
                    try {
                        results.push(JSON.parse(objectString));
                    } catch (e2) {}
                }
                currentObjectStartIndex = -1;
            }
        }
    }
    return results;
}

function handleGeminiError(error: unknown, action: string): Error {
    console.error(`Error during "${action}":`, error);
    const baseMessage = `Không thể ${action}`;
    if (error instanceof Error) {
        const message = error.message;
        if (isPermissionError(error)) {
            if (action.toLowerCase().includes('ảnh') || action.toLowerCase().includes('image')) {
                return new Error(`Lỗi quyền truy cập API (403 - Permission Denied): Tính năng tạo/sửa ảnh AI yêu cầu API Key có quyền hoặc đã kích hoạt thanh toán (Billing). Vui lòng thêm/chọn API Key hợp lệ trong phần Quản lý API Key.`);
            }
            return new Error(`Lỗi quyền truy cập API (403 - Permission Denied): API Key hiện tại không có quyền gọi mô hình AI hoặc chưa kích hoạt quyền/thanh toán trên Google Cloud. Vui lòng kiểm tra lại API Key hoặc thêm API Key hợp lệ trong mục "Quản lý API Key".`);
        }
        if (isQuotaError(error)) {
            if (message.includes('bỏ qua nhanh')) {
                return error; // Return the fast-fail error exactly as is
            }
            return new Error(`Lỗi Hạn ngạch (Quota): Hệ thống đang quá tải. Đã tự động thử lại nhưng không thành công. Vui lòng thử lại sau ít phút hoặc thêm API Key trong mục "Quản lý API Key".`);
        }
        if (isNetworkError(error)) {
            return new Error(`Lỗi kết nối mạng (Failed to fetch): Trình duyệt hoặc mạng gặp sự cố khi kết nối tới dịch vụ AI. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau vài giây.`);
        }
        return new Error(`${baseMessage}: ${message}`);
    }
    return new Error(`Đã xảy ra lỗi không mong muốn khi ${action}.`);
}

export function startChat(highThinking: boolean = false): Chat {
  const ai = getAI();
  return ai.chats.create({
    model: highThinking ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash',
    config: highThinking ? {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH
      }
    } : undefined
  });
}

export interface SeoKeywordResult {
  productName: string;
  primaryKeywords: string[];
  longTailKeywords: string[];
  searchIntent: string;
  recommendedMetaDescription: string;
  seoTips: string[];
  sources: GroundingSource[];
  searchQueries: string[];
}

export async function suggestSeoKeywords(
  productName: string,
  category?: string,
  description?: string
): Promise<SeoKeywordResult> {
  try {
    const keys = getApiKeys();
    const customApiKey = keys.length > 0 ? keys[0] : undefined;
    const res = await fetch('/api/gemini/suggest-keywords', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-device-id': getDeviceId()
      },
      body: JSON.stringify({ productName, category, description, customApiKey })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          ...json.data,
          sources: json.sources || [],
          searchQueries: json.searchQueries || []
        };
      }
    }
  } catch (e) {
    console.warn("Backend suggest-keywords failed, falling back to direct AI:", e);
  }

  const prompt = `
Bạn là một chuyên gia SEO Thương mại điện tử.
Sử dụng công cụ tìm kiếm Google Search để tra cứu từ khóa SEO thực tế cho sản phẩm: "${productName}".
${category ? `Ngành hàng: ${category}` : ''}
${description ? `Mô tả tóm tắt: ${description.substring(0, 1000)}` : ''}

Nhiệm vụ:
- Gợi ý từ khóa chính (primary)
- Gợi ý từ khóa dài (long-tail)
- Phân tích ý định tìm kiếm (searchIntent)
- Đoạn metaDescription đề xuất 140-160 ký tự
- Lời khuyên tối ưu (seoTips)

Trả về định dạng JSON:
{
  "productName": "${productName}",
  "primaryKeywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"],
  "longTailKeywords": ["từ khóa dài 1", "từ khóa dài 2", "từ khóa dài 3"],
  "searchIntent": "...",
  "recommendedMetaDescription": "...",
  "seoTips": ["...", "..."]
}
`;

  try {
    const { response } = await generateContentWithFallback(prompt, {
      tools: [{ googleSearch: {} }],
      temperature: 0.2
    }, true, 'gemini-3.8-flash');

    const jsonStr = cleanAndExtractJson(response.text || '');
    let parsed: any = {};
    try { parsed = JSON.parse(jsonStr); } catch (err) {}
    
    const candidate = response.candidates?.[0];
    const sources = (candidate?.groundingMetadata?.groundingChunks || [])
      .filter((c: any) => c?.web?.uri)
      .map((c: any) => ({ uri: c.web.uri, title: c.web.title || c.web.uri }));
    const searchQueries = (candidate?.groundingMetadata as any)?.webSearchQueries || [];

    return {
      productName: parsed.productName || productName,
      primaryKeywords: parsed.primaryKeywords || [],
      longTailKeywords: parsed.longTailKeywords || [],
      searchIntent: parsed.searchIntent || 'Tìm kiếm và mua sắm sản phẩm',
      recommendedMetaDescription: parsed.recommendedMetaDescription || '',
      seoTips: parsed.seoTips || [],
      sources,
      searchQueries
    };
  } catch (err) {
    throw handleGeminiError(err, "gợi ý từ khóa SEO");
  }
}

export async function checkDescriptionAccuracy(
  productName: string,
  descriptionText: string
): Promise<string> {
  // First attempt server-side fact-check with Google Search grounding
  try {
    const res = await fetch('/api/gemini/fact-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, descriptionText })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.checkedHtml) {
        return data.checkedHtml;
      }
    }
  } catch (serverErr) {
    console.warn("Server fact check failed, fallback to client model:", serverErr);
  }

  const prompt = `
Bạn là một chuyên gia kiểm duyệt nội dung (QA) khắt khe.
Nhiệm vụ của bạn là kiểm tra độ chính xác của đoạn mô tả sản phẩm sau cho sản phẩm "${productName}".

Đoạn mô tả cần kiểm tra:
\`\`\`
${descriptionText}
\`\`\`

Yêu cầu:
1. Đánh giá xem có bất kỳ thông tin nào (đặc biệt là thông số kỹ thuật, kích thước, công suất, chất liệu, tính năng độc quyền...) có vẻ bịa đặt (hallucinated) hoặc không có thật đối với sản phẩm này hay không.
2. Trả về toàn bộ đoạn mô tả gốc, nhưng bọc các đoạn văn bản nghi ngờ bịa đặt trong thẻ HTML sau: <mark class="bg-red-500/30 text-red-200 px-1 rounded border border-red-500/50" title="Nghi ngờ bịa đặt">đoạn văn bản</mark>
3. Sau đoạn mô tả, hãy thêm một đường phân cách (---) và liệt kê ngắn gọn lý do tại sao bạn nghi ngờ các thông tin đó. Nếu không có thông tin nào đáng ngờ, hãy giữ nguyên đoạn mô tả và thêm ghi chú "✅ Không phát hiện thông tin bịa đặt." ở dưới cùng.
4. KHÔNG thay đổi bất kỳ từ ngữ nào của đoạn mô tả gốc ngoại trừ việc thêm thẻ <mark> vào những chỗ cần thiết.

Hãy trả về kết quả ngay lập tức mà không cần mào đầu.
`;

  try {
    const response = await generateWithRetry('gemini-3.8-flash', { 
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text || '';
  } catch (error) {
    console.error('Error in checkDescriptionAccuracy:', error);
    throw new Error('Lỗi khi kiểm tra độ chính xác.');
  }
}

export async function generateProductDescription(
    productQuery: string, 
    guidelines: string, 
    model: string = 'gemini-3.8-flash', 
    useWebSearch: boolean = true,
    url?: string,
    rawContent?: string
): Promise<GenerationResult> {
  activeFeatureContext = 'description';
  try {
    let effectiveRawContent = rawContent || '';
    if (url && (!effectiveRawContent || !effectiveRawContent.trim())) {
        try {
            const { fetchWithFallback } = await import('../utils/ecommerceScraper');
            const html = await fetchWithFallback(url, 'text');
            if (html && typeof html === 'string') {
                let content = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
                content = content.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
                content = content.replace(/<[^>]+>/g, ' ');
                content = content.replace(/\s+/g, ' ').trim();
                effectiveRawContent = content.substring(0, 12000);
            }
        } catch (e) {
            console.error("Failed to fetch link", url, e);
        }
    }

    let prompt = "";
    if (effectiveRawContent && effectiveRawContent.trim()) {
        prompt = `
          You are a strict data extractor and copywriter.
          Based ONLY on the provided product name: "${productQuery || url}" and the following provided RAW CONTENT, write a product description.
          
          RAW CONTENT:
          ${effectiveRawContent}
          
          TASK:
          1. Use the provided product name: "${productQuery || url}".
          2. BẮT BUỘC BƯỚC 1: Phân tích kỹ văn bản nguồn trước khi viết.
          3. Write a detailed product description based STRICTLY on the provided RAW CONTENT and the product name.
          4. CRITICAL ACCURACY: Đối chiếu các thông số (isofix, kích thước, ...) với dữ liệu đầu vào. Nếu thông tin mâu thuẫn hoặc không tồn tại trong văn bản nguồn, hãy loại bỏ ngay lập tức.
          5. ABSOLUTELY NO HALLUCINATION: DO NOT use any external knowledge. Nếu thông tin không xuất hiện trong RAW CONTENT, bạn PHẢI ghi rõ 'Thông tin không xác định' thay vì đoán mò. Do NOT infer features based on the product category.
          
          STRICT GUIDELINES:
          ${guidelines}
          
          CRITICAL FORMATTING RULES:
          - The VERY FIRST LINE of the descriptionHtml MUST be: <h3><strong>Giới thiệu tổng quan về ${productQuery || '[Tên sản phẩm]'}</strong></h3>
          - Use the exact product name in the header.
          - Immediately after this <h3> header, start the first paragraph <p> with the content.
          - DO NOT add any intermediate headers or bold lines like "Giới thiệu sản phẩm" or repeating the product name again right after the <h3>.
          - STRICTLY FORBIDDEN: DO NOT use Markdown formatting like **bold** or *italic*. Use ONLY HTML tags like <strong> and <em>.
          - DO NOT use the asterisk (*) character for formatting or at the start of lines.
          - No H1 or H2 tags. Use only <h3>, <p>, and <strong> for HTML.
          
          Output ONLY valid JSON: { "productName": "...", "descriptionHtml": "..." }
        `;
    } else if (url) {
        prompt = `
          You are a strict data extractor and copywriter.
          Based ONLY on the information from the provided URL: "${url}", write a product description.
          
          TASK:
          1. Use the provided product name: "${productQuery}" (if empty, extract the product name from the URL).
          2. BẮT BUỘC BƯỚC 1: Phân tích kỹ văn bản nguồn từ URL trước khi viết.
          3. Write a detailed product description based STRICTLY on the content of that specific page.
          4. Identify the brand of the product from the name/content.
          5. CRITICAL ACCURACY: Đối chiếu các thông số (isofix, kích thước, ...) với dữ liệu đầu vào. Nếu thông tin mâu thuẫn hoặc không tồn tại, hãy loại bỏ ngay lập tức.
          6. ABSOLUTELY NO HALLUCINATION: Nếu thông tin không xuất hiện trên trang, bạn PHẢI ghi rõ 'Thông tin không xác định' thay vì đoán mò. Do not infer features based on similar products.
          
          STRICT GUIDELINES:
          ${guidelines}
          
          CRITICAL FORMATTING RULES:
          - The VERY FIRST LINE of the descriptionHtml MUST be: <h3><strong>Giới thiệu tổng quan về ${productQuery || '[Tên sản phẩm]'}</strong></h3>
          - If a product name was provided ("${productQuery}"), you MUST use it EXACTLY in the header.
          - If the provided name was empty, use the exact product name you extracted from the URL in the header.
          - Immediately after this <h3> header, start the first paragraph <p> with the content.
          - DO NOT add any intermediate headers or bold lines like "Giới thiệu sản phẩm" or repeating the product name again right after the <h3>.
          - STRICTLY FORBIDDEN: DO NOT use Markdown formatting like **bold** or *italic*. Use ONLY HTML tags like <strong> and <em>.
          - DO NOT use the asterisk (*) character for formatting or at the start of lines.
          - No H1 or H2 tags. Use only <h3>, <p>, and <strong> for HTML.
          
          Output ONLY valid JSON: { "productName": "...", "descriptionHtml": "..." }
        `;
    } else {
        prompt = `
          Based on information from the web, write a product description for: "${productQuery}".
          
          TASK:
          1. BẮT BUỘC BƯỚC 1: Phân tích kỹ văn bản nguồn từ website chính thức trước khi viết.
          2. Identify the brand of the product from the name.
          3. Find the official homepage or product page of that brand/product.
          4. Use ONLY information from the official site to generate the description to ensure accuracy.
          5. CRITICAL ACCURACY: Đối chiếu các thông số (isofix, kích thước, ...) với dữ liệu tìm được. Nếu thông tin mâu thuẫn hoặc không tồn tại, hãy loại bỏ ngay lập tức.
          6. ABSOLUTELY NO HALLUCINATION: Nếu thông tin không xuất hiện, bạn PHẢI ghi rõ 'Thông tin không xác định' thay vì đoán mò. It is strictly forbidden to guess specifications based on the product type.
          
          STRICT GUIDELINES:
          ${guidelines}
          
          CRITICAL FORMATTING RULES:
          - The VERY FIRST LINE of the descriptionHtml MUST be: <h3><strong>Giới thiệu tổng quan về ${productQuery}</strong></h3>
          - The product name in the header MUST be EXACTLY "${productQuery}". Do not shorten, expand, or modify it.
          - Immediately after this <h3> header, start the first paragraph <p> with the content.
          - DO NOT add any intermediate headers or bold lines like "Giới thiệu sản phẩm" or repeating the product name again right after the <h3>.
          - STRICTLY FORBIDDEN: DO NOT use Markdown formatting like **bold** or *italic*. Use ONLY HTML tags like <strong> and <em>.
          - DO NOT use the asterisk (*) character for formatting or at the start of lines.
          - No H1 or H2 tags. Use only <h3>, <p>, and <strong> for HTML.
          
          Output ONLY valid JSON: { "descriptionHtml": "..." }
        `;
    }
    
    const config: any = { temperature: 0.1 };
    if (rawContent && rawContent.trim()) {
        config.tools = [];
    } else if (url) {
        config.tools = [{ urlContext: {} }];
    } else if (useWebSearch) {
        config.tools = [{ googleSearch: {} }];
    }
    if (!config.tools || config.tools.length === 0) {
        config.responseMimeType = 'application/json';
    }
    
    const { response } = await generateContentWithFallback(prompt, config, true, model);
    let jsonString = cleanAndExtractJson(response.text || '');
    let data: any = {};
    if (jsonString) {
        try {
            data = JSON.parse(jsonString);
        } catch (_) {
            const arr = dirtyJsonParse(jsonString);
            if (arr.length > 0) data = arr[0];
        }
    }
    
    if (!data.descriptionHtml && response.text) {
        let rawText = response.text.replace(/```(?:html|json)?/gi, '').replace(/```/g, '').trim();
        data.descriptionHtml = rawText;
    }
    
    // Cleanup: Remove any Markdown-style bold/italic asterisks that might have leaked
    if (data.descriptionHtml) {
        data.descriptionHtml = data.descriptionHtml.replace(/\*\*/g, '').replace(/\*/g, '');
    }
    
    let sources: GroundingSource[] = [];
    let searchQueries: string[] = [];
    const candidate = response.candidates?.[0];
    if (candidate?.groundingMetadata?.groundingChunks) {
      sources = (candidate.groundingMetadata.groundingChunks as any[])
        .map((chunk: GroundingChunk) => ({ uri: chunk.web?.uri || '', title: chunk.web?.title || '' }))
        .filter((s: GroundingSource) => s.uri);
    }
    if ((candidate?.groundingMetadata as any)?.webSearchQueries) {
      searchQueries = (candidate?.groundingMetadata as any).webSearchQueries;
    }
    
    const html = minifyHtml(data.descriptionHtml || '');
    return {
      productName: data.productName || productQuery,
      descriptionText: stripHtmlToText(html),
      descriptionHtml: html,
      sources,
      searchQueries,
      seoKeywords: data.seoKeywords || [],
      metaDescription: data.metaDescription || '',
    };
  } catch (error) { throw handleGeminiError(error, "tạo mô tả"); }
}

export async function generateBatchSimpleDescriptions(
    products: string[], 
    simplePrompt: string, 
    model: string = 'gemini-3.8-flash', 
    useWebSearch: boolean = false,
    isLinkMode: boolean = false,
    isRawMode: boolean = false
): Promise<SingleGenerationResult[]> {
    try {
        let enrichedProducts = [...products];
        if (isLinkMode) {
            const { fetchWithFallback } = await import('../utils/ecommerceScraper');
            enrichedProducts = await Promise.all(products.map(async (p) => {
                const parts = p.split('|').map(s => s.trim());
                let name = ""; let url = ""; let raw = "";
                if (parts.length >= 3) {
                    name = parts[0]; url = parts[1]; raw = parts.slice(2).join('|');
                } else if (parts.length === 2) {
                    // Check if either is a url
                    if (parts[1].startsWith('http')) { name = parts[0]; url = parts[1]; }
                    else if (parts[0].startsWith('http')) { url = parts[0]; name = parts[1]; }
                    else { name = parts[0]; raw = parts[1]; }
                } else if (parts.length === 1) {
                    if (parts[0].startsWith('http')) url = parts[0]; else name = parts[0];
                }

                if (url && (!raw || raw.trim() === '')) {
                    try {
                        const html = await fetchWithFallback(url, 'text');
                        if (html && typeof html === 'string') {
                            let content = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
                            content = content.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
                            content = content.replace(/<[^>]+>/g, ' ');
                            content = content.replace(/\s+/g, ' ').trim();
                            raw = content.substring(0, 10000);
                        }
                    } catch (e) {
                        console.error("Failed to fetch link", url, e);
                    }
                }
                return `${name} | ${url} | ${raw}`;
            }));
        }

        let prompt = "";
        if (isLinkMode || isRawMode) {
            prompt = `For the following products (format is "Name | URL | RawContent"): ${enrichedProducts.join('\n')}, write simple descriptions based on: ${simplePrompt}. 
            TASK:
            1. If a name is provided, use it as the product name. If only a URL is provided, extract the product name from the URL or RawContent.
            2. BẮT BUỘC BƯỚC 1: Phân tích kỹ văn bản nguồn trước khi viết.
            3. Write a simple description using ONLY the content provided in RawContent.
            4. Identify the brand for each.
            5. CRITICAL ACCURACY: Đối chiếu các thông số (isofix, kích thước, ...) với dữ liệu đầu vào. Nếu thông tin mâu thuẫn hoặc không tồn tại, hãy loại bỏ ngay lập tức.
            6. ABSOLUTELY NO HALLUCINATION: DO NOT use any external knowledge. Nếu thông tin không xuất hiện trong RawContent, bạn PHẢI ghi rõ 'Thông tin không xác định' thay vì đoán mò. Do not infer features.
            
            - STRICTLY FORBIDDEN: DO NOT use Markdown formatting like **bold** or *italic*. Use ONLY HTML tags like <strong> and <em>.
            - DO NOT use the asterisk (*) character for formatting or at the start of lines.
            Output JSON ARRAY of objects { productName, descriptionHtml }.`;
        } else {
            prompt = `For products: ${products.join(', ')}, write descriptions based on: ${simplePrompt}. 
            TASK:
            1. BẮT BUỘC BƯỚC 1: Phân tích kỹ văn bản nguồn từ website chính thức trước khi viết.
            2. Identify the brand for each product.
            3. Find the official site and use ONLY that info for accuracy.
            4. CRITICAL ACCURACY: Đối chiếu các thông số (isofix, kích thước, ...) với dữ liệu tìm được. Nếu thông tin mâu thuẫn hoặc không tồn tại, hãy loại bỏ ngay lập tức.
            5. ABSOLUTELY NO HALLUCINATION: Nếu thông tin không xuất hiện, bạn PHẢI ghi rõ 'Thông tin không xác định' thay vì đoán mò.
            
            - STRICTLY FORBIDDEN: DO NOT use Markdown formatting like **bold** or *italic*. Use ONLY HTML tags like <strong> and <em>.
            - DO NOT use the asterisk (*) character for formatting or at the start of lines.
            Avoid duplication of headers. Output JSON ARRAY of objects { productName, descriptionHtml }.`;
        }

        const config: any = { temperature: 0.1 };
        if (useWebSearch) {
            config.tools = [{ googleSearch: {} }];
        } else {
            config.responseMimeType = 'application/json';
        }
        
        const { response } = await generateContentWithFallback(prompt, config, true, model);
        let data: any[] = parseJsonArraySafely(response.text || '');
        
        if ((!data || data.length === 0) && response.text) {
            const raw = response.text.replace(/```(?:html|json)?/gi, '').replace(/```/g, '').trim();
            if (products.length === 1) {
                const nameOnly = products[0].includes('|') ? products[0].split('|')[0].trim() : products[0];
                data = [{ productName: nameOnly, descriptionHtml: raw }];
            }
        }
        
        // Cleanup: Remove any Markdown-style bold/italic asterisks that might have leaked
        data = (data || []).map((item: any) => {
            if (item && item.descriptionHtml) {
                item.descriptionHtml = item.descriptionHtml.replace(/\*\*/g, '').replace(/\*/g, '');
            }
            return item;
        });

        return products.map((p, idx) => {
            const nameOnly = p.includes('|') ? p.split('|')[0].trim() : p;
            const item = findMatchingItem(data, nameOnly, p) || (data.length === products.length ? data[idx] : (products.length === 1 ? data[0] : null));
            if (item && item.descriptionHtml) {
                const html = minifyHtml(item.descriptionHtml);
                return { 
                    productName: item.productName || nameOnly, 
                    descriptionText: stripHtmlToText(html), 
                    descriptionHtml: html, 
                    sources: [], 
                    status: 'success' 
                };
            }
            return { productName: nameOnly, descriptionText: '', descriptionHtml: '', sources: [], status: 'error' };
        });
    } catch (error) { throw handleGeminiError(error, "tạo hàng loạt"); }
}

export async function generateBatchDetailedDescriptions(
    products: string[], 
    guidelines: string, 
    model: string = 'gemini-3.8-flash', 
    useWebSearch: boolean = true,
    isLinkMode: boolean = false,
    isRawMode: boolean = false
): Promise<SingleGenerationResult[]> {
    try {
        let enrichedProducts = [...products];
        if (isLinkMode) {
            const { fetchWithFallback } = await import('../utils/ecommerceScraper');
            enrichedProducts = await Promise.all(products.map(async (p) => {
                const parts = p.split('|').map(s => s.trim());
                let name = ""; let url = ""; let raw = "";
                if (parts.length >= 3) {
                    name = parts[0]; url = parts[1]; raw = parts.slice(2).join('|');
                } else if (parts.length === 2) {
                    if (parts[1].startsWith('http')) { name = parts[0]; url = parts[1]; }
                    else if (parts[0].startsWith('http')) { url = parts[0]; name = parts[1]; }
                    else { name = parts[0]; raw = parts[1]; }
                } else if (parts.length === 1) {
                    if (parts[0].startsWith('http')) url = parts[0]; else name = parts[0];
                }

                if (url && (!raw || raw.trim() === '')) {
                    try {
                        const html = await fetchWithFallback(url, 'text');
                        if (html && typeof html === 'string') {
                            let content = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
                            content = content.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
                            content = content.replace(/<[^>]+>/g, ' ');
                            content = content.replace(/\s+/g, ' ').trim();
                            raw = content.substring(0, 10000);
                        }
                    } catch (e) {
                        console.error("Failed to fetch link", url, e);
                    }
                }
                return `${name} | ${url} | ${raw}`;
            }));
        }

        let inputInstruction = "";
        if (isRawMode && isLinkMode) {
            inputInstruction = "The input format is 'Name | URL | RawContent'. Use ONLY the content from the provided URLs and RawContent.";
        } else if (isRawMode) {
            inputInstruction = "The input format is 'Name | URL | RawContent'. The second part (URL) might be empty. Use ONLY the provided RawContent and Name. DO NOT look for information elsewhere.";
        } else if (isLinkMode) {
            inputInstruction = "The input format is 'Name | URL | RawContent'. Using the scraped RawContent is HIGH PRIORITY. You MUST use the provided RawContent to extract information.";
        }

        const prompt = `
          Generate detailed descriptions for the following products:
          ${isLinkMode ? enrichedProducts.join('\n') : products.join('\n')}
          
          ${inputInstruction}
          Note: If a product provided has empty RawContent or URL, and web search is enabled, you MUST search for its official information online.
          
          CRITICAL INSTRUCTION - NO HALLUCINATION:
          1. BẮT BUỘC BƯỚC 1: Phân tích kỹ văn bản nguồn trước khi viết.
          2. Đối chiếu các thông số (isofix, kích thước, ...) với dữ liệu đầu vào. Nếu thông tin mâu thuẫn hoặc không tồn tại, hãy loại bỏ ngay lập tức.
          3. If you are using RawContent, DO NOT use external knowledge. Nếu thông tin không xuất hiện, bạn PHẢI ghi rõ 'Thông tin không xác định' thay vì đoán mò. Do not guess features based on the product category.
          
          STRICT GUIDELINES:
          ${guidelines}
          
          CRITICAL FORMATTING RULES FOR EACH PRODUCT:
          - The VERY FIRST LINE of the descriptionHtml MUST be: <h3><strong>Giới thiệu tổng quan về [Product Name]</strong></h3>
          - Use the EXACT product name provided.
          - Immediately after this <h3> header, start the first paragraph <p> with the content.
          - DO NOT add any intermediate headers or bold lines like "Giới thiệu sản phẩm" or repeating the product name again right after the <h3>.
          - STRICTLY FORBIDDEN: DO NOT use Markdown formatting like **bold** or *italic*. Use ONLY HTML tags like <strong> and <em>.
          - DO NOT use the asterisk (*) character for formatting or at the start of lines.
          - No H1 or H2 tags. Use only <h3>, <p>, and <strong> for HTML.
          
          Output JSON ARRAY of objects: { "productName": "...", "descriptionHtml": "..." }
        `;
        const config: any = { temperature: 0.1, maxOutputTokens: 8192 };
        if (useWebSearch) {
            config.tools = [{ googleSearch: {} }];
        } else {
            config.responseMimeType = 'application/json';
        }

        const { response } = await generateContentWithFallback(prompt, config, true, model);
        let data: any[] = parseJsonArraySafely(response.text || '');

        if ((!data || data.length === 0) && response.text) {
            const raw = response.text.replace(/```(?:html|json)?/gi, '').replace(/```/g, '').trim();
            if (products.length === 1) {
                const nameOnly = products[0].includes('|') ? products[0].split('|')[0].trim() : products[0];
                data = [{ productName: nameOnly, descriptionHtml: raw }];
            }
        }

        if (!data || data.length === 0) {
            try {
                const jsonFallbackPrompt = `${prompt}\n\nIMPORTANT: Return ONLY a raw JSON Array: [{"productName": "...", "descriptionHtml": "..."}]`;
                const { response: jsonResp } = await generateContentWithFallback(
                    jsonFallbackPrompt, 
                    { responseMimeType: 'application/json', temperature: 0.1 }, 
                    false, 
                    'gemini-3.8-flash'
                );
                data = parseJsonArraySafely(jsonResp.text || '');
            } catch (fbErr) {
                console.warn("JSON structured fallback failed:", fbErr);
            }
        }

        if (!data || data.length === 0) {
            console.error("AI response was empty or invalid JSON:", response.text);
            throw new Error("Mô hình AI trả về phản hồi rỗng hoặc không hợp lệ khi tạo mô tả chi tiết hàng loạt.");
        }
        
        // Cleanup: Remove any Markdown-style bold/italic asterisks that might have leaked
        data = data.map((item: any) => {
            if (item && item.descriptionHtml) {
                item.descriptionHtml = item.descriptionHtml.replace(/\*\*/g, '').replace(/\*/g, '');
            }
            return item;
        });

        const candidate = response.candidates?.[0];
        let sources: GroundingSource[] = [];
        let searchQueries: string[] = [];
        if (candidate?.groundingMetadata?.groundingChunks) {
            sources = (candidate.groundingMetadata.groundingChunks as any[])
                .map((chunk: GroundingChunk) => ({ uri: chunk.web?.uri || '', title: chunk.web?.title || '' }))
                .filter((s: GroundingSource) => s.uri);
        }
        if ((candidate?.groundingMetadata as any)?.webSearchQueries) {
            searchQueries = (candidate?.groundingMetadata as any).webSearchQueries;
        }

        return products.map((p, idx) => {
            const nameOnly = p.includes('|') ? p.split('|')[0].trim() : p;
            const item = findMatchingItem(data, nameOnly, p) || (data.length === products.length ? data[idx] : (products.length === 1 ? data[0] : null));
            if (item && item.descriptionHtml) {
                const html = minifyHtml(item.descriptionHtml);
                return { 
                    productName: item.productName || nameOnly, 
                    descriptionText: stripHtmlToText(html), 
                    descriptionHtml: html, 
                    sources, 
                    searchQueries,
                    seoKeywords: item.seoKeywords || [],
                    metaDescription: item.metaDescription || '',
                    status: 'success' 
                };
            }
            return { productName: nameOnly, descriptionText: '', descriptionHtml: '', sources: [], status: 'error' };
        });
    } catch (error) { throw handleGeminiError(error, "tạo chi tiết"); }
}

export async function extractProductAttributesForSingleItem(
    productInput: string, 
    attributes: AttributeDefinition[],
    useProModel: boolean = true
): Promise<{ modelUsed: string, data: ExtractedResult }> {
    try {
        // Construct the attribute list for the prompt
        const list = attributes.map(a => {
            if (a.type === 'fixed' && a.values) {
                return `- "${a.name}": Choose one best value from [${a.values}]`;
            }
            return `- "${a.name}": Extract exact text from spec`;
        }).join('\n');

        const prompt = `
        You are a highly accurate data extraction assistant.
        
        TASK:
        1. Search Google for the product: "${productInput}".
        2. Find its technical specifications and details.
        3. Extract the following attributes.
        
        ATTRIBUTES TO EXTRACT:
        ${list}
        
        STRICT OUTPUT RULES:
        - Return ONLY a JSON object. No markdown, no code blocks.
        - Keys must be exactly: ${attributes.map(a => `"${a.name}"`).join(', ')}.
        - If an attribute is NOT found after searching, do not leave it blank. Instead, try to infer it logically from the product name or category (e.g. if name contains "250ml", set Capacity to "250ml").
        - If absolutely no info is found, use "Đang cập nhật" (Updating) as the value. DO NOT use null or empty string.
        - Translate all values to Vietnamese.
        `;

        const model = useProModel ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash';
        
        // Use generateWithRetry directly to control the model choice better, but with fallback for safety
        let response: GenerateContentResponse;
        try {
             response = await generateWithRetry(model, {
                contents: prompt,
                config: { tools: [{ googleSearch: {} }], responseMimeType: 'application/json' } // Force search
            }, 1);
        } catch (e) {
            // Fallback to flash if pro fails or vice versa
            console.warn(`Extraction failed with ${model}, trying fallback.`);
            response = await generateWithRetry('gemini-3.8-flash', {
                contents: prompt,
                config: { tools: [{ googleSearch: {} }], responseMimeType: 'application/json' }
            });
        }

        const jsonString = cleanAndExtractJson(response.text || '');
        if (!jsonString) {
             throw new Error("Empty response from AI");
        }
        
        const rawData = JSON.parse(jsonString);
        
        // Normalize keys to match requested attributes exactly (handle case sensitivity)
        const normalizedData: ExtractedResult = { productName: productInput };
        
        attributes.forEach(attr => {
            // Find key case-insensitively
            const foundKey = Object.keys(rawData).find(k => k.toLowerCase() === attr.name.toLowerCase());
            normalizedData[attr.name] = foundKey ? rawData[foundKey] : "Đang cập nhật";
        });

        return { modelUsed: model, data: normalizedData };
    } catch (error) { 
        throw handleGeminiError(error, "trích xuất thuộc tính"); 
    }
}

export async function scrapeImagesFromUrl(url: string): Promise<string[]> {
    try {
        const prompt = `Analyze page: ${url}. Find real product image URLs (jpg, png, webp). Do NOT invent or make up URLs. Only return real URLs found on the page. Return ONLY a JSON array of strings.`;
        const { response } = await generateContentWithFallback(prompt, { tools: [{ googleSearch: {} }], responseMimeType: 'application/json' }, true);
        const jsonString = cleanAndExtractJson(response.text || '');
        if (!jsonString) return [];
        
        let images: any[] = [];
        try {
            images = JSON.parse(jsonString);
        } catch (e) {
            images = dirtyJsonParse(jsonString);
        }
        
        if (!Array.isArray(images)) return [];

        return images.filter((img: any) => {
            if (typeof img !== 'string') return false;
            const trimmed = img.trim();
            if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
            if (trimmed.length < 15) return false;
            const lower = trimmed.toLowerCase();
            if (lower.includes('placeholder') || lower.includes('example.com') || lower.includes('dummy') || lower.includes('pixel') || lower.includes('spacer')) return false;
            return true;
        });
    } catch (error) { 
        console.warn("scrapeImagesFromUrl failed:", error);
        return [];
    }
}

export async function standardizeProductNames(names: string[], rules?: string): Promise<StandardizedNameResult[]> {
    activeFeatureContext = 'seo';
    try {
        const prompt = `
        Standardize the following product names for Google SEO and E-commerce marketing.
        
        RULES TO FOLLOW:
        ${rules || '- Cấu trúc chuẩn SEO: [Loại sản phẩm] + [Thương hiệu] + [Tên dòng/Model] + [Mã sản phẩm] + [Màu sắc (nếu có thông tin)]\n- Ưu tiên từ khóa SEO quan trọng lên đầu.\n- Viết hoa chữ cái đầu mỗi từ quan trọng (Title Case).\n- Giữ nguyên các mã sản phẩm, model, SKU (ví dụ: APS204AS0E, iPhone 15 Pro Max) không được thay đổi định dạng hoặc viết thường.\n- Không dùng toàn bộ chữ in hoa.\n- Không dùng ký tự đặc biệt, emoji, hoặc từ quảng cáo (Rẻ nhất, Freeship).\n- Đơn vị đo lường chuẩn (ml, g, kg, cm).'}
        
        PRODUCTS TO STANDARDIZE:
        ${names.join('\n')}
        
        TASK:
        1. For each product, provide a standardized name that follows the rules.
        2. Output ONLY a JSON array of objects: { "original": "...", "standardized": "..." }.
        `;
        
        const { response } = await generateContentWithFallback(prompt, { responseMimeType: 'application/json' }, false, 'gemini-3.8-flash');
        const jsonString = cleanAndExtractJson(response.text || '');
        if (!jsonString) return names.map(n => ({ original: n, standardized: n, status: 'error' }));
        
        let data = [];
        try { 
            data = JSON.parse(jsonString); 
        } catch (e) { 
            data = dirtyJsonParse(jsonString); 
        }
        
        return data.map((item: any) => ({
            original: item.original || '',
            standardized: item.standardized || '',
            status: 'success'
        }));
    } catch (error) { 
        throw handleGeminiError(error, "chuẩn hóa tên sản phẩm"); 
    }
}

export async function generateSeoProductNames(names: string[], rules?: string, model: string = 'gemini-3.8-flash'): Promise<StandardizedNameResult[]> {
    activeFeatureContext = 'seo';
    try {
        const prompt = `
        You are an expert E-commerce Copywriter and SEO Specialist.
        Generate high-converting, Google Ads & E-commerce SEO optimized product titles for the following items.

        RULES TO FOLLOW:
        ${rules || '- Cấu trúc Tên SEO Quảng cáo: [Từ khóa tìm kiếm hot / Thương hiệu] + [Tên sản phẩm chính] + [Đặc tính nổi bật / Kích thước / Dung tích] + [Mã SP / Loại]\n- Ưu tiên từ khóa tìm kiếm có lượng truy cập cao lên vị trí đầu tiên.\n- Viết hoa chữ cái đầu các từ chính (Title Case).\n- Tối ưu độ dài trong khoảng 60 - 90 ký tự (chuẩn Google Shopping / Shopee Ads).\n- Loại bỏ từ quảng cáo giật tít không hợp lệ, giữ nguyên mã số kỹ thuật.'}

        PRODUCTS:
        ${names.join('\n')}

        TASK:
        1. For each product, create an attractive, high-converting SEO product title.
        2. Output ONLY a JSON array of objects: { "original": "...", "standardized": "..." }.
        `;
        
        const { response } = await generateContentWithFallback(prompt, { responseMimeType: 'application/json' }, false, model);
        const jsonString = cleanAndExtractJson(response.text || '');
        if (!jsonString) return names.map(n => ({ original: n, standardized: n, status: 'error' }));
        
        let data = [];
        try { 
            data = JSON.parse(jsonString); 
        } catch (e) { 
            data = dirtyJsonParse(jsonString); 
        }
        
        return data.map((item: any) => ({
            original: item.original || '',
            standardized: item.standardized || item.seoName || '',
            status: 'success'
        }));
    } catch (error) { 
        throw handleGeminiError(error, "tạo tên SEO sản phẩm"); 
    }
}

export async function suggestGuidelines(currentGuidelines: string, productName?: string): Promise<string> {
    try {
        const prompt = `
        You are an expert in E-commerce Copywriting and SEO.
        
        TASK:
        1. Analyze the current product description guidelines: "${currentGuidelines}".
        2. ${productName ? `Consider the product: "${productName}".` : ''}
        3. Optimize these guidelines to be more professional, clear, and effective for generating high-quality product descriptions.
        4. If the current guidelines are empty, generate a comprehensive set of standard guidelines for a professional product description.
        5. The output should be a structured list of rules in Vietnamese.
        
        STRICT RULES:
        - Focus on structure (Introduction, Features, Benefits, Call to Action).
        - Include formatting rules (HTML tags like <h3>, <p>, <strong>).
        - Ensure the tone is appropriate for e-commerce.
        - Output ONLY the optimized guidelines text. No conversational filler.
        `;
        
        const { response } = await generateContentWithFallback(prompt, { responseMimeType: 'text/plain' }, false, 'gemini-3.8-flash');
        return response.text || currentGuidelines;
    } catch (error) {
        throw handleGeminiError(error, "gợi ý nguyên tắc");
    }
}

export async function categorizeProducts(names: string[]): Promise<{original: string, category: string}[]> {
    try {
        const prompt = `
        Categorize the following products into logical e-commerce categories:
        ${names.join('\n')}
        
        TASK:
        1. For each product, provide a concise category (e.g., "Thực phẩm", "Điện tử", "Thời trang", "Mỹ phẩm").
        2. Use Vietnamese for categories.
        3. Output ONLY a JSON array of objects: { "original": "...", "category": "..." }.
        `;
        
        const { response } = await generateContentWithFallback(prompt, { responseMimeType: 'application/json' }, false, 'gemini-3.8-flash');
        const jsonString = cleanAndExtractJson(response.text || '');
        if (!jsonString) return names.map(n => ({ original: n, category: 'N/A' }));
        
        let data = [];
        try { 
            data = JSON.parse(jsonString); 
        } catch (e) { 
            data = dirtyJsonParse(jsonString); 
        }
        return data;
    } catch (error) {
        throw handleGeminiError(error, "phân loại sản phẩm");
    }
}
export async function suggestStandardizationRules(currentRules: string): Promise<string> {
    try {
        const prompt = `
        You are an expert in E-commerce SEO and Google Shopping optimization.
        
        TASK:
        1. Analyze the current product name standardization rules: "${currentRules}".
        2. Optimize these rules to ensure product names are perfectly formatted for Google Search and Shopping SEO.
        3. Rules should focus on: Structure ([Brand] + [Type] + [Features]...), Keyword placement, Title Case, Length (70-100 chars), and removing promotional fluff.
        4. If the current rules are empty, generate a comprehensive set of best-practice SEO rules for product names.
        
        Output ONLY the optimized rules in Markdown format (bullet points).
        `;
        
        const { response } = await generateContentWithFallback(prompt, { model: 'gemini-3.8-flash' }, false);
        return response.text || currentRules;
    } catch (error) { 
        throw handleGeminiError(error, "gợi ý quy tắc chuẩn hóa"); 
    }
}

export async function groupImagesByVariantsWithAI(mainImages: string[], variantImages: string[]): Promise<Record<string, string[]>> {
    activeFeatureContext = 'scraper';
    try {
        const prompt = `
        You are an e-commerce expert. I have a list of product images (main gallery) and a list of variant swatch images (colors/types).
        
        Variant Swatch Images:
        ${variantImages.map((url, i) => `Variant ${i + 1}: ${url}`).join('\n')}
        
        Main Gallery Images:
        ${mainImages.map((url, i) => `Img ${i + 1}: ${url}`).join('\n')}
        
        TASK:
        1. Look at the visual characteristics of the Variant Swatch Images (e.g. colors).
        2. Group the Main Gallery Images by determining which Variant they match.
        3. Identify "General" images (size charts, logos, lifestyle shots showing multiple colors) and include them in ALL groups.
        4. Return ONLY a JSON object where keys are the Variant Swatch Image URLs, and values are arrays of corresponding Main Gallery Image URLs.
        `;

        const { response } = await generateContentWithFallback(prompt, { 
            responseMimeType: 'application/json',
            tools: [{ googleSearch: {} }]
        }, false, 'gemini-3.8-flash');
        const jsonString = cleanAndExtractJson(response.text || '');
        if (!jsonString) return {};
        
        try {
            return JSON.parse(jsonString) as Record<string, string[]>;
        } catch (e: any) {
            console.error("AI grouping by variants failed to parse JSON.");
            console.error("Raw response:", response.text);
            console.error("Cleaned JSON:", jsonString);
            throw e;
        }
    } catch (error) {
        console.error("AI grouping by variants failed:", error);
        return {};
    }
}

export async function groupMediaByColorWithAI(mediaUrlsWithPosition: {url: string, position: number}[], colorGroups: {name: string, startPos: number}[]): Promise<Record<string, string[]>> {
    activeFeatureContext = 'scraper';
    try {
        const prompt = `
        You are an e-commerce expert. I have a list of product images with their positions in the gallery.
        Available Colors and their reported starting positions:
        ${colorGroups.map(c => `- ${c.name} (starts at position ${c.startPos})`).join('\n')}
        
        Media Gallery:
        ${mediaUrlsWithPosition.map(m => `Pos ${m.position}: ${m.url}`).join('\n')}
        
        TASK:
        1. Group these images by the color they represent.
        2. Use the "starting positions" as a strong hint, but BE SMART. If you see images that clearly belong to the NEXT color appearing before its reported start position, group them correctly. 
        3. Identify "General" images (size charts, lifestyle shots with multiple colors, and measurement tables).
        4. General images should be included in ALL color groups.
        5. Return ONLY a JSON object: { "Color Name": ["url1", "url2"], ... }
        `;

        const { response } = await generateContentWithFallback(prompt, { 
            responseMimeType: 'application/json',
            tools: [{ googleSearch: {} }]
        }, false, 'gemini-3.8-flash');
        const jsonString = cleanAndExtractJson(response.text || '');
        if (!jsonString) return {};
        
        try {
            return JSON.parse(jsonString);
        } catch (e: any) {
            console.error("groupMediaByColorWithAI failed to parse JSON.");
            console.error("Raw response:", response.text);
            console.error("Cleaned JSON:", jsonString);
            throw e;
        }
    } catch (error) {
        throw handleGeminiError(error, "phân loại ảnh theo màu bằng AI");
    }
}

export async function removeBackgroundCanvas(base64Image: string, mimeType: string, tolerance: number = 32): Promise<string> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            return reject(new Error("Canvas background removal requires browser environment."));
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const width = img.naturalWidth || img.width;
                const height = img.naturalHeight || img.height;
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Canvas context not available'));
                }
                ctx.drawImage(img, 0, 0);
                const imgData = ctx.getImageData(0, 0, width, height);
                const data = imgData.data;

                // Sample corners and mid edges to determine background color
                const samplePoints = [
                    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
                    [Math.floor(width / 2), 0], [0, Math.floor(height / 2)],
                    [width - 1, Math.floor(height / 2)], [Math.floor(width / 2), height - 1]
                ];
                let sumR = 0, sumG = 0, sumB = 0;
                for (const [x, y] of samplePoints) {
                    const idx = (y * width + x) * 4;
                    sumR += data[idx];
                    sumG += data[idx + 1];
                    sumB += data[idx + 2];
                }
                const bgR = sumR / samplePoints.length;
                const bgG = sumG / samplePoints.length;
                const bgB = sumB / samplePoints.length;

                // Flood fill algorithm from all border pixels
                const visited = new Uint8Array(width * height);
                const queue: number[] = [];

                for (let x = 0; x < width; x++) {
                    queue.push(x, 0);
                    queue.push(x, height - 1);
                }
                for (let y = 1; y < height - 1; y++) {
                    queue.push(0, y);
                    queue.push(width - 1, y);
                }

                const colorDist = (r: number, g: number, b: number) => {
                    return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
                };

                let head = 0;
                while (head < queue.length) {
                    const x = queue[head++];
                    const y = queue[head++];
                    const pixelIdx = y * width + x;
                    if (visited[pixelIdx]) continue;
                    visited[pixelIdx] = 1;

                    const dataIdx = pixelIdx * 4;
                    const r = data[dataIdx];
                    const g = data[dataIdx + 1];
                    const b = data[dataIdx + 2];

                    const dist = colorDist(r, g, b);
                    if (dist <= tolerance * 2.8) {
                        const alphaRatio = Math.max(0, Math.min(1, (dist - (tolerance * 1.6)) / (tolerance * 1.2)));
                        data[dataIdx + 3] = Math.round(data[dataIdx + 3] * alphaRatio);

                        if (x > 0 && !visited[pixelIdx - 1]) queue.push(x - 1, y);
                        if (x < width - 1 && !visited[pixelIdx + 1]) queue.push(x + 1, y);
                        if (y > 0 && !visited[pixelIdx - width]) queue.push(x, y - 1);
                        if (y < height - 1 && !visited[pixelIdx + width]) queue.push(x, y + 1);
                    }
                }

                ctx.putImageData(imgData, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                const base64Clean = dataUrl.replace(/^data:image\/png;base64,/, '');
                resolve(base64Clean);
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = (e) => reject(new Error("Không thể tải hình ảnh để xử lý tách nền."));
        img.src = base64Image.startsWith('data:') ? base64Image : `data:${mimeType || 'image/png'};base64,${base64Image}`;
    });
}

export async function editImageWithPrompt(base64Image: string, mimeType: string, prompt: string, quality: 'speed' | 'quality' = 'speed'): Promise<string> {
    const isBgRemoval = prompt.toLowerCase().includes('remove background') || 
                        prompt.toLowerCase().includes('tách nền') || 
                        prompt.toLowerCase().includes('xóa nền') ||
                        prompt.toLowerCase().includes('transparent background');

    try {
        const model = quality === 'quality' ? 'gemini-3.1-flash-image' : 'gemini-3.1-flash-lite-image';
        
        // Use retry for image edit as well
        const response = await generateWithRetry(model, {
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Image
                        }
                    },
                    { text: prompt }
                ]
            }
        });
        
        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return part.inlineData.data;
                }
            }
        }
        
        throw new Error("Mô hình AI không trả về dữ liệu hình ảnh mới.");
    } catch (error: any) {
        console.warn("editImageWithPrompt error:", error);
        
        // If it's a background removal task and AI failed (e.g. 403 or quota error), auto-fallback to smart Canvas background removal
        if (isBgRemoval) {
            console.log("Đang tự động chuyển sang giải thuật tách nền Canvas thông minh...");
            try {
                return await removeBackgroundCanvas(base64Image, mimeType);
            } catch (canvasErr) {
                console.error("Canvas background removal failed:", canvasErr);
            }
        }

        throw handleGeminiError(error, "chỉnh sửa ảnh");
    }
}

export async function generateMappingScript(
    sourceHeaders: string[], 
    targetHeaders: string[], 
    sourceDataSample: any[],
    targetDataSample: any[],
    useSmartPrompt: boolean = true
): Promise<string> {
    try {
        const toCompactCSV = (headers: string[], data: any[]) => {
            if (!data || data.length === 0) return '';
            const headerRow = headers.join(' | ');
            const dataRows = data.map(row => {
                if (Array.isArray(row)) {
                    return row.map(cell => String(cell || '').replace(/\n/g, ' ').trim()).join(' | ');
                } else if (typeof row === 'object' && row !== null) {
                    return headers.map(h => String(row[h] || '').replace(/\n/g, ' ').trim()).join(' | ');
                }
                return String(row || '');
            });
            return [headerRow, ...dataRows].join('\n');
        };

        const sourceDataFormatted = useSmartPrompt 
            ? toCompactCSV(sourceHeaders, sourceDataSample) 
            : JSON.stringify(sourceDataSample);
            
        const targetDataFormatted = useSmartPrompt 
            ? toCompactCSV(targetHeaders, targetDataSample) 
            : JSON.stringify(targetDataSample);

        const prompt = `
        You are an expert JavaScript developer and data engineer. 
        Your task is to write a clean, safe, and efficient JavaScript function body that maps a Source Row object to a Target Row object.
        
        CONTEXT:
        Source Headers: ${useSmartPrompt ? sourceHeaders.join(' | ') : JSON.stringify(sourceHeaders)}
        Source Sample Data (first few rows):
        ${sourceDataFormatted}
        
        Target Headers: ${useSmartPrompt ? targetHeaders.join(' | ') : JSON.stringify(targetHeaders)}
        Target Sample Data (first few rows acting as desired examples):
        ${targetDataFormatted}
        
        THE FUNCTION SIGNATURE IS:
        function mapRow(sourceRow, dictMap) {
            const targetRow = {};
            // YOUR CODE GOES HERE 
            return targetRow;
        }

        REQUIREMENTS:
        1. Learn how the Target Sample Data was generated from the Source Sample Data. Identify any conditional logic (e.g., if Source "Mã SP" is "BT", Target "Hành động" might be "Biến thể").
        2. Identify basic field mappings based on matching names.
        3. If there is a dictionary map lookup needed (you can infer this when a source value like "B2734_Canifa" becomes "CANIFA"), use: 
           targetRow["Target Header"] = dictMap[String(sourceRow["Source Header"] || "").trim().toLowerCase()] || sourceRow["Source Header"];
        4. Handle formatting like adding "%" to VAT if the target sample data does so.
        5. Return ONLY the code inside the function body. Do not include the function wrapper. Do not include markdown formatting like \`\`\`javascript. Just raw javascript code.
        `;
        
        const { response } = await generateContentWithFallback(prompt, { responseMimeType: 'text/plain' }, false, 'gemini-3.1-pro-preview');
        let code = response.text || '';
        // Clean up markdown block if AI still includes it
        code = code.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
        return code;
    } catch (error) {
        throw handleGeminiError(error, "Tạo script xử lý dữ liệu bằng AI");
    }
}

    export async function mapHeadersWithAI(sourceHeaders: string[], targetHeaders: string[], sourceDataSample?: any[], targetDataSample?: any[], useSmartPrompt: boolean = true): Promise<{
        headerMapping: Record<string, string>,
        valueRules: Array<{sourceColumn: string, targetColumn: string, sourceValue: string, targetValue: string}>,
        estimatedTokensSaved?: number
    }> {
        try {
            // Limit sample data to prevent context overload and token limit truncation
            const limitedSourceSample = sourceDataSample ? sourceDataSample.slice(0, 10) : [];
            const limitedTargetSample = targetDataSample ? targetDataSample.slice(0, 10) : [];
            
            // Helper function to convert array of arrays/objects to compact CSV-like string
            const toCompactCSV = (headers: string[], data: any[]) => {
                const headerRow = headers.join(' | ');
                const dataRows = data.map(row => {
                    if (Array.isArray(row)) {
                        return row.map(cell => String(cell || '').replace(/\n/g, ' ').trim()).join(' | ');
                    } else if (typeof row === 'object' && row !== null) {
                        return headers.map(h => String(row[h] || '').replace(/\n/g, ' ').trim()).join(' | ');
                    }
                    return String(row || '');
                });
                return [headerRow, ...dataRows].join('\n');
            };

            const sourceDataFormatted = useSmartPrompt 
                ? toCompactCSV(sourceHeaders, limitedSourceSample) 
                : JSON.stringify(limitedSourceSample, null, 2);
                
            const targetDataFormatted = useSmartPrompt 
                ? toCompactCSV(targetHeaders, limitedTargetSample) 
                : JSON.stringify(limitedTargetSample, null, 2);

            let estimatedTokensSaved = 0;
            if (useSmartPrompt) {
                const jsonStrSource = JSON.stringify(limitedSourceSample, null, 2) || "";
                const jsonStrTarget = JSON.stringify(limitedTargetSample, null, 2) || "";
                const savedChars = (jsonStrSource.length - sourceDataFormatted.length) + (jsonStrTarget.length - targetDataFormatted.length);
                estimatedTokensSaved = Math.max(0, Math.round(savedChars / 4));
            }

            const prompt = `
            You are an expert data analyst. I have a dataset with "Source Headers" and need to map them to "Target Headers" (a template).
            
            Source Headers:
            ${useSmartPrompt ? sourceHeaders.join(' | ') : JSON.stringify(sourceHeaders)}
            
            ${limitedSourceSample.length > 0 ? `Sample Data from Source:
            ${sourceDataFormatted}
            ` : ''}
            
            Target Headers:
            ${useSmartPrompt ? targetHeaders.join(' | ') : JSON.stringify(targetHeaders)}
    
            ${limitedTargetSample.length > 0 ? `Sample Data from Target (Desired Output Template):
            ${targetDataFormatted}
            ` : ''}
            
            TASK:
            1. Find the best match for each Source Header in the Target Headers.
            2. Look at the Source Sample Data and compare it to the Target Sample Data to deduce if formatting or value changes occurred.
               For example, if Source "Product_Code" is "BT_123" and Target "Chủng Loại" is "Biến thể" or "CHA_456" -> "Tạo mới".
            3. Output ONLY a raw JSON object with this exact structure:
            {
               "headerMapping": { "Exact Source Header": "Exact Target Header" },
               "valueRules": [
                   { "sourceColumn": "Exact Source Header", "targetColumn": "Exact Target Header", "sourceValue": "BT", "targetValue": "Biến thể" }
               ]
            }
            Use "valueRules" to specify partial or exact string mappings from the samples. 
            IMPORTANT: ONLY generate valueRules for CATEGORICAL data (e.g., status, categories, types, flags) that have clear translations. DO NOT generate valueRules for continuous data, unique IDs, prices, names, or descriptions to keep the output concise. Limit valueRules to a maximum of 20 rules.
            `;
            
            const { response } = await generateContentWithFallback(prompt, { responseMimeType: 'application/json' }, false, 'gemini-3.1-pro-preview');
            let jsonString = cleanAndExtractJson(response.text || '');
            if (!jsonString) return { headerMapping: {}, valueRules: [] };
            
            let parsed;
            try {
                parsed = JSON.parse(jsonString);
            } catch (e) {
                // Basic repair for truncated JSON
                try {
                    console.warn("JSON parse failed, attempting simple repair:", e);
                    
                    // Handle common AI syntax error with extra brackets
                    jsonString = jsonString.replace(/\]\s*\]\s*\}/g, ']}');
                    
                    if (!jsonString.endsWith('}')) {
                        if (jsonString.lastIndexOf(']') > jsonString.lastIndexOf('}')) {
                            jsonString += ']}';
                        } else {
                            jsonString += '}]}';
                        }
                    }
                    parsed = JSON.parse(jsonString);
                } catch (repairError) {
                     // If it still fails, just return empty to prevent crashing the whole app
                     console.error("Could not repair JSON:", repairError, "Raw String:", jsonString);
                     return { headerMapping: {}, valueRules: [] };
                }
            }
            
            return {
               headerMapping: parsed.headerMapping || {},
               valueRules: parsed.valueRules || [],
               estimatedTokensSaved
            };
        } catch (error) {
            throw handleGeminiError(error, "Ánh xạ cột bằng AI");
        }
    }


export async function extractReviewComponents(description: string, model: string = 'gemini-3.8-flash'): Promise<{specs: {name: string, value: string}[], sections: string[]}> {
    activeFeatureContext = 'extractor';
    const prompt = `
Bạn là một chuyên gia phân tích cấu trúc bài viết và bóc tách dữ liệu kỹ thuật.
Hãy đọc đoạn HTML mô tả sản phẩm sau:

${description}

Nhiệm vụ của bạn:
1. Trích xuất TẤT CẢ các thông số kỹ thuật rõ ràng (ví dụ: kích thước, chất liệu, khối lượng, công suất...) thành mảng "specs" gồm các object { "name": "...", "value": "..." }.
2. Trích xuất TẤT CẢ các TIÊU ĐỀ PHẦN NỘI DUNG (Sections) có trong bài (thường nằm trong thẻ <h3>, <strong>, <h2>... như: Giới thiệu, Thông tin sản phẩm, Tính năng nổi bật, Hướng dẫn sử dụng...) thành mảng chuỗi "sections".

TRẢ VỀ JSON có cấu trúc sau:
{
  "specs": [ { "name": "Tên thông số", "value": "Giá trị" } ],
  "sections": [ "Tên phần 1", "Tên phần 2" ]
}
CHỈ trả về JSON.
`;
    try {
        const response = await generateWithRetry(model, { 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text || "{}";
        let result = { specs: [], sections: [] };
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.specs)) result.specs = parsed.specs;
            if (Array.isArray(parsed.sections)) result.sections = parsed.sections;
        } catch (e) {
            console.error("JSON parse failed for review components", e);
        }
        return result;
    } catch (error) {
        console.error("Error extracting components:", error);
        return { specs: [], sections: [] };
    }
}

export async function rewriteDescriptionWithSpecs(
    originalDescription: string, 
    specsToKeep: {name: string, value: string}[], 
    specsToRemove: {name: string, value: string}[],
    sectionsToRemove: string[] = [],
    model: string = 'gemini-3.8-flash'
): Promise<string> {
    const prompt = `
Bạn là một AI Copywriter chuyên nghiệp.
Dưới đây là một đoạn mô tả sản phẩm HTML:
---
${originalDescription}
---

Nhiệm vụ của bạn:
1. LOẠI BỎ hoàn toàn các thông tin liên quan đến các thông số kỹ thuật sau:
${specsToRemove.map(s => `- ${s.name}: ${s.value}`).join('\n')}

2. LOẠI BỎ HOÀN TOÀN CÁC PHẦN NỘI DUNG (Sections) SAU (xóa cả tiêu đề phần đó và nội dung bên dưới nó):
${sectionsToRemove.map(s => `- ${s}`).join('\n')}

3. ĐẢM BẢO giữ lại các thông số kỹ thuật sau:
${specsToKeep.map(s => `- ${s.name}: ${s.value}`).join('\n')}

YÊU CẦU BẮT BUỘC:
- GIỮ NGUYÊN cấu trúc HTML của các phần còn lại (các thẻ <h3>, <strong>, <ul>, <li>...), giọng văn và độ dài. 
- Không tự ý thêm nội dung mới nếu không được yêu cầu.
- Nếu bạn xóa một phần nội dung (như "Tính năng nổi bật"), hãy đảm bảo xóa sạch cả tiêu đề và các gạch đầu dòng thuộc phần đó.
- Trả về nguyên đoạn HTML. Không sử dụng markdown bọc code (\`\`\`html).
`;
    try {
        const response = await generateWithRetry(model, { contents: prompt });
        let newDescription = response.text || originalDescription;
        newDescription = newDescription.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return newDescription;
    } catch (error) {
        console.error("Error rewriting description:", error);
        return originalDescription;
    }
}
