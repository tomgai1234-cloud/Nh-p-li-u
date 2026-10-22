const fs = require('fs');
let content = fs.readFileSync('components/tabs/HtmlDescriptionScraperTab.tsx', 'utf8');

// The advanced section should be removed and we just place the selectors directly in the main left column

const newInputs = `
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 flex justify-between uppercase tracking-wider">
                        <span>CSS Selector Khung Mô Tả</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={containerSelector}
                            onChange={(e) => setContainerSelector(e.target.value)}
                            placeholder="Để trống hệ thống sẽ tự tìm (vd: .product-desc)"
                            className="flex-1 bg-zinc-950 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                        />
                        <button
                            onClick={() => {
                                if(url) {
                                    setVisualPickerTarget('container');
                                    setVisualPickerUrl(url);
                                    setIsVisualPickerOpen(true);
                                } else {
                                    toast.error("Vui lòng nhập URL trước khi chọn vùng");
                                }
                            }}
                            className="bg-zinc-800 hover:bg-sky-600 text-zinc-300 hover:text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors border border-zinc-700 hover:border-sky-500 shadow-lg"
                            title="Chọn vùng HTML trực quan"
                        >
                            <LayoutGrid className="w-4 h-4" />
                            Chọn Vùng
                        </button>
                    </div>
                </div>
                
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 flex justify-between uppercase tracking-wider">
                        <span>CSS Selector Nút View More</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={clickSelector}
                            onChange={(e) => setClickSelector(e.target.value)}
                            placeholder="Mặc định: Tự tìm nút Xem thêm (vd: #show-more)"
                            className="flex-1 bg-zinc-950 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                        />
                        <button
                            onClick={() => {
                                if(url) {
                                    setVisualPickerTarget('click');
                                    setVisualPickerUrl(url);
                                    setIsVisualPickerOpen(true);
                                } else {
                                    toast.error("Vui lòng nhập URL trước khi chọn vùng");
                                }
                            }}
                            className="bg-zinc-800 hover:bg-sky-600 text-zinc-300 hover:text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors border border-zinc-700 hover:border-sky-500 shadow-lg"
                            title="Chọn nút click trực quan"
                        >
                            <LayoutGrid className="w-4 h-4" />
                            Chọn Nút
                        </button>
                    </div>
                </div>
                
                <div className="space-y-1.5 pt-2">
                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)} 
                        className="flex items-center gap-2 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        {showAdvanced ? 'Ẩn cài đặt khác' : 'Hiện cài đặt khác (Timeout)'}
                    </button>
                </div>
                
                {showAdvanced && (
                    <div className="space-y-4 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800 animate-fade-in">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-400 flex justify-between">
                                <span>Thời gian chờ tải trang (ms)</span>
                            </label>
                            <input
                                type="number"
                                value={waitTime}
                                onChange={(e) => setWaitTime(e.target.value)}
                                placeholder="2000"
                                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-md px-3 py-2 outline-none focus:border-sky-500"
                            />
                        </div>
                    </div>
                )}
            </div>
`;

// we need to replace everything from <div className="pt-2"> down to the button that says "Bắt đầu Đào HTML" with this.

const rx = /<div className="pt-2">[\s\S]*?(?=<div className="mt-auto pt-4 border-t border-zinc-800">)/;

content = content.replace(rx, newInputs);
fs.writeFileSync('components/tabs/HtmlDescriptionScraperTab.tsx', content);

