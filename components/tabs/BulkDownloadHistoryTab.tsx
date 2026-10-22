import React, { useState, useEffect } from 'react';
import { auth } from '../../src/firebase';
import Spinner from '../Spinner';
import { History } from 'lucide-react';
import { listHistory, subscribeToStore, STORE_NAMES } from '../../services/idbService';

const BulkDownloadHistoryTab: React.FC = () => {
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        setIsLoadingHistory(true);
        
        const loadData = async () => {
            try {
                let results = await listHistory(STORE_NAMES.BULK_DOWNLOADS, 50);
                if (auth.currentUser?.email !== 'tungnguyen.0612993@gmail.com') {
                    results = results.filter((item: any) => item.uid === auth.currentUser?.uid);
                }
                setHistoryList(results);
            } catch (err) {
                console.error("Error loading history:", err);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        loadData();
        const unsubscribe = subscribeToStore(STORE_NAMES.BULK_DOWNLOADS, loadData);
        return () => unsubscribe();
    }, [auth.currentUser]);

    return (
        <div className="max-w-7xl mx-auto space-y-8 w-full animate-fade-in">
            <div className="bg-zinc-800/40 p-6 rounded-2xl border border-zinc-700/50">
                <h2 className="text-xl font-bold text-sky-400 mb-4 flex items-center gap-2">
                    <History className="w-6 h-6" /> Lịch sử Tải ảnh hàng loạt
                </h2>
                
                {isLoadingHistory ? (
                    <div className="flex justify-center items-center py-12">
                        <Spinner className="w-8 h-8 text-sky-500" />
                    </div>
                ) : historyList.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-zinc-700/50 rounded-xl">
                        <History className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                        <p className="text-zinc-400">Bạn chưa thực hiện thao tác nào.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left border-collapse">
                            <thead className="text-xs text-zinc-400 uppercase tracking-wider bg-zinc-900/50 border-b border-zinc-700">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Thời gian</th>
                                    <th className="px-4 py-3 font-medium">Tài khoản</th>
                                    <th className="px-4 py-3 font-medium">Thao tác</th>
                                    <th className="px-4 py-3 font-medium text-center">Số lượng</th>
                                    <th className="px-4 py-3 font-medium">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-700/50">
                                {historyList.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-800/50 transition-colors group">
                                        <td className="px-4 py-3 text-zinc-300">
                                            {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sky-300 text-xs truncate max-w-[150px]" title={item.userEmail || 'N/A'}>
                                            {item.userEmail || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-300 font-medium truncate max-w-[200px]" title={item.actionType}>
                                            {item.actionType}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-green-400 font-bold">{item.details?.successCount || 0}</span> / <span className="text-zinc-400">{item.details?.totalCount || 0}</span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-400">
                                            {item.details?.format ? `Format: ${item.details.format}` : ''}
                                            {item.details?.provider ? `Provider: ${item.details.provider}` : ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkDownloadHistoryTab;
