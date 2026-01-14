import React, { useState, useRef } from 'react';
import { 
  ProjectState, 
  ReferenceFile, 
  GeneratedOutput, 
  AspectRatio, 
  ImageSize 
} from './types';
import { WorkflowNode, Connector } from './components/WorkflowNode';
import { 
  refineArchitecturalPrompt, 
  enhanceArchitecturalPrompt,
  generateConceptImage, 
  generateHighResRender, 
  generateArchitecturalVideo 
} from './services/geminiService';
import { 
  Upload, 
  ArrowRight, 
  Loader2, 
  Image as ImageIcon, 
  PlayCircle,
  Wand2,
  Maximize2,
  Layers,
  FileText,
  File as FileGeneric,
  Sparkles,
  MessageSquarePlus,
  Download,
  Trash2,
  X,
  FlaskConical,
  ClipboardCopy,
  ArrowLeftCircle,
  Repeat2,
  Save,
  Library,
  Copy
} from 'lucide-react';

const INITIAL_STATE: ProjectState = {
  description: '',
  contextFiles: [],
  exactReferences: [],
  generatedPrompt: '',
  thinkingProcess: '',
  outputs: [],
  isThinking: false,
  selectedAspectRatio: AspectRatio.LANDSCAPE_16_9,
  selectedResolution: ImageSize.SIZE_1K
};

type NodeId = 'context' | 'reference' | 'prompt' | 'visualization' | 'prompt_lab' | 'saved_prompts';
type FlowType = 'main' | 'lab';

// Helper to convert base64 data URL to File object
function dataURLtoFile(dataurl: string, filename: string): File {
  try {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    console.error("Conversion failed", e);
    return new File([], filename);
  }
}

interface SavedPrompt {
  id: string;
  text: string;
  instruction: string;
  timestamp: Date;
}

const App: React.FC = () => {
  const [project, setProject] = useState<ProjectState>(INITIAL_STATE);
  const [refinementInstruction, setRefinementInstruction] = useState('');
  
  // Prompt Lab State
  const [labInput, setLabInput] = useState('');
  const [labInstruction, setLabInstruction] = useState('');
  const [labOutput, setLabOutput] = useState('');
  const [labLoading, setLabLoading] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);

  // Fullscreen Viewer State
  const [fullscreenMedia, setFullscreenMedia] = useState<{url: string, type: 'image'|'video'} | null>(null);

  // Dynamic Node Ordering (Separated Flows)
  const [mainNodes, setMainNodes] = useState<NodeId[]>(['context', 'reference', 'prompt', 'visualization']);
  const [labNodes, setLabNodes] = useState<NodeId[]>(['prompt_lab', 'saved_prompts']);
  
  const [draggedItem, setDraggedItem] = useState<{index: number, flow: FlowType} | null>(null);

  // Track "Active" Stage for highlighting
  const [activeStage, setActiveStage] = useState<number>(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'context' | 'exact') => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file: File) => {
        const isImage = file.type.startsWith('image/');
        return {
          id: Math.random().toString(36).substr(2, 9),
          file,
          previewUrl: isImage ? URL.createObjectURL(file) : '',
          name: file.name,
          type: isImage ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'text'
        } as ReferenceFile;
      });
      
      setProject(prev => ({
        ...prev,
        [target === 'context' ? 'contextFiles' : 'exactReferences']: [
          ...(target === 'context' ? prev.contextFiles : prev.exactReferences),
          ...newFiles
        ]
      }));
    }
  };

  const deleteContextFile = (id: string) => {
    setProject(prev => ({
      ...prev,
      contextFiles: prev.contextFiles.filter(f => f.id !== id)
    }));
  };

  const deleteReference = (id: string) => {
    setProject(prev => ({
      ...prev,
      exactReferences: prev.exactReferences.filter(r => r.id !== id)
    }));
  };

  const deleteOutput = (id: string) => {
    setProject(prev => ({
      ...prev,
      outputs: prev.outputs.filter(o => o.id !== id)
    }));
  };

  const handleReuse = (output: GeneratedOutput, target: 'context' | 'reference') => {
    if (!output.imageUrl) return; // Only images supported for now
    
    const file = dataURLtoFile(output.imageUrl, `generated-${output.id.substr(0,6)}.png`);
    const newRef: ReferenceFile = {
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: output.imageUrl,
      name: `Gen-${output.id.substr(0,4)}`,
      type: 'image'
    };

    setProject(prev => ({
      ...prev,
      [target === 'context' ? 'contextFiles' : 'exactReferences']: [
        ...(target === 'context' ? prev.contextFiles : prev.exactReferences),
        newRef
      ]
    }));
  };

  const generatePrompt = async () => {
    setActiveStage(2); 
    setProject(prev => ({ ...prev, isThinking: true }));
    try {
      const contextFiles = project.contextFiles.map(r => r.file);
      const result = await refineArchitecturalPrompt(project.description, contextFiles);
      setProject(prev => ({ 
        ...prev, 
        generatedPrompt: result.refinedPrompt,
        thinkingProcess: result.thoughts,
        isThinking: false 
      }));
      setActiveStage(3);
    } catch (error) {
      console.error(error);
      setProject(prev => ({ ...prev, isThinking: false }));
      alert("Failed to generate prompt. Please try again.");
    }
  };

  const handleRefinePrompt = async () => {
    if (!refinementInstruction) return;
    setProject(prev => ({ ...prev, isThinking: true }));
    try {
       const newPrompt = await enhanceArchitecturalPrompt(project.generatedPrompt, refinementInstruction);
       setProject(prev => ({
         ...prev,
         generatedPrompt: newPrompt,
         isThinking: false
       }));
       setRefinementInstruction(''); 
    } catch (error) {
      console.error(error);
      setProject(prev => ({ ...prev, isThinking: false }));
      alert("Failed to refine prompt.");
    }
  };

  const handleLabGenerate = async () => {
    if (!labInput || !labInstruction) return;
    setLabLoading(true);
    try {
      const result = await enhanceArchitecturalPrompt(labInput, labInstruction);
      setLabOutput(result);
    } catch (e) {
      console.error(e);
      alert("Lab generation failed");
    } finally {
      setLabLoading(false);
    }
  };

  const handleSavePrompt = (text: string, instruction: string) => {
    if (!text) return;
    const newPrompt: SavedPrompt = {
      id: Math.random().toString(36).substr(2, 9),
      text: text,
      instruction: instruction || 'Generated Prompt',
      timestamp: new Date()
    };
    setSavedPrompts(prev => [newPrompt, ...prev]);
  };

  const deleteSavedPrompt = (id: string) => {
    setSavedPrompts(prev => prev.filter(p => p.id !== id));
  };

  const handleGenerateConcepts = async () => {
    setProject(prev => ({ ...prev, isThinking: true }));
    try {
      const selectedRef = project.exactReferences.find(r => r.id === project.selectedExactReferenceId) || project.exactReferences[0];
      const referenceFile = selectedRef?.file;
      
      const imageUrl = await generateConceptImage(
        project.generatedPrompt, 
        referenceFile,
        project.selectedAspectRatio
      );

      const newOutput: GeneratedOutput = {
        id: Math.random().toString(),
        imageUrl,
        prompt: project.generatedPrompt,
        type: 'concept',
        baseImageId: selectedRef?.id
      };

      setProject(prev => ({
        ...prev,
        outputs: [...prev.outputs, newOutput],
        isThinking: false
      }));
      setActiveStage(4);
    } catch (error) {
      console.error(error);
      setProject(prev => ({ ...prev, isThinking: false }));
      alert("Failed to generate concept.");
    }
  };

  const handleDownload = (url: string, id: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `archiflow-output-${id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, index: number, flow: FlowType) => {
    setDraggedItem({ index, flow });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number, flow: FlowType) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.flow !== flow) return;
    
    if (draggedItem.index !== index) {
      const newOrder = flow === 'main' ? [...mainNodes] : [...labNodes];
      const draggedNodeId = newOrder[draggedItem.index];
      newOrder.splice(draggedItem.index, 1);
      newOrder.splice(index, 0, draggedNodeId);
      
      if (flow === 'main') setMainNodes(newOrder);
      else setLabNodes(newOrder);
      
      setDraggedItem({ index, flow });
    }
  };

  const handleDrop = () => {
    setDraggedItem(null);
  };

  const renderNode = (id: NodeId, index: number, flow: FlowType) => {
    const commonDragProps = {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, index, flow),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index, flow),
      onDrop: handleDrop
    };

    switch (id) {
      case 'context':
        return (
          <WorkflowNode 
            key={id}
            title="Project Context" 
            icon={FileText} 
            stepNumber={1} 
            color="slate"
            isActive={activeStage === 1}
            {...commonDragProps}
            actions={
              <button 
                onClick={() => setActiveStage(2)} 
                className="w-full py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center justify-center gap-2 text-sm font-medium"
              >
                Confirm & Next <ArrowRight size={14} />
              </button>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Description</label>
                <textarea
                  className="w-full p-3 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-slate-200 outline-none resize-none h-32"
                  placeholder="Describe the architectural vision..."
                  value={project.description}
                  onChange={(e) => setProject(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                  Context Documents & Images
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {project.contextFiles.map(f => (
                      <div key={f.id} className="aspect-square bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-1 relative group overflow-hidden" title={f.name}>
                        {f.type === 'image' ? (
                          <img src={f.previewUrl} className="w-full h-full object-cover rounded" alt="ref" />
                        ) : (
                          <FileGeneric className="text-slate-400" size={20} />
                        )}
                        <button 
                            onClick={() => deleteContextFile(f.id)}
                            className="absolute top-1 right-1 p-0.5 bg-white/90 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <X size={10} />
                        </button>
                        <span className="text-[8px] text-center w-full truncate mt-1 px-1">{f.name}</span>
                      </div>
                  ))}
                  <label className="aspect-square border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all">
                    <Upload size={16} className="text-slate-400" />
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,.pdf,.txt,.md,.doc,.docx" 
                      className="hidden" 
                      onChange={(e) => handleFileUpload(e, 'context')} 
                    />
                  </label>
                </div>
              </div>
            </div>
          </WorkflowNode>
        );

      case 'reference':
        return (
          <WorkflowNode 
            key={id}
            title="Base Image (Optional)" 
            icon={ImageIcon} 
            stepNumber={2}
            color="blue"
            isActive={activeStage === 2}
            {...commonDragProps}
            actions={
              <button 
                onClick={generatePrompt}
                disabled={project.isThinking}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
              >
                {project.isThinking ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                Generate Prompt
              </button>
            }
          >
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Upload a specific base image (render, sketch, photo) to transform.
                </p>
                <div className="border-2 border-dashed border-blue-100 bg-blue-50/50 rounded-xl p-4 flex flex-col items-center justify-center">
                  {project.exactReferences.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {project.exactReferences.map(f => (
                          <div key={f.id} className="relative aspect-video rounded-lg overflow-hidden border border-blue-200 group">
                            <img src={f.previewUrl} alt="exact" className="w-full h-full object-cover" />
                            <button 
                              onClick={() => deleteReference(f.id)}
                              className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-red-500 hover:bg-white hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                  ) : (
                    <div className="text-center py-4">
                      <ImageIcon className="w-8 h-8 text-blue-200 mx-auto mb-2" />
                      <span className="text-xs text-blue-400">No base image</span>
                    </div>
                  )}
                  <label className="mt-4 px-4 py-2 text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50">
                      Choose Image
                      <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleFileUpload(e, 'exact')} 
                    />
                  </label>
                </div>
            </div>
          </WorkflowNode>
        );

      case 'prompt_lab':
        return (
          <WorkflowNode 
            key={id}
            title="Lab: Prompt Tester" 
            icon={FlaskConical} 
            color="amber"
            {...commonDragProps}
            actions={
              <div className="flex gap-2">
                <button 
                  onClick={handleLabGenerate}
                  disabled={labLoading || !labInput}
                  className="flex-1 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
                >
                  {labLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  Test
                </button>
                {labOutput && (
                   <button 
                     onClick={() => handleSavePrompt(labOutput, labInstruction)}
                     className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 flex items-center justify-center gap-2 border border-amber-200"
                     title="Save to Library"
                   >
                     <Save size={16} />
                   </button>
                )}
              </div>
            }
          >
             <div className="space-y-4">
               <div className="bg-amber-50 p-2 rounded text-[10px] text-amber-800 leading-tight">
                 Standalone tool to test the "Gemini Image Prompt Enhancement Agent".
               </div>
               <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Base Prompt</label>
                  <textarea 
                    className="w-full p-3 border border-amber-200 rounded-lg text-xs h-32 outline-none focus:ring-1 focus:ring-amber-400 bg-white text-slate-900"
                    placeholder="e.g. A modern house in the woods..."
                    value={labInput}
                    onChange={e => setLabInput(e.target.value)}
                  />
               </div>
               <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Instruction</label>
                  <textarea 
                    className="w-full p-3 border border-amber-200 rounded-lg text-xs h-20 outline-none focus:ring-1 focus:ring-amber-400 bg-white text-slate-900 resize-none"
                    placeholder="e.g. Remove RED marked shapes..."
                    value={labInstruction}
                    onChange={e => setLabInstruction(e.target.value)}
                  />
               </div>
               {labOutput && (
                 <div className="mt-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Result (Editable)</label>
                    <div className="relative">
                      <textarea 
                        className="w-full p-3 border border-slate-200 bg-white text-slate-900 rounded-lg text-xs h-32 font-mono outline-none focus:ring-1 focus:ring-amber-400"
                        value={labOutput}
                        onChange={(e) => setLabOutput(e.target.value)}
                      />
                      <button 
                        onClick={() => navigator.clipboard.writeText(labOutput)}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 bg-white rounded-md border border-slate-100"
                      >
                        <ClipboardCopy size={12} />
                      </button>
                    </div>
                 </div>
               )}
             </div>
          </WorkflowNode>
        );

      case 'saved_prompts':
        return (
          <WorkflowNode 
            key={id}
            title="Saved Prompts" 
            icon={Library} 
            color="amber"
            {...commonDragProps}
          >
             <div className="space-y-3">
               {savedPrompts.length === 0 ? (
                 <div className="text-center py-8 text-slate-400 text-xs italic">
                   No saved prompts yet.
                 </div>
               ) : (
                 savedPrompts.map((p, idx) => (
                   <div key={p.id} className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 group relative hover:shadow-sm transition-shadow">
                     <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold text-amber-700">
                          {p.timestamp.toLocaleTimeString()}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => navigator.clipboard.writeText(p.text)}
                              className="p-1 hover:bg-amber-100 rounded text-amber-600"
                              title="Copy"
                            >
                              <Copy size={12} />
                            </button>
                            <button 
                              onClick={() => deleteSavedPrompt(p.id)}
                              className="p-1 hover:bg-red-100 rounded text-red-500"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                        </div>
                     </div>
                     <p className="text-[11px] text-slate-600 line-clamp-2 mb-1" title={p.instruction}>
                       <span className="font-semibold">Inst:</span> {p.instruction}
                     </p>
                     <p className="text-xs text-slate-800 font-mono line-clamp-3 bg-white p-1 rounded border border-amber-100">
                       {p.text}
                     </p>
                   </div>
                 ))
               )}
             </div>
          </WorkflowNode>
        );

      case 'prompt':
        return (
          <WorkflowNode 
            key={id}
            title="Prompt Engine" 
            icon={Wand2} 
            stepNumber={3}
            color="purple"
            isActive={activeStage === 3}
            {...commonDragProps}
            actions={
                <button 
                  onClick={handleGenerateConcepts}
                  disabled={project.isThinking || !project.generatedPrompt}
                  className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
                >
                  {project.isThinking ? <Loader2 className="animate-spin" size={14} /> : <Layers size={14} />}
                  Render Concepts
                </button>
            }
          >
              <div className="space-y-4">
                {project.exactReferences.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2 block">Apply To</label>
                      <select 
                        className="w-full text-xs p-2 border border-purple-200 rounded bg-white text-slate-900"
                        onChange={(e) => setProject(p => ({...p, selectedExactReferenceId: e.target.value}))}
                        value={project.selectedExactReferenceId || ''}
                      >
                        {project.exactReferences.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                )}

                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
                    <label className="text-xs font-bold text-purple-800 flex items-center gap-2 mb-3">
                      <Sparkles size={14} className="text-purple-600" /> 
                      AI Prompt Refiner
                    </label>
                    <div className="flex flex-col gap-3">
                      <textarea 
                        className="w-full p-3 border border-purple-200 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-purple-200 outline-none h-24 resize-none font-medium placeholder-purple-300"
                        placeholder='Describe changes (e.g., "Make it a sunset scene with warm lighting", "Remove RED marked areas")'
                        value={refinementInstruction}
                        onChange={(e) => setRefinementInstruction(e.target.value)}
                      />
                      <button 
                        onClick={handleRefinePrompt}
                        disabled={!refinementInstruction || project.isThinking}
                        className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide"
                      >
                          {project.isThinking ? <Loader2 size={14} className="animate-spin" /> : <MessageSquarePlus size={14} />}
                          Refine Prompt
                      </button>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                          <span>Generated Prompt</span>
                          {project.thinkingProcess && <span className="text-green-500">✓ Optimized</span>}
                        </label>
                        {project.generatedPrompt && (
                          <button 
                            onClick={() => handleSavePrompt(project.generatedPrompt, 'From Production Engine')}
                            className="p-1 hover:bg-purple-100 rounded text-purple-600 transition-colors"
                            title="Save to Library"
                          >
                            <Save size={14} />
                          </button>
                        )}
                    </div>
                    <textarea 
                      className="w-full p-3 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm focus:ring-2 focus:ring-purple-200 outline-none h-48 leading-relaxed font-mono text-xs"
                      value={project.generatedPrompt}
                      onChange={(e) => setProject(p => ({ ...p, generatedPrompt: e.target.value }))}
                      placeholder="Waiting for input..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Aspect Ratio</label>
                      <select 
                        className="w-full text-xs p-2 border border-slate-300 bg-white text-slate-900 rounded font-medium cursor-pointer hover:bg-slate-50 transition-colors"
                        value={project.selectedAspectRatio}
                        onChange={(e) => setProject(p => ({ ...p, selectedAspectRatio: e.target.value as AspectRatio }))}
                      >
                        {Object.values(AspectRatio).map(ar => (
                          <option key={ar} value={ar}>{ar}</option>
                        ))}
                      </select>
                    </div>
                </div>
              </div>
          </WorkflowNode>
        );

      case 'visualization':
        return (
          <WorkflowNode 
            key={id}
            title="Visualization" 
            icon={Layers} 
            stepNumber={4}
            color="emerald"
            isActive={activeStage === 4}
            {...commonDragProps}
          >
              <div className="space-y-6">
                {project.outputs.length === 0 && !project.isThinking && (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      Outputs will appear here.
                    </div>
                )}

                {project.isThinking && activeStage === 4 && (
                    <div className="flex flex-col items-center justify-center py-10 text-emerald-500">
                      <Loader2 className="animate-spin mb-2" size={32} />
                      <span className="text-xs font-mono">Generating Pixels...</span>
                    </div>
                )}

                {project.outputs.map((out, idx) => (
                    <div key={out.id} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="relative aspect-video bg-slate-200 group cursor-zoom-in" onClick={() => setFullscreenMedia({url: out.videoUrl || out.imageUrl!, type: out.videoUrl ? 'video' : 'image'})}>
                          {out.videoUrl ? (
                            <video src={out.videoUrl} className="w-full h-full object-cover pointer-events-none" />
                          ) : (
                            <img src={out.imageUrl} alt="output" className="w-full h-full object-cover" />
                          )}
                          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded backdrop-blur-md uppercase font-bold">
                            {out.type}
                          </div>
                          
                          {/* Quick Actions Overlay - Pointer events disabled so click passes to image for fullscreen */}
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4 pointer-events-none">
                             {/* Row 1: Main Actions */}
                             <div className="flex gap-2 pointer-events-auto">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleDownload(out.imageUrl || out.videoUrl!, out.id); }}
                                 className="px-3 py-2 bg-white text-slate-900 rounded-lg hover:scale-105 transition-transform flex items-center gap-2 text-xs font-bold shadow-lg" 
                                 title="Download"
                               >
                                  <Download size={14} /> Download
                               </button>
                               <button 
                                 onClick={(e) => { e.stopPropagation(); deleteOutput(out.id); }}
                                 className="px-3 py-2 bg-red-500 text-white rounded-lg hover:scale-105 transition-transform flex items-center gap-2 text-xs font-bold shadow-lg hover:bg-red-600" 
                                 title="Delete"
                               >
                                  <Trash2 size={14} />
                               </button>
                             </div>

                             {/* Row 2: Reuse Actions (Images Only) */}
                             {!out.videoUrl && (
                               <div className="flex gap-2 w-full justify-center border-t border-white/20 pt-3 mt-1 pointer-events-auto">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleReuse(out, 'context'); }} 
                                    className="px-3 py-1.5 bg-slate-700/80 text-white border border-slate-600 rounded-md hover:bg-slate-600 text-[10px] flex items-center gap-1.5 transition-colors"
                                    title="Add to Project Context"
                                  >
                                    <FileText size={10} /> To Context
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleReuse(out, 'reference'); }} 
                                    className="px-3 py-1.5 bg-blue-900/80 text-white border border-blue-700 rounded-md hover:bg-blue-800 text-[10px] flex items-center gap-1.5 transition-colors"
                                    title="Use as Base Image"
                                  >
                                    <ImageIcon size={10} /> To Base Image
                                  </button>
                               </div>
                             )}
                          </div>
                      </div>
                    </div>
                ))}
              </div>
          </WorkflowNode>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden flex flex-col font-sans text-slate-900">
       {/* Background Grid Pattern */}
       <div className="fixed inset-0 pointer-events-none opacity-[0.03]" 
            style={{ 
              backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', 
              backgroundSize: '20px 20px' 
            }} 
       />

       {/* Fullscreen Overlay */}
       {fullscreenMedia && (
         <div 
           className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-8 cursor-pointer"
           onClick={() => setFullscreenMedia(null)}
         >
            <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
               {fullscreenMedia.type === 'video' ? (
                 <video src={fullscreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
               ) : (
                 <img src={fullscreenMedia.url} alt="Fullscreen" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
               )}
               <button 
                 onClick={() => setFullscreenMedia(null)}
                 className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white bg-white/10 rounded-full"
               >
                 <X size={24} />
               </button>
            </div>
         </div>
       )}

       {/* Top Bar */}
       <header className="px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">AF</div>
            <h1 className="font-bold text-lg text-slate-800">ArchiFlow AI</h1>
          </div>
          <div className="text-xs text-slate-400">Workflow Mode</div>
       </header>

       {/* Horizontal Canvas with Two Streams */}
       <main 
         className="flex-1 overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing p-12 custom-scrollbar flex flex-col gap-12"
         ref={scrollRef}
       >
         {/* Main Production Flow */}
         <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-2">Production Pipeline</div>
            <div className="flex flex-row items-start min-w-max">
                {mainNodes.map((nodeId, index) => (
                  <React.Fragment key={nodeId}>
                      {renderNode(nodeId, index, 'main')}
                      {index < mainNodes.length - 1 && <Connector active={false} />}
                  </React.Fragment>
                ))}
            </div>
         </div>

         {/* Prompt Lab Flow */}
         <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-4 ml-2">Experimental Lab</div>
            <div className="flex flex-row items-start min-w-max">
                {labNodes.map((nodeId, index) => (
                  <React.Fragment key={nodeId}>
                      {renderNode(nodeId, index, 'lab')}
                      {index < labNodes.length - 1 && <Connector active={false} />}
                  </React.Fragment>
                ))}
            </div>
         </div>
       </main>
    </div>
  );
};

export default App;