
import React, { useEffect, useState } from 'react';
import Button from '../Button';
import { Monitor, CheckCircle2, Download, ExternalLink, Info, Terminal, Package, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const DownloadAppTab: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [isBlobProtocol, setIsBlobProtocol] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    // Check if running on a blob URL (common in some preview environments)
    if (window.location.protocol === 'blob:') {
        setIsBlobProtocol(true);
    }

    // Check if running inside an iframe
    try {
        if (window.self !== window.top) {
            setIsIframe(true);
        }
    } catch (e) {
        setIsIframe(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("PWA Install Prompt captured");
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) return;

    if (!deferredPrompt) {
      if (isIframe) {
          alert("Bạn đang xem ứng dụng trong chế độ xem trước (iframe). Tính năng cài đặt PWA chỉ hoạt động khi mở trang web trong Tab mới.");
      } else {
          alert("Trình duyệt chưa hiển thị yêu cầu cài đặt. Hãy thử:\n1. Tải lại trang.\n2. Tương tác với trang (nhấp chuột vài lần).\n3. Sử dụng menu cài đặt thủ công của trình duyệt (xem hướng dẫn bên dưới).");
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleOpenNewTab = () => {
      window.open(window.location.href, '_blank');
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-app-url.com';
  const nativefierCmd = `npx nativefier --name "HoTroNhapLieu" "${currentUrl}" --single-instance`;

  const handleCopy = (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      setCopiedCmd(label);
      toast.success(`Đã sao chép câu lệnh ${label}`);
      setTimeout(() => setCopiedCmd(null), 3000);
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-8">
      {/* Hero Header */}
      <div className="bg-zinc-800/50 p-8 sm:p-12 rounded-2xl border border-zinc-700 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-lg bg-sky-500/10 blur-3xl rounded-full pointer-events-none"></div>
        
        <div className="relative z-10">
            <div className="inline-flex items-center justify-center p-4 bg-zinc-800 rounded-2xl border border-zinc-700 mb-6 shadow-xl">
                <Monitor className="w-16 h-16 text-sky-400" />
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Cài đặt & Đóng gói App Desktop (.exe)
            </h1>
            <p className="text-zinc-400 max-w-xl mx-auto text-lg mb-8">
                Sử dụng bộ công cụ AI mượt mà như ứng dụng Windows (.exe) thực thụ, chạy cửa sổ riêng độc lập, hiển thị Icon trên Desktop & Taskbar.
            </p>

            {isBlobProtocol ? (
                <div className="bg-orange-900/30 border border-orange-700/50 p-6 rounded-xl max-w-2xl mx-auto mb-6 text-left">
                    <h3 className="text-orange-400 font-bold text-lg mb-2 flex items-center gap-2">
                        <Info className="w-5 h-5" />
                        Chế độ Xem trước bị hạn chế
                    </h3>
                    <p className="text-zinc-300 text-sm mb-3 leading-relaxed">
                        Bạn đang chạy ứng dụng trong môi trường xem trước tạm thời (Blob URL). Vì lý do bảo mật của trình duyệt, tính năng <strong>Cài đặt App (PWA)</strong> không hoạt động trực tiếp trên khung này.
                    </p>
                    <div className="bg-black/30 p-3 rounded border border-orange-800/30">
                        <p className="text-zinc-400 text-xs">
                            <strong>Giải pháp:</strong> Bạn có thể sử dụng các phương pháp đóng gói file <strong>.exe</strong> bên dưới hoặc mở trang ở Tab mới để cài đặt PWA.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {isIframe && (
                        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl text-yellow-200 text-sm max-w-lg mx-auto">
                            <p className="font-bold flex items-center justify-center gap-2 mb-2">
                                ⚠️ Cảnh báo chế độ xem trước
                            </p>
                            <p className="text-zinc-400 mb-3">
                                Bạn đang xem web trong khung xem trước (iframe). Để cài đặt PWA Web App lên máy tính, hãy mở trang trong Tab mới.
                            </p>
                            <Button onClick={handleOpenNewTab} colorScheme="slate" className="!w-auto !px-6 !py-2 !text-sm mx-auto">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Mở trang này trong Tab mới để cài đặt PWA
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        {isInstalled ? (
                            <Button disabled className="!w-auto !px-8 !py-3 bg-green-600/20 text-green-400 border border-green-600/50 cursor-default">
                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                Đã cài đặt thành công trên PC
                            </Button>
                        ) : (
                            <Button 
                                onClick={handleInstallClick} 
                                disabled={!deferredPrompt} 
                                className={`!w-auto !px-10 !py-3 text-lg shadow-lg ${!deferredPrompt ? 'opacity-50 cursor-not-allowed' : 'shadow-sky-500/20'}`}
                            >
                                <Download className="w-6 h-6 mr-2" />
                                {deferredPrompt ? 'Cài đặt PWA ngay (1-Click)' : 'Không tìm thấy yêu cầu cài đặt PWA'}
                            </Button>
                        )}
                    </div>
                </>
            )}
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-800/30 p-6 rounded-xl border border-zinc-700/50 hover:bg-zinc-800/50 transition-colors">
              <h3 className="text-sky-400 font-semibold mb-2 flex items-center gap-2">
                  <span className="text-xl">⚡</span> Khởi động tức thì
              </h3>
              <p className="text-sm text-zinc-400">Khởi động nhanh từ Desktop/Taskbar giống hệt ứng dụng Windows native (.exe).</p>
          </div>
          <div className="bg-zinc-800/30 p-6 rounded-xl border border-zinc-700/50 hover:bg-zinc-800/50 transition-colors">
              <h3 className="text-sky-400 font-semibold mb-2 flex items-center gap-2">
                  <span className="text-xl">🖥️</span> Cửa sổ riêng biệt
              </h3>
              <p className="text-sm text-zinc-400">Ẩn hoàn toàn thanh địa chỉ trình duyệt, giao diện gọn gàng tối ưu diện tích làm việc.</p>
          </div>
          <div className="bg-zinc-800/30 p-6 rounded-xl border border-zinc-700/50 hover:bg-zinc-800/50 transition-colors">
              <h3 className="text-sky-400 font-semibold mb-2 flex items-center gap-2">
                  <span className="text-xl">🔒</span> Hoạt động ổn định
              </h3>
              <p className="text-sm text-zinc-400">Không bị tắt nhầm tab khi thao tác nhập dữ liệu số lượng lớn.</p>
          </div>
      </div>

      {/* Section 2: Create standalone EXE instructions */}
      <div className="bg-zinc-900/60 border border-sky-500/30 rounded-xl p-6 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
              <Package className="w-7 h-7 text-sky-400" />
              <div>
                  <h2 className="text-xl font-bold text-white">Cách tạo File Cài đặt Windows (.exe) Độc lập</h2>
                  <p className="text-xs text-zinc-400">Đóng gói công cụ này thành phần mềm Windows chạy file .exe riêng biệt</p>
              </div>
          </div>

          <div className="space-y-6">
              {/* Option A: Nativefier 1-line command */}
              <div className="bg-zinc-800/80 p-5 rounded-xl border border-zinc-700">
                  <div className="flex justify-between items-start mb-2">
                      <span className="text-sky-300 font-bold text-sm flex items-center gap-2">
                          <Terminal className="w-4 h-4" /> Phương pháp 1: Đóng gói nhanh bằng 1 câu lệnh (Nativefier)
                      </span>
                      <span className="text-xs bg-sky-900/50 text-sky-300 border border-sky-700 px-2 py-0.5 rounded">Khuyên dùng</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                      Yêu cầu máy tính đã cài Node.js. Mở Command Prompt (cmd) hoặc PowerShell trên Windows và dán câu lệnh sau:
                  </p>
                  <div className="bg-black/60 p-3 rounded-lg border border-zinc-700 font-mono text-xs text-green-400 flex justify-between items-center overflow-x-auto gap-2">
                      <code>{nativefierCmd}</code>
                      <button 
                          onClick={() => handleCopy(nativefierCmd, 'Nativefier')}
                          className="flex items-center gap-1 bg-zinc-700 hover:bg-zinc-600 text-white px-2.5 py-1 rounded text-xs transition-colors shrink-0"
                      >
                          {copiedCmd === 'Nativefier' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedCmd === 'Nativefier' ? 'Đã chép' : 'Sao chép'}
                      </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2">
                      💡 Lệnh này sẽ tự động tải trình đóng gói Chromium và tạo thư mục chứa file <strong>HoTroNhapLieu.exe</strong> cho máy tính của bạn.
                  </p>
              </div>

              {/* Option B: PWABuilder online tool */}
              <div className="bg-zinc-800/80 p-5 rounded-xl border border-zinc-700">
                  <div className="flex justify-between items-start mb-2">
                      <span className="text-emerald-300 font-bold text-sm flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" /> Phương pháp 2: Tải file cài Windows qua PWABuilder (Không cần gõ lệnh)
                      </span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                      PWABuilder là công cụ miễn phí của Microsoft hỗ trợ tự động biến Web thành file cài đặt Windows (.msix / .exe):
                  </p>
                  <ol className="list-decimal list-inside space-y-2.5 text-xs text-zinc-300">
                      <li>Truy cập trang web: <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className="text-sky-400 underline font-semibold hover:text-sky-300">www.pwabuilder.com</a></li>
                      <li>
                          Dán địa chỉ Web của bạn vào ô tìm kiếm:
                          <div className="mt-1 flex items-center gap-2 bg-black/60 p-2 rounded border border-zinc-700 w-fit">
                              <code className="text-sky-300 font-mono">{currentUrl}</code>
                              <button 
                                  onClick={() => handleCopy(currentUrl, 'URL')}
                                  className="bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors"
                              >
                                  {copiedCmd === 'URL' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                  {copiedCmd === 'URL' ? 'Đã chép' : 'Chép URL'}
                              </button>
                          </div>
                      </li>
                      <li>Nhấn nút <strong>Start</strong> để hệ thống kiểm tra PWA.</li>
                      <li>
                          Khi trang hiển thị kết quả, nhấn nút <strong>Package for Store</strong> (hoặc nút <strong>Windows</strong>).
                      </li>
                      <li>
                          Nhấn <strong>Generate / Download</strong> để tải file nén chứa bộ cài đặt <code>.msix</code> / <code>.exe</code> về máy.
                      </li>
                      <li>
                          Giải nén file zip vừa tải về và nhấp đúp vào file <code>.msix</code> (hoặc chạy <code>Install.ps1</code>) để cài ứng dụng trực tiếp vào Windows 10/11!
                      </li>
                  </ol>
              </div>
          </div>
      </div>

      {/* Manual PWA Installation Guide */}
      <div className="bg-zinc-900/50 border border-zinc-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-zinc-200 mb-6 flex items-center gap-2">
              <Info className="w-6 h-6 text-zinc-400"/>
              Hướng dẫn cài đặt PWA Web App trên trình duyệt
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-zinc-800 p-5 rounded-xl border border-zinc-700">
                  <strong className="block text-white mb-4 text-lg border-b border-zinc-700 pb-2">Google Chrome</strong>
                  <ol className="space-y-4 text-zinc-300 text-sm">
                      <li className="flex gap-3">
                          <span className="bg-zinc-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                          <span>Nhìn lên thanh địa chỉ (URL bar) ở góc trên cùng.</span>
                      </li>
                      <li className="flex gap-3">
                          <span className="bg-zinc-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                          <span>
                              Nhấp vào biểu tượng <strong>Màn hình có mũi tên xuống</strong> <Download className="w-3 h-3 inline mx-1"/> ở góc phải thanh địa chỉ.
                          </span>
                      </li>
                      <li className="flex gap-3">
                          <span className="bg-zinc-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                          <div>
                              Hoặc nhấn menu <strong>⋮</strong> <span className="text-zinc-500 mx-1">➜</span> <strong>Cài đặt và chia sẻ</strong> <span className="text-zinc-500 mx-1">➜</span> <strong>Cài đặt ứng dụng</strong>.
                          </div>
                      </li>
                  </ol>
              </div>
              
              <div className="bg-zinc-800 p-5 rounded-xl border border-zinc-700">
                  <strong className="block text-white mb-4 text-lg border-b border-zinc-700 pb-2">Microsoft Edge</strong>
                  <ol className="space-y-4 text-zinc-300 text-sm">
                      <li className="flex gap-3">
                          <span className="bg-zinc-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                          <span>Nhìn lên thanh địa chỉ ở góc trên cùng.</span>
                      </li>
                      <li className="flex gap-3">
                          <span className="bg-zinc-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                          <span>
                              Nhấp vào biểu tượng <strong>App Available</strong> (Hình 3 ô vuông + dấu cộng).
                          </span>
                      </li>
                      <li className="flex gap-3">
                          <span className="bg-zinc-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                          <div>
                              Hoặc nhấn menu <strong>...</strong> <span className="text-zinc-500 mx-1">➜</span> <strong>Ứng dụng (Apps)</strong> <span className="text-zinc-500 mx-1">➜</span> <strong>Cài đặt trang web này như một ứng dụng</strong>.
                          </div>
                      </li>
                  </ol>
              </div>
          </div>
      </div>
    </div>
  );
};

export default DownloadAppTab;

