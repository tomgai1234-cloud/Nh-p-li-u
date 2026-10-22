
import React from 'react';
import Modal from './Modal';
import Button from './Button';
import TextInput from './TextInput';

interface ResizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ResizeModal: React.FC<ResizeModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resize Image">
      <div className="space-y-4">
        <p className="text-slate-400">
          Specify new dimensions for the image. This feature is currently under development.
        </p>
        <div className="flex gap-4">
            <div className="flex-1">
                <label htmlFor="resize-width" className="block text-sm font-medium text-sky-300 mb-2">Width</label>
                <TextInput id="resize-width" placeholder="1920" disabled />
            </div>
            <div className="flex-1">
                <label htmlFor="resize-height" className="block text-sm font-medium text-sky-300 mb-2">Height</label>
                <TextInput id="resize-height" placeholder="1080" disabled />
            </div>
        </div>
        <div className="flex justify-end gap-4 pt-4">
            <Button onClick={onClose} colorScheme="slate">Cancel</Button>
            <Button onClick={onClose} disabled>Apply</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ResizeModal;
