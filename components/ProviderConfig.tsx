import React, { useState } from 'react';
import { Plus, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import TextInput from './TextInput';
import Button from './Button';
import { useProviderAccounts } from '../src/hooks/useProviderAccounts';

interface ProviderConfigProps {
  provider: string; // 'cloudinary' | 'shopify' | 'imgbb'
  activeId: string;
  onActiveIdChange: (id: string) => void;
  disabled?: boolean;
}

export const ProviderConfig: React.FC<ProviderConfigProps> = ({ provider, activeId, onActiveIdChange, disabled }) => {
  const { 
      cloudinaryAccounts, setCloudinaryAccounts,
      shopifyAccounts, setShopifyAccounts,
      imgbbAccounts, setImgbbAccounts
  } = useProviderAccounts();

  const [isCheckingCloud, setIsCheckingCloud] = useState(false);
  const [cloudCheckResult, setCloudCheckResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Helper cho Cloudinary
  const activeCloudinary = cloudinaryAccounts.find(a => a.id === activeId) || cloudinaryAccounts[0];
  const updateCloudinary = (updates: Partial<typeof activeCloudinary>) => {
      setCloudinaryAccounts(prev => prev.map(a => a.id === activeCloudinary.id ? { ...a, ...updates } : a));
      setCloudCheckResult(null);
  };

  const handleTestCloudinary = async () => {
      if (!activeCloudinary?.cloudName) {
          toast.error("Vui lòng nhập Cloud Name trước khi kiểm tra!");
          return;
      }
      setIsCheckingCloud(true);
      const toastId = toast.loading("Đang gửi request ping tới Cloudinary API...");
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
          if (data.valid) {
              setCloudCheckResult({ valid: true, message: `Ping OK (${data.pingMs || 0}ms): Cloud Name & API Key hợp lệ!` });
              toast.success(data.message || `Xác thực Cloudinary thành công (${data.pingMs || 0}ms)!`, { id: toastId });
          } else {
              setCloudCheckResult({ valid: false, message: data.error || "Xác thực thất bại" });
              toast.error(data.error || "Xác thực Cloudinary thất bại!", { id: toastId });
          }
      } catch (err: any) {
          setCloudCheckResult({ valid: false, message: err.message || "Lỗi kết nối máy chủ" });
          toast.error("Lỗi kết nối tới máy chủ.", { id: toastId });
      } finally {
          setIsCheckingCloud(false);
      }
  };

  // Helper cho Shopify
  const activeShopify = shopifyAccounts.find(a => a.id === activeId) || shopifyAccounts[0];
  const updateShopify = (updates: Partial<typeof activeShopify>) => {
      setShopifyAccounts(prev => prev.map(a => a.id === activeShopify.id ? { ...a, ...updates } : a));
  };

  // Helper cho ImgBB
  const activeImgbb = imgbbAccounts.find(a => a.id === activeId) || imgbbAccounts[0];
  const updateImgbb = (updates: Partial<typeof activeImgbb>) => {
      setImgbbAccounts(prev => prev.map(a => a.id === activeImgbb.id ? { ...a, ...updates } : a));
  };

  React.useEffect(() => {
     if (provider === 'cloudinary' && (!activeId || !cloudinaryAccounts.find(a => a.id === activeId))) {
         onActiveIdChange(cloudinaryAccounts[0].id);
     }
     if (provider === 'shopify' && (!activeId || !shopifyAccounts.find(a => a.id === activeId))) {
         onActiveIdChange(shopifyAccounts[0].id);
     }
     if (provider === 'imgbb' && (!activeId || !imgbbAccounts.find(a => a.id === activeId))) {
         onActiveIdChange(imgbbAccounts[0].id);
     }
  }, [provider, activeId, cloudinaryAccounts, shopifyAccounts, imgbbAccounts, onActiveIdChange]);

  const addAccount = () => {
      const newId = Date.now().toString();
      if (provider === 'cloudinary') setCloudinaryAccounts([...cloudinaryAccounts, { id: newId, cloudName: '', apiKey: '', apiSecret: '' }]);
      if (provider === 'shopify') setShopifyAccounts([...shopifyAccounts, { id: newId, storeDomain: '', accessToken: '' }]);
      if (provider === 'imgbb') setImgbbAccounts([...imgbbAccounts, { id: newId, apiKey: '' }]);
      onActiveIdChange(newId);
  };

  const removeAccount = () => {
      if (provider === 'cloudinary' && cloudinaryAccounts.length > 1) {
          setCloudinaryAccounts(prev => prev.filter(a => a.id !== activeCloudinary.id));
          onActiveIdChange(cloudinaryAccounts[0].id);
      }
      if (provider === 'shopify' && shopifyAccounts.length > 1) {
          setShopifyAccounts(prev => prev.filter(a => a.id !== activeShopify.id));
          onActiveIdChange(shopifyAccounts[0].id);
      }
      if (provider === 'imgbb' && imgbbAccounts.length > 1) {
          setImgbbAccounts(prev => prev.filter(a => a.id !== activeImgbb.id));
          onActiveIdChange(imgbbAccounts[0].id);
      }
  };

  return (
      <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto flex-1">
                 <label className="text-sm font-bold text-sky-400 whitespace-nowrap">Tài khoản {provider === 'shopify' ? 'Shopify' : provider === 'cloudinary' ? 'Cloudinary' : 'ImgBB'}:</label>
                 <select 
                     value={activeId} 
                     disabled={disabled}
                     onChange={e => onActiveIdChange(e.target.value)}
                     className="flex-1 min-w-[200px] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
                 >
                     {provider === 'cloudinary' && cloudinaryAccounts.map((a, i) => (
                         <option key={a.id} value={a.id}>{a.cloudName || 'Chưa thiết lập'} {(i === 0 && a.id === 'default') ? '(Mặc định)' : ''}</option>
                     ))}
                     {provider === 'shopify' && shopifyAccounts.map((a, i) => (
                         <option key={a.id} value={a.id}>{a.storeDomain || 'Chưa thiết lập'} {(i === 0 && a.id === 'default') ? '(Mặc định)' : ''}</option>
                     ))}
                     {provider === 'imgbb' && imgbbAccounts.map((a, i) => (
                         <option key={a.id} value={a.id}>{a.apiKey ? a.apiKey.substring(0,6)+'...' : 'Chưa thiết lập'} {(i === 0 && a.id === 'default') ? '(Mặc định)' : ''}</option>
                     ))}
                 </select>
             </div>
             <div className="flex items-center gap-2 w-full sm:w-auto mt-2 md:mt-0">
                 <Button onClick={addAccount} disabled={disabled} colorScheme="zinc" className="flex-1 sm:flex-none !w-auto !px-4 !py-2.5 text-sm"><Plus className="w-4 h-4" /> <span className="hidden sm:inline ml-1">Thêm profile</span></Button>
                 <Button onClick={removeAccount} colorScheme="red" className="flex-1 sm:flex-none !w-auto !px-4 !py-2.5 text-sm" disabled={disabled || (provider === 'cloudinary' ? cloudinaryAccounts.length === 1 : provider === 'shopify' ? shopifyAccounts.length === 1 : imgbbAccounts.length === 1)} title="Xóa tài khoản này"><Trash2 className="w-4 h-4 mr-1" /> Xóa</Button>
             </div>
          </div>
          <div className="pt-2 border-t border-zinc-800">
             {provider === 'cloudinary' && (
                 <div className="space-y-3 mt-2">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div>
                             <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">Cloud Name</label>
                             <TextInput disabled={disabled} value={activeCloudinary?.cloudName} onChange={e => updateCloudinary({cloudName: e.target.value})}/>
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">API Key</label>
                             <TextInput disabled={disabled} value={activeCloudinary?.apiKey} onChange={e => updateCloudinary({apiKey: e.target.value})}/>
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">API Secret</label>
                             <TextInput disabled={disabled} type="password" value={activeCloudinary?.apiSecret} onChange={e => updateCloudinary({apiSecret: e.target.value})}/>
                         </div>
                     </div>
                     <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
                         <div className="flex items-center gap-2.5">
                             <Button
                                 type="button"
                                 onClick={handleTestCloudinary}
                                 disabled={disabled || isCheckingCloud || !activeCloudinary?.cloudName}
                                 colorScheme="emerald"
                                 className="!w-auto !px-3.5 !py-2 text-xs font-bold shadow-md shadow-emerald-950"
                             >
                                 {isCheckingCloud ? (
                                     <>
                                         <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Đang ping Cloudinary...
                                     </>
                                 ) : (
                                     <>
                                         <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Kiểm tra kết nối
                                     </>
                                 )}
                             </Button>
                             {cloudCheckResult && (
                                 <span className={`text-xs flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-lg border ${
                                     cloudCheckResult.valid
                                         ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                         : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                 }`}>
                                     {cloudCheckResult.valid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                                     {cloudCheckResult.message}
                                 </span>
                             )}
                         </div>
                         <span className="text-[11px] text-zinc-500 italic">Gửi request ping tới Cloudinary REST API để xác thực tài khoản</span>
                     </div>
                 </div>
             )}
             
             {provider === 'shopify' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                     <div>
                         <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">Store Domain</label>
                         <TextInput disabled={disabled} value={activeShopify?.storeDomain} onChange={e => updateShopify({storeDomain: e.target.value})} placeholder="VD: mystore.myshopify.com"/>
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">Admin API Access Token</label>
                         <TextInput disabled={disabled} type="password" value={activeShopify?.accessToken} onChange={e => updateShopify({accessToken: e.target.value})} placeholder="shpat_..."/>
                     </div>
                 </div>
             )}

             {provider === 'imgbb' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                     <div>
                         <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">ImgBB API Key <a href="https://api.imgbb.com/" target="_blank" rel="noreferrer" className="text-sky-500 lowercase underline">(Lấy key tại đây)</a></label>
                         <TextInput disabled={disabled} value={activeImgbb?.apiKey} onChange={e => updateImgbb({apiKey: e.target.value})}/>
                     </div>
                 </div>
             )}
          </div>
      </div>
  );
};
