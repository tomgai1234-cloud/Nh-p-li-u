
import React, { useState, useEffect, useRef } from 'react';
import type { AttributeSet, AttributeDefinition } from '../../types';
import Modal from '../Modal';
import Button from '../Button';
import TextInput from '../TextInput';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface AttributeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (attributes: AttributeDefinition[], timeout: number, setName: string) => void;
  initialAttributes: AttributeDefinition[];
  initialTimeout: number;
}

const STORAGE_KEY = 'productExtractorSets_v2';

const DEFAULT_ATTRIBUTE_SETS: AttributeSet[] = [
    {
        id: 'default-1', name: 'Sản phẩm chống nắng', timeout: 30, attributes: [
            { name: 'Xuất xứ thương hiệu', type: 'free', values: '' },
            { name: 'Công dụng', type: 'fixed', values: 'Chống nắng cho body, Chống nắng cho mặt, Dưỡng ẩm' },
            { name: 'Chỉ số SPF/PA', type: 'fixed', values: '30 - 50, 50++, Dưới 30' },
            { name: 'Màu sắc', type: 'fixed', values: 'Không màu, Có màu' },
            { name: 'Loại da', type: 'fixed', values: 'Da thường, Da dầu, Da khô, Da hỗn hợp, Da nhạy cảm' },
            { name: 'Đối tượng', type: 'fixed', values: 'Người lớn, Trẻ em, Mẹ bầu' },
            { name: 'Loại hình', type: 'fixed', values: 'Vật lý, Hóa học, Thuần chay' },
            { name: 'Kết cấu', type: 'fixed', values: 'Dạng serum, Dạng gel, Dạng kem, Dạng sữa, Dạng xịt' },
            { name: 'Dung tích', type: 'free', values: '' },
            { name: 'Khối lượng', type: 'free', values: '' },
            { name: 'Bảo quản', type: 'free', values: '' },
            { name: 'Lưu ý', type: 'free', values: '' },
            { name: 'Thời hạn sử dụng', type: 'free', values: '' },
        ]
    },
    {
        id: 'default-2', name: 'Rửa mặt / Tẩy Trang', timeout: 30, attributes: [
            { name: 'Xuất xứ thương hiệu', type: 'free', values: '' },
            { name: 'Công dụng', type: 'free', values: '' },
            { name: 'Độ pH', type: 'free', values: '' },
            { name: 'Giới tính', type: 'fixed', values: 'Nam, Nữ, Unisex' },
            { name: 'Thành phần nổi bật', type: 'free', values: '' },
            { name: 'Loại da', type: 'fixed', values: 'Da nhạy cảm, Da khô, Da dầu, Da mụn, Mọi loại da' },
            { name: 'Kết cấu', type: 'fixed', values: 'Dạng gel, Dạng nước, Dạng dầu, Dạng sáp, Dạng sữa' },
            { name: 'Dung tích', type: 'free', values: '' },
            { name: 'Khối lượng', type: 'free', values: '' },
            { name: 'Bảo quản', type: 'free', values: '' },
            { name: 'Lưu ý', type: 'free', values: '' },
            { name: 'Thời hạn sử dụng', type: 'free', values: '' },
        ]
    },
    {
        id: 'default-3', name: 'Mặt nạ', timeout: 30, attributes: [
            { name: 'Xuất xứ thương hiệu', type: 'free', values: '' },
            { name: 'Công dụng', type: 'free', values: '' },
            { name: 'Loại da', type: 'fixed', values: 'Da nhạy cảm, Da khô, Da dầu, Da mụn, Mọi loại da' },
            { name: 'Loại hình', type: 'fixed', values: 'Dạng giấy, Dạng gel, Dạng bột, Mặt nạ đất sét' },
            { name: 'Vùng chuyên biệt', type: 'fixed', values: 'Mặt nạ mắt, Mặt nạ môi, Mặt nạ cổ' },
            { name: 'Dung tích', type: 'free', values: '' },
            { name: 'Khối lượng', type: 'free', values: '' },
            { name: 'Bảo quản', type: 'free', values: '' },
            { name: 'Lưu ý', type: 'free', values: '' },
            { name: 'Thời hạn sử dụng', type: 'free', values: '' },
        ]
    },
    {
        id: 'default-4', name: 'TPCN / Hỗ Trợ', timeout: 30, attributes: [
            { name: 'Xuất xứ thương hiệu', type: 'free', values: '' },
            { name: 'Công dụng', type: 'free', values: '' },
            { name: 'Bộ phận', type: 'fixed', values: 'Bổ sung chức năng gan, Bổ sung chức năng thận' },
            { name: 'Đối tượng', type: 'fixed', values: 'Trẻ em, Người lớn, Người cao tuổi, Mẹ bầu' },
            { name: 'Dung tích', type: 'free', values: '' },
            { name: 'Khối lượng', type: 'free', values: '' },
            { name: 'Bảo quản', type: 'free', values: '' },
            { name: 'Lưu ý', type: 'free', values: '' },
            { name: 'Thời hạn sử dụng', type: 'free', values: '' },
        ]
    },
    {
        id: 'default-5', name: 'Nước hoa', timeout: 30, attributes: [
            { name: 'Xuất xứ thương hiệu', type: 'free', values: '' },
            { name: 'Nhóm hương', type: 'free', values: '' },
            { name: 'Nồng độ', type: 'fixed', values: 'EDT (eau de toilette), EDP (eau de parfum)' },
            { name: 'Thời điểm', type: 'fixed', values: 'Mùa hè, Mùa đông, Mọi mùa' },
            { name: 'Giới tính', type: 'fixed', values: 'Nam, Nữ, Unisex' },
            { name: 'Loại', type: 'fixed', values: 'Combo nước hoa, Nước hoa dạng lăn, Nước hoa niche' },
            { name: 'Dung tích', type: 'free', values: '' },
            { name: 'Bảo quản', type: 'free', values: '' },
            { name: 'Lưu ý', type: 'free', values: '' },
            { name: 'Thời hạn sử dụng', type: 'free', values: '' },
        ]
    },
    {
        id: 'default-6', name: 'Thiết Bị Chăm Sóc Cá Nhân', timeout: 30, attributes: [
            { name: 'Xuất xứ thương hiệu', type: 'free', values: '' },
            { name: 'Giới tính phù hợp', type: 'fixed', values: 'Nam, Nữ, Unisex' },
            { name: 'Phân loại', type: 'fixed', values: 'Máy sấy tóc, máy ép, máy massage, máy cạo râu' },
            { name: 'Công suất', type: 'free', values: '' },
            { name: 'Khối lượng', type: 'free', values: '' },
            { name: 'Kích thước', type: 'free', values: '' },
        ]
    },
    {
        id: 'default-7', name: 'Cải thiện Môi trường sống', timeout: 30, attributes: [
            { name: 'Xuất xứ thương hiệu', type: 'free', values: '' },
            { name: 'Model', type: 'free', values: '' },
            { name: 'Màu sắc', type: 'free', values: '' },
            { name: 'Công suất (W)', type: 'free', values: '' },
            { name: 'Diện tích sử dụng phù hợp', type: 'free', values: '' },
            { name: 'Khu vực sử dụng', type: 'fixed', values: 'Phòng khách, Phòng bếp, Phòng ngủ, Phòng vệ sinh, Ngoài trời' },
            { name: 'Độ ồn hoạt động (dB)', type: 'free', values: '' },
            { name: 'Tính năng', type: 'free', values: '' },
            { name: 'Công nghệ', type: 'free', values: '' },
            { name: 'Loại điều khiển', type: 'fixed', values: 'Điều khiển từ xa, Cơ học' },
            { name: 'Kích thước', type: 'free', values: '' },
            { name: 'Khối lượng', type: 'free', values: '' },
            { name: 'Nguồn điện', type: 'free', values: '' },
        ]
    },
];

const AttributeConfigModal: React.FC<AttributeConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAttributes,
  initialTimeout,
}) => {
  const [attributeSets, setAttributeSets] = useState<AttributeSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const [setName, setSetName] = useState<string>('');
  const [currentAttributes, setCurrentAttributes] = useState<AttributeDefinition[]>([]);
  // FIX: Rename 'timeout' to 'timeoutValue' and 'setTimeout' to 'setTimeoutValue' 
  // to avoid shadowing the global window.setTimeout function, which can cause 
  // unexpected behavior or React Error #310 if called incorrectly.
  const [timeoutValue, setTimeoutValue] = useState<string>(String(initialTimeout));
  const [newValue, setNewValue] = useState('');
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const savedSetsJSON = localStorage.getItem(STORAGE_KEY);
        const savedSets = savedSetsJSON ? JSON.parse(savedSetsJSON) : [];
        const combinedSets = [...DEFAULT_ATTRIBUTE_SETS, ...savedSets];
        const uniqueSets = Array.from(new Map(combinedSets.map(item => [item.id, item])).values());
        setAttributeSets(uniqueSets);
      } catch (e) {
        console.error("Failed to load attribute sets from storage", e);
        setAttributeSets(DEFAULT_ATTRIBUTE_SETS);
      }
      setCurrentAttributes(initialAttributes);
      setTimeoutValue(String(initialTimeout));
      setSelectedSetId('');
      setSetName('');
    }
  }, [isOpen, initialAttributes, initialTimeout]);

  const handleSetSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const setId = e.target.value;
    setSelectedSetId(setId);
    const selected = attributeSets.find(s => s.id === setId);
    if (selected) {
      setCurrentAttributes(selected.attributes);
      setTimeoutValue(String(selected.timeout));
      setSetName(selected.name);
    } else {
        setSetName('');
    }
  };

  const handleSaveSet = () => {
    if (!setName.trim() || currentAttributes.length === 0) return;

    const customSets = attributeSets.filter(s => !s.id.startsWith('default-'));
    const existingSetIndex = customSets.findIndex(s => s.name.toLowerCase() === setName.trim().toLowerCase());
    
    const newSet: AttributeSet = {
      id: existingSetIndex > -1 ? customSets[existingSetIndex].id : String(Date.now()),
      name: setName.trim(),
      attributes: currentAttributes,
      timeout: Number(timeoutValue) || 30,
    };

    let updatedCustomSets;
    if (existingSetIndex > -1) {
        updatedCustomSets = customSets.map(s => s.id === newSet.id ? newSet : s);
    } else {
        updatedCustomSets = [...customSets, newSet];
    }
    
    setAttributeSets([...DEFAULT_ATTRIBUTE_SETS, ...updatedCustomSets]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustomSets));
    setSelectedSetId(newSet.id);
  };
  
  const handleDeleteSet = () => {
    if (!selectedSetId || selectedSetId.startsWith('default-')) return;
    if (window.confirm(`Bạn có chắc muốn xóa bộ thuộc tính "${setName}" không?`)) {
        const updatedSets = attributeSets.filter(s => s.id !== selectedSetId);
        const updatedCustomSets = updatedSets.filter(s => !s.id.startsWith('default-'));
        setAttributeSets(updatedSets);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCustomSets));
        setSelectedSetId('');
        setSetName('');
        setCurrentAttributes([]);
    }
  };


  const handleDone = () => {
    const matchingSet = attributeSets.find(s => JSON.stringify(s.attributes) === JSON.stringify(currentAttributes));
    const finalSetName = matchingSet ? matchingSet.name : '';
    onSave(currentAttributes, Number(timeoutValue) || 30, finalSetName);
  };
  
  const handleAddAttribute = () => {
    setCurrentAttributes([...currentAttributes, { name: '', type: 'free', values: '' }]);
  };
  
  const handleRemoveAttribute = (index: number) => {
    setCurrentAttributes(currentAttributes.filter((_, i) => i !== index));
  };

  const handleAttributeChange = (index: number, field: keyof AttributeDefinition, value: string) => {
    const updated = [...currentAttributes];
    updated[index] = { ...updated[index], [field]: value };
    setCurrentAttributes(updated);
  };

  const handleAddValue = (attrIndex: number) => {
    if (newValue.trim()) {
      const updated = [...currentAttributes];
      const currentValues = updated[attrIndex].values ? updated[attrIndex].values!.split(',').map(v => v.trim()) : [];
      if (!currentValues.includes(newValue.trim())) {
        currentValues.push(newValue.trim());
        updated[attrIndex].values = currentValues.join(', ');
        setCurrentAttributes(updated);
      }
      setNewValue('');
    }
  };

  const handleRemoveValue = (attrIndex: number, valueToRemove: string) => {
    const updated = [...currentAttributes];
    const currentValues = updated[attrIndex].values!.split(',').map(v => v.trim());
    updated[attrIndex].values = currentValues.filter(v => v !== valueToRemove).join(', ');
    setCurrentAttributes(updated);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (index: number) => {
    if (dragIndexRef.current === null || dragIndexRef.current === index) {
      return;
    }
    const newAttributes = [...currentAttributes];
    const draggedItem = newAttributes[dragIndexRef.current];
    newAttributes.splice(dragIndexRef.current, 1);
    newAttributes.splice(index, 0, draggedItem);
    setCurrentAttributes(newAttributes);
    dragIndexRef.current = index;
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cấu hình thuộc tính">
      <div className="space-y-6">
        {/* Manage Sets */}
        <div className="p-4 bg-zinc-900/50 border border-zinc-700 rounded-lg space-y-3">
          <h4 className="font-semibold text-zinc-200">Quản lý bộ thuộc tính</h4>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
            <select
              value={selectedSetId}
              onChange={handleSetSelection}
              className="w-full bg-zinc-900/70 border border-zinc-600 rounded-md py-2 px-3 text-zinc-200 placeholder-zinc-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition duration-200"
            >
              <option value="">-- Tìm hoặc chọn một bộ... --</option>
              {attributeSets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={handleDeleteSet} disabled={!selectedSetId || selectedSetId.startsWith('default-')} className="h-10 w-10 flex items-center justify-center bg-zinc-700 hover:bg-red-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Xóa bộ đã chọn">
              <Trash2 className="w-5 h-5 text-zinc-300" />
            </button>
          </div>
           <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                <TextInput 
                    value={setName}
                    onChange={(e) => setSetName(e.target.value)}
                    placeholder="Lưu hoặc cập nhật bộ với tên"
                    aria-label="Tên bộ thuộc tính"
                />
                 <Button onClick={handleSaveSet} disabled={!setName.trim()} className="!py-2 !h-10">Lưu</Button>
            </div>
        </div>
        
        {/* Attributes Input */}
        <div className="p-4 bg-zinc-900/50 border border-zinc-700 rounded-lg space-y-3">
            <h4 className="font-semibold text-zinc-200">Các thuộc tính cần trích xuất</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 -mr-2">
                {currentAttributes.map((attr, index) => (
                    <div 
                        key={`${attr.name}-${index}`} 
                        className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-md space-y-2 relative group"
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={() => handleDragEnter(index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                    >
                        <div className="grid grid-cols-[auto_1fr_100px_auto] gap-2 items-center">
                            <div className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300 p-1">
                                <GripVertical className="w-5 h-5" />
                            </div>
                            <TextInput 
                                placeholder="Tên thuộc tính"
                                value={attr.name}
                                onChange={e => handleAttributeChange(index, 'name', e.target.value)}
                            />
                            <select 
                                value={attr.type}
                                onChange={e => handleAttributeChange(index, 'type', e.target.value)}
                                className="bg-zinc-900/70 border border-zinc-600 rounded-md py-2 px-3 text-sm text-zinc-200 focus:ring-2 focus:ring-sky-500 outline-none"
                            >
                                <option value="free">Tự do</option>
                                <option value="fixed">Cố định</option>
                            </select>
                            <button onClick={() => handleRemoveAttribute(index)} className="p-2 text-zinc-500 hover:text-red-400">
                                <Trash2 className="w-5 h-5"/>
                            </button>
                        </div>
                         {attr.type === 'fixed' && (
                            <div className="pl-8 col-span-4 space-y-2">
                                <div className="flex gap-2">
                                    <TextInput 
                                        placeholder="Thêm một giá trị cố định"
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddValue(index)}
                                    />
                                    <Button onClick={() => handleAddValue(index)} className="!w-auto !px-4 !py-2 !text-sm">Thêm</Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(attr.values || '').split(',').map(v => v.trim()).filter(Boolean).map((val) => (
                                        <div key={val} className="flex items-center gap-1 bg-sky-800/50 text-sky-200 text-xs px-2 py-1 rounded-full">
                                            <span>{val}</span>
                                            <button onClick={() => handleRemoveValue(index, val)} className="text-sky-300 hover:text-white">&times;</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <Button onClick={handleAddAttribute} colorScheme="slate" className="!w-auto !py-1 !px-3 !text-sm">
                <Plus className="w-4 h-4 mr-1"/>
                Thêm thuộc tính
            </Button>
        </div>

        {/* Advanced Settings */}
        <div className="p-4 bg-zinc-900/50 border border-zinc-700 rounded-lg space-y-3">
            <h4 className="font-semibold text-zinc-200">Cài đặt nâng cao</h4>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <label htmlFor="timeout" className="text-sm text-zinc-300 flex-shrink-0">Thời gian chờ AI (giây)</label>
                <TextInput
                    id="timeout"
                    type="number"
                    value={timeoutValue}
                    onChange={e => setTimeoutValue(e.target.value)}
                    className="w-full sm:w-24"
                />
            </div>
             <p className="text-xs text-zinc-500">Thời gian tối đa để chờ AI phản hồi cho mỗi mục. Tăng giá trị này nếu bạn gặp lỗi hết thời gian chờ với các sản phẩm phức tạp.</p>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleDone} className="!w-auto !px-8 !py-2.5">Xong</Button>
        </div>
      </div>
    </Modal>
  );
};

export default AttributeConfigModal;
