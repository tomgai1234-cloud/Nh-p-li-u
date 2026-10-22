import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import TextInput from './TextInput';
import type { ImageState } from '../types';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (options: { format: 'png' | 'jpeg' | 'webp'; quality: number; filename: string }) => void;
  image: ImageState | null;
  imageCount: number;
}

const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose, onSave, image, imageCount }) => {
  const [filename, setFilename] = useState('');
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('jpeg');
  const [quality, setQuality] = useState(90);

  useEffect(() => {
    if (image?.file.name) {
      // Loại bỏ phần mở rộng cũ trước khi đề xuất phần mở rộng mới
      const nameWithoutExtension = image.file.name.split('.').slice(0, -1).join('.');
      setFilename(nameWithoutExtension);
    }
  }, [image, isOpen]);

  const handleSave = () => {
    if (filename.trim() && image) {
      onSave({ format, quality: quality / 100, filename: filename.trim() });
      onClose();
    }
  };

  const FormatButton: React.FC<{ value: 'png' | 'jpeg' | 'webp'; label: string }> = ({ value, label }) => (
    <button
      onClick={() => setFormat(value)}
      className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
        format === value
          ? 'bg-sky-600 text-white'
          : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700'
      }`}
    >
      {label}
    </button>
  );
  
  const modalTitle = imageCount > 1 ? `Lưu ${imageCount} Ảnh` : 'Lưu Ảnh';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-6">
        <div>
          <label htmlFor="filename" className="block text-sm font-medium text-sky-300 mb-2">
            {imageCount > 1 ? 'Tiền tố tên tệp' : 'Tên tệp'}
          </label>
          <div className="flex items-center">
            <TextInput
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="ten_anh_cua_ban"
              className={imageCount <= 1 ? "rounded-r-none" : ""}
            />
            {imageCount <= 1 && (
                <span className="inline-flex items-center px-3 text-sm text-zinc-300 bg-zinc-700 border border-l-0 border-zinc-600 rounded-r-md h-[42px]">
                .{format === 'jpeg' ? 'jpg' : format}
                </span>
            )}
          </div>
           {imageCount > 1 && (
            <p className="text-xs text-zinc-400 mt-2">
                Các tệp sẽ được lưu với tên như <code>{filename || 'tiền_tố'}-1.jpg</code>, <code>{filename || 'tiền_tố'}-2.jpg</code>, ...
            </p>
          )}
        </div>

        <div>
            <label className="block text-sm font-medium text-sky-300 mb-2">
                Định dạng
            </label>
            <div className="flex items-center gap-2 p-1 bg-zinc-900/50 rounded-lg">
                <FormatButton value="jpeg" label="JPG" />
                <FormatButton value="png" label="PNG" />
                <FormatButton value="webp" label="WebP" />
            </div>
        </div>

        {format !== 'png' && (
            <div>
                 <div className="flex justify-between items-center mb-2">
                    <label htmlFor="quality" className="text-sm font-medium text-sky-300">
                        Chất lượng
                    </label>
                    <span className="text-sm font-mono text-sky-300 bg-zinc-700/50 px-2 py-0.5 rounded-md">{quality}</span>
                </div>
                <input
                    id="quality"
                    type="range"
                    min="1"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-sky-500 [&::-moz-range-thumb]:rounded-full"
                />
            </div>
        )}
        
        <div className="flex flex-col sm:flex-row-reverse gap-4 pt-4 border-t border-zinc-700">
          <Button onClick={handleSave} disabled={!filename.trim() || imageCount === 0}>
            Lưu
          </Button>
          <Button onClick={onClose} colorScheme="slate">
            Hủy
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SaveModal;