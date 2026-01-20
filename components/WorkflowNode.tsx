import React from 'react';
import { LucideIcon } from 'lucide-react';

interface WorkflowNodeProps {
  title: string;
  icon: LucideIcon;
  color?: string;
  isActive?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
  status?: string;
  position: { x: number; y: number };
  onMouseDown: (e: React.MouseEvent) => void;
}

export const WorkflowNode: React.FC<WorkflowNodeProps> = ({ 
  title, 
  icon: Icon, 
  color = "blue", 
  isActive, 
  children, 
  actions,
  status,
  position,
  onMouseDown
}) => {
  // Theme configuration for Dark Mode
  const themes: Record<string, { border: string, iconColor: string, iconBg: string }> = {
    blue: { border: 'border-blue-500', iconColor: 'text-blue-400', iconBg: 'bg-blue-500/10' },
    purple: { border: 'border-purple-500', iconColor: 'text-purple-400', iconBg: 'bg-purple-500/10' },
    emerald: { border: 'border-emerald-500', iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
    amber: { border: 'border-amber-500', iconColor: 'text-amber-400', iconBg: 'bg-amber-500/10' },
    indigo: { border: 'border-indigo-500', iconColor: 'text-indigo-400', iconBg: 'bg-indigo-500/10' },
    slate: { border: 'border-slate-500', iconColor: 'text-slate-400', iconBg: 'bg-slate-500/10' },
  };

  const theme = themes[color] || themes.slate;

  return (
    <div 
      className={`absolute w-96 rounded-xl bg-slate-900 border transition-shadow duration-200 flex flex-col group
        ${isActive ? `${theme.border} shadow-[0_0_20px_rgba(0,0,0,0.3)] ring-1 ring-${color}-500/50` : 'border-slate-800 shadow-xl hover:border-slate-700'}
      `}
      style={{
        left: position.x,
        top: position.y,
        // Ensure active node is visually prioritized slightly (simple z-index handling could be added in parent)
      }}
      onMouseDown={onMouseDown}
    >
       {/* Header - The "Grip" area */}
       <div className="p-4 border-b border-slate-800 flex items-start justify-between cursor-grab active:cursor-grabbing select-none">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${theme.iconBg} ${theme.iconColor}`}>
               <Icon size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
              {status && <p className="text-[10px] text-slate-500 font-mono mt-0.5">{status}</p>}
            </div>
          </div>
       </div>

       {/* Body */}
       <div className="p-4 space-y-3 cursor-default" onMouseDown={(e) => e.stopPropagation()}>
         {children}
       </div>

       {/* Footer Actions if present */}
       {actions && (
         <div className="p-3 border-t border-slate-800 bg-slate-900/50 rounded-b-xl" onMouseDown={(e) => e.stopPropagation()}>
           {actions}
         </div>
       )}
    </div>
  );
};

export const Connector = () => null; // No longer used in Canvas mode