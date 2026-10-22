import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, Download } from 'lucide-react';
import Button from '../Button';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageCropperModalProps {
    isOpen: boolean;
    onClose: () => void;
    imgUrl: string;
    onSave: (croppedImgUrl: string) => void;
}

export default function ImageCropperModal({ isOpen, onClose, imgUrl, onSave }: ImageCropperModalProps) {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCrop(undefined);
            setCompletedCrop(undefined);
        }
    }, [isOpen, imgUrl]);

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        // Default crop to center, 80% size
        const crop = centerCrop(
            makeAspectCrop(
                {
                    unit: '%',
                    width: 80,
                },
                width / height,
                width,
                height
            ),
            width,
            height
        );
        setCrop(crop);
    }

    async function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = crop.width;
        canvas.height = crop.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('No 2d context');
        }

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width,
            crop.height
        );

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    console.error('Canvas is empty');
                    return;
                }
                const croppedUrl = URL.createObjectURL(blob);
                resolve(croppedUrl);
            }, 'image/jpeg', 1);
        });
    }

    const handleSave = async () => {
        if (completedCrop && imgRef.current && completedCrop.width > 0 && completedCrop.height > 0) {
            const croppedUrl = await getCroppedImg(imgRef.current, completedCrop);
            onSave(croppedUrl);
            onClose();
        } else {
            // If no crop was made, just return the original
            onSave(imgUrl);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
                    onClick={onClose}
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col relative z-10"
                >
                    <div className="flex justify-between items-center p-4 border-b border-zinc-800">
                        <h2 className="text-lg font-bold text-white">Chỉnh sửa ảnh</h2>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-zinc-950 min-h-[300px]">
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            className="max-w-full max-h-[60vh]"
                        >
                            <img
                                ref={imgRef}
                                alt="Crop me"
                                src={imgUrl}
                                onLoad={onImageLoad}
                                className="max-w-full max-h-[60vh] object-contain"
                                crossOrigin="anonymous"
                            />
                        </ReactCrop>
                    </div>
                    
                    <div className="p-4 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-900">
                        <Button type="button" onClick={onClose} variant="ghost">Hủy</Button>
                        <Button type="button" onClick={handleSave} colorScheme="blue">
                            <Check className="w-4 h-4 mr-2" />
                            Lưu ảnh (Crop)
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
