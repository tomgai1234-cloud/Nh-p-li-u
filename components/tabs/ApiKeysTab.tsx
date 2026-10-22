import React, { useState, useEffect } from 'react';
import { 
    Settings, Key, Plus, Trash2, ExternalLink, RefreshCw, AlertTriangle, 
    CheckCircle, ShieldCheck, Zap, Info, BarChart3, HelpCircle, RotateCcw,
    Sparkles, FileText, Tag, Image as ImageIcon, Database, MessageSquare,
    Clock, Lock, Check, XCircle, CloudUpload, Eye, EyeOff, CheckCircle2,
    Copy, Globe, Layers, ShoppingBag, ArrowRight, Activity, Wifi
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../Button';
import { useProviderAccounts } from '../../src/hooks/useProviderAccounts';
import { 
    getAllKeysUsage, getKeyUsage, getQuotaEstimates, resetKeyUsage, 
    getAllKeyStatuses, getKeyStatus, setKeyStatus, markKeyQuotaExhausted,
    KeyUsageData, KeyStatusInfo, KeyState, FEATURE_INFO, FeatureKey 
} from '../../services/apiKeyUsageTracker';

export function ApiKeysTab() {
    const [keys, setKeys] = useState<string[]>([]);
    const [newKey, setNewKey] = useState('');
    const [statuses, setStatuses] = useState<Record<string, KeyStatusInfo>>({});
    const [usageMap, setUsageMap] = useState<Record<string, KeyUsageData>>({});
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    const [showPermissionHelp, setShowPermissionHelp] = useState(false);
    const [isVerifyingAll, setIsVerifyingAll] = useState(false);

    // Section Switcher: Gemini vs Cloudinary
    const [activeSection, setActiveSection] = useState<'gemini' | 'cloudinary'>('gemini');
    const { 
        cloudinaryAccounts, setCloudinaryAccounts,
        shopifyAccounts,
        imgbbAccounts
    } = useProviderAccounts();
    const [selectedCloudId, setSelectedCloudId] = useState<string>('default');
    const [showSecret, setShowSecret] = useState(false);
    const [cloudVerifyStatus, setCloudVerifyStatus] = useState<{
        loading: boolean;
        valid?: boolean;
        warning?: boolean;
        pingMs?: number;
        cloudNameValid?: boolean;
        apiKeyValid?: boolean;
        apiSecretValid?: boolean;
        message?: string;
        error?: string;
        testedAt?: string;
    } | null>(null);

    const activeCloudinary = cloudinaryAccounts.find(a => a.id === selectedCloudId) || cloudinaryAccounts[0] || {
        id: 'default',
        cloudName: '',
        apiKey: '',
        apiSecret: ''
    };

    const updateActiveCloudinary = (patch: Partial<typeof activeCloudinary>) => {
        setCloudinaryAccounts(prev => prev.map(a => a.id === activeCloudinary.id ? { ...a, ...patch } : a));
        setCloudVerifyStatus(null);
    };

    const handleVerifyCloudinary = async () => {
        if (!activeCloudinary.cloudName) {
            setCloudVerifyStatus({ loading: false, valid: false, error: 'Vui lòng nhập Cloud Name trước khi kiểm tra.' });
            toast.error('Vui lòng nhập Cloud Name trước khi kiểm tra.');
            return;
        }
        setCloudVerifyStatus({ loading: true });
        const toastId = toast.loading('Đang gửi ping request tới Cloudinary API...');
        try {
            const res = await fetch('/api/cloudinary/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cloudName: activeCloudinary.cloudName,
                    apiKey: activeCloudinary.apiKey,
                    apiSecret: activeCloudinary.apiSecret
                })
            });
            const data = await res.json();
            const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            if (data.valid) {
                setCloudVerifyStatus({ 
                    loading: false, 
                    valid: true, 
                    warning: data.warning,
                    pingMs: data.pingMs,
                    cloudNameValid: data.cloudNameValid,
                    apiKeyValid: data.apiKeyValid,
                    apiSecretValid: data.apiSecretValid,
                    message: data.message,
                    testedAt: nowTime
                });
                toast.success(data.message || `Xác thực Cloudinary thành công (${data.pingMs || 0}ms)!`, { id: toastId });
            } else {
                setCloudVerifyStatus({ 
                    loading: false, 
                    valid: false, 
                    pingMs: data.pingMs,
                    cloudNameValid: data.cloudNameValid,
                    apiKeyValid: data.apiKeyValid,
                    apiSecretValid: data.apiSecretValid,
                    error: data.error || 'Xác thực thất bại',
                    testedAt: nowTime
                });
                toast.error(data.error || "Xác thực Cloudinary thất bại!", { id: toastId });
            }
        } catch (err: any) {
            setCloudVerifyStatus({ loading: false, valid: false, error: err.message || 'Lỗi kết nối tới máy chủ' });
            toast.error("Lỗi kết nối tới máy chủ.", { id: toastId });
        }
    };

    const handleRestoreDefaultCloud = () => {
        updateActiveCloudinary({ cloudName: 'dr9bdcoyf' });
        toast.success("Đã khôi phục Cloud Name: dr9bdcoyf");
    };

    const refreshAll = () => {
        setUsageMap(getAllKeysUsage());
        setStatuses(getAllKeyStatuses());
    };

    const verifyKey = async (rawKey: string) => {
        const cleanKey = rawKey.replace(/[^a-zA-Z0-9_\-]/g, '');
        
        setStatuses(prev => ({ 
            ...prev, 
            [cleanKey]: { state: 'checking', message: 'Đang kiểm tra kết nối với Google AI...' } 
        }));

        try {
            if (!cleanKey || cleanKey.length < 30) {
                const errStatus: KeyStatusInfo = { 
                    state: 'invalid', 
                    message: 'API Key không đúng định dạng (quá ngắn hoặc chứa ký tự lạ).' 
                };
                setStatuses(prev => ({ ...prev, [cleanKey]: errStatus }));
                setKeyStatus(cleanKey, errStatus);
                return;
            }

            // Thử xác thực trước qua Server Proxy
            let verified = false;
            let isQuota = false;
            let isPerm = false;
            let isInvalidFormat = false;
            let errorMessage = '';

            try {
                const srvRes = await fetch('/api/gemini/verify-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: cleanKey })
                });
                const srvData = await srvRes.json();
                if (srvRes.ok && srvData.valid) {
                    verified = true;
                } else {
                    errorMessage = srvData.diagnosis || srvData.error || 'Xác thực không thành công';
                    if (srvData.code === 429 || srvData.diagnosis?.toLowerCase().includes('quota') || srvData.diagnosis?.toLowerCase().includes('hết hạn mức') || srvData.diagnosis?.toLowerCase().includes('429')) {
                        isQuota = true;
                    } else if (srvData.code === 403 || srvData.diagnosis?.toLowerCase().includes('403') || srvData.diagnosis?.toLowerCase().includes('permission')) {
                        isPerm = true;
                    } else if (srvData.code === 400 || srvData.diagnosis?.toLowerCase().includes('invalid')) {
                        isInvalidFormat = true;
                    }
                }
            } catch (netErr) {
                // Fallback nếu server proxy tạm thời không phản hồi: thử fetch trực tiếp
                try {
                    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${cleanKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: "hi" }] }],
                            generationConfig: { maxOutputTokens: 1 }
                        })
                    });

                    if (!response.ok && response.status === 404) {
                        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${cleanKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: "hi" }] }],
                                generationConfig: { maxOutputTokens: 1 }
                            })
                        });
                    }

                    if (response.ok) {
                        verified = true;
                    } else {
                        const data = await response.json().catch(() => ({}));
                        const rawMsg = data?.error?.message || response.statusText;
                        if (response.status === 429 || rawMsg?.toLowerCase().includes('resource_exhausted') || rawMsg?.toLowerCase().includes('quota')) {
                            isQuota = true;
                            errorMessage = 'Key đã hết hạn mức (429 Quota Exceeded) trong ngày hôm nay.';
                        } else if (rawMsg?.toLowerCase().includes('caller does not have permission') || response.status === 403) {
                            isPerm = true;
                            errorMessage = 'The caller does not have permission (403): Dự án Google Cloud chưa bật "Generative Language API" hoặc Key bị chặn quyền.';
                        } else if (response.status === 400 || rawMsg?.toLowerCase().includes('api key not valid')) {
                            isInvalidFormat = true;
                            errorMessage = 'Mã API Key không hợp lệ hoặc đã bị vô hiệu hóa bởi Google.';
                        } else {
                            errorMessage = rawMsg || `Lỗi HTTP ${response.status}`;
                        }
                    }
                } catch (fallbackErr: any) {
                    errorMessage = fallbackErr.message || 'Không thể kết nối tới máy chủ Google';
                }
            }

            if (verified) {
                const newSt: KeyStatusInfo = { state: 'valid' };
                setStatuses(prev => ({ ...prev, [cleanKey]: newSt }));
                setKeyStatus(cleanKey, newSt);
                
                if (cleanKey !== rawKey) {
                    setKeys(prev => {
                        const newKeys = prev.map(k => k === rawKey ? cleanKey : k);
                        localStorage.setItem('user_api_keys', newKeys.join(','));
                        return newKeys;
                    });
                }
            } else if (isQuota) {
                markKeyQuotaExhausted(cleanKey);
                setStatuses(prev => ({ 
                    ...prev, 
                    [cleanKey]: { 
                        state: 'quota_exceeded', 
                        message: 'Hết hạn ngạch hôm nay (429 Quota Exceeded): Key đã dùng hết 1,500 lượt miễn phí của ngày hôm nay. Tự động reset vào 00:00 UTC (07:00 sáng VN).' 
                    } 
                }));
            } else if (isPerm) {
                const newSt: KeyStatusInfo = { 
                    state: 'permission_denied', 
                    message: errorMessage || 'The caller does not have permission (403): Cần bật Generative Language API hoặc tạo từ Gmail cá nhân.' 
                };
                setStatuses(prev => ({ ...prev, [cleanKey]: newSt }));
                setKeyStatus(cleanKey, newSt);
            } else {
                const newSt: KeyStatusInfo = { 
                    state: isInvalidFormat ? 'invalid' : 'unknown', 
                    message: errorMessage 
                };
                setStatuses(prev => ({ ...prev, [cleanKey]: newSt }));
                setKeyStatus(cleanKey, newSt);
            }
        } catch (error: any) {
            const errSt: KeyStatusInfo = { state: 'invalid', message: error.message || 'Lỗi mạng' };
            setStatuses(prev => ({ ...prev, [cleanKey]: errSt }));
            setKeyStatus(cleanKey, errSt);
        }
        refreshAll();
    };

    const verifyAllKeys = async (keyList: string[]) => {
        setIsVerifyingAll(true);
        for (const key of keyList) {
            await verifyKey(key);
        }
        setIsVerifyingAll(false);
    };

    useEffect(() => {
        const storedKeys = localStorage.getItem('user_api_keys');
        const initialStatuses = getAllKeyStatuses();
        setStatuses(initialStatuses);
        
        if (storedKeys) {
            const parsedKeys = storedKeys.split(',').filter(Boolean);
            setKeys(parsedKeys);
            verifyAllKeys(parsedKeys);
        }
        refreshAll();

        const handleUsageUpdate = () => {
            refreshAll();
        };

        window.addEventListener('apiKeyUsageUpdated', handleUsageUpdate);
        window.addEventListener('apiKeyStatusUpdated', handleUsageUpdate);
        return () => {
            window.removeEventListener('apiKeyUsageUpdated', handleUsageUpdate);
            window.removeEventListener('apiKeyStatusUpdated', handleUsageUpdate);
        };
    }, []);

    const saveKeys = (newKeys: string[]) => {
        setKeys(newKeys);
        localStorage.setItem('user_api_keys', newKeys.join(','));
    };

    const handleAddKey = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedKey = newKey.replace(/[^a-zA-Z0-9_\-]/g, '');
        if (trimmedKey && !keys.includes(trimmedKey)) {
            const updatedKeys = [...keys, trimmedKey];
            saveKeys(updatedKeys);
            setNewKey('');
            verifyKey(trimmedKey);
            refreshAll();
        }
    };

    const handleRemoveKey = (keyToRemove: string) => {
        const updatedKeys = keys.filter(k => k !== keyToRemove);
        saveKeys(updatedKeys);
        const newStatuses = { ...statuses };
        delete newStatuses[keyToRemove];
        setStatuses(newStatuses);
        resetKeyUsage(keyToRemove);
        refreshAll();
    };

    const handleResetAllUsage = () => {
        if (window.confirm("Bạn có chắc chắn muốn đặt lại toàn bộ thống kê lượt dùng Token của tất cả các key về 0?")) {
            resetKeyUsage();
            refreshAll();
        }
    };

    // Calculate aggregate totals and status breakdown
    const validKeys = keys.filter(k => statuses[k]?.state === 'valid');
    const quotaExhaustedKeys = keys.filter(k => statuses[k]?.state === 'quota_exceeded');
    const errorKeys = keys.filter(k => statuses[k]?.state === 'permission_denied' || statuses[k]?.state === 'invalid');
    const checkingKeys = keys.filter(k => statuses[k]?.state === 'checking');

    // Total active requests remaining across all valid keys
    const totalActiveRemaining = validKeys.reduce((acc, k) => {
        const u = usageMap[k] || getKeyUsage(k);
        const st = statuses[k] || getKeyStatus(k);
        const est = getQuotaEstimates(u, st);
        return acc + est.remainingRequestsToday;
    }, 0);

    const totalValidCapacity = validKeys.length * 1500;
    const totalRequestsUsedToday = keys.reduce((acc, k) => {
        const u = usageMap[k] || getKeyUsage(k);
        const st = statuses[k] || getKeyStatus(k);
        const est = getQuotaEstimates(u, st);
        return acc + est.requestsUsedToday;
    }, 0);

    const hasPermissionError = Object.values(statuses).some(s => 
        s.state === 'permission_denied' || (s.state === 'invalid' && s.message?.toLowerCase().includes('permission'))
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
            {/* Top Navigation Switcher */}
            <div className="flex flex-wrap items-center gap-3 bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-800 w-fit">
                <button
                    type="button"
                    onClick={() => setActiveSection('gemini')}
                    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        activeSection === 'gemini'
                            ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                >
                    <Key className="w-4 h-4" />
                    Google AI (Gemini) API Keys
                    <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                        activeSection === 'gemini' ? 'bg-sky-600 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                        {keys.length} Key
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveSection('cloudinary')}
                    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        activeSection === 'cloudinary'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                >
                    <CloudUpload className="w-4 h-4" />
                    Cấu hình Cloudinary (Hosting Ảnh)
                    {activeCloudinary.cloudName ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                            activeSection === 'cloudinary' ? 'bg-emerald-700 text-white' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}>
                            {activeCloudinary.cloudName}
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Chưa có Cloud
                        </span>
                    )}
                </button>
            </div>

            {/* =========================================================================
               THIRD-PARTY SERVICES STATUS COMPONENT (UI TIỆN ÍCH GIÁM SÁT KẾT NỐI)
               ========================================================================= */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            <Layers className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                Trạng thái Dịch vụ & Máy chủ bên thứ ba
                            </h3>
                            <p className="text-[11px] text-zinc-400">
                                Theo dõi trạng thái kết nối máy chủ ảnh và API phục vụ nhập liệu & xuất file
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 text-[11px] font-mono">
                            Đồng bộ qua LocalStorage
                        </span>
                    </div>
                </div>

                {/* Status Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Cloudinary Status Card */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                        !activeCloudinary.cloudName
                            ? 'bg-amber-950/25 border-amber-500/40 text-amber-200 shadow-lg shadow-amber-500/5'
                            : cloudVerifyStatus?.valid
                            ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-300'
                            : cloudVerifyStatus && !cloudVerifyStatus.valid && !cloudVerifyStatus.loading
                            ? 'bg-rose-950/25 border-rose-500/40 text-rose-300'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
                    }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                                <CloudUpload className={`w-4 h-4 ${
                                    !activeCloudinary.cloudName 
                                        ? 'text-amber-400' 
                                        : cloudVerifyStatus?.valid 
                                        ? 'text-emerald-400' 
                                        : 'text-sky-400'
                                }`} />
                                Cloudinary (Host ảnh CDN)
                            </span>
                            {!activeCloudinary.cloudName ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                                    Thiếu Cloud Name
                                </span>
                            ) : cloudVerifyStatus?.loading ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
                                    Đang ping API...
                                </span>
                            ) : cloudVerifyStatus?.valid ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    Đã xác thực ({cloudVerifyStatus.pingMs}ms)
                                </span>
                            ) : cloudVerifyStatus && !cloudVerifyStatus.valid ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                    <XCircle className="w-3 h-3 text-rose-400" />
                                    Lỗi kết nối
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1">
                                    <Activity className="w-3 h-3 text-zinc-400" />
                                    Chưa ping API
                                </span>
                            )}
                        </div>

                        <div className="space-y-1 font-mono text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-[11px]">Cloud: </span>
                                <span className="font-bold text-white">
                                    {activeCloudinary.cloudName || 'Chưa thiết lập'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-[11px]">API Key: </span>
                                <span className="text-zinc-300">
                                    {activeCloudinary.apiKey ? '••••••••' + activeCloudinary.apiKey.slice(-4) : 'Chưa nhập'}
                                </span>
                            </div>
                        </div>

                        {cloudVerifyStatus?.message && (
                            <div className="mt-2 text-[10px] text-emerald-400/90 leading-tight truncate">
                                ✓ {cloudVerifyStatus.message}
                            </div>
                        )}
                        {cloudVerifyStatus?.error && (
                            <div className="mt-2 text-[10px] text-rose-400/90 leading-tight line-clamp-2">
                                ⚠ {cloudVerifyStatus.error}
                            </div>
                        )}

                        <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px] gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveSection('cloudinary')}
                                className="text-sky-400 hover:text-sky-300 underline font-medium flex items-center gap-1"
                            >
                                Cấu hình <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={handleVerifyCloudinary}
                                disabled={cloudVerifyStatus?.loading || !activeCloudinary.cloudName}
                                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs ${
                                    !activeCloudinary.cloudName
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 active:scale-95'
                                }`}
                                title="Gửi request ping tới Cloudinary API để kiểm tra Cloud Name và API Key"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${cloudVerifyStatus?.loading ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
                                Kiểm tra kết nối
                            </button>
                        </div>
                    </div>

                    {/* Shopify Status Card */}
                    <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-zinc-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                                <ShoppingBag className="w-4 h-4 text-emerald-400" />
                                Shopify Store API
                            </span>
                            {shopifyAccounts[0]?.storeDomain ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Đã kết nối
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400">
                                    Chưa thiết lập
                                </span>
                            )}
                        </div>
                        <div className="font-mono text-xs truncate">
                            <span className="text-zinc-400 text-[11px]">Domain: </span>
                            <span className="text-zinc-200">
                                {shopifyAccounts[0]?.storeDomain || 'Chưa liên kết'}
                            </span>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center justify-between">
                            <span>Upload sản phẩm Shopify</span>
                        </div>
                    </div>

                    {/* ImgBB Status Card */}
                    <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-zinc-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                                <ImageIcon className="w-4 h-4 text-purple-400" />
                                ImgBB (Host phụ)
                            </span>
                            {imgbbAccounts[0]?.apiKey ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Sẵn sàng
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400">
                                    Chưa thiết lập
                                </span>
                            )}
                        </div>
                        <div className="font-mono text-xs truncate">
                            <span className="text-zinc-400 text-[11px]">API Key: </span>
                            <span className="text-zinc-200">
                                {imgbbAccounts[0]?.apiKey ? '••••••••' + imgbbAccounts[0].apiKey.slice(-4) : 'Trống'}
                            </span>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center justify-between">
                            <span>Host ảnh phụ khi cần</span>
                        </div>
                    </div>
                </div>

                {/* CẢNH BÁO NẾU CLOUD NAME BỊ TRỐNG */}
                {!activeCloudinary.cloudName && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/40 text-amber-200 space-y-3 shadow-lg">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div className="space-y-1 flex-1">
                                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                                    Cảnh báo: Cloud Name của Cloudinary đang bị trống!
                                </h4>
                                <p className="text-xs text-amber-200/80 leading-relaxed">
                                    Khi thiếu Cloud Name, các tính năng quan trọng như <strong>Luồng 1-Step</strong>, <strong>Tải ảnh hàng loạt</strong>, và <strong>Cào dữ liệu & Upload ảnh</strong> sẽ không thể tải ảnh lên CDN và không xuất được link ảnh Cloudinary sang Excel.
                                </p>
                            </div>
                        </div>

                        {/* Các nút xử lý nhanh & Hướng dẫn */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-amber-500/20">
                            {/* Khôi phục 1-click */}
                            <button
                                type="button"
                                onClick={handleRestoreDefaultCloud}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Bấm để khôi phục nhanh Cloud Name: <strong>dr9bdcoyf</strong>
                            </button>

                            {/* Nút chuyển tab cấu hình */}
                            <button
                                type="button"
                                onClick={() => setActiveSection('cloudinary')}
                                className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                            >
                                Nhập Cloud Name thủ công <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            {/* Link đến Cloudinary Console */}
                            <a
                                href="https://console.cloudinary.com/settings/api-keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-sky-400 hover:text-sky-300 underline font-medium flex items-center gap-1 ml-auto"
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Lấy từ console.cloudinary.com
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {activeSection === 'cloudinary' ? (
                /* =========================================================================
                   CLOUDINARY CONFIGURATION & RECOVERY CENTER
                   ========================================================================= */
                <div className="space-y-8 animate-fade-in">
                    {/* Header Card */}
                    <div className="relative p-8 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <CloudUpload className="w-36 h-36 text-emerald-500" />
                        </div>
                        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                                        <CloudUpload className="w-6 h-6" />
                                    </div>
                                    <h1 className="text-3xl font-black text-white tracking-tight">Cấu hình API Cloudinary</h1>
                                </div>
                                <p className="text-zinc-400 max-w-2xl leading-relaxed text-sm">
                                    Cloudinary được dùng để lưu trữ và phân phối hình ảnh cho <strong>Luồng 1-Step</strong>, <strong>Tải ảnh hàng loạt</strong>, và công cụ trích xuất ảnh. Cấu hình được lưu trong trình duyệt và tự động đồng bộ xuyên suốt ứng dụng.
                                </p>
                            </div>

                            {/* Status Card */}
                            <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 shrink-0 shadow-lg space-y-2 min-w-[280px]">
                                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                                    <span>Cloud Name Hiện Tại</span>
                                    {activeCloudinary.cloudName && (
                                        <span className="text-[10px] text-emerald-400 font-normal">Đang hoạt động</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${activeCloudinary.cloudName ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                                    <span className="font-mono text-base font-bold text-white">
                                        {activeCloudinary.cloudName || 'Chưa thiết lập'}
                                    </span>
                                </div>
                                <div className="text-xs text-zinc-500">
                                    {activeCloudinary.cloudName ? 'Sẵn sàng dùng cho Luồng 1-Step & Tải ảnh' : 'Cần nhập Cloud Name để tải ảnh lên máy chủ'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Credentials Form */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                            <div className="space-y-1">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    Thông Tin Chứng Thực Cloudinary
                                </h2>
                                <p className="text-xs text-zinc-400">Quản lý và chuyển đổi giữa nhiều profile tài khoản Cloudinary.</p>
                            </div>

                            {/* Profile select & actions */}
                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedCloudId}
                                    onChange={(e) => {
                                        setSelectedCloudId(e.target.value);
                                        setCloudVerifyStatus(null);
                                    }}
                                    className="bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500 font-medium"
                                >
                                    {cloudinaryAccounts.map((a, i) => (
                                        <option key={a.id} value={a.id}>
                                            {a.cloudName || 'Chưa đặt tên'} {i === 0 && a.id === 'default' ? '(Mặc định)' : ''}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const newId = Date.now().toString();
                                        setCloudinaryAccounts([...cloudinaryAccounts, { id: newId, cloudName: '', apiKey: '', apiSecret: '' }]);
                                        setSelectedCloudId(newId);
                                        setCloudVerifyStatus(null);
                                        toast.success("Đã thêm profile mới!");
                                    }}
                                    className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                                    title="Thêm profile mới"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>

                                {cloudinaryAccounts.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm("Bạn có chắc chắn muốn xóa profile Cloudinary này?")) {
                                                const updated = cloudinaryAccounts.filter(a => a.id !== selectedCloudId);
                                                setCloudinaryAccounts(updated);
                                                setSelectedCloudId(updated[0]?.id || 'default');
                                                toast.success("Đã xóa profile!");
                                            }
                                        }}
                                        className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                                        title="Xóa profile này"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Input Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Cloud Name */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                                    <span>1. Cloud Name *</span>
                                    {activeCloudinary.cloudName && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(activeCloudinary.cloudName);
                                                toast.success("Đã sao chép Cloud Name!");
                                            }}
                                            className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 font-mono lowercase"
                                        >
                                            <Copy className="w-3 h-3" /> copy
                                        </button>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    value={activeCloudinary.cloudName}
                                    onChange={(e) => updateActiveCloudinary({ cloudName: e.target.value.trim() })}
                                    placeholder="Ví dụ: dr9bdcoyf"
                                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-zinc-100 font-mono transition-colors outline-none"
                                />

                                {/* Quick Restore Recommendation */}
                                <div className="pt-1">
                                    {activeCloudinary.cloudName !== 'dr9bdcoyf' ? (
                                        <button
                                            type="button"
                                            onClick={handleRestoreDefaultCloud}
                                            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline flex items-center gap-1 bg-emerald-950/40 hover:bg-emerald-950/80 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 transition-all text-left"
                                        >
                                            <RefreshCw className="w-3 h-3 shrink-0" /> Khôi phục Cloud Name đã dùng trước đó: <strong>dr9bdcoyf</strong>
                                        </button>
                                    ) : (
                                        <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Đang sử dụng Cloud Name: <strong>dr9bdcoyf</strong>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* API Key */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                    2. API Key *
                                </label>
                                <input
                                    type="text"
                                    value={activeCloudinary.apiKey}
                                    onChange={(e) => updateActiveCloudinary({ apiKey: e.target.value.trim() })}
                                    placeholder="Ví dụ: 829591417539124"
                                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-zinc-100 font-mono transition-colors outline-none"
                                />
                                <p className="text-[11px] text-zinc-500">Chuỗi khoảng 15 chữ số từ Cloudinary</p>
                            </div>

                            {/* API Secret */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                    3. API Secret *
                                </label>
                                <div className="relative">
                                    <input
                                        type={showSecret ? "text" : "password"}
                                        value={activeCloudinary.apiSecret}
                                        onChange={(e) => updateActiveCloudinary({ apiSecret: e.target.value.trim() })}
                                        placeholder="Ví dụ: X9e_K91zabc..."
                                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 pr-10 text-sm text-zinc-100 font-mono transition-colors outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSecret(!showSecret)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                                    >
                                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-[11px] text-zinc-500">Chuỗi bí mật dùng để ký và xác thực upload</p>
                            </div>
                        </div>

                        {/* Test Connection Button & Status */}
                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-zinc-800">
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleVerifyCloudinary}
                                    disabled={cloudVerifyStatus?.loading || !activeCloudinary.cloudName}
                                    colorScheme="emerald"
                                    className="text-sm px-6 py-3 font-bold shadow-lg shadow-emerald-950/40"
                                >
                                    {cloudVerifyStatus?.loading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Đang ping Cloudinary API...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> Kiểm tra kết nối (Ping Cloudinary API)
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={() => toast.success("Đã tự động lưu cấu hình vào bộ nhớ ứng dụng!")}
                                    colorScheme="zinc"
                                    className="text-sm px-4 py-3 font-semibold"
                                >
                                    Lưu cấu hình
                                </Button>
                            </div>

                            <a
                                href="https://console.cloudinary.com/settings/api-keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1.5 underline"
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Mở trang quản lý API Keys trên Cloudinary Console
                            </a>
                        </div>

                        {/* Test result message banner with detailed diagnostics */}
                        {cloudVerifyStatus && !cloudVerifyStatus.loading && (
                            <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2.5 ${
                                cloudVerifyStatus.valid
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            }`}>
                                <div className="flex items-start gap-3">
                                    {cloudVerifyStatus.valid ? (
                                        <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                                    ) : (
                                        <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                                    )}
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-sm">
                                                {cloudVerifyStatus.valid ? 'Xác thực Cloudinary thành công!' : 'Lỗi kết nối Cloudinary:'}
                                            </span>
                                            {cloudVerifyStatus.pingMs !== undefined && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-700 text-zinc-300">
                                                    Ping: {cloudVerifyStatus.pingMs}ms
                                                </span>
                                            )}
                                        </div>
                                        <p>{cloudVerifyStatus.message || cloudVerifyStatus.error}</p>
                                    </div>
                                </div>

                                {/* Verification checklist breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-800/60 text-[11px] font-mono">
                                    <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                                        cloudVerifyStatus.cloudNameValid 
                                            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-300'
                                            : 'bg-rose-950/40 border-rose-500/20 text-rose-300'
                                    }`}>
                                        {cloudVerifyStatus.cloudNameValid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                                        <span>Cloud Name: {cloudVerifyStatus.cloudNameValid ? 'Hợp lệ' : 'Không tìm thấy'}</span>
                                    </div>

                                    <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                                        cloudVerifyStatus.apiKeyValid 
                                            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-300'
                                            : cloudVerifyStatus.apiKeyValid === false
                                            ? 'bg-rose-950/40 border-rose-500/20 text-rose-300'
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                    }`}>
                                        {cloudVerifyStatus.apiKeyValid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : cloudVerifyStatus.apiKeyValid === false ? <XCircle className="w-3.5 h-3.5 text-rose-400" /> : <Info className="w-3.5 h-3.5 text-zinc-500" />}
                                        <span>API Key: {cloudVerifyStatus.apiKeyValid ? 'Khớp tài khoản' : cloudVerifyStatus.apiKeyValid === false ? 'Sai API Key' : 'Chưa nhập'}</span>
                                    </div>

                                    <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                                        cloudVerifyStatus.apiSecretValid 
                                            ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-300'
                                            : cloudVerifyStatus.apiSecretValid === false
                                            ? 'bg-amber-950/40 border-amber-500/20 text-amber-300'
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                    }`}>
                                        {cloudVerifyStatus.apiSecretValid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : cloudVerifyStatus.apiSecretValid === false ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> : <Info className="w-3.5 h-3.5 text-zinc-500" />}
                                        <span>API Secret: {cloudVerifyStatus.apiSecretValid ? 'Hợp lệ (Đầy đủ)' : 'Cần nhập để upload'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3 Recovery & Verification Guides */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-2">
                            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-sm">1</div>
                            <h3 className="text-sm font-bold text-zinc-200">Lấy từ Cloudinary Console</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Đăng nhập vào <strong>console.cloudinary.com</strong> bằng email của bạn. Tại góc trên bên trái Dashboard hoặc mục <em>Settings ➔ API Keys</em>, bạn sẽ thấy đầy đủ Cloud name, API Key và Secret.
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">2</div>
                            <h3 className="text-sm font-bold text-zinc-200">Khôi phục từ Link Ảnh cũ</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Mở bất kỳ file Excel nào bạn đã xuất trước đây. Các đường link ảnh Cloudinary có dạng <code className="text-emerald-400">res.cloudinary.com/<strong>[tên-cloud]</strong>/...</code>. Ký tự ngay sau tên miền chính là Cloud Name.
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm">3</div>
                            <h3 className="text-sm font-bold text-zinc-200">Lưu trữ trên Trình duyệt</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Thông tin cấu hình được lưu tại <code className="text-purple-300">localStorage['upload_cloud_name']</code>. Khi bạn nhập tại đây, hệ thống sẽ tự động cập nhật cho Luồng 1-Step và Tải ảnh hàng loạt.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                /* =========================================================================
                   GOOGLE AI / GEMINI API KEYS SECTION (EXISTING)
                   ========================================================================= */
                <>
            {/* Header Section */}
            <div className="relative p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="w-32 h-32 text-sky-500" />
                </div>
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/20">
                                <Key className="w-6 h-6" />
                            </div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Quản lý API Key & Theo dõi Token</h1>
                        </div>
                        <p className="text-zinc-400 max-w-2xl leading-relaxed text-sm">
                            Hệ thống tự động xoay vòng API Key sẵn sàng, phát hiện và phân loại chính xác các Key hết hạn ngạch (429) hoặc bị lỗi phân quyền (403), đảm bảo công việc nhập liệu không bao giờ bị gián đoạn.
                        </p>
                    </div>

                    {/* Aggregate Capacity & Status Widget */}
                    {keys.length > 0 && (
                        <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-5 shrink-0 shadow-lg space-y-3 min-w-[320px]">
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
                                    Dung lượng khả dụng hôm nay
                                </span>
                                <button 
                                    onClick={handleResetAllUsage} 
                                    title="Đặt lại bộ đếm thống kê về 0"
                                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-baseline justify-between">
                                <div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-2xl font-black text-emerald-400">{totalActiveRemaining.toLocaleString()}</span>
                                        <span className="text-xs font-semibold text-zinc-500">/ {totalValidCapacity.toLocaleString()} lượt</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 mt-0.5">
                                        Tổng lượt AI còn gọi được ngay
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-bold font-mono text-zinc-300">
                                        {totalRequestsUsedToday.toLocaleString()}
                                    </span>
                                    <p className="text-[10px] text-zinc-500">Đã gọi hôm nay</p>
                                </div>
                            </div>

                            {/* Status Pills Breakdown */}
                            <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold flex-wrap">
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {validKeys.length} Sẵn sàng
                                </span>
                                {quotaExhaustedKeys.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-amber-400" />
                                        {quotaExhaustedKeys.length} Hết hạn ngạch
                                    </span>
                                )}
                                {errorKeys.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-1">
                                        <XCircle className="w-3 h-3 text-rose-400" />
                                        {errorKeys.length} Lỗi
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Cảnh báo đặc biệt: Giải thích lỗi "The caller does not have permission" (403) */}
            <div className={`p-6 rounded-3xl border transition-all duration-300 ${
                hasPermissionError 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-100 shadow-xl shadow-amber-500/5' 
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
            }`}>
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 ${
                        hasPermissionError ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-sky-500/20 text-sky-400'
                    }`}>
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                Vì sao API Key báo lỗi: <span className="font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">The caller does not have permission (403)</span>?
                            </h3>
                            <button 
                                onClick={() => setShowPermissionHelp(!showPermissionHelp)}
                                className="text-xs font-bold text-sky-400 hover:text-sky-300 underline flex items-center gap-1"
                            >
                                {showPermissionHelp ? 'Thu gọn' : 'Xem hướng dẫn khắc phục'}
                            </button>
                        </div>

                        <p className="text-xs leading-relaxed text-zinc-300">
                            Lỗi này xảy ra khi chuỗi API Key của bạn <strong className="text-emerald-400">đúng định dạng</strong> nhưng máy chủ Google <strong className="text-red-400">từ chối cấp quyền truy cập mô hình Gemini</strong>. 100% nguyên nhân thuộc 3 trường hợp sau:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                            <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
                                <p className="text-xs font-bold text-amber-300">1. Chưa BẬT API trong GCP</p>
                                <p className="text-[11px] text-zinc-400 leading-snug">
                                    Nếu tạo Key từ Google Cloud Console, bạn bắt buộc phải vào thư viện bật <strong>"Generative Language API"</strong>, nếu không Key sẽ bị từ chối 403.
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
                                <p className="text-xs font-bold text-amber-300">2. Key bị giới hạn (Restrictions)</p>
                                <p className="text-[11px] text-zinc-400 leading-snug">
                                    Mục <em>API Restrictions</em> hoặc <em>Application Restrictions</em> đang khóa chỉ cho phép domain hoặc dịch vụ khác (Maps, Translate...).
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1">
                                <p className="text-xs font-bold text-amber-300">3. Email tổ chức Workspace</p>
                                <p className="text-[11px] text-zinc-400 leading-snug">
                                    Dùng tài khoản email công ty/trường học bị Quản trị viên (Admin) tắt quyền sử dụng dịch vụ Google AI Studio.
                                </p>
                            </div>
                        </div>

                        {showPermissionHelp && (
                            <div className="mt-4 p-4 rounded-2xl bg-zinc-950 border border-sky-500/30 space-y-3 animate-fade-in">
                                <p className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <CheckCircle className="w-4 h-4 text-emerald-400" /> Cách khắc phục chuẩn 100% (Chỉ mất 30 giây):
                                </p>
                                <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-300">
                                    <li>
                                        Mở tab ẩn danh hoặc trình duyệt đăng nhập bằng <strong className="text-white">Gmail cá nhân (@gmail.com thường)</strong>.
                                    </li>
                                    <li>
                                        Truy cập trực tiếp: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-sky-400 font-bold underline">https://aistudio.google.com/apikey</a>.
                                    </li>
                                    <li>
                                        Bấm nút xanh <strong className="text-emerald-400">"Create API key"</strong> → Chọn <strong className="text-white">"Create API key in new project"</strong>.
                                    </li>
                                    <li>
                                        Copy mã API vừa tạo dán vào ô bên dưới. Key tạo bằng cách này sẽ tự động được cấp quyền đầy đủ mà không bị lỗi Permission!
                                    </li>
                                </ol>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Cột Trái: Quản lý Key & Theo dõi Token */}
                <div className="xl:col-span-7 space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-sky-400" />
                                Kho chứa API Keys ({keys.length})
                            </h2>
                            <span className="text-xs text-zinc-500 font-medium">Di chuột vào thẻ để xem chi tiết từng tính năng</span>
                        </div>
                        
                        <form onSubmit={handleAddKey} className="flex gap-2 mb-8">
                            <input
                                type="text"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                placeholder="Dán Gemini API Key mới (bắt đầu bằng AIza...)"
                                className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all font-mono text-sm"
                            />
                            <Button type="submit" disabled={!newKey.trim()} colorScheme="sky" className="rounded-xl px-6">
                                <Plus className="w-5 h-5" />
                            </Button>
                        </form>

                        <div>
                            <div className="flex justify-between items-center px-1 mb-3">
                                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                                    Danh sách {keys.length} API Key
                                </h3>
                                {keys.length > 0 && (
                                    <button 
                                        onClick={() => verifyAllKeys(keys)} 
                                        disabled={isVerifyingAll}
                                        className="text-[10px] font-bold text-sky-500 hover:text-sky-400 flex items-center gap-1 uppercase tracking-wider disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${isVerifyingAll ? 'animate-spin' : ''}`} /> 
                                        {isVerifyingAll ? 'Đang kiểm tra tất cả...' : 'Kiểm tra lại tất cả'}
                                    </button>
                                )}
                            </div>
                            
                            {keys.length === 0 ? (
                                <div className="text-center py-12 bg-zinc-950/50 rounded-2xl border border-dashed border-zinc-800">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                                        <Key className="w-8 h-8 text-zinc-700" />
                                    </div>
                                    <p className="text-zinc-500 text-sm font-medium">Bạn chưa thêm API Key nào.</p>
                                    <p className="text-zinc-600 text-xs mt-1">Làm theo hướng dẫn bên phải để lấy key miễn phí từ Google.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1 custom-scrollbar">
                                    {keys.map((key, idx) => {
                                        const cleanKey = key.replace(/[^a-zA-Z0-9_\-]/g, '');
                                        const usage = usageMap[cleanKey] || getKeyUsage(cleanKey);
                                        const keyStatus = statuses[cleanKey] || getKeyStatus(cleanKey);
                                        const estimates = getQuotaEstimates(usage, keyStatus);
                                        const isHovered = hoveredKey === cleanKey;

                                        const isExhausted = keyStatus?.state === 'quota_exceeded' || estimates.isExhausted;
                                        const isPermDenied = keyStatus?.state === 'permission_denied';
                                        const isInvalid = keyStatus?.state === 'invalid';
                                        const isValid = keyStatus?.state === 'valid';
                                        const isChecking = keyStatus?.state === 'checking';

                                        return (
                                            <div 
                                                key={idx} 
                                                onMouseEnter={() => setHoveredKey(cleanKey)}
                                                onMouseLeave={() => setHoveredKey(null)}
                                                className={`group relative bg-zinc-950 border rounded-2xl p-4 transition-all duration-300 shadow-sm ${
                                                    isExhausted 
                                                        ? 'border-amber-500/40 bg-amber-950/10' 
                                                        : isPermDenied || isInvalid
                                                        ? 'border-rose-500/30 bg-rose-950/10'
                                                        : 'border-zinc-800 hover:border-sky-500/40'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                                        <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                                                            isValid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                            isExhausted ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                                                            isPermDenied || isInvalid ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                                                            'bg-zinc-800 text-zinc-400'
                                                        }`}>
                                                            {isExhausted ? <Clock className="w-4 h-4 text-amber-400" /> :
                                                             isPermDenied ? <Lock className="w-4 h-4 text-rose-400" /> :
                                                             <Key className="w-4 h-4" />}
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="text-sm font-mono font-bold text-zinc-200 tracking-wider">
                                                                    {cleanKey.substring(0, 10)}••••••••{cleanKey.substring(cleanKey.length - 4)}
                                                                </p>
                                                                
                                                                {/* Status Badges */}
                                                                {isValid && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                                                                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Sẵn sàng hoạt động
                                                                    </span>
                                                                )}
                                                                {isChecking && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">
                                                                        <RefreshCw className="w-3 h-3 animate-spin text-sky-400" /> Đang kiểm tra...
                                                                    </span>
                                                                )}
                                                                {isExhausted && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider shadow-sm">
                                                                        <Clock className="w-3 h-3 text-amber-400" /> Hết hạn ngạch hôm nay (429)
                                                                    </span>
                                                                )}
                                                                {isPermDenied && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider">
                                                                        <Lock className="w-3 h-3 text-rose-400" /> Lỗi phân quyền (403)
                                                                    </span>
                                                                )}
                                                                {isInvalid && !isPermDenied && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">
                                                                        <AlertTriangle className="w-3 h-3 text-red-400" /> Lỗi Key (400)
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Lỗi chi tiết nếu có */}
                                                            {(isPermDenied || isInvalid || isExhausted) && keyStatus?.message && (
                                                                <div className={`mt-2 p-2.5 rounded-xl text-xs leading-relaxed ${
                                                                    isExhausted ? 'bg-amber-950/40 border border-amber-500/30 text-amber-200' :
                                                                    'bg-rose-950/40 border border-rose-500/20 text-rose-300'
                                                                }`}>
                                                                    <p className="font-semibold">{isExhausted ? 'Thông tin hạn ngạch:' : 'Chi tiết lỗi:'}</p>
                                                                    <p className="text-[11px] mt-0.5">{keyStatus?.message}</p>
                                                                </div>
                                                            )}

                                                            {/* Thanh tiến trình Quota & Token tóm tắt */}
                                                            <div className="mt-3 bg-zinc-900/90 p-3 rounded-xl border border-zinc-850 space-y-2">
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                                                                        <BarChart3 className={`w-3.5 h-3.5 ${isExhausted ? 'text-amber-400' : isPermDenied || isInvalid ? 'text-rose-400' : 'text-sky-400'}`} />
                                                                        {isExhausted ? (
                                                                            <span>Đã dùng hôm nay: <strong className="text-amber-300 font-bold">1,500 / 1,500 lượt (100% trần)</strong></span>
                                                                        ) : isPermDenied || isInvalid ? (
                                                                            <span>Tình trạng: <strong className="text-rose-400 font-bold">Không khả dụng (0 lượt)</strong></span>
                                                                        ) : (
                                                                            <span>Đã dùng hôm nay: <strong className="text-zinc-100 font-bold">{estimates.requestsUsedToday} / 1,500 lượt</strong></span>
                                                                        )}
                                                                    </span>
                                                                    <span className="text-[11px] text-zinc-500 font-mono">
                                                                        ~{estimates.tokensUsedToday.toLocaleString()} tokens
                                                                    </span>
                                                                </div>

                                                                {/* Progress bar */}
                                                                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                                            isExhausted ? 'bg-gradient-to-r from-amber-500 to-rose-500' :
                                                                            isPermDenied || isInvalid ? 'bg-zinc-700' :
                                                                            estimates.requestPercent > 80 ? 'bg-red-500' :
                                                                            estimates.requestPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                                                        }`}
                                                                        style={{ width: `${isExhausted ? 100 : Math.max(3, estimates.requestPercent)}%` }}
                                                                    />
                                                                </div>

                                                                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                                                                    {isExhausted ? (
                                                                        <span className="text-amber-300 font-medium">
                                                                            Khả dụng còn lại: <strong className="font-bold">0 lượt</strong> (Tự reset sau 00:00 UTC / 07:00 AM VN)
                                                                        </span>
                                                                    ) : isPermDenied || isInvalid ? (
                                                                        <span className="text-rose-400 font-medium">
                                                                            Khả dụng còn lại: <strong className="font-bold">0 lượt</strong> (Bị khóa quyền hoặc sai key)
                                                                        </span>
                                                                    ) : (
                                                                        <span>
                                                                            Ước tính còn lại: <strong className="text-emerald-400 font-bold">~{estimates.remainingRequestsToday} lượt gọi</strong>
                                                                        </span>
                                                                    )}
                                                                    <span className="text-zinc-500 italic text-[10px]">Rê chuột xem chi tiết từng công cụ</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button 
                                                            onClick={() => verifyKey(cleanKey)} 
                                                            title="Kiểm tra lại Key này"
                                                            className="p-2 text-zinc-500 hover:text-sky-400 hover:bg-zinc-900 rounded-xl transition-colors"
                                                        >
                                                            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-sky-400' : ''}`} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRemoveKey(cleanKey)} 
                                                            title="Xóa Key này khỏi kho"
                                                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 rounded-xl transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* HOVER TOOLTIP / POPOVER: Hiển thị chi tiết số lượt tính năng & số lần còn dùng được */}
                                                {isHovered && (
                                                    <div className="mt-3 p-4 rounded-2xl bg-zinc-900 border border-sky-500/30 shadow-2xl shadow-sky-500/10 space-y-4 animate-fade-in">
                                                        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                                                            <div className="flex items-center gap-2">
                                                                <Sparkles className="w-4 h-4 text-sky-400" />
                                                                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                                                                    Chi tiết lượt thao tác & Dự toán còn lại
                                                                </h4>
                                                            </div>
                                                            <span className="text-[10px] font-mono text-zinc-500">Google Gemini Flash Free: 1,500 RPD</span>
                                                        </div>

                                                        {/* Bảng số lượt đã thao tác theo từng tính năng */}
                                                        <div>
                                                            <p className="text-[11px] font-bold text-zinc-400 mb-2">Các tính năng bạn đã gọi hôm nay:</p>
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                                                                    <span className="flex items-center gap-1.5 text-zinc-300">
                                                                        <FileText className="w-3.5 h-3.5 text-blue-400" /> Tạo mô tả SP
                                                                    </span>
                                                                    <span className="font-bold font-mono text-white">{usage.today?.byFeature?.description || 0} lần</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                                                                    <span className="flex items-center gap-1.5 text-zinc-300">
                                                                        <Tag className="w-3.5 h-3.5 text-emerald-400" /> Tạo tên SEO
                                                                    </span>
                                                                    <span className="font-bold font-mono text-white">{usage.today?.byFeature?.seo || 0} lần</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                                                                    <span className="flex items-center gap-1.5 text-zinc-300">
                                                                        <ImageIcon className="w-3.5 h-3.5 text-purple-400" /> Cào ảnh/Gom màu
                                                                    </span>
                                                                    <span className="font-bold font-mono text-white">{usage.today?.byFeature?.scraper || 0} lần</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                                                                    <span className="flex items-center gap-1.5 text-zinc-300">
                                                                        <Database className="w-3.5 h-3.5 text-amber-400" /> Trích xuất thông số
                                                                    </span>
                                                                    <span className="font-bold font-mono text-white">{usage.today?.byFeature?.extractor || 0} lần</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                                                                    <span className="flex items-center gap-1.5 text-zinc-300">
                                                                        <MessageSquare className="w-3.5 h-3.5 text-pink-400" /> Chatbot / Hỏi đáp
                                                                    </span>
                                                                    <span className="font-bold font-mono text-white">{usage.today?.byFeature?.chat || 0} lần</span>
                                                                </div>
                                                                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                                                                    <span className="flex items-center gap-1.5 text-zinc-300">
                                                                        <Zap className="w-3.5 h-3.5 text-orange-400" /> Khác / Kiểm tra
                                                                    </span>
                                                                    <span className="font-bold font-mono text-white">{usage.today?.byFeature?.other || 0} lần</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Dự toán số lần còn dùng được */}
                                                        <div className={`p-3 rounded-xl border space-y-1.5 ${
                                                            isExhausted 
                                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
                                                                : isPermDenied || isInvalid
                                                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                                                                : 'bg-emerald-500/10 border-emerald-500/20 text-zinc-200'
                                                        }`}>
                                                            <div className="flex items-center justify-between text-xs font-bold">
                                                                <span className={isExhausted ? 'text-amber-300' : isPermDenied || isInvalid ? 'text-rose-300' : 'text-emerald-400'}>
                                                                    Dự toán số lần còn dùng được hôm nay:
                                                                </span>
                                                                <span className="font-mono">{isExhausted || isPermDenied || isInvalid ? '0 lượt' : `~${estimates.remainingRequestsToday} lượt`}</span>
                                                            </div>
                                                            
                                                            {isExhausted ? (
                                                                <div className="text-[11px] text-amber-200/90 space-y-1">
                                                                    <p>• Key này đã hết 1,500 lượt miễn phí hôm nay trên Google AI Studio.</p>
                                                                    <p>• Hệ thống sẽ tự động chuyển sang các Key khác đang ở trạng thái <strong>"Sẵn sàng hoạt động"</strong>.</p>
                                                                    <p>• Hạn mức sẽ tự động được Google mở lại sau 00:00 UTC (07:00 sáng VN).</p>
                                                                </div>
                                                            ) : isPermDenied || isInvalid ? (
                                                                <div className="text-[11px] text-rose-200/90 space-y-1">
                                                                    <p>• Key không thể thực hiện các cuộc gọi do thiếu quyền (403) hoặc sai định dạng.</p>
                                                                    <p>• Vui lòng xóa Key này hoặc tạo Key mới từ Gmail cá nhân thông thường.</p>
                                                                </div>
                                                            ) : (
                                                                <div className="text-[11px] text-zinc-300 space-y-1">
                                                                    <p>• <strong>Tạo mô tả sản phẩm:</strong> Còn dùng được khoảng <strong>~{estimates.estRemainingDesc} lần</strong></p>
                                                                    <p>• <strong>Tạo tên SEO chuẩn:</strong> Còn dùng được khoảng <strong>~{estimates.estRemainingSeo} lần</strong></p>
                                                                    <p>• <strong>Cào ảnh & gom nhóm màu:</strong> Còn dùng được khoảng <strong>~{estimates.estRemainingScraper} lần</strong></p>
                                                                    <p>• <strong>Trích xuất thông số kỹ thuật:</strong> Còn dùng được khoảng <strong>~{estimates.estRemainingExtractor} lần</strong></p>
                                                                </div>
                                                            )}
                                                            
                                                            <p className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800 italic">
                                                                * Google Gemini cấp 1,500 lượt gọi miễn phí mỗi ngày (RPD) cho mỗi API Key.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cột Phải: Hướng dẫn lấy Key chuẩn & Temp Mail */}
                <div className="xl:col-span-5 space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl flex flex-col">
                        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/20">
                                    <Info className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-white">Cách tạo Gemini Key chuẩn</h2>
                            </div>
                            <a 
                                href="https://aistudio.google.com/apikey" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-sky-500 hover:bg-sky-400 text-white font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-500/20 text-sm whitespace-nowrap"
                            >
                                Mở Google AI Studio <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                Để ứng dụng hoạt động mượt mà và không lo hết lượt, bạn nên tạo từ <strong className="text-emerald-400">3 đến 5 API Key</strong> bằng các tài khoản Gmail cá nhân khác nhau.
                            </p>

                            <div className="space-y-4">
                                {[
                                    {
                                        step: 'Bước 1',
                                        title: 'Dùng Gmail Cá Nhân',
                                        desc: 'Mở Google AI Studio và đăng nhập bằng tài khoản @gmail.com cá nhân thông thường (tránh dùng email công ty/trường học).'
                                    },
                                    {
                                        step: 'Bước 2',
                                        title: 'Bấm Create API Key',
                                        desc: 'Chọn "Create API key in a new project". AI Studio sẽ tự động kích hoạt Generative Language API 100% không bao giờ lỗi.'
                                    },
                                    {
                                        step: 'Bước 3',
                                        title: 'Copy mã dán vào Tool',
                                        desc: 'Copy chuỗi ký tự (bắt đầu bằng AIza...), dán vào danh sách bên trái. Hệ thống sẽ tự động xác thực và xoay vòng.'
                                    }
                                ].map((item, idx) => (
                                    <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800/50">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-xs font-black text-zinc-400">
                                                {idx + 1}
                                            </div>
                                            {idx !== 2 && <div className="w-0.5 h-full bg-zinc-800 rounded-full" />}
                                        </div>
                                        <div className="pb-2">
                                            <h4 className="text-sm font-bold text-zinc-100 mb-1">{item.title}</h4>
                                            <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-sky-500/5 border border-sky-500/20 text-sky-200/60 p-5 rounded-3xl text-xs leading-relaxed flex gap-4">
                        <ShieldCheck className="w-5 h-5 shrink-0 text-sky-400" />
                        <div>
                            <span className="text-sky-400 font-bold block mb-1 uppercase tracking-wider">Hệ thống xoay vòng (Rotation):</span>
                            Mỗi công cụ khi hoạt động sẽ tự động bốc Key đang ở trạng thái <strong className="text-emerald-400 font-normal">"Sẵn sàng hoạt động"</strong>. Các Key bị hết hạn ngạch hoặc lỗi quyền sẽ bị tự động bỏ qua để chuyển sang key kế tiếp. Dữ liệu API Key của bạn hoàn toàn được lưu an toàn tại máy tính cá nhân.
                        </div>
                    </div>
                    
                    <TempMailWidget />
                </div>
            </div>
            </>
            )}
        </div>
    );
}

function TempMailWidget() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [error, setError] = useState('');

    const generateEmail = async () => {
        setLoading(true);
        setError('');
        try {
            // Get domains
            const domRes = await fetch('https://api.mail.tm/domains');
            const domData = await domRes.json();
            const domain = domData['hydra:member'][0].domain;
            
            const randomUser = 'user' + Math.floor(Math.random() * 1000000) + Date.now().toString().slice(-4);
            const newEmail = `${randomUser}@${domain}`;
            const newPass = 'pass' + Date.now();
            
            // Create account
            const accRes = await fetch('/api/temp-mail/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: newEmail, password: newPass })
            });
            if (!accRes.ok) throw new Error("Không thể tạo tài khoản mail.tm");
            
            // Get token
            const tokenRes = await fetch('/api/temp-mail/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: newEmail, password: newPass })
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok) throw new Error("Không thể lấy token mail.tm");
            
            setEmail(newEmail);
            setPassword(newPass);
            setToken(tokenData.token);
            setMessages([]);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Lỗi không xác định khi tạo email.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/temp-mail/messages', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data['hydra:member'] || []);
                }
            } catch (error) {
                console.error("Lỗi lấy tin nhắn:", error);
            }
        }, 8000);
        return () => clearInterval(interval);
    }, [token]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </span>
                    Tạo Email Tạm Thời
                </h2>
                <Button onClick={generateEmail} disabled={loading} colorScheme="purple" className="text-sm px-4">
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Tạo Email Mới"}
                </Button>
            </div>

            {error && (
                <div className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                    {error}
                </div>
            )}

            {email && (
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <input 
                            readOnly 
                            value={email} 
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 font-mono text-sm"
                        />
                        <Button onClick={() => copyToClipboard(email)} colorScheme="zinc" className="px-4">
                            Copy
                        </Button>
                    </div>

                    <div className="bg-zinc-950/50 rounded-2xl border border-zinc-800 p-4">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <RefreshCw className={`w-3 h-3 ${token ? 'animate-spin' : ''}`} /> Hộp Thư Đến
                        </h3>
                        {messages.length === 0 ? (
                            <p className="text-zinc-600 text-sm italic text-center py-4">Chưa có tin nhắn nào...</p>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {messages.map((m, i) => (
                                    <div key={i} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl shadow-sm">
                                        <p className="text-sm font-bold text-zinc-200 truncate">{m.subject}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-xs text-zinc-500">{m.from.address}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {!email && !loading && (
                <p className="text-zinc-500 text-sm italic text-center">
                    Bạn có thể tạo email tạm thời để đăng ký tài khoản Google mới mà không cần dùng email cá nhân.
                </p>
            )}
        </div>
    );
}

