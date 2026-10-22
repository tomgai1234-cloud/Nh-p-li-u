
import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { Chat } from '@google/genai';
import { startChat } from '../../services/geminiService';
import type { ChatMessage, GroundingSource } from '../../types';
import TextInput from '../TextInput';
import Button from '../Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Trash2, Globe, Search, ExternalLink, ShieldCheck, Newspaper, HelpCircle } from 'lucide-react';

const SUGGESTED_QUERIES = [
    { label: "Sự kiện & Tin tức công nghệ mới", query: "Điểm qua các sự kiện và tin tức công nghệ tiêu dùng nổi bật trong tuần qua?" },
    { label: "Fact-check thông số iPhone 16 Pro", query: "Fact-check kiểm tra thông số chip và camera thực tế của iPhone 16 Pro Max?" },
    { label: "Xu hướng tìm kiếm Shopee/TikTok Shop", query: "Các sản phẩm gia dụng và thời trang đang dẫn đầu xu hướng tìm kiếm thương mại điện tử hiện nay là gì?" },
];

const ChatbotTab: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useGoogleSearch, setUseGoogleSearch] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const chatInstance = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load history on mount & check remix preset
    useEffect(() => {
        const saved = localStorage.getItem('chatbot_history');
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch (e) {
                setMessages([{ 
                    type: 'bot', 
                    text: 'Xin chào! Tôi là Trợ lý AI tích hợp Google Search thời gian thực. Tôi có thể giúp bạn thảo luận tin tức mới nhất, kiểm tra sự thật (fact-check), tra cứu thông số sản phẩm và hỗ trợ nội dung.',
                }]);
            }
        } else {
            setMessages([{ 
                type: 'bot', 
                text: 'Xin chào! Tôi là Trợ lý AI tích hợp Google Search thời gian thực. Tôi có thể giúp bạn thảo luận tin tức mới nhất, kiểm tra sự thật (fact-check), tra cứu thông số sản phẩm và hỗ trợ nội dung.',
            }]);
        }

        const presetQuery = localStorage.getItem('chatbot_preset_query');
        if (presetQuery) {
            setInput(presetQuery);
            localStorage.removeItem('chatbot_preset_query');
        }
    }, []);

    // Save history on update
    useEffect(() => {
        localStorage.setItem('chatbot_history', JSON.stringify(messages));
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessageWithSearch = async (textToSend: string) => {
        if (!textToSend.trim() || isLoading) return;

        const userMessage: ChatMessage = { type: 'user', text: textToSend.trim() };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            // Prepare conversation history
            const history = updatedMessages
                .filter(m => m.type === 'user' || m.type === 'bot')
                .map(m => ({
                    role: m.type === 'user' ? 'user' : 'model',
                    text: m.text
                }));

            // Call server-side API with Google Search grounding
            const res = await fetch('/api/gemini/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.text,
                    history: history.slice(-10), // Send last 10 messages for context
                    useGoogleSearch,
                    model: 'gemini-3.8-flash'
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    const botMessage: ChatMessage = { 
                        type: 'bot', 
                        text: data.text || '',
                        sources: data.sources || [],
                        searchQueries: data.searchQueries || []
                    };
                    setMessages(prev => [...prev, botMessage]);
                    return;
                }
            }

            // Fallback to client chat instance if server fails
            if (!chatInstance.current) {
                chatInstance.current = startChat();
            }
            const response = await chatInstance.current.sendMessage({ message: userMessage.text });
            const botMessage: ChatMessage = { type: 'bot', text: response.text || '' };
            setMessages(prev => [...prev, botMessage]);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Đã có lỗi xảy ra.';
            setError(errorMessage);
            const systemMessage: ChatMessage = { type: 'system', text: `Lỗi: ${errorMessage}` };
            setMessages(prev => [...prev, systemMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await sendMessageWithSearch(input);
    };

    const handleClearChat = () => {
        if(window.confirm('Bạn có chắc muốn xóa toàn bộ đoạn chat?')) {
            setMessages([{ 
                type: 'bot', 
                text: 'Xin chào! Tôi là Trợ lý AI tích hợp Google Search thời gian thực. Tôi có thể giúp bạn thảo luận tin tức mới nhất, kiểm tra sự thật (fact-check), tra cứu thông số sản phẩm và hỗ trợ nội dung.',
            }]);
            chatInstance.current = startChat();
        }
    };

    const LoadingIndicator = () => (
        <div className="flex items-center space-x-2 p-2">
            <motion.div 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ repeat: Infinity, duration: 0.6 }} 
                className="w-2 h-2 bg-sky-400 rounded-full" 
            />
            <motion.div 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} 
                className="w-2 h-2 bg-sky-400 rounded-full" 
            />
            <motion.div 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} 
                className="w-2 h-2 bg-sky-400 rounded-full" 
            />
            <span className="text-xs text-sky-300 font-medium ml-2">Đang tra cứu dữ liệu Google & suy nghĩ...</span>
        </div>
    );

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl"
        >
            <header className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur z-10 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-900/30 rounded-lg">
                        <Sparkles className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                            Trợ lý AI Tìm kiếm
                            <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-sky-900/40 text-sky-300 border border-sky-600/40">
                                Google Search Grounding
                            </span>
                        </h2>
                        <p className="text-xs text-zinc-400">Tra cứu tin tức trực tiếp, đối chiếu thông số & Fact-check</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Google Search Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors" title="Bật/Tắt tìm kiếm Google thời gian thực">
                        <Globe className={`w-4 h-4 ${useGoogleSearch ? 'text-sky-400' : 'text-zinc-500'}`} />
                        <span className={`text-xs font-medium ${useGoogleSearch ? 'text-zinc-200' : 'text-zinc-400'}`}>
                            Google Search
                        </span>
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={useGoogleSearch}
                            onChange={(e) => setUseGoogleSearch(e.target.checked)}
                        />
                        <div className="w-8 h-4 bg-zinc-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-sky-500/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sky-600 relative"></div>
                    </label>

                    <button 
                        onClick={handleClearChat}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Xóa đoạn chat"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gradient-to-b from-zinc-900 to-zinc-900/50">
                <AnimatePresence initial={false}>
                    {messages.map((msg, index) => (
                        <motion.div 
                            key={index} 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className={`flex items-start gap-3 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.type === 'bot' ? 'bg-zinc-800 border border-zinc-700' : 'bg-sky-600'}`}>
                                {msg.type === 'bot' ? <Sparkles className="w-4 h-4 text-sky-400"/> : <span className="text-xs font-bold text-white">Bạn</span>}
                            </div>
                            
                            <div 
                                className={`
                                    max-w-[85%] sm:max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm space-y-3
                                    ${msg.type === 'user' 
                                        ? 'bg-sky-600 text-white rounded-tr-sm' 
                                        : 'bg-zinc-800/90 border border-zinc-700 text-zinc-200 rounded-tl-sm'}
                                    ${msg.type === 'system' ? 'bg-red-900/20 border-red-800 text-red-300 w-full text-center' : ''}
                                `}
                            >
                                <p className="whitespace-pre-wrap">{msg.text}</p>

                                {/* Google Search Grounding Queries */}
                                {msg.searchQueries && msg.searchQueries.length > 0 && (
                                    <div className="pt-2 border-t border-zinc-700/60 flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
                                        <span className="font-semibold text-sky-300 flex items-center gap-1">
                                            <Search className="w-3 h-3" /> Đã tìm kiếm:
                                        </span>
                                        {msg.searchQueries.map((query, qIdx) => (
                                            <span key={qIdx} className="bg-zinc-900/90 border border-zinc-700 text-sky-200 px-2 py-0.5 rounded-full">
                                                "{query}"
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Google Search Grounding Sources */}
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="pt-2 border-t border-zinc-700/60 space-y-1 text-xs">
                                        <div className="font-semibold text-zinc-400 flex items-center gap-1">
                                            <Globe className="w-3 h-3 text-sky-400" /> Nguồn trích dẫn ({msg.sources.length}):
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {msg.sources.map((source, sIdx) => (
                                                <a 
                                                    key={sIdx}
                                                    href={source.uri}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 bg-zinc-900/80 hover:bg-zinc-900 text-sky-300 hover:text-sky-200 border border-zinc-700 hover:border-sky-500/50 px-2.5 py-1 rounded-md transition-colors text-[11px] max-w-[260px] truncate"
                                                    title={source.title || source.uri}
                                                >
                                                    <span className="truncate">{source.title || source.uri}</span>
                                                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                
                {isLoading && (
                     <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="flex items-start gap-3"
                    >
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 mt-1">
                            <Sparkles className="w-4 h-4 text-sky-400"/>
                        </div>
                        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-tl-sm p-3">
                            <LoadingIndicator />
                        </div>
                    </motion.div>
                )}
                 <div ref={messagesEndRef} />
            </main>

            {/* Quick Suggestions Bar */}
            <div className="px-4 py-2 bg-zinc-900/90 border-t border-zinc-800/80 flex items-center gap-2 overflow-x-auto custom-scrollbar text-xs">
                <span className="text-zinc-500 whitespace-nowrap flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Gợi ý:
                </span>
                {SUGGESTED_QUERIES.map((s, idx) => (
                    <button
                        key={idx}
                        onClick={() => sendMessageWithSearch(s.query)}
                        disabled={isLoading}
                        className="whitespace-nowrap px-2.5 py-1 rounded-full bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-sky-300 hover:border-sky-500/40 transition-colors text-xs disabled:opacity-50"
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <footer className="p-4 bg-zinc-900 border-t border-zinc-800">
                <form onSubmit={handleSubmit} className="flex items-end gap-2 relative">
                    <TextInput 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder={useGoogleSearch ? "Tra cứu Google thời gian thực, fact-check, thảo luận tin tức..." : "Hỏi trợ lý AI..."}
                        disabled={isLoading}
                        className="flex-1 !bg-zinc-800 !border-zinc-700 !rounded-xl !py-3 !pl-4 !pr-12 focus:!ring-sky-500/50"
                        autoFocus
                    />
                    <div className="absolute right-2 bottom-1.5">
                        <Button 
                            type="submit" 
                            disabled={isLoading || !input.trim()} 
                            className="!w-8 !h-8 !p-0 !rounded-lg !min-w-0"
                            colorScheme="sky"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </form>
            </footer>
        </motion.div>
    );
};

export default ChatbotTab;
