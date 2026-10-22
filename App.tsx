import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Icons ---
import { 
  FileText, Image as ImageIcon, BookOpen, FileInput, MessageSquare, 
  ScanLine, ImageDown, Tag, DownloadCloud, Video, Monitor, 
  LayoutTemplate, Menu, X, ChevronDown, ChevronRight, Search,
  PanelLeftClose, PanelLeftOpen, LayoutGrid, Sparkles, Database, HelpCircle,
  LogOut, LogIn, User as UserIcon, Key, Code, Layers, LayoutDashboard, Users, ShieldAlert, Globe, History, GitCommit,
  BarChart3
} from 'lucide-react';

// --- Firebase ---
import { auth, signInWithGoogle, logout, db } from './src/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// --- Component Imports ---
import DescriptionGeneratorTab from './components/tabs/DescriptionGeneratorTab';
import ImageEditorTab from './components/tabs/ImageEditorTab';
import GuideTab from './components/tabs/GuideTab';
import DashboardTab from './components/tabs/DashboardTab';
import SkuReportTab from './components/tabs/SkuReportTab';
import FileConverterV2Tab from './components/tabs/FileConverterV2Tab';
import ChatbotTab from './components/tabs/ChatbotTab';
import ProductExtractorTab from './components/tabs/ProductExtractorTab';
import ImageScraperTab from './components/tabs/ImageScraperTab';
import ProductNameStandardizerTab from './components/tabs/ProductNameStandardizerTab';
import BulkDownloadTab from './components/tabs/BulkDownloadTab';
import VideoEditorTab from './components/tabs/VideoEditorTab';
import DownloadAppTab from './components/tabs/DownloadAppTab';
import BatchFrameTab from './components/tabs/BatchFrameTab';
import { ApiKeysTab } from './components/tabs/ApiKeysTab';
import RawImageScraperTab from './components/tabs/RawImageScraperTab';
import ShopeeScraperTab from './components/tabs/ShopeeScraperTab';
import WebTarsScraperTab from './components/tabs/WebTarsScraperTab';
import ScraperHubTab from './components/tabs/ScraperHubTab';
import UserManagementTab from './components/tabs/UserManagementTab';
import GlobalChat from './components/GlobalChat';
import DocumentExtractorTab from './components/tabs/DocumentExtractorTab';
import ProductPipelineTab from './components/tabs/ProductPipelineTab';
import ChangelogTab from './components/tabs/ChangelogTab';
import GoogleDocsToHtmlTab from './components/tabs/GoogleDocsToHtmlTab';
import AppGalleryTab from './components/tabs/AppGalleryTab';
import TabSkeletonLoader from './components/TabSkeletonLoader';

import { Toaster, toast } from 'react-hot-toast';
import Spinner from './components/Spinner';

// --- Types & Constants ---
type ActiveTabId = 'dashboard' | 'sku-report' | 'pipeline' | 'app-gallery' | 'description' | 'image' | 'chatbot' | 'converter-v2' | 'guide' | 'extractor' | 'scraper-hub' | 'standardizer' | 'bulk-download' | 'video-editor' | 'download-app' | 'batch-frame' | 'api-keys' | 'user-management' | 'changelog' | 'docs-to-html';

interface TabGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  tabs: ActiveTabId[];
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user' | 'blocked';
  allowedTabs?: ActiveTabId[];
}

const APP_VERSION = 'v2.6.0 (v6.4.1 Engine)';

const TAB_COMPONENTS: Record<ActiveTabId, React.ComponentType<any>> = {
  'dashboard': DashboardTab,
  'sku-report': SkuReportTab,
  'pipeline': ProductPipelineTab,
  'app-gallery': AppGalleryTab,
  'description': DescriptionGeneratorTab,
  'docs-to-html': GoogleDocsToHtmlTab,
  'batch-frame': BatchFrameTab,
  'extractor': ProductExtractorTab,
  'standardizer': ProductNameStandardizerTab,
  'image': ImageEditorTab,
  'video-editor': VideoEditorTab,
  'scraper-hub': ScraperHubTab,
  'bulk-download': BulkDownloadTab,
  'converter-v2': FileConverterV2Tab,
  'chatbot': ChatbotTab,
  'download-app': DownloadAppTab,
  'changelog': ChangelogTab,
  'guide': GuideTab,
  'api-keys': ApiKeysTab,
  'user-management': UserManagementTab,
};

const TAB_LABELS: Record<ActiveTabId, string> = {
  'dashboard': 'Dashboard',
  'sku-report': 'Báo cáo Nhập liệu (SKU)',
  'pipeline': 'Luồng 1-Step (Pipeline)',
  'app-gallery': 'Thư viện App (Gallery)',
  'description': 'Tạo Mô tả',
  'docs-to-html': 'Tối ưu & Chuẩn hóa HTML',
  'batch-frame': 'Tạo Khung Hàng Loạt',
  'extractor': 'Lấy thuộc tính',
  'standardizer': 'Chuẩn hóa Tên',
  'image': 'Chỉnh sửa Ảnh',
  'video-editor': 'Chỉnh sửa Video',
  'scraper-hub': 'Cào Dữ Liệu',
  'bulk-download': 'Tải Ảnh Hàng Loạt',
  'converter-v2': 'Tự động Chuẩn hóa',
  'chatbot': 'Chatbot',
  'download-app': 'Tải App',
  'changelog': 'Lịch sử Cập nhật',
  'guide': 'Hướng dẫn',
  'api-keys': 'Quản lý API Key',
  'user-management': 'Quản lý Người dùng',
};

const TAB_ICONS: Record<ActiveTabId, React.ReactNode> = {
  'dashboard': <LayoutDashboard className="w-4 h-4" />,
  'sku-report': <BarChart3 className="w-4 h-4 text-amber-400" />,
  'pipeline': <Layers className="w-4 h-4 text-emerald-400" />,
  'app-gallery': <Sparkles className="w-4 h-4 text-sky-400" />,
  'description': <FileText className="w-4 h-4" />,
  'docs-to-html': <Code className="w-4 h-4" />,
  'batch-frame': <LayoutTemplate className="w-4 h-4" />,
  'extractor': <ScanLine className="w-4 h-4" />,
  'standardizer': <Tag className="w-4 h-4" />,
  'image': <ImageIcon className="w-4 h-4" />,
  'video-editor': <Video className="w-4 h-4" />,
  'scraper-hub': <ImageDown className="w-4 h-4" />,
  'bulk-download': <DownloadCloud className="w-4 h-4" />,
  'converter-v2': <FileInput className="w-4 h-4" />,
  'chatbot': <MessageSquare className="w-4 h-4" />,
  'download-app': <Monitor className="w-4 h-4" />,
  'changelog': <History className="w-4 h-4" />,
  'guide': <BookOpen className="w-4 h-4" />,
  'api-keys': <Key className="w-4 h-4" />,
  'user-management': <Users className="w-4 h-4" />,
};

const TAB_GROUPS: TabGroup[] = [
  {
    id: 'overview',
    label: 'Tổng quan',
    icon: <LayoutDashboard className="w-5 h-5" />,
    tabs: ['dashboard', 'app-gallery']
  },
  {
    id: 'product',
    label: 'Quản lý Sản phẩm',
    icon: <LayoutGrid className="w-5 h-5" />,
    tabs: ['pipeline', 'description', 'docs-to-html', 'extractor', 'standardizer']
  },
  {
    id: 'media',
    label: 'Chỉnh sửa Media',
    icon: <Sparkles className="w-5 h-5" />,
    tabs: ['image', 'video-editor', 'batch-frame']
  },
  {
    id: 'data',
    label: 'Công cụ Dữ liệu',
    icon: <Database className="w-5 h-5" />,
    tabs: ['sku-report', 'scraper-hub', 'bulk-download', 'converter-v2']
  },
  {
    id: 'system',
    label: 'Hệ thống & Hỗ trợ',
    icon: <HelpCircle className="w-5 h-5" />,
    tabs: ['chatbot', 'api-keys', 'download-app', 'changelog', 'guide', 'user-management']
  }
];

const App: React.FC = () => {
  const getInitialTab = (): ActiveTabId => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam) {
          const normalized = tabParam.replace('_', '-') as ActiveTabId;
          if (TAB_COMPONENTS[normalized]) return normalized;
        }
        const hash = window.location.hash.replace('#', '').replace('_', '-') as ActiveTabId;
        if (hash && TAB_COMPONENTS[hash]) return hash;
      } catch (_) {}
    }
    const saved = localStorage.getItem('appActiveTab');
    return (saved as ActiveTabId) || 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<ActiveTabId | null>(getInitialTab);
  const [isTabLoading, setIsTabLoading] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial = getInitialTab();
    return TAB_GROUPS.reduce((acc, group) => {
      // Auto-expand the group containing the active tab by default
      acc[group.id] = group.tabs.includes(initial);
      return acc;
    }, {} as Record<string, boolean>);
  });

  const toggleGroup = (groupId: string) => {
    if (!isSidebarOpen) setIsSidebarOpen(true); // Open sidebar if interacting with groups
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        let role: 'admin' | 'user' | 'blocked' = 'user';
        let allowedTabs: ActiveTabId[] | undefined;
        
        try {
          if (currentUser.email === 'tungnguyen.0612993@gmail.com') {
            role = 'admin';
          }
          
          const profileData: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL || '',
            role,
            allowedTabs
          };

          // if (false) {
          //   await setDoc(userDocRef, {
          //     ...profileData,
          //     createdAt: serverTimestamp(),
          //     lastLogin: serverTimestamp()
          //   });
          // } else {
          //   await setDoc(userDocRef, {
          //     role,
          //     lastLogin: serverTimestamp()
          //   }, { merge: true });
          // }
          setUserProfile(profileData);
        } catch (error) {
          console.warn("Firestore error, fallback profile.", error);
          if (currentUser.email === 'tungnguyen.0612993@gmail.com') {
            role = 'admin';
          }
          setUserProfile({
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL || '',
            role,
            allowedTabs: undefined
          });
        }
      } else {
        // Auto-login as default Local Admin so user enters app directly without login prompt
        const dummyUser = {
          uid: 'local-admin',
          email: 'tungnguyen.0612993@gmail.com',
          displayName: 'Admin',
          photoURL: ''
        } as User;
        setUser(dummyUser);
        setUserProfile({
          uid: 'local-admin',
          email: 'tungnguyen.0612993@gmail.com',
          displayName: 'Admin',
          photoURL: '',
          role: 'admin'
        });
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Keep-alive heartbeat to prevent container idling
    const pingServer = () => {
      fetch('/api/health')
        .catch(() => {
          // silent fallback
        });
    };

    // Initial ping
    pingServer();

    // Ping every 45 seconds while page is open
    const interval = setInterval(pingServer, 45000);

    // Re-ping when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pingServer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleTabChangeRequest = (e: Event) => {
      const customEvent = e as CustomEvent<ActiveTabId>;
      if (customEvent.detail) {
        handleTabChange(customEvent.detail);
      }
    };
    const handleTabLoadingEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ loading: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.loading === 'boolean') {
        setIsTabLoading(customEvent.detail.loading);
      }
    };

    window.addEventListener('change-active-tab', handleTabChangeRequest);
    window.addEventListener('set-tab-loading', handleTabLoadingEvent);
    return () => {
      window.removeEventListener('change-active-tab', handleTabChangeRequest);
      window.removeEventListener('set-tab-loading', handleTabLoadingEvent);
    };
  }, [activeTab]);

  const handleTabChange = (id: ActiveTabId) => {
    if (id === activeTab) return;
    setIsTabLoading(true);
    setActiveTab(id);
    localStorage.setItem('appActiveTab', id);

    // Smooth transition to allow the new tab DOM & state to prepare without layout flicker
    setTimeout(() => {
      setIsTabLoading(false);
    }, 180);
  };

  const handleSelectFromGallery = (targetTab: string, payload?: { presetQuery?: string; prompt?: string }) => {
    const tabId = targetTab as ActiveTabId;
    if (!tabId) return;

    // Automatically expand the group containing the target tab in the sidebar
    TAB_GROUPS.forEach(group => {
      if (group.tabs.includes(tabId)) {
        setExpandedGroups(prev => ({ ...prev, [group.id]: true }));
      }
    });

    // Populate Remix preset data if available
    if (payload?.presetQuery) {
      try {
        if (tabId === 'description') {
          localStorage.setItem('descGen_productQuery', JSON.stringify(payload.presetQuery));
        } else if (tabId === 'extractor') {
          localStorage.setItem('extractor_products', JSON.stringify(payload.presetQuery));
        } else if (tabId === 'standardizer') {
          localStorage.setItem('standardizer_input', JSON.stringify(payload.presetQuery));
        } else if (tabId === 'chatbot') {
          localStorage.setItem('chatbot_preset_query', payload.presetQuery);
        }
      } catch (e) {
        console.warn("Could not save preset to localStorage:", e);
      }
    }

    handleTabChange(tabId);
    toast.success(`Đã mở ${TAB_LABELS[tabId] || tabId} & nạp dữ liệu Remix!`, {
      icon: '✨'
    });
  };

  const handleLocalLogin = () => {
    const dummyUser = {
      uid: 'local-admin',
      email: 'tungnguyen.0612993@gmail.com',
      displayName: 'Admin',
      photoURL: ''
    } as User;
    setUser(dummyUser);
    setUserProfile({
      uid: 'local-admin',
      email: 'tungnguyen.0612993@gmail.com',
      displayName: 'Admin',
      photoURL: '',
      role: 'admin'
    });
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const googleUser = await signInWithGoogle();
      if (!googleUser) {
        handleLocalLogin();
      }
    } catch (error) {
      console.warn('Google login error, entering Local Admin mode:', error);
      handleLocalLogin();
    } finally {
      setIsLoggingIn(false);
    }
  };

  const availableTabGroups = useMemo(() => {
    return TAB_GROUPS.map(group => {
      let tabs = [...group.tabs];
      const isAdmin = userProfile?.role === 'admin' || user?.email === 'tungnguyen.0612993@gmail.com';
      
      if (!isAdmin) {
        tabs = tabs.filter(t => t !== 'user-management');
        if (userProfile && userProfile.allowedTabs) {
          tabs = tabs.filter(t => t === 'dashboard' || t === 'guide' || userProfile.allowedTabs!.includes(t));
        }
      }
      return { ...group, tabs };
    }).filter(g => g.tabs.length > 0);
  }, [user, userProfile]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Spinner className="w-8 h-8 text-zinc-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zinc-800/20 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-md bg-[#0a0a0c] border border-zinc-800/50 p-8 rounded-2xl shadow-2xl relative z-10"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-inner">
              <LayoutGrid className="w-8 h-8 text-zinc-100" />
            </div>
          </div>
          <h2 className="text-3xl font-display font-medium text-center text-zinc-100 mb-2 tracking-tight">Hệ thống Nhập liệu</h2>
          <p className="text-zinc-400 text-center mb-8 font-sans">Đăng nhập để truy cập công cụ</p>
          
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full relative group overflow-hidden bg-zinc-100 hover:bg-white text-zinc-900 font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center disabled:opacity-70"
          >
            {isLoggingIn ? (
              <Spinner className="w-5 h-5 text-zinc-900" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Tiếp tục với Google
              </>
            )}
          </button>

          <button
            onClick={handleLocalLogin}
            className="w-full mt-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm border border-zinc-700/50"
          >
            <UserIcon className="w-4 h-4 text-sky-400" />
            Vào ngay ứng dụng (Chế độ Admin)
          </button>
        </motion.div>
      </div>
    );
  }

  if (userProfile?.role === 'blocked') {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0a0a0c] border border-zinc-800/50 p-8 rounded-2xl shadow-2xl text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-display font-medium text-zinc-100 mb-2">Tài khoản bị khóa</h2>
          <p className="text-zinc-400 mb-6">Tài khoản của bạn đã bị khóa hoặc chưa được cấp quyền. Vui lòng liên hệ Admin.</p>
          <button
            onClick={() => logout()}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  const ActiveComponent = activeTab && TAB_COMPONENTS[activeTab] ? TAB_COMPONENTS[activeTab] : DashboardTab;

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 overflow-hidden font-sans selection:bg-zinc-800">
      <Toaster position="top-right" toastOptions={{ className: '!bg-zinc-900 !text-zinc-100 !border !border-zinc-800' }} />
      {user && <GlobalChat />}
      
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 72,
          opacity: 1
        }}
        className="flex-shrink-0 bg-[#0a0a0c] border-r border-zinc-800/50 flex flex-col z-20"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="h-16 flex items-center px-4 border-b border-zinc-800/50">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
            <LayoutGrid className="w-5 h-5 text-zinc-100" />
          </div>
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="ml-3 font-display font-medium text-zinc-100 whitespace-nowrap overflow-hidden"
              >
                Hỗ trợ nhập liệu
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-2">
          {availableTabGroups.map(group => {
            const isExpanded = expandedGroups[group.id];

            return (
            <div key={group.id} className="px-3">
              <AnimatePresence mode="wait">
                {isSidebarOpen ? (
                  <motion.button
                    key="group-header"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => toggleGroup(group.id)}
                    className="w-full px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between hover:text-zinc-300 hover:bg-zinc-900/50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {group.icon}
                      {group.label}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                  </motion.button>
                ) : (
                  <motion.div 
                    key="group-divider"
                    className="flex justify-center my-3"
                  >
                    <div className="w-6 h-px bg-zinc-800" />
                  </motion.div>
                )}
              </AnimatePresence>
              
              <AnimatePresence initial={false}>
                {(isExpanded || !isSidebarOpen) && (
                  <motion.div
                    initial={isSidebarOpen ? { height: 0, opacity: 0 } : undefined}
                    animate={isSidebarOpen ? { height: 'auto', opacity: 1 } : undefined}
                    exit={isSidebarOpen ? { height: 0, opacity: 0 } : undefined}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden space-y-1"
                  >
                    {group.tabs.map(tabId => {
                      const isActive = activeTab === tabId;
                      return (
                        <button
                          key={tabId}
                          onClick={() => handleTabChange(tabId)}
                          className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                            isActive 
                              ? 'bg-zinc-800/80 text-zinc-100' 
                              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                          }`}
                          title={!isSidebarOpen ? TAB_LABELS[tabId] : undefined}
                        >
                          {isActive && (
                            <motion.div 
                              layoutId="activeSidebarTab"
                              className="absolute left-0 top-1 bottom-1 w-1 bg-zinc-400 rounded-r-full"
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}
                          <div className={`flex-shrink-0 ${isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                            {TAB_ICONS[tabId]}
                          </div>
                          
                          <AnimatePresence>
                            {isSidebarOpen && (
                              <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.2 }}
                                className="ml-3 font-medium text-sm whitespace-nowrap overflow-hidden text-left"
                              >
                                {TAB_LABELS[tabId]}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )})}
        </div>

        <div className="p-3 border-t border-zinc-800/50 space-y-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
            title={isSidebarOpen ? "Thu gọn" : "Mở rộng"}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center p-2 rounded-lg bg-zinc-900 border border-zinc-800">
            {user.photoURL ? (
              <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-zinc-700" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                <UserIcon className="w-4 h-4 text-zinc-400" />
              </div>
            )}
            
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="ml-3 flex-1 overflow-hidden"
                >
                  <div className="text-sm font-medium text-zinc-200 truncate">{user.displayName || 'Người dùng'}</div>
                  <div className="text-xs text-zinc-500 truncate">{user.email}</div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {isSidebarOpen && (
              <button
                onClick={() => logout()}
                className="p-1.5 ml-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-md transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#09090b] relative z-10">
        <header className="h-16 border-b border-zinc-800/50 bg-[#0a0a0c]/80 backdrop-blur-md flex items-center px-6 md:px-8 justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              {activeTab ? TAB_ICONS[activeTab] : <FileText className="w-4 h-4" />}
            </div>
            <h1 className="text-lg font-display font-medium text-zinc-100">
              {activeTab ? TAB_LABELS[activeTab] : 'Dashboard'}
            </h1>
          </div>
          <div className="text-xs font-mono text-zinc-600 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
            {APP_VERSION}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {isTabLoading ? (
              <motion.div
                key={`skeleton-${activeTab}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className={activeTab === 'image' || activeTab === 'video-editor' ? "w-full h-full min-w-0" : "p-6 md:p-8 max-w-7xl mx-auto min-h-full min-w-0"}
              >
                <TabSkeletonLoader tabId={activeTab} label={activeTab ? TAB_LABELS[activeTab] : undefined} />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab || 'empty'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={activeTab === 'image' || activeTab === 'video-editor' ? "w-full h-full min-w-0" : "p-6 md:p-8 max-w-7xl mx-auto min-h-full min-w-0"}
              >
                {activeTab === 'app-gallery' ? (
                  <AppGalleryTab onSelectTab={handleSelectFromGallery} />
                ) : (
                  <ActiveComponent />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export { TabSkeletonLoader };
export default App;
