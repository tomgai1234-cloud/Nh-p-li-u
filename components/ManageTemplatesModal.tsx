import React, { useState } from 'react';
import type { CustomTemplate } from '../types';
import Modal from './Modal';
import Button from './Button';
import TextInput from './TextInput';
import { Trash2, FolderKanban, Plus, Save, Search } from 'lucide-react';

interface ManageTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: CustomTemplate[];
  onLoad: (template: CustomTemplate) => void;
  onDelete: (templateId: string) => void;
  onSave: (name: string) => void;
  currentGuidelines: string;
}

const ManageTemplatesModal: React.FC<ManageTemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  onLoad,
  onDelete,
  onSave,
  currentGuidelines,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSave = () => {
    if (newTemplateName.trim()) {
      onSave(newTemplateName.trim());
      setNewTemplateName('');
      setIsAdding(false);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quản lý Mẫu Nguyên tắc">
      <div className="space-y-6">
        {/* Save Current Guidelines Section */}
        <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-4">
          {!isAdding ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-sky-400">Lưu Nguyên tắc Hiện tại</h4>
                <p className="text-xs text-zinc-400 mt-1">Lưu nội dung bạn đang soạn thảo thành một mẫu mới.</p>
              </div>
              <Button 
                onClick={() => setIsAdding(true)} 
                disabled={!currentGuidelines.trim()}
                className="!w-auto !px-4 !py-2 !text-sm"
              >
                <Plus className="w-4 h-4 mr-2" /> Lưu Mẫu Mới
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-sky-400">Tên Mẫu Mới</h4>
                <button onClick={() => setIsAdding(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Hủy</button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextInput
                    id="newTemplateName"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Nhập tên cho mẫu này..."
                    className="!py-1.5"
                    autoFocus
                  />
                </div>
                <Button 
                  onClick={handleSave} 
                  disabled={!newTemplateName.trim()}
                  className="!w-auto !px-4 !py-2 !text-sm"
                >
                  <Save className="w-4 h-4 mr-2" /> Lưu
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Templates List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-zinc-500" />
              Danh sách Mẫu đã lưu ({templates.length})
            </h4>
            {templates.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text"
                  placeholder="Tìm kiếm..."
                  className="bg-zinc-900 border border-zinc-700 rounded-lg py-1 pl-8 pr-3 text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-sky-500/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <FolderKanban className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="text-zinc-400 text-sm">Bạn chưa lưu mẫu nào.</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[240px] mx-auto">
                Mẫu giúp bạn tái sử dụng các nguyên tắc viết mô tả cho các dòng sản phẩm khác nhau.
              </p>
            </div>
          ) : (
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
              <ul className="space-y-2">
                {(searchQuery ? filteredTemplates : templates).map((template) => (
                  <li
                    key={template.id}
                    className="group flex justify-between items-center p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-sky-500/30 hover:bg-sky-500/5 transition-all"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-200 truncate text-sm" title={template.name}>
                          {template.name}
                        </p>
                        <span className="text-[10px] text-zinc-600">ID: {template.id.slice(0, 8)}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1 italic">
                        {template.content.slice(0, 100)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button 
                        onClick={() => onLoad(template)} 
                        className="!w-auto !px-3 !py-1 !text-[11px] font-bold h-7"
                        colorScheme="sky"
                      >
                        Tải Mẫu
                      </Button>
                      <button
                        onClick={() => onDelete(template.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                        aria-label={`Xóa mẫu ${template.name}`}
                        title="Xóa mẫu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {searchQuery && filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  Không tìm thấy mẫu nào khớp với "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
        <Button onClick={onClose} colorScheme="slate" className="!w-auto !px-6 !py-2 !text-sm">
          Đóng
        </Button>
      </div>
    </Modal>
  );
};

export default ManageTemplatesModal;