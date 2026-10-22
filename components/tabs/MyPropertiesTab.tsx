import React from 'react';
import { Settings2 } from 'lucide-react';

const MyPropertiesTab: React.FC = () => {
  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="bg-zinc-800/50 p-6 sm:p-8 rounded-2xl border border-zinc-700 text-center">
        <Settings2 className="w-12 h-12 text-sky-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-zinc-100">Thuộc tính của tôi</h1>
        <p className="text-zinc-400 mt-2">
          Khu vực này dành cho việc quản lý các thuộc tính và cài đặt của bạn.
        </p>
        <div className="mt-6 text-left prose prose-invert prose-zinc max-w-none text-zinc-300 space-y-4">
            <p>
                Hiện tại, chức năng này đang được phát triển. Trong tương lai, bạn sẽ có thể:
            </p>
            <ul>
                <li>Xem thông tin tài khoản của bạn.</li>
                <li>Tùy chỉnh các cài đặt mặc định cho ứng dụng.</li>
                <li>Quản lý các mẫu và dữ liệu đã lưu một cách tập trung.</li>
            </ul>
        </div>
      </div>
    </div>
  );
};

export default MyPropertiesTab;