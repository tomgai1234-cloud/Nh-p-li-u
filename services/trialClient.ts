/**
 * Client-side Device ID & Trial management utility
 */

const DEVICE_ID_KEY = 'app_device_id';
const TRIAL_USAGE_KEY = 'app_trial_usage';

/**
 * Retrieves or generates a unique persistent device ID for rate limiting and trial tracking.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server_environment';
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (e) {
    return 'fallback_device_' + Date.now();
  }
}

/**
 * Gets trial usage metrics for the current device.
 */
export function getTrialUsage(feature: string = 'general'): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`${TRIAL_USAGE_KEY}_${feature}`);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Increments trial usage count for a feature.
 */
export function recordTrialUsage(feature: string = 'general', amount: number = 1): number {
  if (typeof window === 'undefined') return 0;
  try {
    const current = getTrialUsage(feature);
    const updated = current + amount;
    localStorage.setItem(`${TRIAL_USAGE_KEY}_${feature}`, String(updated));
    return updated;
  } catch {
    return 0;
  }
}

/**
 * Checks if device is in trial mode.
 */
export function isTrialActive(): boolean {
  return true;
}

export interface TrialStatusResponse {
  isPro: boolean;
  deviceId?: string;
  quotas?: {
    [key: string]: { 
      used: number; 
      limit: number; 
      isExhausted?: boolean; 
      remaining?: number; 
    };
  };
}

export async function fetchTrialStatus(): Promise<TrialStatusResponse> {
  return {
    isPro: true,
    deviceId: getDeviceId(),
    quotas: {}
  };
}

export function subscribeTrialStatus(callback: (status: TrialStatusResponse) => void): () => void {
  return () => {};
}

export default {
  getDeviceId,
  getTrialUsage,
  recordTrialUsage,
  isTrialActive,
  fetchTrialStatus,
  subscribeTrialStatus,
};


