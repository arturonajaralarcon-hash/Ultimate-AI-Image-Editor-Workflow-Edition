import React from 'react';
import { AppStep } from '../types';
import { ChevronRight, FileInput, Image, Wand2, Layers, Tv2 } from 'lucide-react';

interface FlowchartProps {
  currentStep: AppStep;
  setStep: (step: AppStep) => void;
}

const steps = [
  { id: AppStep.INITIAL_INPUT, label: 'Context', icon: FileInput },
  { id: AppStep.REFERENCE_UPLOAD, label: 'References', icon: Image },
  { id: AppStep.PROMPT_ENGINEERING, label: 'Concept', icon: Wand2 },
  { id: AppStep.GENERATION, label: 'Visualize', icon: Layers },
  { id: AppStep.FINAL_OUTPUT, label: 'Render & Veo', icon: Tv2 },
];

export const Flowchart: React.FC<FlowchartProps> = ({ currentStep, setStep }) => {
  return (
    <div className="w-full py-6 px-4 bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Connecting Line */}
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-100 -z-10" />
          
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div 
                key={step.id} 
                className={`flex flex-col items-center cursor-pointer transition-all duration-300 ${isActive ? 'scale-105' : 'opacity-70 hover:opacity-100'}`}
                onClick={() => isCompleted ? setStep(step.id) : null}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 bg-white transition-colors duration-300
                  ${isActive ? 'border-blue-600 text-blue-600 shadow-lg shadow-blue-100' : 
                    isCompleted ? 'border-green-500 text-green-500 bg-green-50' : 'border-slate-300 text-slate-400'
                  }`}
                >
                  <Icon size={20} />
                </div>
                <span className={`mt-2 text-xs font-semibold ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};