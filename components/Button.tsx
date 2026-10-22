
import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonProps = HTMLMotionProps<"button"> & {
    colorScheme?: 'sky' | 'green' | 'emerald' | 'slate' | 'zinc' | 'primary' | 'ghost' | 'red' | 'orange' | 'blue' | 'purple' | 'yellow' | 'cyan';
    isLoading?: boolean;
    isloading?: boolean;
    variant?: string;
    icon?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
};

const Button: React.FC<ButtonProps> = ({ children, className, colorScheme = 'sky', disabled, isLoading, isloading, variant, icon, size, ...props }) => {
  const baseClasses = "w-full inline-flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed";

  const colorClasses = {
      sky: 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500 text-white shadow-sky-900/20',
      green: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white shadow-emerald-900/20',
      emerald: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white shadow-emerald-900/20',
      slate: 'bg-zinc-600 hover:bg-zinc-500 focus:ring-zinc-500 text-white',
      zinc: 'bg-zinc-700 hover:bg-zinc-600 focus:ring-zinc-500 text-white shadow-zinc-900/20',
      primary: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white shadow-indigo-900/20',
      ghost: 'bg-transparent border-zinc-600 hover:bg-zinc-800 focus:ring-zinc-500 text-zinc-300 border',
      red: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white shadow-red-900/20',
      orange: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500 text-white shadow-orange-900/20',
      blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white shadow-blue-900/20',
      purple: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500 text-white shadow-purple-900/20',
      yellow: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 text-zinc-900 shadow-yellow-900/20',
      cyan: 'bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500 text-white shadow-cyan-900/20',
  }
  
  return (
    <motion.button
      whileHover={!disabled && !isLoading ? { scale: 1.02, filter: "brightness(1.1)" } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
      disabled={disabled || isLoading}
      {...props}
      className={`${baseClasses} ${colorClasses[colorScheme]} ${className || ''}`.trim()}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Đang xử lý...
        </>
      ) : children}
    </motion.button>
  );
};

export default Button;
