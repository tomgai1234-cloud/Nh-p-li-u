
import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  onReorder: (dragIndex: number, hoverIndex: number) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, setActiveTab, onReorder }) => {
  const dragIndexRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (scrollContainerRef.current) {
        const activeElement = scrollContainerRef.current.querySelector(`[data-tab-id="${activeTab}"]`);
        if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
  }, [activeTab]);

  // Mouse Wheel Horizontal Scroll
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const onWheel = (e: WheelEvent) => {
        if (e.deltaY === 0) return;
        // Check if content overflows
        if (el.scrollWidth > el.clientWidth) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        }
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }
  }, []);

  // Drag to Scroll Logic
  const handleMouseDown = (e: React.MouseEvent) => {
      if (!scrollContainerRef.current) return;
      
      setIsDragging(true);
      setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
      setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
      setIsDragging(false);
  };

  const handleMouseUp = () => {
      setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !scrollContainerRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollContainerRef.current.offsetLeft;
      const walk = (x - startX) * 1.5; // Scroll-fast
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Drag and Drop Sort Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    // Set effect allowed
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (index: number) => {
    if (dragIndexRef.current === null || dragIndexRef.current === index) {
      return;
    }
    onReorder(dragIndexRef.current, index);
    dragIndexRef.current = index;
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="w-full">
        <div 
            ref={scrollContainerRef}
            className={`
                flex items-center gap-2 overflow-x-auto p-2 bg-zinc-800/40 backdrop-blur-md border border-zinc-700/50 rounded-2xl no-scrollbar select-none
                ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
            `}
            style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
            }}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
        >
            <AnimatePresence initial={false}>
                {tabs.map((tab, index) => {
                    const isActive = activeTab === tab.id;
                    
                    return (
                        <motion.div
                            key={tab.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="relative flex-shrink-0"
                            data-tab-id={tab.id}
                        >
                            <div
                                draggable={!isDragging} // Disable item dragging if we are container dragging
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragEnter={() => handleDragEnter(index)}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                className="relative z-20"
                            >
                                <button
                                    onClick={() => !isDragging && setActiveTab(tab.id)}
                                    className={`
                                        relative z-10 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 outline-none
                                        ${isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}
                                    `}
                                >
                                    <span className={`relative z-10 transition-colors duration-200 ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                                        {tab.icon}
                                    </span>
                                    <span className="relative z-10 whitespace-nowrap">
                                        {tab.label}
                                    </span>
                                    
                                    {/* Hover effect for non-active tabs */}
                                    {!isActive && (
                                        <div className="absolute inset-0 rounded-xl bg-zinc-700/0 hover:bg-zinc-700/30 transition-colors duration-200" />
                                    )}
                                </button>
                            </div>

                            {/* Active Tab Background Indicator */}
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabBackground"
                                    className="absolute inset-0 bg-gradient-to-br from-sky-600 to-sky-500 rounded-xl shadow-lg shadow-sky-900/20 z-10"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                />
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    </div>
  );
};

export default Tabs;
