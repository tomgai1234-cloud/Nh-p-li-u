import React from 'react';
import { Loader2 } from 'lucide-react';

interface TabSkeletonLoaderProps {
  tabId?: string | null;
  label?: string;
}

export const TabSkeletonLoader: React.FC<TabSkeletonLoaderProps> = ({ tabId, label }) => {
  // Determine specialized layout based on tab category
  const isDashboard = tabId === 'dashboard' || tabId === 'sku-report';
  const isMediaEditor = tabId === 'image' || tabId === 'video-editor';
  const isFormOrGenerator = tabId === 'description' || tabId === 'docs-to-html' || tabId === 'pipeline' || tabId === 'standardizer';
  const isChatbot = tabId === 'chatbot';

  if (isMediaEditor) {
    return (
      <div className="w-full h-[calc(100vh-4rem)] flex flex-col bg-[#09090b] select-none animate-pulse">
        {/* Top Control Bar Skeleton */}
        <div className="h-14 border-b border-zinc-800/60 bg-[#0c0c0e] px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-24 h-8 bg-zinc-800/60 rounded-lg" />
            <div className="w-20 h-8 bg-zinc-800/40 rounded-lg" />
            <div className="w-20 h-8 bg-zinc-800/40 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-28 h-8 bg-zinc-800/50 rounded-lg" />
            <div className="w-24 h-8 bg-zinc-700/60 rounded-lg" />
          </div>
        </div>

        {/* Main Canvas Workspace Skeleton */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Toolbar */}
          <div className="w-16 border-r border-zinc-800/60 bg-[#0a0a0c] p-2 flex flex-col items-center gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-10 h-10 rounded-lg bg-zinc-800/60" />
            ))}
          </div>

          {/* Central Canvas Viewport */}
          <div className="flex-1 bg-[#121215] flex items-center justify-center p-8 relative">
            <div className="w-full max-w-2xl aspect-[4/3] rounded-xl border border-dashed border-zinc-700/40 bg-zinc-900/40 flex flex-col items-center justify-center gap-3 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-zinc-500 animate-spin" />
              </div>
              <div className="w-48 h-4 bg-zinc-800/70 rounded-full" />
              <div className="w-32 h-3 bg-zinc-800/40 rounded-full" />
            </div>
          </div>

          {/* Right Adjustments Panel */}
          <div className="w-72 border-l border-zinc-800/60 bg-[#0a0a0c] p-4 flex flex-col gap-4">
            <div className="w-32 h-5 bg-zinc-800/80 rounded" />
            <div className="space-y-3 pt-2">
              <div className="w-full h-8 bg-zinc-800/50 rounded-lg" />
              <div className="w-full h-8 bg-zinc-800/50 rounded-lg" />
              <div className="w-full h-8 bg-zinc-800/50 rounded-lg" />
            </div>
            <div className="border-t border-zinc-800/60 pt-4 space-y-4">
              <div className="w-24 h-4 bg-zinc-800/60 rounded" />
              <div className="w-full h-2 bg-zinc-800/50 rounded-full" />
              <div className="w-full h-2 bg-zinc-800/50 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isDashboard) {
    return (
      <div className="space-y-6 select-none animate-pulse">
        {/* Top Header & Status Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/40">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-44 h-7 bg-zinc-800/80 rounded-lg" />
              <div className="w-20 h-5 bg-zinc-800/50 rounded-full" />
            </div>
            <div className="w-64 h-3.5 bg-zinc-800/40 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-28 h-9 bg-zinc-800/60 rounded-lg" />
            <div className="w-24 h-9 bg-zinc-800/80 rounded-lg" />
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-5 rounded-xl bg-[#0e0e11] border border-zinc-800/60 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="w-24 h-3.5 bg-zinc-800/70 rounded" />
                <div className="w-8 h-8 rounded-lg bg-zinc-800/60" />
              </div>
              <div className="w-20 h-7 bg-zinc-700/60 rounded-md" />
              <div className="w-32 h-3 bg-zinc-800/40 rounded-full" />
            </div>
          ))}
        </div>

        {/* Two-Column Section: Chart & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-xl bg-[#0e0e11] border border-zinc-800/60 space-y-5">
            <div className="flex items-center justify-between">
              <div className="w-40 h-5 bg-zinc-800/80 rounded" />
              <div className="w-28 h-7 bg-zinc-800/40 rounded-lg" />
            </div>
            {/* Chart Area Bars */}
            <div className="h-60 flex items-end justify-between gap-3 pt-8 pb-2 border-b border-zinc-800/50">
              {[45, 65, 30, 80, 55, 90, 70, 85, 60, 95, 40, 75].map((val, idx) => (
                <div
                  key={idx}
                  style={{ height: `${val}%` }}
                  className="flex-1 bg-zinc-800/50 rounded-t transition-all"
                />
              ))}
            </div>
            <div className="flex justify-between">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="w-10 h-3 bg-zinc-800/40 rounded" />
              ))}
            </div>
          </div>

          {/* Right Recent List */}
          <div className="p-6 rounded-xl bg-[#0e0e11] border border-zinc-800/60 space-y-4">
            <div className="w-32 h-5 bg-zinc-800/80 rounded" />
            <div className="space-y-3 pt-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/30">
                  <div className="w-9 h-9 rounded-lg bg-zinc-800/70 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="w-3/4 h-3.5 bg-zinc-800/80 rounded" />
                    <div className="w-1/2 h-2.5 bg-zinc-800/40 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isFormOrGenerator) {
    return (
      <div className="space-y-6 select-none animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
          <div className="space-y-2">
            <div className="w-48 h-6 bg-zinc-800/80 rounded-lg" />
            <div className="w-72 h-3.5 bg-zinc-800/40 rounded" />
          </div>
          <div className="w-32 h-9 bg-zinc-800/60 rounded-lg" />
        </div>

        {/* Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Input Pane */}
          <div className="lg:col-span-5 p-6 rounded-xl bg-[#0e0e11] border border-zinc-800/60 space-y-5">
            <div className="w-28 h-4 bg-zinc-800/80 rounded" />
            <div className="space-y-2">
              <div className="w-24 h-3 bg-zinc-800/60 rounded" />
              <div className="w-full h-10 bg-zinc-800/40 rounded-lg border border-zinc-800/40" />
            </div>
            <div className="space-y-2">
              <div className="w-32 h-3 bg-zinc-800/60 rounded" />
              <div className="w-full h-28 bg-zinc-800/30 rounded-lg border border-zinc-800/40" />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <div className="w-5 h-5 bg-zinc-800/60 rounded" />
              <div className="w-40 h-3 bg-zinc-800/50 rounded" />
            </div>
            <div className="w-full h-11 bg-zinc-700/60 rounded-xl mt-4" />
          </div>

          {/* Right Result Preview Pane */}
          <div className="lg:col-span-7 p-6 rounded-xl bg-[#0e0e11] border border-zinc-800/60 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
                <div className="w-36 h-4 bg-zinc-800/80 rounded" />
                <div className="flex gap-2">
                  <div className="w-16 h-7 bg-zinc-800/40 rounded-md" />
                  <div className="w-16 h-7 bg-zinc-800/40 rounded-md" />
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div className="w-full h-4 bg-zinc-800/60 rounded" />
                <div className="w-11/12 h-4 bg-zinc-800/50 rounded" />
                <div className="w-4/5 h-4 bg-zinc-800/50 rounded" />
                <div className="w-full h-4 bg-zinc-800/40 rounded" />
                <div className="w-3/4 h-4 bg-zinc-800/40 rounded" />
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-800/40 flex justify-end gap-3">
              <div className="w-24 h-9 bg-zinc-800/60 rounded-lg" />
              <div className="w-32 h-9 bg-zinc-700/60 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isChatbot) {
    return (
      <div className="w-full max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col bg-[#0e0e11] rounded-2xl border border-zinc-800/60 overflow-hidden select-none animate-pulse">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between bg-[#0a0a0c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-800/80" />
            <div className="space-y-1.5">
              <div className="w-28 h-4 bg-zinc-800/80 rounded" />
              <div className="w-20 h-2.5 bg-zinc-800/40 rounded" />
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-zinc-800/50" />
        </div>

        {/* Messages Body */}
        <div className="flex-1 p-6 space-y-6 overflow-hidden">
          {/* Assistant Bubble */}
          <div className="flex items-start gap-3 max-w-[80%]">
            <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex-shrink-0" />
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/60 space-y-2 flex-1">
              <div className="w-full h-3.5 bg-zinc-800/70 rounded" />
              <div className="w-4/5 h-3.5 bg-zinc-800/50 rounded" />
              <div className="w-3/5 h-3.5 bg-zinc-800/40 rounded" />
            </div>
          </div>

          {/* User Bubble */}
          <div className="flex items-start gap-3 max-w-[70%] ml-auto justify-end">
            <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/40 space-y-2 w-full">
              <div className="w-full h-3.5 bg-zinc-700/60 rounded" />
              <div className="w-2/3 h-3.5 bg-zinc-700/40 rounded" />
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex-shrink-0" />
          </div>

          {/* Assistant Bubble 2 */}
          <div className="flex items-start gap-3 max-w-[85%]">
            <div className="w-8 h-8 rounded-full bg-zinc-800/80 flex-shrink-0" />
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/60 space-y-2 flex-1">
              <div className="w-full h-3.5 bg-zinc-800/70 rounded" />
              <div className="w-5/6 h-3.5 bg-zinc-800/50 rounded" />
            </div>
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-zinc-800/60 bg-[#0a0a0c]">
          <div className="h-12 rounded-xl bg-zinc-900 border border-zinc-800/80 px-4 flex items-center justify-between">
            <div className="w-48 h-4 bg-zinc-800/50 rounded" />
            <div className="w-8 h-8 rounded-lg bg-zinc-800/80" />
          </div>
        </div>
      </div>
    );
  }

  // Universal Grid / Table / Scraper Skeleton
  return (
    <div className="space-y-6 select-none animate-pulse">
      {/* Top Header & Search Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/40">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-52 h-7 bg-zinc-800/80 rounded-lg" />
            <span className="text-xs text-zinc-500 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              Đang tải...
            </span>
          </div>
          <div className="w-72 h-3.5 bg-zinc-800/40 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-28 h-9 bg-zinc-800/60 rounded-lg" />
          <div className="w-32 h-9 bg-zinc-700/60 rounded-lg" />
        </div>
      </div>

      {/* Input / Control Filter Panel */}
      <div className="p-4 rounded-xl bg-[#0e0e11] border border-zinc-800/60 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-1/2 h-10 bg-zinc-800/40 rounded-lg border border-zinc-800/40" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-24 h-10 bg-zinc-800/50 rounded-lg" />
          <div className="w-24 h-10 bg-zinc-800/50 rounded-lg" />
          <div className="w-28 h-10 bg-zinc-700/60 rounded-lg" />
        </div>
      </div>

      {/* Table / Results Skeleton Rows */}
      <div className="rounded-xl bg-[#0e0e11] border border-zinc-800/60 overflow-hidden">
        {/* Table Header */}
        <div className="h-11 bg-zinc-900/60 border-b border-zinc-800/60 px-4 flex items-center justify-between">
          <div className="w-24 h-3.5 bg-zinc-800/80 rounded" />
          <div className="w-40 h-3.5 bg-zinc-800/60 rounded hidden md:block" />
          <div className="w-20 h-3.5 bg-zinc-800/60 rounded" />
          <div className="w-16 h-3.5 bg-zinc-800/60 rounded" />
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-zinc-800/40">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-zinc-800/70 flex-shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="w-3/4 h-3.5 bg-zinc-800/80 rounded" />
                  <div className="w-1/3 h-2.5 bg-zinc-800/40 rounded" />
                </div>
              </div>
              <div className="w-28 h-4 bg-zinc-800/50 rounded hidden md:block" />
              <div className="w-16 h-6 bg-zinc-800/60 rounded-md" />
              <div className="w-8 h-8 rounded-lg bg-zinc-800/40 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TabSkeletonLoader;
