import React, { useState } from 'react';
import ImageScraperTab from './ImageScraperTab';
import WebTarsScraperTab from './WebTarsScraperTab';
import RawImageScraperTab from './RawImageScraperTab';
import ShopeeScraperTab from './ShopeeScraperTab';
import DocumentExtractorTab from './DocumentExtractorTab';
import ScrapingHistoryTab from './ScrapingHistoryTab';
import HtmlDescriptionScraperTab from './HtmlDescriptionScraperTab';
import { ImageDown, Globe, ScanLine, Layers, FileText } from 'lucide-react';

type SubTabId = 'image' | 'web-tars' | 'html-desc' | 'raw' | 'shopee' | 'document' | 'history';

export default function ScraperHubTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('image');

  const subTabs = [
    { id: 'image', label: 'Đào Ảnh', icon: <ImageDown className="w-4 h-4" /> },
    { id: 'web-tars', label: 'Web Scraper TARS', icon: <Globe className="w-4 h-4" /> },
    { id: 'document', label: 'Document OCR', icon: <FileText className="w-4 h-4" /> },
    { id: 'raw', label: 'Đào Ảnh Raw', icon: <ScanLine className="w-4 h-4" /> },
    { id: 'shopee', label: 'Đào Shopee', icon: <Layers className="w-4 h-4" /> },
    { id: 'html-desc', label: 'Mô tả (HTML)', icon: <FileText className="w-4 h-4" /> },
    { id: 'history', label: 'Lịch sử Cào dữ liệu', icon: <FileText className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="flex flex-col bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden min-h-[800px] min-w-0">
      <div className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 p-3 px-6 flex flex-wrap items-center justify-start gap-4 shrink-0 z-10 sticky top-0 min-w-0">
        <div className="flex items-center gap-3 mr-4 border-r border-zinc-800 pr-6">
           <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg flex items-center justify-center">
             <ImageDown className="w-5 h-5 text-white" />
           </div>
           <div>
             <h2 className="font-bold text-slate-100 text-sm">Hub Đào Dữ Liệu</h2>
             <p className="text-[10px] text-zinc-400">Tập hợp các bộ công cụ Scraper</p>
           </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {subTabs.map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveSubTab(tab.id)}
               className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all overflow-hidden ${
                  activeSubTab === tab.id
                    ? 'text-white bg-white/10 shadow-inner border border-white/10'
                    : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 border border-transparent'
               }`}
             >
                {tab.icon}
                {tab.label}
             </button>
          ))}
        </div>
      </div>
      <div className="p-4 sm:p-6 min-w-0">
        {activeSubTab === 'image' && <ImageScraperTab />}
        {activeSubTab === 'web-tars' && <WebTarsScraperTab />}
        {activeSubTab === 'document' && <DocumentExtractorTab />}
        {activeSubTab === 'raw' && <RawImageScraperTab />}
        {activeSubTab === 'shopee' && <ShopeeScraperTab />}
        {activeSubTab === 'html-desc' && <HtmlDescriptionScraperTab />}
        {activeSubTab === 'history' && <ScrapingHistoryTab />}
      </div>
    </div>
  );
}
