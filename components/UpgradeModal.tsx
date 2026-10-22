import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, Sparkles, Key, CheckCircle2, AlertTriangle, 
  X, ArrowRight, ShieldCheck, Zap, ExternalLink, HelpCircle
} from 'lucide-react';
import { fetchTrialStatus, getDeviceId, TrialStatusResponse } from '../services/trialClient';
import toast from 'react-hot-toast';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToApiKeys?: () => void;
  initialReason?: string;
}

// Global trigger function to easily open modal from any tab or service
export function triggerUpgradeModal(reason?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-upgrade-modal', { detail: { reason } }));
  }
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onNavigateToApiKeys,
  initialReason,
}) => {
  const [trialStatus, setTrialStatus] = useState<TrialStatusResponse | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'license' | 'byok'>('license');

  useEffect(() => {
    if (isOpen) {
      fetchTrialStatus().then((st) => {
        if (st) setTrialStatus(st);
      });
    }
  }, [isOpen]);

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      toast.error('Vui lòng nhập mã bản quyền');
      return;
    }

    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch('/api/trial/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
        body: JSON.stringify({ deviceId, licenseKey: licenseKey.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || 'Kích hoạt thành công bản Pro!');
        setLicenseKey('');
        await fetchTrialStatus();
        onClose();
      } else {
        toast.error(data.message || 'Mã bản quyền không đúng hoặc đã hết hạn');
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối tới máy chủ kích hoạt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const quotas = trialStatus?.quotas;
  const isAnyExhausted = Boolean(
    quotas && (quotas.scraperLinks.isExhausted || quotas.aiGenerations.isExhausted || quotas.cloudinaryUploads.isExhausted)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl bg-[#0e0e11] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header Banner */}
        <div className="relative p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-purple-500/10 border-b border-zinc-800">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-zinc-950 font-bold">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                Nâng cấp Bản Quyền Ứng Dụng
                <span className="text-xs bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                  PRO VIP
                </span>
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                {initialReason || 'Trải nghiệm toàn diện không giới hạn tốc độ và số lượt xử lý.'}
              </p>
            </div>
          </div>
        </div>

        {/* Quota Usage Status */}
        <div className="p-6 bg-zinc-950/60 border-b border-zinc-800/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Tình trạng hạn mức dùng thử của máy này
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              Device ID: {trialStatus?.deviceId?.slice(0, 16)}...
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Scraper */}
            <div className={`p-3 rounded-xl border ${quotas?.scraperLinks.isExhausted ? 'bg-red-500/5 border-red-500/30' : 'bg-zinc-900/60 border-zinc-800'}`}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-300 font-medium">Cào link web</span>
                <span className={quotas?.scraperLinks.isExhausted ? 'text-red-400 font-bold' : 'text-zinc-400'}>
                  {quotas?.scraperLinks.remaining ?? 5} / {quotas?.scraperLinks.limit ?? 5} còn lại
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${quotas?.scraperLinks.isExhausted ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (((quotas?.scraperLinks.remaining ?? 5) / (quotas?.scraperLinks.limit ?? 5)) * 100))}%` }}
                />
              </div>
            </div>

            {/* AI Generation */}
            <div className={`p-3 rounded-xl border ${quotas?.aiGenerations.isExhausted ? 'bg-red-500/5 border-red-500/30' : 'bg-zinc-900/60 border-zinc-800'}`}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-300 font-medium">Tạo AI & SEO</span>
                <span className={quotas?.aiGenerations.isExhausted ? 'text-red-400 font-bold' : 'text-zinc-400'}>
                  {quotas?.aiGenerations.remaining ?? 10} / {quotas?.aiGenerations.limit ?? 10} còn lại
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${quotas?.aiGenerations.isExhausted ? 'bg-red-500' : 'bg-sky-500'}`}
                  style={{ width: `${Math.min(100, (((quotas?.aiGenerations.remaining ?? 10) / (quotas?.aiGenerations.limit ?? 10)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Cloudinary */}
            <div className={`p-3 rounded-xl border ${quotas?.cloudinaryUploads.isExhausted ? 'bg-red-500/5 border-red-500/30' : 'bg-zinc-900/60 border-zinc-800'}`}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-300 font-medium">Tải ảnh Cloudinary</span>
                <span className={quotas?.cloudinaryUploads.isExhausted ? 'text-red-400 font-bold' : 'text-zinc-400'}>
                  {quotas?.cloudinaryUploads.remaining ?? 10} / {quotas?.cloudinaryUploads.limit ?? 10} còn lại
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${quotas?.cloudinaryUploads.isExhausted ? 'bg-red-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, (((quotas?.cloudinaryUploads.remaining ?? 10) / (quotas?.cloudinaryUploads.limit ?? 10)) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tab switch between License & BYOK */}
        <div className="flex border-b border-zinc-800 px-6 pt-3 bg-zinc-900/40">
          <button
            onClick={() => setActiveTab('license')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'license'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Crown className="w-4 h-4" />
            Cách 1: Nhập Mã Bản Quyền (Pro License)
          </button>
          <button
            onClick={() => setActiveTab('byok')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'byok'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-4 h-4" />
            Cách 2: Tự nhập Key miễn phí (BYOK)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'license' ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-amber-500/10 to-transparent p-4 rounded-xl border border-amber-500/20">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Quyền lợi khi kích hoạt gói Pro:
                </h3>
                <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
                  <li>Không giới hạn lượt cào dữ liệu từ Shopee, Panasonic, Titleist và mọi website.</li>
                  <li>Sử dụng máy chủ AI tốc độ cao không cần cài đặt API Key cá nhân.</li>
                  <li>Hỗ trợ tải ảnh hàng loạt và lưu trữ trực tiếp không giới hạn dung lượng.</li>
                </ul>
              </div>

              <form onSubmit={handleActivateLicense} className="space-y-3">
                <label className="block text-xs font-medium text-zinc-300">
                  Nhập mã bản quyền của bạn (License Key):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="VD: PRO-30D-XXXX-XXXX hoặc PRO-LIFETIME-XXXX"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono tracking-wider"
                  />
                  <button
                    type="submit"
                    disabled={loading || !licenseKey.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    {loading ? 'Đang kiểm tra...' : 'Kích hoạt'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                <span>Chưa có mã bản quyền?</span>
                <span className="text-amber-400 font-medium">Liên hệ Zalo / Telegram Admin để đăng ký</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-sky-500/10 p-4 rounded-xl border border-sky-500/20">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-sky-400" />
                  Chế độ Tự cung cấp Key (Bring Your Own Key):
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Bạn có thể sử dụng ứng dụng <strong className="text-sky-300">hoàn toàn miễn phí</strong> bằng cách tự tạo tài khoản Google Gemini API Key và Cloudinary cá nhân, sau đó nhập vào tab Quản lý API Key. Hệ thống sẽ sử dụng trực tiếp key của bạn mà không tốn phí bản quyền.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    onClose();
                    if (onNavigateToApiKeys) {
                      onNavigateToApiKeys();
                    }
                  }}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium rounded-xl text-sm transition-colors flex items-center gap-2 border border-zinc-700"
                >
                  <Key className="w-4 h-4 text-sky-400" />
                  Mở trang Quản lý API Key
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
