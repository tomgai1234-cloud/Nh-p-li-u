import React, { useState, useEffect } from 'react';
import { Crown, Sparkles, Zap, AlertCircle } from 'lucide-react';
import { 
  fetchTrialStatus, 
  subscribeTrialStatus, 
  TrialStatusResponse 
} from '../services/trialClient';
import { UpgradeModal } from './UpgradeModal';

interface TrialBadgeProps {
  onNavigateToApiKeys?: () => void;
}

export const TrialBadge: React.FC<TrialBadgeProps> = ({ onNavigateToApiKeys }) => {
  const [trialStatus, setTrialStatus] = useState<TrialStatusResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalReason, setModalReason] = useState<string | undefined>();

  useEffect(() => {
    // Initial fetch
    fetchTrialStatus().then((st) => {
      if (st) setTrialStatus(st);
    });

    // Subscribe to quota changes
    const unsubscribe = subscribeTrialStatus((updated) => {
      setTrialStatus(updated);
    });

    // Global listener for automatic paywall triggers
    const handleGlobalTrigger = (e: any) => {
      if (e?.detail?.reason) {
        setModalReason(e.detail.reason);
      }
      setIsModalOpen(true);
    };

    window.addEventListener('open-upgrade-modal', handleGlobalTrigger);

    return () => {
      unsubscribe();
      window.removeEventListener('open-upgrade-modal', handleGlobalTrigger);
    };
  }, []);

  if (!trialStatus) return null;

  const { isPro, quotas } = trialStatus;
  const isAnyExhausted = Boolean(
    quotas && (
      quotas.scraperLinks.isExhausted || 
      quotas.aiGenerations.isExhausted || 
      quotas.cloudinaryUploads.isExhausted
    )
  );

  return (
    <>
      <div className="flex items-center gap-2">
        {isPro ? (
          <button
            onClick={() => {
              setModalReason('Bạn đang sử dụng phiên bản PRO.');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:border-amber-400 transition-all shadow-sm shadow-amber-500/10 cursor-pointer"
            title="Bản quyền PRO đã được kích hoạt"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
            <span>Bản PRO VIP</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setModalReason('Theo dõi và nâng cấp hạn mức dùng thử của bạn.');
                setIsModalOpen(true);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                isAnyExhausted
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
              }`}
              title="Click để xem chi tiết hạn mức dùng thử"
            >
              <Zap className={`w-3.5 h-3.5 ${isAnyExhausted ? 'text-amber-400 animate-pulse' : 'text-sky-400'}`} />
              <span className="hidden sm:inline">Dùng thử:</span>
              <span className="font-mono text-zinc-200">
                {quotas ? `${quotas.scraperLinks.remaining + quotas.aiGenerations.remaining + quotas.cloudinaryUploads.remaining} lượt` : 'Free'}
              </span>
            </button>

            <button
              onClick={() => {
                setModalReason('Nâng cấp lên gói PRO để mở khóa toàn bộ tính năng.');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Nâng cấp</span>
            </button>
          </div>
        )}
      </div>

      <UpgradeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalReason(undefined);
        }}
        onNavigateToApiKeys={onNavigateToApiKeys}
        initialReason={modalReason}
      />
    </>
  );
};
