const fs = require('fs');
let code = fs.readFileSync('components/ResultCard.tsx', 'utf8');

// 1. Update interface
code = code.replace(
  "status: 'success' | 'error';",
  "status: 'success' | 'error' | 'loading';"
);

// 2. Add isLoading constant
code = code.replace(
  "const isError = status === 'error';",
  "const isError = status === 'error';\n  const isLoading = status === 'loading';"
);

// 3. Update styling and behavior for loading
code = code.replace(
  "${isError ? 'bg-red-900/30 border-red-700' : 'bg-zinc-800/50 backdrop-blur-sm border-zinc-700 hover:bg-zinc-800/70'}",
  "${isError ? 'bg-red-900/30 border-red-700' : isLoading ? 'bg-sky-900/10 border-sky-900/30' : 'bg-zinc-800/50 backdrop-blur-sm border-zinc-700 hover:bg-zinc-800/70'}"
);

code = code.replace(
  "onClick={toggleExpand}",
  "onClick={isLoading ? undefined : toggleExpand}"
);

code = code.replace(
  "<h2 className={`text-sm font-bold uppercase break-words flex-1 transition-colors ${isError ? 'text-red-300' : 'text-sky-300 group-hover:text-sky-200'}`}>",
  "<h2 className={`text-sm font-bold uppercase break-words flex-1 transition-colors ${isError ? 'text-red-300' : isLoading ? 'text-sky-400 animate-pulse' : 'text-sky-300 group-hover:text-sky-200'}`}>"
);

// Disable expand button when loading
code = code.replace(
  "{!isError && (",
  "{!isError && !isLoading && ("
);

const expandButtonSearch = `<button
                    className={\`p-1.5 text-zinc-400 hover:text-sky-400 transition-transform duration-200 rounded-full focus:outline-none \${isExpanded ? 'rotate-180' : ''}\`}
                    title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>`;
const expandButtonReplace = `<button
                    className={\`p-1.5 \${isLoading ? 'text-zinc-600' : 'text-zinc-400 hover:text-sky-400 cursor-pointer'} transition-transform duration-200 rounded-full focus:outline-none \${isExpanded ? 'rotate-180' : ''}\`}
                    title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-sky-500" /> : <ChevronDown className="w-4 h-4" />}
                  </button>`;

code = code.replace(expandButtonSearch, expandButtonReplace);

fs.writeFileSync('components/ResultCard.tsx', code);
