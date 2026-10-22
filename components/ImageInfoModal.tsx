import React from 'react';
import Modal from './Modal';
import type { ImageState } from '../types';

interface ImageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: ImageState | null;
}

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatMimeType = (mimeType: string): string => {
    const parts = mimeType.split('/');
    if (parts.length === 2) {
        return parts[1].toUpperCase();
    }
    return mimeType;
}

const InfoRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-3 border-b border-zinc-700 last:border-b-0">
    <dt className="text-sm font-medium text-zinc-400">{label}</dt>
    <dd className="text-sm text-zinc-200 font-mono text-right break-all">{value}</dd>
  </div>
);

const ImageInfoModal: React.FC<ImageInfoModalProps> = ({ isOpen, onClose, image }) => {
  if (!image) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thông tin Ảnh">
      <div className="space-y-4">
        <dl>
            <InfoRow label="Tên tệp" value={image.file.name} />
            <InfoRow label="Độ phân giải" value={`${image.dimensions.width} x ${image.dimensions.height} px`} />
            <InfoRow label="Kích thước tệp" value={formatBytes(image.file.size)} />
            <InfoRow label="Định dạng" value={formatMimeType(image.file.type)} />
        </dl>
        <div className="pt-4">
            <img src={image.url} alt="Preview" className="max-w-full max-h-64 object-contain mx-auto rounded-md" />
        </div>
      </div>
    </Modal>
  );
};

export default ImageInfoModal;