import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { Activity, Zap, TrendingUp, Users, Search, Clock, ChevronDown, ChevronRight, Info, HelpCircle, Calendar, Play, ArrowRight, Star, LayoutDashboard, DownloadCloud, LayoutGrid, MapPin, GripHorizontal } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../src/firebase';

const generateMockData = (days: number) => {
  return Array.from({ length: days }).map((_, i) => ({
    date: `${i + 1}/${days > 7 ? '10' : '11'}`,
    tools: Math.floor(Math.random() * 20) + 10,
    images: Math.floor(Math.random() * 100) + 30,
    requests: Math.floor(Math.random() * 60) + 20
  }));
};

const MOCK_DATA = {
  'today': generateMockData(1),
  '7days': generateMockData(7),
  'thisMonth': generateMockData(30),
  'custom': generateMockData(14),
};

const mockToolDistribution = [
  { name: 'Đào Ảnh', value: 45 },
  { name: 'Khung Hàng Loạt', value: 25 },
  { name: 'Tạo Mô Tả', value: 20 },
  { name: 'Chatbot', value: 10 }
];

const COLORS = ['#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b'];

const DAILY_FREE_TOKENS = 5000;
const TOOL_COSTS = [
  { id: 'description', label: 'Tạo Mô tả', cost: 15 },
  { id: 'batch-frame', label: 'Khung Hàng Loạt', cost: 30 },
  { id: 'extractor', label: 'Lấy Thuộc tính', cost: 20 },
  { id: 'standardizer', label: 'Chuẩn hóa Tên', cost: 10 },
  { id: 'image', label: 'Chỉnh sửa Ảnh', cost: 100 },
  { id: 'video-editor', label: 'Chỉnh sửa Video', cost: 500 },
  { id: 'scraper', label: 'Đào Ảnh', cost: 25 },
  { id: 'raw-scraper', label: 'Đào Ảnh Raw', cost: 35 },
  { id: 'shopee-scraper', label: 'Đào Shopee', cost: 50 },
  { id: 'bulk-download', label: 'Tải Hàng Loạt', cost: 10 },
  { id: 'converter', label: 'Chuyển File', cost: 15 },
  { id: 'chatbot', label: 'Chatbot AI', cost: 10 }
];

interface AnalyticsUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: string;
  apiCalls: number;
  tokensLeft: number;
  tokenExpiration: Date;
  status: 'active' | 'warning' | 'expired';
}

const DashboardTab: React.FC = () => {
  const [users, setUsers] = useState<AnalyticsUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'today' | '7days' | 'thisMonth' | 'custom'>('7days');

  const dashboardMetrics = useMemo(() => {
    let totalTokensUsedToday = 0;
    let activeUsers = 0;
    let warningUsers = 0;
    let expiredUsers = 0;

    users.forEach(u => {
      const usedToday = DAILY_FREE_TOKENS - u.tokensLeft;
      totalTokensUsedToday += usedToday;
      
      if (u.status === 'active') activeUsers++;
      else if (u.status === 'warning') warningUsers++;
      else if (u.status === 'expired') expiredUsers++;
    });

    const statusData = [
      { name: 'Bình thường', value: activeUsers, fill: '#10b981' },
      { name: 'Sắp hết', value: warningUsers, fill: '#f59e0b' },
      { name: 'Hết Token', value: expiredUsers, fill: '#ef4444' }
    ].filter(d => d.value > 0);

    return { totalTokensUsedToday, activeUsers, warningUsers, expiredUsers, statusData };
  }, [users]);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u => 
      u.displayName.toLowerCase().includes(query) || 
      u.email.toLowerCase().includes(query)
    );
  }, [searchQuery, users]);

  const topUsersData = useMemo(() => {
    return [...users].sort((a, b) => b.apiCalls - a.apiCalls).slice(0, 5).map(u => ({
      name: u.displayName || u.email.split('@')[0],
      apiCalls: u.apiCalls,
      tokensLeft: u.tokensLeft
    }));
  }, [users]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingUsers(true);
        // const snapshot = await getDocs(collection(db, 'users'));
        const snapshot: any[] = []; // Mocked
        const activeUsers: AnalyticsUser[] = [];
        
        snapshot.forEach((doc: any) => {
          const data = doc.data();
          
          // Generate mock stats based on UID hash for consistency
          const hash = Array.from(String(doc.id)).reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
          const apiCalls = (hash * 13) % 2500;
          const tokenUsedToday = (hash * 47) % DAILY_FREE_TOKENS;
          const tokensLeft = DAILY_FREE_TOKENS - tokenUsedToday;
          
          // Expiration date from today to +30 days
          const daysLeft = (hash % 30) - 5; // -5 to +25 days
          const expiration = new Date();
          expiration.setDate(expiration.getDate() + daysLeft);
          
          let status: 'active' | 'warning' | 'expired' = 'active';
          if (daysLeft < 0 || tokensLeft < (DAILY_FREE_TOKENS * 0.05)) status = 'expired';
          else if (daysLeft < 5 || tokensLeft < (DAILY_FREE_TOKENS * 0.2)) status = 'warning';
          
          activeUsers.push({
            uid: doc.id,
            email: data.email || 'N/A',
            displayName: data.displayName || 'Unknown',
            photoURL: data.photoURL || '',
            role: data.role || 'user',
            apiCalls,
            tokensLeft,
            tokenExpiration: expiration,
            status
          });
        });
        
        setUsers(activeUsers.sort((a, b) => b.apiCalls - a.apiCalls));
      } catch (err) {
        console.error("Error fetching users for dashboard:", err);
      } finally {
        setLoadingUsers(false);
      }
    };
    
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <LayoutDashboard className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100">Dashboard</h2>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="hidden lg:flex items-center gap-1.5 text-emerald-400 text-xs font-semibold mr-2 border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Trạng thái Online
          </div>
          
          {/* Date Range Filter */}
          <div className="flex flex-1 sm:flex-none justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            {[
              { value: 'today', label: 'Hôm nay' },
              { value: '7days', label: '7 Ngày' },
              { value: 'thisMonth', label: 'Tháng này' },
              { value: 'custom', label: 'Tùy chỉnh' }
            ].map((range) => (
              <button
                key={range.value}
                onClick={() => setDateRange(range.value as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex-1 sm:flex-none ${
                  dateRange === range.value 
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 h-full bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-800 transition-all">
            <DownloadCloud className="w-4 h-4 text-zinc-500" />
            Xuất PDF
          </button>
        </div>
      </div>

      {/* 4 Top Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* API Calls (Leads) */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-5 relative overflow-hidden group hover:border-zinc-700 transition-colors">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 text-zinc-400 font-semibold text-sm">
              <div className="w-7 h-7 rounded-full bg-zinc-800/80 flex items-center justify-center group-hover:bg-indigo-500/10 transition-colors">
                 <Activity className="w-3.5 h-3.5 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
              </div>
              Lượt Gọi AI
            </div>
            <Info className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-zinc-100">{MOCK_DATA[dateRange].reduce((a, b) => a + b.requests, 0).toLocaleString()}</span>
            <span className="flex items-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
              <TrendingUp className="w-3 h-3 mr-0.5" /> 2%
            </span>
            <span className="text-[10px] text-zinc-500 font-medium ml-auto">vs kỳ trước</span>
          </div>
        </div>

        {/* Tokens Used (CLV) */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-5 group hover:border-zinc-700 transition-colors">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 text-zinc-400 font-semibold text-sm">
              <div className="w-7 h-7 rounded-full bg-zinc-800/80 flex items-center justify-center group-hover:bg-indigo-500/10 transition-colors">
                 <Zap className="w-3.5 h-3.5 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
              </div>
              Token Đã Hấp Thụ
            </div>
            <Info className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-zinc-100">{dashboardMetrics.totalTokensUsedToday > 1000 ? (dashboardMetrics.totalTokensUsedToday/1000).toFixed(1) + 'K' : dashboardMetrics.totalTokensUsedToday}</span>
            <span className="flex items-center text-xs font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20">
              <TrendingUp className="w-3 h-3 mr-0.5 rotate-180" /> 4%
            </span>
            <span className="text-[10px] text-zinc-500 font-medium ml-auto">vs kỳ trước</span>
          </div>
        </div>

        {/* Active Users (Conversion Rate) */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-5 group hover:border-zinc-700 transition-colors">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 text-zinc-400 font-semibold text-sm">
              <div className="w-7 h-7 rounded-full bg-zinc-800/80 flex items-center justify-center group-hover:bg-indigo-500/10 transition-colors">
                 <Users className="w-3.5 h-3.5 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
              </div>
              Người dùng thực
            </div>
            <Info className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-zinc-100">{dashboardMetrics.activeUsers}</span>
            <span className="flex items-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
              <TrendingUp className="w-3 h-3 mr-0.5" /> 8%
            </span>
            <span className="text-[10px] text-zinc-500 font-medium ml-auto">vs kỳ trước</span>
          </div>
        </div>

        {/* Action Needed (Revenue equivalent) */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-5 group hover:border-zinc-700 transition-colors">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 text-zinc-400 font-semibold text-sm">
              <div className="w-7 h-7 rounded-full bg-zinc-800/80 flex items-center justify-center group-hover:bg-indigo-500/10 transition-colors">
                 <Activity className="w-3.5 h-3.5 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
              </div>
              Sắp Tới Hạn
            </div>
            <Info className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-zinc-100">{dashboardMetrics.warningUsers + dashboardMetrics.expiredUsers}</span>
            <span className="flex items-center text-xs font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20">
              <TrendingUp className="w-3 h-3 mr-0.5 rotate-180" /> 1%
            </span>
            <span className="text-[10px] text-zinc-500 font-medium ml-auto">vs kỳ trước</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Daily User Activity Metrics (Area Chart) */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6 lg:col-span-2 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
             <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100 mb-1">
                  Biểu đồ Lượt gọi AI <GripHorizontal className="w-3 h-3 text-zinc-600" />
                </div>
                <div className="text-xs text-zinc-500 font-medium">Xu hướng cuộc gọi AI theo ngày</div>
             </div>
             <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
               <Activity className="w-3.5 h-3.5" /> +12% vs kỳ trước
             </div>
          </div>
          <div className="h-[260px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
              <AreaChart data={MOCK_DATA[dateRange]} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="date" stroke="#52525b" axisLine={false} tickLine={false} tickMargin={10} style={{ fontSize: '10px' }} />
                <YAxis stroke="#52525b" axisLine={false} tickLine={false} tickMargin={10} style={{ fontSize: '10px' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }} 
                  itemStyle={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981' }}
                  labelStyle={{ fontSize: '0.75rem', color: '#a1a1aa' }}
                />
                <Area type="monotone" dataKey="requests" name="Active Users" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Performing AI Tools (Pie Chart) */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6 flex flex-col">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-zinc-100">Top Performing AI Tools</h3>
              <Info className="w-3.5 h-3.5 text-zinc-600" />
           </div>
           <div className="flex-1 mt-auto h-[260px] w-full">
             <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
               <PieChart>
                 <Pie
                   data={mockToolDistribution}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                   stroke="none"
                 >
                   {mockToolDistribution.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }} 
                   itemStyle={{ fontSize: '0.75rem', fontWeight: 600 }}
                 />
                 <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }} />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Analytics Section */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-zinc-100">Bảng theo dõi người dùng & Token</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Tìm người dùng..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 rounded-xl focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none w-48 sm:w-64 transition-all" 
              />
            </div>
          </div>
        </div>

        {loadingUsers ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-zinc-400">Đang tải dữ liệu báo cáo...</p>
          </div>
        ) : (
          <div className="overflow-visible rounded-xl border border-zinc-800/50">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500 border-b border-zinc-800/80">
                <tr>
                  <th scope="col" className="px-6 py-4 font-semibold">Người dùng</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-center group relative cursor-help">
                    <div className="flex items-center justify-center gap-1.5">
                      Gọi API
                      <HelpCircle className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-normal normal-case leading-relaxed">
                      Tổng số lần người dùng này đã gọi API trong toàn bộ thời gian sử dụng.
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold group relative cursor-help">
                    <div className="flex items-center gap-1.5">
                      Token Khả Dụng (Hôm nay)
                      <HelpCircle className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </div>
                    <div className="absolute bottom-full left-0 mb-2 w-56 p-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-normal normal-case leading-relaxed">
                      Số đơn vị tính toán (Token) còn lại trong ngày. Hệ thống sẽ tự động cấp lại Token mới vào 00:00 mỗi ngày.
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold group relative cursor-help">
                    <div className="flex items-center gap-1.5">
                      Hạn Ngày
                      <HelpCircle className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </div>
                    <div className="absolute bottom-full left-0 mb-2 w-48 p-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-normal normal-case leading-relaxed">
                      Thời điểm tài khoản hết hiệu lực. Sau ngày này, tài khoản sẽ không thể thực hiện các thao tác tốn Token.
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 bg-zinc-900/40">
                {filteredUsers.map((user) => (
                  <React.Fragment key={user.uid}>
                    <tr 
                      className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedUser(expandedUser === user.uid ? null : user.uid)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                            {expandedUser === user.uid ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          {user.photoURL ? (
                            <img src={user.photoURL} className="w-8 h-8 rounded-full border border-zinc-700" alt={user.displayName} referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                              <Users className="w-4 h-4 text-zinc-500" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-zinc-200">{user.displayName}</div>
                            <div className="text-xs text-zinc-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-mono text-zinc-300">{user.apiCalls.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-[120px] bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${user.tokensLeft < 1000 ? 'bg-red-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.max(5, (user.tokensLeft / DAILY_FREE_TOKENS) * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-zinc-300 w-12">{user.tokensLeft.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        {user.tokenExpiration.toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4">
                        {user.status === 'active' && (
                          <div className="relative group inline-block">
                            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-xs font-medium cursor-help">Bình thường</span>
                            <div className="absolute bottom-full right-0 mb-2 w-56 p-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-right leading-relaxed">
                              Tài khoản hoạt động tốt. Số lượng Token dồi dào, hãy thoải mái sử dụng.
                            </div>
                          </div>
                        )}
                        {user.status === 'warning' && (
                          <div className="relative group inline-block">
                            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-xs font-medium cursor-help">Sắp hết hạn</span>
                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-right leading-relaxed">
                              Lượng Token hoặc hạn sử dụng sắp cạn. Hệ thống sẽ tự động hồi lại Token vào 00:00 ngày mai.
                            </div>
                          </div>
                        )}
                        {user.status === 'expired' && (
                          <div className="relative group inline-block">
                            <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-xs font-medium cursor-help">Hết Token</span>
                            <div className="absolute bottom-full right-0 mb-2 w-56 p-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-right leading-relaxed">
                              Tài khoản đã cạn kiệt Token hoặc quá hạn. Bạn sẽ không thể tiếp tục gọi API trong hôm nay.
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedUser === user.uid && (
                      <tr className="bg-zinc-900/80 border-t-0">
                        <td colSpan={5} className="px-14 py-6 border-b border-zinc-800/80">
                          <div className="flex items-center gap-2 mb-4">
                            <Info className="w-4 h-4 text-indigo-400" />
                            <h4 className="text-sm font-semibold text-zinc-200">Sức chứa khả dụng của {user.displayName}</h4>
                            <span className="ml-auto text-xs text-zinc-500">Giới hạn miễn phí mỗi ngày: <strong className="text-zinc-300">{DAILY_FREE_TOKENS.toLocaleString()} Token</strong></span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {TOOL_COSTS.map(tool => {
                              const usesLeft = Math.floor(user.tokensLeft / tool.cost);
                              const isDepleted = usesLeft <= 0;
                              
                              return (
                                <div key={tool.id} className="bg-zinc-800/40 border border-zinc-700/60 rounded-xl p-4 flex flex-col gap-2">
                                  <div className="flex justify-between items-start">
                                    <span className="font-medium text-zinc-300 text-sm leading-tight">{tool.label}</span>
                                    <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                                      {tool.cost} t/lần
                                    </span>
                                  </div>
                                  <div className="flex items-end gap-2 mt-auto pt-2">
                                    <span className={`text-2xl font-bold font-mono leading-none ${isDepleted ? 'text-red-400' : 'text-indigo-400'}`}>
                                      {isDepleted ? 0 : usesLeft.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-zinc-500 pb-0.5">lần dùng</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {filteredUsers.length === 0 && users.length > 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      Không tìm thấy người dùng nào phù hợp.
                    </td>
                  </tr>
                )}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      Chưa có dữ liệu người dùng.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity Panel */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6 flex flex-col lg:col-span-1">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-zinc-100">Lịch sử hoạt động</h3>
          <button className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">Xem tất cả</button>
        </div>
        
        <div className="space-y-4 flex-1">
           {[
             { id: 1, action: 'Standardized products', count: '50 products', time: '10 mins ago', status: 'Thành công', dotColor: 'bg-emerald-500' },
             { id: 2, action: 'Generated descriptions', count: '10 descriptions', time: '1 hr ago', status: 'Thành công', dotColor: 'bg-emerald-500' },
             { id: 3, action: 'Removed image backgrounds', count: '25 images', time: '3 hrs ago', status: 'Thành công', dotColor: 'bg-emerald-500' },
             { id: 4, action: 'Bulk Drive upload', count: '150 items', time: '5 hrs ago', status: 'Cảnh báo', dotColor: 'bg-amber-500' },
             { id: 5, action: 'Scraped product details', count: '120 products', time: '1 day ago', status: 'Thành công', dotColor: 'bg-indigo-500' },
           ].map((task) => (
              <div key={task.id} className="p-3 bg-zinc-800/40 border border-zinc-700/50 rounded-xl hover:border-zinc-600 transition-colors cursor-pointer group">
                 <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${task.dotColor}`}></div>
                      <h4 className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">{task.action}</h4>
                    </div>
                    <span className="text-[10px] text-zinc-500">{task.time}</span>
                 </div>
                 <div className="flex justify-between items-center ml-4">
                    <span className="text-[11px] text-zinc-400">{task.count}</span>
                    <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">{task.status}</span>
                 </div>
              </div>
           ))}
        </div>
      </div>

      {/* Recommended Tools Widget */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-6">
           <Star className="w-5 h-5 text-amber-400 fill-amber-400/20" />
           <h3 className="text-lg font-bold text-zinc-100">Công cụ Gợi ý cho bạn</h3>
           <span className="text-xs text-zinc-500 sm:ml-2 font-medium">Dựa trên lịch sử hoạt động gần đây</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           {[
             { id: 'bulk-frame', icon: LayoutGrid, name: 'Khung Ảnh Hàng Loạt', description: 'Gắn khung đồng loạt cho nhiều ảnh chỉ với 1 click', tag: 'Dùng nhiều nhất', heatColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
             { id: 'scraper', icon: DownloadCloud, name: 'Tải Ảnh Hàng Loạt', description: 'Tự động bóc tách ảnh từ link bất kỳ', tag: 'Dùng gần đây', heatColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
             { id: 'seo-desc', icon: Info, name: 'Tạo Mô tả Tự động', description: 'SEO content chuyên nghiệp với AI', tag: 'Đề xuất', heatColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
             { id: 'import-drive', icon: Zap, name: 'Import từ Google Drive', description: 'Scan folder tài nguyên tốc độ cao', tag: 'Mới cập nhật', heatColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
           ].map((tool) => (
              <div key={tool.id} className="group flex flex-col p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-xl hover:border-amber-500/30 hover:bg-zinc-800/80 hover:shadow-lg hover:shadow-amber-500/5 transition-all cursor-pointer">
                 <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:scale-110 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all shadow-inner">
                       <tool.icon className="w-5 h-5 text-zinc-400 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tool.heatColor}`}>
                       {tool.tag}
                    </span>
                 </div>
                 <h4 className="text-sm font-bold text-zinc-200 group-hover:text-amber-50 transition-colors mb-1.5">{tool.name}</h4>
                 <p className="text-xs text-zinc-400 mb-5 flex-1 leading-relaxed">{tool.description}</p>
                 <button className="flex items-center text-xs font-bold text-zinc-500 group-hover:text-amber-400 transition-colors mt-auto">
                    Mở công cụ <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0 transition-all font-bold" />
                 </button>
              </div>
           ))}
        </div>
      </div>
    </div>
  </div>
);
};

export default DashboardTab;
