import React, { useState, useMemo } from 'react';
import type { GroundingSource, SeoKeywordSuggestion } from '../types';
import { Link, Copy, Download, ChevronDown, ShieldAlert, Loader2, SlidersHorizontal, Check, X, Edit2, Save, Layers, Search, Sparkles, Tag, Globe, CheckCheck } from 'lucide-react';
import { checkDescriptionAccuracy, extractReviewComponents, rewriteDescriptionWithSpecs, suggestSeoKeywords, type SeoKeywordResult } from '../services/geminiService';

interface ResultCardProps {
  onApplyReviewToAll?: (specsToRemove: {name: string, value: string}[], sectionsToRemove: string[]) => void;
  productName: string;
  descriptionText: string;
  descriptionHtml: string;
  sources: GroundingSource[];
  status: 'success' | 'error' | 'loading';
  error?: string;
  totalResultsCount?: number;
  showReviewMode?: boolean;
  seoKeywords?: SeoKeywordSuggestion[];
  searchQueries?: string[];
  metaDescription?: string;
}

type ActiveTab = 'text' | 'html' | 'accuracy' | 'review' | 'seo';
type HtmlViewMode = 'preview' | 'code';

const TRUNCATE_LENGTH = 400;

export const ResultCard: React.FC<ResultCardProps> = ({ 
  productName, 
  descriptionText, 
  descriptionHtml, 
  sources, 
  status, 
  error, 
  onApplyReviewToAll, 
  totalResultsCount, 
  showReviewMode,
  seoKeywords = [],
  searchQueries = [],
  metaDescription = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isDescriptionContentExpanded, setIsDescriptionContentExpanded] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('html');
  const [htmlViewMode, setHtmlViewMode] = useState<HtmlViewMode>('preview');
  
  const [isCheckingAccuracy, setIsCheckingAccuracy] = useState(false);
  const [accuracyHtml, setAccuracyHtml] = useState<string | null>(null);

  // --- SEO Suggestion States ---
  const [seoResult, setSeoResult] = useState<SeoKeywordResult | null>(null);
  const [isLoadingSeo, setIsLoadingSeo] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState<string | null>(null);

  // --- Review Mode States ---
  const [localDescriptionHtml, setLocalDescriptionHtml] = useState(descriptionHtml);
  const [specs, setSpecs] = useState<{name: string, value: string, active: boolean}[] | null>(null);
  const [sections, setSections] = useState<{name: string, active: boolean}[] | null>(null);
  const [isExtractingSpecs, setIsExtractingSpecs] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const previewRef = React.useRef<HTMLDivElement>(null);
  // --------------------------
  // Sync localDescriptionHtml when prop changes
  React.useEffect(() => {
    setLocalDescriptionHtml(descriptionHtml);
  }, [descriptionHtml]);

  const handleFetchSeo = async () => {
    setIsLoadingSeo(true);
    try {
      const res = await suggestSeoKeywords(productName, undefined, localDescriptionHtml);
      setSeoResult(res);
    } catch (err) {
      console.error('Lỗi khi gợi ý từ khóa SEO:', err);
    } finally {
      setIsLoadingSeo(false);
    }
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBadge(label);
    setTimeout(() => setCopiedBadge(null), 2000);
  };

  React.useEffect(() => {
    setSpecs(null);
    setSections(null); // Reset sections
  }, [productName]);



  const isLongDescription = useMemo(() => descriptionText.length > TRUNCATE_LENGTH, [descriptionText]);

  const displayedDescription = isLongDescription && !isDescriptionContentExpanded
    ? `${descriptionText.substring(0, TRUNCATE_LENGTH)}...`
    : descriptionText;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const stripHtml = (html: string) => {
      const tmp = document.createElement("DIV");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    };
    const contentToCopy = activeTab === 'text' ? stripHtml(localDescriptionHtml) : localDescriptionHtml;

    navigator.clipboard.writeText(contentToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => {
      console.error('Không thể sao chép văn bản: ', err);
      alert('Không thể sao chép vào clipboard.');
    });
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        const isHtml = activeTab === 'html';
        const stripHtml = (html: string) => { const tmp = document.createElement('DIV'); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || ''; };
        const content = isHtml ? localDescriptionHtml : stripHtml(localDescriptionHtml);
        const mimeType = isHtml ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8';
        const extension = isHtml ? 'html' : 'txt';

        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        const fileName = `${productName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_description.${extension}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Không thể tải tệp xuống: ', err);
        alert('Đã xảy ra lỗi khi cố gắng tải tệp xuống.');
    }
  };

  
  const handleExtractSpecs = async () => {
      if (specs !== null && sections !== null) return;

      setIsExtractingSpecs(true);
      try {
          const extracted = await extractReviewComponents(localDescriptionHtml);
          setSpecs(extracted.specs.map(s => ({ ...s, active: true })));
          setSections(extracted.sections.map(s => ({ name: s, active: true })));
      } catch (error) {
          console.error("Extraction failed", error);
          setSpecs([]);
          setSections([]);
      } finally {
          setIsExtractingSpecs(false);
      }
  };

  const handleToggleComponent = async (type: 'spec' | 'section', index: number) => {
      if ((!specs && !sections) || isRewriting) return;
      
      let newSpecs = specs ? [...specs] : [];
      let newSections = sections ? [...sections] : [];

      if (type === 'spec') {
          newSpecs[index].active = !newSpecs[index].active;
          setSpecs(newSpecs);
      } else {
          newSections[index].active = !newSections[index].active;
          setSections(newSections);
      }

      const specsToKeep = newSpecs.filter(s => s.active);
      const specsToRemove = newSpecs.filter(s => !s.active);
      const sectionsToRemove = newSections.filter(s => !s.active).map(s => s.name);

      setIsRewriting(true);
      try {
          const newHtml = await rewriteDescriptionWithSpecs(localDescriptionHtml, specsToKeep, specsToRemove, sectionsToRemove);
          setLocalDescriptionHtml(newHtml);
      } catch (error) {
          console.error("Rewrite failed", error);
          // Revert on error
          if (type === 'spec') {
              newSpecs[index].active = !newSpecs[index].active;
              setSpecs([...newSpecs]);
          } else {
              newSections[index].active = !newSections[index].active;
              setSections([...newSections]);
          }
      } finally {
          setIsRewriting(false);
      }
  };

  const triggerApplyToAll = () => {
      if (!onApplyReviewToAll) return;
      const specsToRemove = specs ? specs.filter(s => !s.active).map(s => ({ name: s.name, value: s.value })) : [];
      const sectionsToRemove = sections ? sections.filter(s => !s.active).map(s => s.name) : [];
      onApplyReviewToAll(specsToRemove, sectionsToRemove);
  };

  const handleCheckAccuracy = async () => {
      setActiveTab('accuracy');
      if (accuracyHtml) return; // already checked

      setIsCheckingAccuracy(true);
      try {
          // Use descriptionText or descriptionHtml depending on what provides best context
          // descriptionText is better for the AI to parse without HTML tags getting in the way
          const result = await checkDescriptionAccuracy(productName, descriptionText);
          setAccuracyHtml(result);
      } catch (error) {
          console.error("Accuracy check failed", error);
          setAccuracyHtml("Lỗi: Không thể kiểm tra độ chính xác lúc này. Vui lòng thử lại sau.");
      } finally {
          setIsCheckingAccuracy(false);
      }
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const TabButton: React.FC<{tab: ActiveTab, label: string}> = ({ tab, label }) => (
      <button
        onClick={(e) => {
            e.stopPropagation();
            setActiveTab(tab);
        }}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
            activeTab === tab 
            ? 'bg-sky-600 text-white' 
            : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700'
        }`}
      >
        {label}
      </button>
  );

  const HtmlSubTabButton: React.FC<{mode: HtmlViewMode, label: string}> = ({ mode, label }) => (
    <button
      onClick={(e) => {
          e.stopPropagation();
          setHtmlViewMode(mode);
      }}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
          htmlViewMode === mode
          ? 'bg-zinc-600 text-white' 
          : 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
      }`}
    >
      {label}
    </button>
  );
  
  
  const isError = status === 'error';
  const isLoading = status === 'loading';
  const stripHtml = (html: string) => { const tmp = document.createElement('DIV'); tmp.innerHTML = html; return tmp.textContent || tmp.innerText || ''; };


  return (
    <div
      className={`rounded-lg shadow-xl border animate-fade-in p-4 transition-all duration-200
        ${isError ? 'bg-red-900/30 border-red-700' : isLoading ? 'bg-sky-900/10 border-sky-900/30' : 'bg-zinc-800/50 backdrop-blur-sm border-zinc-700 hover:bg-zinc-800/70'}
      `}
    >
       <div className="flex-1 min-w-0">
          <div 
             className="flex justify-between items-center gap-4 cursor-pointer select-none group"
             onClick={isLoading ? undefined : toggleExpand}
          >
              <h2 className={`text-sm font-bold uppercase break-words flex-1 transition-colors ${isError ? 'text-red-300' : isLoading ? 'text-sky-400 animate-pulse' : 'text-sky-300 group-hover:text-sky-200'}`}>
                {productName}
              </h2>
               <div className="flex items-center gap-1 flex-shrink-0 -mr-2">
                  {!isError && !isLoading && (
                    <>
                        <button
                            onClick={handleCopy}
                            className="p-1.5 text-zinc-400 hover:text-sky-400 transition-colors duration-200 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500"
                            title={activeTab === 'text' ? 'Sao chép văn bản thuần túy' : 'Sao chép mã HTML'}
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleDownload}
                            className="p-1.5 text-zinc-400 hover:text-sky-400 transition-colors duration-200 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500"
                            title={activeTab === 'text' ? 'Tải về dưới dạng .txt' : 'Tải về dưới dạng .html'}
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </>
                  )}
                  <button
                    className={`p-1.5 ${isLoading ? 'text-zinc-600' : 'text-zinc-400 hover:text-sky-400 cursor-pointer'} transition-transform duration-200 rounded-full focus:outline-none ${isExpanded ? 'rotate-180' : ''}`}
                    title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-sky-500" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
          </div>
          
          {isExpanded && (
             <div className="mt-3 border-t border-zinc-700/50 pt-3 animate-fade-in cursor-auto" onClick={e => e.stopPropagation()}>
                 {isError ? (
                    <div>
                        <p className="text-red-300 font-semibold">Tạo mô tả thất bại</p>
                        <p className="text-red-400 text-sm mt-2">{error}</p>
                    </div>
                 ) : (
                    <>
                        <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <TabButton tab="html" label="HTML" />
                                <TabButton tab="text" label="Văn bản thuần túy" />
                                <TabButton tab="seo" label="Từ khóa & SEO" />
                            </div>
                            <button
                                onClick={handleCheckAccuracy}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 flex items-center gap-2 border ${
                                    activeTab === 'accuracy'
                                    ? 'bg-amber-600/30 text-amber-400 border-amber-500/50'
                                    : 'bg-zinc-800/50 text-amber-500/80 hover:bg-amber-600/20 hover:text-amber-400 border-amber-500/30'
                                }`}
                            >
                                <ShieldAlert className="w-4 h-4" />
                                Kiểm tra bịa đặt
                            </button>
                        </div>
                        
                        {isCopied && (
                            <p className="text-sm text-green-400 mb-4 animate-fade-in" role="status">
                            Đã sao chép vào clipboard!
                            </p>
                        )}
                    
                        {showReviewMode && (
                        <>
                        {/* Review Mode Content - Always visible at top */}
                        <div className="bg-zinc-900/50 border border-purple-500/30 rounded-lg p-4 mb-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2"><Layers className="w-4 h-4"/> Bật/Tắt Nội Dung</h3>
                                        {onApplyReviewToAll && totalResultsCount !== undefined && totalResultsCount >= 2 && (
                                            <button 
                                                onClick={triggerApplyToAll}
                                                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded transition-colors shadow-sm"
                                            >
                                                Áp dụng thay đổi cho tất cả sản phẩm
                                            </button>
                                        )}
                                    </div>
                                    {isExtractingSpecs ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-purple-500">
                                            <Loader2 className="w-8 h-8 animate-spin mb-3" />
                                            <p className="text-sm font-medium animate-pulse">Đang phân tích cấu trúc bài viết...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 mb-6">
                                            <div>
                                                <h4 className="text-xs text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Các phần chính (Sections)</h4>
                                                {sections && sections.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {sections.map((section, i) => (
                                                            <button
                                                                key={'sec-'+i}
                                                                onClick={() => handleToggleComponent('section', i)}
                                                                disabled={isRewriting}
                                                                className={`group relative px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 flex items-center gap-2 overflow-hidden ${
                                                                    section.active 
                                                                    ? 'bg-zinc-800/80 text-zinc-200 border-emerald-500/50 shadow-sm' 
                                                                    : 'bg-zinc-900/50 text-zinc-500 border-zinc-800'
                                                                } ${isRewriting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-500/80'}`}
                                                            >
                                                                <div className={`flex flex-shrink-0 items-center justify-center w-3.5 h-3.5 rounded-[4px] border transition-colors ${
                                                                    section.active ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-zinc-800 border-zinc-600 text-transparent'
                                                                }`}>
                                                                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                                                                </div>
                                                                <span className={`truncate max-w-[250px] ${!section.active ? 'line-through opacity-60' : ''}`}>
                                                                    {section.name}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-zinc-500 italic">Không tìm thấy tiêu đề phần nào.</p>
                                                )}
                                            </div>

                                            <div>
                                                <h4 className="text-xs text-zinc-400 mb-2 uppercase tracking-wider font-semibold">Thông số kỹ thuật</h4>
                                                {specs && specs.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {specs.map((spec, i) => (
                                                            <button
                                                                key={'spec-'+i}
                                                                onClick={() => handleToggleComponent('spec', i)}
                                                                disabled={isRewriting}
                                                                className={`group relative px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 flex items-center gap-2 overflow-hidden ${
                                                                    spec.active 
                                                                    ? 'bg-zinc-800/80 text-zinc-200 border-purple-500/50 shadow-sm' 
                                                                    : 'bg-zinc-900/50 text-zinc-500 border-zinc-800'
                                                                } ${isRewriting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-purple-500/80'}`}
                                                            >
                                                                <div className={`flex flex-shrink-0 items-center justify-center w-3.5 h-3.5 rounded-[4px] border transition-colors ${
                                                                    spec.active ? 'bg-purple-500 border-purple-500 text-white' : 'bg-zinc-800 border-zinc-600 text-transparent'
                                                                }`}>
                                                                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                                                                </div>
                                                                <div className="flex items-center gap-1.5 truncate max-w-[250px]">
                                                                    <span className={`font-semibold ${!spec.active ? 'line-through opacity-60' : ''}`}>{spec.name}:</span> 
                                                                    <span className={`font-normal ${!spec.active ? 'line-through opacity-60' : ''}`}>{spec.value}</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-zinc-500 italic">Không tìm thấy thông số kỹ thuật.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="mt-4 pt-4 border-t border-purple-500/20 relative">
                                        {isRewriting && (
                                            <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
                                                <div className="bg-zinc-800 px-4 py-2 rounded-full border border-purple-500/30 flex items-center gap-2 shadow-lg">
                                                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                                    <span className="text-xs text-purple-300 font-medium">Đang cập nhật mô tả...</span>
                                                </div>
                                            </div>
                                        )}
                                        <div 
                                            className={`prose prose-sm prose-invert prose-zinc max-w-none text-zinc-300 font-sans 
                                            prose-img:rounded-lg prose-img:my-2 
                                            prose-h2:text-sky-300 prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-sky-200 prose-h3:mt-3 prose-h3:mb-1
                                            prose-strong:text-zinc-100
                                            prose-p:my-1 prose-p:leading-relaxed
                                            prose-ul:my-2 prose-li:my-0.5 ${isRewriting ? 'opacity-30' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: localDescriptionHtml }} 
                                        />
                                    </div>
                                </div>

                        </>
                        )}

                        <div>
                            {activeTab === 'accuracy' ? (
                                <div className="bg-zinc-900/50 border border-amber-500/30 rounded-lg p-4">
                                    {isCheckingAccuracy ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-amber-500">
                                            <Loader2 className="w-8 h-8 animate-spin mb-3" />
                                            <p className="text-sm font-medium animate-pulse">Đang rà soát và kiểm tra thông tin bịa đặt...</p>
                                        </div>
                                    ) : accuracyHtml ? (
                                        <div 
                                            className="prose prose-sm prose-invert prose-zinc max-w-none text-zinc-300 whitespace-pre-wrap font-sans 
                                            prose-p:my-1 prose-p:leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: accuracyHtml.replace(/\n/g, '<br/>') }}
                                        />
                                    ) : null}
                                </div>
                            ) : activeTab === 'seo' ? (
                                <div className="bg-zinc-900/60 border border-sky-500/30 rounded-xl p-5 space-y-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-sky-400" />
                                            <h3 className="font-semibold text-zinc-100 text-sm">Gợi ý Từ khóa SEO & Dữ liệu Google Search</h3>
                                        </div>
                                        <button
                                            onClick={handleFetchSeo}
                                            disabled={isLoadingSeo}
                                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer shadow-sm"
                                        >
                                            {isLoadingSeo ? (
                                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tra cứu Google...</>
                                            ) : (
                                                <><Search className="w-3.5 h-3.5" /> Gợi ý / Cập nhật lại từ khóa</>
                                            )}
                                        </button>
                                    </div>

                                    {/* Meta Description */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-sky-300 uppercase tracking-wider flex items-center gap-1">
                                                <Tag className="w-3.5 h-3.5" /> Thẻ Meta Description Đề xuất
                                            </label>
                                            {(seoResult?.recommendedMetaDescription || metaDescription) && (
                                                <button
                                                    onClick={() => handleCopyText(seoResult?.recommendedMetaDescription || metaDescription, 'meta')}
                                                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                                                >
                                                    {copiedBadge === 'meta' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                    {copiedBadge === 'meta' ? 'Đã chép' : 'Sao chép'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-3 bg-zinc-950/70 rounded-lg border border-zinc-700/70 text-xs text-zinc-200 leading-relaxed">
                                            {seoResult?.recommendedMetaDescription || metaDescription || (
                                                <span className="text-zinc-500 italic">Chưa có meta description. Nhấn "Gợi ý / Cập nhật lại từ khóa" ở trên để AI tạo tự động từ Google Search.</span>
                                            )}
                                        </div>
                                        {(seoResult?.recommendedMetaDescription || metaDescription) && (
                                            <div className="text-[11px] text-zinc-400 flex items-center justify-between px-1">
                                                <span>Độ dài: {(seoResult?.recommendedMetaDescription || metaDescription).length} ký tự</span>
                                                <span className={(seoResult?.recommendedMetaDescription || metaDescription).length >= 120 && (seoResult?.recommendedMetaDescription || metaDescription).length <= 165 ? 'text-emerald-400' : 'text-amber-400'}>
                                                    {(seoResult?.recommendedMetaDescription || metaDescription).length >= 120 && (seoResult?.recommendedMetaDescription || metaDescription).length <= 165 ? '✓ Chuẩn SEO (120-165 ký tự)' : 'Khuyến nghị: 120-165 ký tự'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Primary Keywords */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                            Từ khóa chính (Primary Keywords)
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {((seoResult?.primaryKeywords && seoResult.primaryKeywords.length > 0)
                                                ? seoResult.primaryKeywords
                                                : (seoKeywords.filter(k => k.type === 'primary').map(k => k.keyword))
                                            ).length > 0 ? (
                                                ((seoResult?.primaryKeywords && seoResult.primaryKeywords.length > 0)
                                                    ? seoResult.primaryKeywords
                                                    : (seoKeywords.filter(k => k.type === 'primary').map(k => k.keyword))
                                                ).map((kw, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleCopyText(kw, `kw-${i}`)}
                                                        className="px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-md text-xs hover:bg-emerald-900/50 transition-colors flex items-center gap-1 group"
                                                        title="Bấm để sao chép"
                                                    >
                                                        {copiedBadge === `kw-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Tag className="w-3 h-3 text-emerald-400/70" />}
                                                        <span>{kw}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <span className="text-xs text-zinc-500 italic">Chưa có từ khóa chính.</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Long-tail Keywords */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                                            Từ khóa dài / Tìm kiếm mở rộng (Long-tail Keywords)
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {((seoResult?.longTailKeywords && seoResult.longTailKeywords.length > 0)
                                                ? seoResult.longTailKeywords
                                                : (seoKeywords.filter(k => k.type === 'long-tail').map(k => k.keyword))
                                            ).length > 0 ? (
                                                ((seoResult?.longTailKeywords && seoResult.longTailKeywords.length > 0)
                                                    ? seoResult.longTailKeywords
                                                    : (seoKeywords.filter(k => k.type === 'long-tail').map(k => k.keyword))
                                                ).map((kw, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleCopyText(kw, `lt-${i}`)}
                                                        className="px-2.5 py-1 bg-sky-950/40 border border-sky-500/40 text-sky-300 rounded-md text-xs hover:bg-sky-900/50 transition-colors flex items-center gap-1 group"
                                                        title="Bấm để sao chép"
                                                    >
                                                        {copiedBadge === `lt-${i}` ? <Check className="w-3 h-3 text-sky-400" /> : <Tag className="w-3 h-3 text-sky-400/70" />}
                                                        <span>{kw}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <span className="text-xs text-zinc-500 italic">Chưa có từ khóa mở rộng.</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Search Intent & Tips */}
                                    {seoResult?.searchIntent && (
                                        <div className="pt-2 border-t border-zinc-800 flex items-center gap-2 text-xs">
                                            <span className="text-zinc-400 font-medium">Ý định tìm kiếm (Search Intent):</span>
                                            <span className="bg-purple-950/40 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-medium">
                                                {seoResult.searchIntent}
                                            </span>
                                        </div>
                                    )}

                                    {seoResult?.seoTips && seoResult.seoTips.length > 0 && (
                                        <div className="pt-2 border-t border-zinc-800 space-y-1 text-xs">
                                            <span className="text-zinc-400 font-medium">Mẹo SEO cho sản phẩm này:</span>
                                            <ul className="list-disc list-inside text-zinc-300 space-y-1">
                                                {seoResult.seoTips.map((tip, idx) => (
                                                    <li key={idx}>{tip}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ) : activeTab === 'text' ? (
                            <>
                                <div className="prose prose-sm prose-invert prose-zinc max-w-none text-zinc-300 whitespace-pre-wrap font-sans">
                                {isLongDescription && !isDescriptionContentExpanded ? stripHtml(localDescriptionHtml).substring(0, TRUNCATE_LENGTH) + '...' : stripHtml(localDescriptionHtml)}
                                </div>
                                {isLongDescription && (
                                <button
                                    onClick={(e) => {
                                        setIsDescriptionContentExpanded(!isDescriptionContentExpanded)
                                    }}
                                    className="text-sky-400 hover:text-sky-300 font-semibold mt-4 text-sm transition-colors duration-200"
                                >
                                    {isDescriptionContentExpanded ? 'Thu gọn' : 'Xem thêm'}
                                </button>
                                )}
                            </>
                            ) : (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <HtmlSubTabButton mode="preview" label="Xem trước" />
                                        <HtmlSubTabButton mode="code" label="Mã" />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (isEditing) {
                                                if (htmlViewMode === 'preview' && previewRef.current) {
                                                    setLocalDescriptionHtml(previewRef.current.innerHTML);
                                                }
                                                setIsEditing(false);
                                            } else {
                                                setIsEditing(true);
                                            }
                                        }}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-200 flex items-center gap-1.5 ${
                                            isEditing
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            : 'bg-zinc-800/60 text-sky-400 hover:bg-zinc-700 border border-zinc-700'
                                        }`}
                                    >
                                        {isEditing ? (
                                            <><Save className="w-3.5 h-3.5" /> Lưu</>
                                        ) : (
                                            <><Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa</>
                                        )}
                                    </button>
                                </div>
                                {htmlViewMode === 'preview' ? (
                                    <div 
                                        ref={previewRef}
                                        contentEditable={isEditing}
                                        suppressContentEditableWarning={true}
                                        className={`prose prose-sm prose-invert prose-zinc max-w-none text-zinc-300 font-sans 
                                        prose-img:rounded-lg prose-img:my-2 
                                        prose-h2:text-sky-300 prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-sky-200 prose-h3:mt-3 prose-h3:mb-1
                                        prose-strong:text-zinc-100
                                        prose-p:my-1 prose-p:leading-relaxed
                                        prose-ul:my-2 prose-li:my-0.5 ${isEditing ? 'p-3 rounded-lg border-2 border-emerald-500/50 bg-zinc-900/50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: localDescriptionHtml }} 
                                    />
                                ) : (
                                    isEditing ? (
                                        <textarea
                                            value={localDescriptionHtml}
                                            onChange={(e) => setLocalDescriptionHtml(e.target.value)}
                                            className="w-full bg-zinc-950/50 p-4 rounded-lg border-2 border-emerald-500/50 font-mono text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 min-h-[300px] transition-all"
                                        />
                                    ) : (
                                        <pre className="whitespace-pre-wrap font-mono text-xs bg-zinc-900/70 p-4 rounded-md border border-zinc-600 max-h-[40vh] overflow-auto">
                                            <code>{localDescriptionHtml}</code>
                                        </pre>
                                    )
                                )}
                            </>
                            )}
                        </div>

                        {((sources && sources.length > 0) || (searchQueries && searchQueries.length > 0)) && (
                            <div className="mt-6 pt-4 border-t border-zinc-700">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-sky-400 flex items-center gap-2">
                                <Globe className="w-4 h-4"/>
                                Dữ liệu & Nguồn Google Search
                                </h3>
                                <button
                                    onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
                                    className="text-sky-400 hover:text-sky-300 font-semibold text-xs transition-colors duration-200"
                                >
                                    {isSourcesExpanded ? 'Thu gọn' : `Chi tiết (${sources.length} nguồn)`}
                                </button>
                            </div>

                            {searchQueries && searchQueries.length > 0 && (
                                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                                    <span className="text-zinc-500 font-medium flex items-center gap-1">
                                        <Search className="w-3 h-3 text-sky-400" /> Truy vấn thực tế:
                                    </span>
                                    {searchQueries.map((q, idx) => (
                                        <span key={idx} className="bg-zinc-800/80 text-sky-300 border border-zinc-700 px-2 py-0.5 rounded-full">
                                            "{q}"
                                        </span>
                                    ))}
                                </div>
                            )}
                            
                            {isSourcesExpanded && sources.length > 0 && (
                                <ul className="space-y-2 mt-3 animate-fade-in">
                                {sources.map((source, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                    <span className="text-zinc-500 mt-0.5 text-xs">&#8226;</span>
                                    <a
                                        href={source.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sky-400 hover:text-sky-300 hover:underline transition-colors duration-200 text-xs break-all"
                                        title={source.title}
                                    >
                                        {source.title || source.uri}
                                    </a>
                                    </li>
                                ))}
                                </ul>
                            )}
                            </div>
                        )}
                    </>
                 )}
             </div>
          )}
       </div>
    </div>
  );
};
