import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import TextInput from './TextInput';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  guidelines: string;
}

const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  guidelines,
}) => {
  const [name, setName] = useState('');

  useEffect(() => {
    // Reset name when modal is opened
    if (isOpen) {
      setName('');
    }
  }, [isOpen]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      onClose(); // Close modal on save
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && name.trim()) {
      handleSave();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lưu Mẫu Nguyên tắc Mới">
      <div className="space-y-6">
        <div>
            <label htmlFor="templateName" className="block text-sm font-medium text-sky-300 mb-2">
                Tên Mẫu
            </label>
            <TextInput
                id="templateName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ví dụ: Tiêu chuẩn cho đồ công nghệ"
                autoFocus
            />
        </div>
        <div>
            <p className="block text-sm font-medium text-sky-300 mb-2">Nội dung xem trước</p>
            <div className="bg-zinc-900/70 border border-zinc-600 rounded-md p-3 text-zinc-300 text-sm max-h-40 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans">{guidelines}</pre>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row-reverse gap-4 mt-8">
          <Button onClick={handleSave} disabled={!name.trim()}>
            Lưu Mẫu
          </Button>
          <Button onClick={onClose} colorScheme="slate">
            Hủy
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SaveTemplateModal;