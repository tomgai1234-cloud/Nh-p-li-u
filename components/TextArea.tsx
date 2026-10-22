
import React from 'react';

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const TextArea: React.FC<TextAreaProps & { isLoading?: boolean; isloading?: boolean }> = ({ isLoading, isloading, ...props }) => {
  return (
    <textarea
      {...props}
      className="w-full bg-zinc-900/70 border border-zinc-600 rounded-md py-2 px-3 text-zinc-200 placeholder-zinc-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
};

export default TextArea;