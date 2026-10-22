import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { Chat } from '@google/genai';
import { startChat } from '../services/geminiService';
import type { ChatMessage } from '../types';
import { MessageSquare, Sparkles, Send, Trash2, X, Paperclip, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GlobalChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachment, setAttachment] = useState<{ name: string, data: string, mimeType: string } | null>(null);
    const [useHighThinking, setUseHighThinking] = useState(false);
    const chatInstance = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const saved = localStorage.getItem('global_chatbot_history');
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch (e) {
                setMessages([{ type: 'bot', text: 'Xin chào! Tôi là trợ lý AI. Tôi có thể giúp bạn hiểu cách sử dụng các tính năng trong hệ thống.' }]);
            }
        } else {
            setMessages([{ type: 'bot', text: 'Xin chào! Tôi có thể giúp bạn hiểu cách làm hoặc cách hoạt động của một công cụ cụ thể.' }]);
        }
        chatInstance.current = startChat(useHighThinking);
    }, []);

    useEffect(() => {
        // Re-initialize chat if the thinking level toggles
        chatInstance.current = startChat(useHighThinking);
    }, [useHighThinking]);

    useEffect(() => {
        localStorage.setItem('global_chatbot_history', JSON.stringify(messages));
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = (event.target?.result as string).split(',')[1];
            setAttachment({
                name: file.name,
                data: base64String,
                mimeType: file.type || 'application/octet-stream'
            });
        };
        reader.readAsDataURL(file);
        
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && !attachment) || isLoading) return;

        const messageText = input.trim() || (attachment ? `[Đã gửi file: ${attachment.name}]` : '');
        const userMessage: ChatMessage = { type: 'user', text: messageText };
        setMessages(prev => [...prev, userMessage]);
        
        const currentInput = input;
        const currentAttachment = attachment;
        
        setInput('');
        setAttachment(null);
        setIsLoading(true);

        try {
            if (!chatInstance.current) {
                chatInstance.current = startChat(useHighThinking);
            }

            let response;
            if (currentAttachment) {
                // If there's an attachment, we send parts
                const parts: any[] = [];
                if (currentInput.trim()) {
                    parts.push({ text: currentInput });
                } else {
                    parts.push({ text: "Hãy phân tích file đính kèm này." });
                }
                
                parts.push({
                    inlineData: {
                        mimeType: currentAttachment.mimeType,
                        data: currentAttachment.data
                    }
                });
                
                response = await chatInstance.current.sendMessage({ message: parts });
            } else {
                response = await chatInstance.current.sendMessage({ message: currentInput });
            }

            const botMessage: ChatMessage = { type: 'bot', text: response.text };
            setMessages(prev => [...prev, botMessage]);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Đã có lỗi xảy ra.';
            const systemMessage: ChatMessage = { type: 'system', text: `Lỗi: ${errorMessage}` };
            setMessages(prev => [...prev, systemMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = () => {
        if(window.confirm('Bạn có chắc muốn xóa toàn bộ đoạn chat?')) {
            setMessages([{ type: 'bot', text: 'Xin chào! Tôi có thể giúp bạn hiểu cách làm hoặc cách hoạt động của một công cụ cụ thể.' }]);
            chatInstance.current = startChat(useHighThinking);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl mb-4 w-[380px] h-[550px] max-h-[80vh] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-sky-900/30 rounded-lg">
                                    <Sparkles className="w-5 h-5 text-sky-400" />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-bold text-zinc-100">AI Trợ Lý</h3>
                                    <p className="text-[11px] text-zinc-400">Hỏi tôi cách dùng công cụ</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => setUseHighThinking(!useHighThinking)} 
                                    className={`p-2 rounded-lg transition-colors ${useHighThinking ? 'text-purple-400 bg-purple-500/20' : 'text-zinc-500 hover:text-purple-400 hover:bg-zinc-800'}`} 
                                    title={useHighThinking ? "Tắt chế độ Suy luận Cao" : "Bật chế độ Suy luận Cao (Gemini Pro)"}
                                >
                                    <Brain className="w-4 h-4" />
                                </button>
                                <button onClick={handleClearChat} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors" title="Xóa đoạn chat">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors" title="Đóng">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Chat Context */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/50" style={{ scrollbarWidth: 'thin' }}>
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex items-start gap-2.5 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${msg.type === 'bot' ? 'bg-zinc-800 border-zinc-700' : 'bg-sky-600 border-sky-500'}`}>
                                        {msg.type === 'bot' ? <Sparkles className="w-3.5 h-3.5 text-sky-400"/> : <span className="text-[10px] font-bold text-white">Bạn</span>}
                                    </div>
                                    
                                    <div className={`max-w-[80%] p-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.type === 'user' ? 'bg-sky-600 text-white rounded-tr-sm' : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-tl-sm'} ${msg.type === 'system' ? 'bg-red-900/20 border-red-800 text-red-300 w-full text-center text-xs' : ''}`}>
                                        <p className="whitespace-pre-wrap">{msg.text}</p>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                                        <Sparkles className="w-3.5 h-3.5 text-sky-400"/>
                                    </div>
                                    <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-tl-sm p-3 flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-zinc-900 border-t border-zinc-800 shrink-0">
                            {attachment && (
                                <div className="mb-2 flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-lg p-2">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        {attachment.mimeType.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" /> : <FileText className="w-4 h-4 text-emerald-400 shrink-0" />}
                                        <span className="text-xs text-zinc-300 truncate">{attachment.name}</span>
                                    </div>
                                    <button onClick={() => setAttachment(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <div className="flex-1 bg-zinc-800/80 border border-zinc-700 backdrop-blur rounded-xl flex items-end overflow-hidden focus-within:border-sky-500/50 transition-colors">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2.5 text-zinc-400 hover:text-sky-400 hover:bg-zinc-700/50 transition-colors shrink-0"
                                        title="Đính kèm Ảnh/Excel"
                                    >
                                        <Paperclip className="w-4 h-4" />
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/png, image/jpeg, image/webp, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                        onChange={handleFileChange}
                                    />
                                    <input 
                                        type="text"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        placeholder="Nhập câu hỏi... (VD: Chỉ tôi cách dùng tab này?)"
                                        disabled={isLoading}
                                        className="w-full bg-transparent border-none outline-none text-sm text-zinc-100 placeholder:text-zinc-500 py-2.5 pr-3 h-full min-h-[42px]"
                                    />
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={isLoading || (!input.trim() && !attachment)} 
                                    className="w-[42px] h-[42px] shrink-0 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:hover:bg-sky-500 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-sky-500/20"
                                >
                                    <Send className="w-4 h-4 ml-0.5" />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-colors ${isOpen ? 'bg-zinc-800 border border-zinc-700 text-white' : 'bg-sky-500 text-white shadow-sky-500/30'} ${!isOpen && 'animate-bounce'}`}
            >
                {isOpen ? <ChevronDown className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
            </motion.button>
        </div>
    );
};

export default GlobalChat;
