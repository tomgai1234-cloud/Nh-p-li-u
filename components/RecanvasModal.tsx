
import React from 'react';
import Modal from './Modal';
import Button from './Button';
import TextInput from './TextInput';


interface RecanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RecanvasModal: React.FC<RecanvasModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Canvas Size">
      <div className="space-y-4">
        <p className="text-slate-400">
          Adjust the canvas size around the image. This feature is currently under development.
        </p>
        <div className="flex gap-4">
            <div className="flex-1">
                <label htmlFor="recanvas-width" className="block text-sm font-medium text-sky-300 mb-2">Width</label>
                <TextInput id="recanvas-width" placeholder="2000" disabled />
            </div>
            <div className="flex-1">
                <label htmlFor="recanvas-height" className="block text-sm font-medium text-sky-300 mb-2">Height</label>
                <TextInput id="recanvas-height" placeholder="1200" disabled />
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

export default RecanvasModal;
