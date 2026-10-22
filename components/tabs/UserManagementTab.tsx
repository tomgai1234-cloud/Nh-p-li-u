import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { Shield, ShieldAlert, User as UserIcon, AlertCircle, Settings, X, Check } from 'lucide-react';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user' | 'blocked';
  allowedTabs?: string[];
  createdAt?: any;
  lastLogin?: any;
}

const MANAGEABLE_TABS = [
  { id: 'description', label: 'Tạo Mô tả' },
  { id: 'batch-frame', label: 'Tạo Khung Hàng Loạt' },
  { id: 'extractor', label: 'Lấy thuộc tính' },
  { id: 'standardizer', label: 'Chuẩn hóa Tên' },
  { id: 'image', label: 'Chỉnh sửa Ảnh' },
  { id: 'video-editor', label: 'Chỉnh sửa Video' },
  { id: 'scraper', label: 'Đào Ảnh' },
  { id: 'raw-scraper', label: 'Đào Ảnh (Tự động/Raw)' },
  { id: 'shopee-scraper', label: 'Đào Shopee' },
  { id: 'bulk-download', label: 'Tải Ảnh Hàng Loạt' },
  { id: 'converter', label: 'Chuyển đổi File' },
  { id: 'chatbot', label: 'Chatbot' }
];

const UserManagementTab: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [editingTabsUser, setEditingTabsUser] = useState<UserData | null>(null);
  const [tempTabs, setTempTabs] = useState<string[]>([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      // const snapshot = await getDocs(collection(db, 'users'));
      const snapshot: any[] = [];
      const activeUsers: UserData[] = [];
      snapshot.forEach(doc => {
        activeUsers.push({ uid: doc.id, ...doc.data() } as UserData);
      });
      setUsers(activeUsers.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.email.localeCompare(b.email);
      }));
    } catch (err: any) {
      console.error("Fetch users error:", err);
      setError('Lỗi lấy danh sách người dùng. Đảm bảo bạn có quyền Admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'user' | 'blocked') => {
    try {
      setActionLoading(uid);
      // await updateDoc(doc(db, 'users', uid), {
      //   role: newRole
      // });
      setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error("Error updating user role:", err);
      alert('Không thể thay đổi quyền. Bạn có chắc chắn mình là Admin?');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveTabs = async () => {
    if (!editingTabsUser) return;
    try {
      setActionLoading(editingTabsUser.uid);
      // await updateDoc(doc(db, 'users', editingTabsUser.uid), {
      //   allowedTabs: tempTabs
      // });
      setUsers(users.map(u => u.uid === editingTabsUser.uid ? { ...u, allowedTabs: tempTabs } : u));
      setEditingTabsUser(null);
    } catch (err) {
      console.error("Error updating tabs:", err);
      alert('Không thể lưu quyền. Đảm bảo bạn có quyền Admin.');
    } finally {
      setActionLoading(null);
    }
  };

  const openTabsModal = (user: UserData) => {
    setEditingTabsUser(user);
    if (user.allowedTabs) {
      setTempTabs(user.allowedTabs);
    } else {
      setTempTabs(MANAGEABLE_TABS.map(t => t.id)); // Default all if undefined
    }
  };

  const toggleTab = (tabId: string) => {
    setTempTabs(prev => 
      prev.includes(tabId) ? prev.filter(t => t !== tabId) : [...prev, tabId]
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    // Firestore timestamp
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleString('vi-VN');
    }
    return new Date(timestamp).toLocaleString('vi-VN');
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-sky-400" />
              Quản lý Phân quyền
            </h3>
            <p className="text-sm text-zinc-400 mt-1">Quản lý người dùng và cấp quyền sử dụng hệ thống</p>
          </div>
          <button 
            onClick={fetchUsers} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold rounded-xl transition-all"
          >
            Làm mới
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-sky-400">
            <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-zinc-400 font-medium">Đang tải danh sách người dùng...</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800/50 bg-[#0f0f0f]">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-[#141414] text-xs uppercase text-zinc-500 border-b border-zinc-800/80">
                <tr>
                  <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Người dùng</th>
                  <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Đăng nhập lần cuối</th>
                  <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Phân quyền</th>
                  <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Quyền Công Cụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {users.map((user) => (
                  <tr key={user.uid} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img src={user.photoURL} className="w-9 h-9 rounded-full border border-zinc-700" alt={user.displayName} referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                            <UserIcon className="w-4 h-4 text-zinc-500" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-zinc-200">{user.displayName}</div>
                          <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                            ID: <span className="font-mono">{user.uid.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-300">{user.email}</td>
                    <td className="px-6 py-4 text-xs text-zinc-500 whitespace-nowrap">
                      {formatDate(user.lastLogin)}
                    </td>
                    <td className="px-6 py-4">
                      {user.email === 'tungnguyen.0612993@gmail.com' ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg w-max text-xs font-bold uppercase tracking-wide">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Super Admin
                        </div>
                      ) : (
                        <select
                          value={user.role}
                          disabled={actionLoading === user.uid}
                          onChange={(e) => handleRoleChange(user.uid, e.target.value as 'admin' | 'user' | 'blocked')}
                          className={`
                            text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border outline-none
                            ${user.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : user.role === 'blocked' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-zinc-800/60 text-zinc-400 border-zinc-700'} 
                            focus:ring-2 focus:ring-sky-500/50
                            disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                          `}
                        >
                          <option value="user" className="bg-zinc-900 text-zinc-300">User</option>
                          <option value="admin" className="bg-zinc-900 text-indigo-400">Admin</option>
                          <option value="blocked" className="bg-zinc-900 text-red-400">Blocked</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.email !== 'tungnguyen.0612993@gmail.com' && user.role !== 'admin' && (
                        <button
                          onClick={() => openTabsModal(user)}
                          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700 hover:border-zinc-500"
                          title="Cấu hình Quyền Công Cụ"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      Chưa có người dùng nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabs Access Modal */}
      {editingTabsUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-zinc-100 mb-1">Thiết lập Quyền Công cụ</h3>
                <p className="text-sm text-zinc-400">
                  {editingTabsUser.displayName} <span className="opacity-60">({editingTabsUser.email})</span>
                </p>
              </div>
              <button 
                onClick={() => setEditingTabsUser(null)}
                className="p-2.5 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MANAGEABLE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => toggleTab(tab.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      tempTabs.includes(tab.id) 
                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                      tempTabs.includes(tab.id) 
                        ? 'bg-sky-500 border-sky-500 text-white' 
                        : 'bg-zinc-800 border-zinc-700 text-transparent'
                    }`}>
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium leading-tight">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800/80 flex items-center justify-end gap-3 shrink-0 bg-zinc-900/50 rounded-b-2xl">
              <button
                onClick={() => setEditingTabsUser(null)}
                className="px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-700 rounded-xl transition-all"
              >
                Hủy bỏ
              </button>
              <button
                disabled={actionLoading === editingTabsUser.uid}
                onClick={handleSaveTabs}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg shadow-sky-500/20"
              >
                {actionLoading === editingTabsUser.uid ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementTab;
