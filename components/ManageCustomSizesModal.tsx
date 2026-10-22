import React, { useState } from 'react';
import type { CustomSizePreset } from '../types';
import Modal from './Modal';
import Button from './Button';
import TextInput from './TextInput';
import { Plus, GripVertical, Trash2 } from 'lucide-react';

interface ManageCustomSizesModalProps {
  onSave: (presets: CustomSizePreset[]) => void;
  isOpen: boolean;
  onClose: () => void;
  presets: CustomSizePreset[];
  onAdd?: (preset: Omit<CustomSizePreset, 'id'>) => void;
  onDelete?: (presetId: string) => void;
}

const ManageCustomSizesModal: React.FC<ManageCustomSizesModalProps> = ({
  isOpen,
  onClose,
  presets,
  onAdd,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [lockType, setLockType] = useState<'unlocked' | 'width-fixed' | 'height-fixed' | 'fixed-width'>('unlocked');

  const handleAdd = () => {
    const numWidth = parseInt(width, 10);
    const numHeight = parseInt(height, 10);
    if (name.trim() && !isNaN(numWidth) && numWidth > 0 && !isNaN(numHeight) && numHeight > 0) {
      onAdd({ name: name.trim(), width: numWidth, height: numHeight, lockType });
      setName('');
      setWidth('');
      setHeight('');
      setLockType('unlocked');
    }
  };

  const getLockStatusText = (type?: 'width-fixed' | 'height-fixed' | 'unlocked' | 'fixed-width') => {
    switch (type) {
        case 'width-fixed':
        case 'fixed-width':
             return '(Rộng CĐ)';
        case 'height-fixed': return '(Cao CĐ)';
        default: return '(Mở khóa)';
    }
  }

  const isAddDisabled = !name.trim() || !width.trim() || !height.trim();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Danh sách tùy chỉnh">
      <div className="space-y-6">
        <div className="p-4 bg-zinc-900/50 border border-zinc-700 rounded-lg space-y-3">
            <h4 className="font-semibold text-zinc-200 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Thêm tùy chỉnh kích thước
            </h4>
            <TextInput 
                placeholder="Tên, ví dụ: Size Youtube"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-3 gap-3">
                <TextInput 
                    type="number" 
                    placeholder="Rộng" 
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                />
                <TextInput 
                    type="number" 
                    placeholder="Cao"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                />
                 <select
                    value={lockType}
                    onChange={(e) => setLockType(e.target.value as any)}
                    className="w-full bg-zinc-900/70 border border-zinc-600 rounded-md py-2 px-3 text-zinc-200 placeholder-zinc-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition duration-200 text-sm"
                >
                    <option value="unlocked">Mở khóa</option>
                    <option value="width-fixed">Rộng Cố định</option>
                    <option value="fixed-width">Chiều rộng cố định</option>
                    <option value="height-fixed">Cao Cố định</option>
                </select>
            </div>
            <Button onClick={handleAdd} disabled={isAddDisabled} colorScheme="slate" className="!w-auto !px-4 !py-2 !text-sm">
                Thêm
            </Button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {presets.map((preset) => (
                <div key={preset.id} className="flex items-center justify-between p-3 bg-zinc-700/40 rounded-md">
                    <div className="flex items-center gap-3">
                        <GripVertical className="w-5 h-5 text-zinc-500 cursor-grab" />
                        <p className="text-zinc-300 text-sm">
                            {preset.name} ({preset.width} &times; {preset.height})
                            <span className="text-xs text-zinc-400 ml-2">{getLockStatusText(preset.lockType)}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="text-sm text-sky-400 hover:underline">Chỉnh sửa</button>
                        <button onClick={() => onDelete(preset.id)} className="text-sm text-red-400 hover:underline">Xóa</button>
                    </div>
                </div>
            ))}
            {presets.length === 0 && (
                <p className="text-center text-zinc-500 py-4">Chưa có tùy chỉnh nào được lưu.</p>
            )}
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-zinc-700">
            <Button onClick={onClose} colorScheme="ghost" className="!w-auto !px-6 !py-2">Hủy</Button>
            <Button onClick={onClose} colorScheme="primary" className="!w-auto !px-6 !py-2">Lưu</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ManageCustomSizesModal;