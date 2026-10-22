import React from 'react';
import type { ActiveTool } from '../../types';

interface Tool {
  id: ActiveTool;
  label: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface ToolGroup {
  id: string;
  tools: Tool[];
}

interface LeftSidebarProps {
  activeTool: ActiveTool | null;
  setActiveTool: (tool: ActiveTool | null) => void;
  toolGroups: ToolGroup[];
}


const LeftSidebar: React.FC<LeftSidebarProps> = ({ activeTool, setActiveTool, toolGroups }) => {
  return (
    <aside className="w-20 bg-zinc-900/40 p-2 border-r border-zinc-700 flex flex-col items-center gap-2 flex-shrink-0">
      {toolGroups.map((group, index) => (
        <React.Fragment key={group.id}>
            {group.tools.map(tool => (
                <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={`
                        w-16 h-16 flex flex-col items-center justify-center gap-1 rounded-lg transition-colors duration-200
                        ${activeTool === tool.id ? 'bg-sky-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'}
                    `}
                    title={tool.label}
                    >
                    <tool.icon className="w-6 h-6" />
                    <span className="text-xs font-medium text-center">{tool.label}</span>
                </button>
            ))}
            {index < toolGroups.length - 1 && (
                <div className="w-10 h-px bg-zinc-700 my-1" />
            )}
        </React.Fragment>
      ))}
    </aside>
  );
};

export default LeftSidebar;