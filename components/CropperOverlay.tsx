import React from 'react';
import type { Crop } from '../types';

interface CropperOverlayProps {
  crop: Crop;
  imageDimensions: { width: number; height: number };
  containerDimensions: { width: number; height: number };
}

const CropperOverlay: React.FC<CropperOverlayProps> = ({ crop, imageDimensions, containerDimensions }) => {
  if (!crop || !imageDimensions || !containerDimensions) return null;

  const scaleX = containerDimensions.width / imageDimensions.width;
  const scaleY = containerDimensions.height / imageDimensions.height;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${crop.x * scaleX}px`,
    top: `${crop.y * scaleY}px`,
    width: `${crop.width * scaleX}px`,
    height: `${crop.height * scaleY}px`,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
    border: '1px solid white',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  };

  return <div style={style} />;
};

export default CropperOverlay;
