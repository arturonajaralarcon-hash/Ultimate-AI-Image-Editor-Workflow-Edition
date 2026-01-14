import React from 'react';
import { LucideIcon, GripVertical } from 'lucide-react';

interface WorkflowNodeProps {
  title: string;
  icon: LucideIcon;
  color?: string;
  isActive?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
  stepNumber?: number; // Optional now as some nodes might be utilities
  
  // Drag props
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const WorkflowNode: React.FC<WorkflowNodeProps> = ({ 
  title, 
  icon: Icon, 
  color = "blue", 
  isActive, 
  children, 
  actions,
  stepNumber,
  draggable,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  // Color mapping safe for Tailwind JIT
  const colorClasses = {
    blue: { border: 'border-blue-200', activeBorder: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
    indigo: { border: 'border-indigo-200', activeBorder: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' },
    purple: { border: 'border-purple-200', activeBorder: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-500' },
    emerald: { border: 'border-emerald-200', activeBorder: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
    slate: { border: 'border-slate-200', activeBorder: 'border-slate-500', bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-500' },
    amber: { border: 'border-amber-200', activeBorder: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  };

  const theme = colorClasses[color as keyof typeof colorClasses] || colorClasses.slate;
  const borderClass = isActive ? theme.activeBorder : 'border-slate-200';
  const shadowClass = isActive ? 'shadow-xl ring-1 ring-black/5' : 'shadow-md';

  return (
    <div 
      className={`w-[400px] flex-shrink-0 bg-white rounded-xl border ${borderClass} ${shadowClass} flex flex-col transition-all duration-300 relative group`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
       {/* Connection Point Left (Only show if part of main flow, heuristic based on stepNumber) */}
       {stepNumber && (
         <div className="absolute top-8 -left-3 w-6 h-6 bg-white border border-slate-300 rounded-full z-10 flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${isActive ? theme.dot : 'bg-slate-300'}`} />
         </div>
       )}

       {/* Header */}
       <div className={`p-4 border-b border-slate-100 flex items-center justify-between rounded-t-xl ${isActive ? 'bg-slate-50/50' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}>
          <div className="flex items-center gap-3">
            {stepNumber ? (
               <div className={`w-8 h-8 rounded-lg ${theme.bg} ${theme.text} flex items-center justify-center font-bold text-sm`}>
                 {stepNumber}
               </div>
            ) : (
               <div className={`w-8 h-8 rounded-lg ${theme.bg} ${theme.text} flex items-center justify-center`}>
                 <Icon size={16} />
               </div>
            )}
            
            <div className="flex items-center gap-2">
              {stepNumber && <Icon size={16} className="text-slate-400" />}
              <h3 className={`font-semibold text-slate-700`}>{title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {isActive && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
             {draggable && <GripVertical size={16} className="text-slate-300" />}
          </div>
       </div>

       {/* Body */}
       <div className="p-5 flex-1 overflow-y-auto max-h-[500px] min-h-[200px] custom-scrollbar space-y-4">
         {children}
       </div>

       {/* Actions Footer */}
       {actions && (
         <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl backdrop-blur-sm">
           {actions}
         </div>
       )}

       {/* Connection Point Right */}
       {stepNumber && (
        <div className="absolute top-8 -right-3 w-6 h-6 bg-white border border-slate-300 rounded-full z-10 flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${isActive ? theme.dot : 'bg-slate-300'}`} />
        </div>
       )}
    </div>
  );
};

export const Connector = ({ active }: { active?: boolean }) => (
  <div className="flex flex-col items-center justify-center w-24 pt-8 relative flex-shrink-0">
    <div className={`h-1 w-full ${active ? 'bg-slate-800' : 'bg-slate-200'} transition-colors duration-500 rounded-full`} />
    <div className={`absolute right-0 top-[26px]`} >
       {/* Simple arrow head */}
       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={active ? "#1e293b" : "#e2e8f0"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
         <path d="m9 18 6-6-6-6"/>
       </svg>
    </div>
  </div>
);