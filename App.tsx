import React, { useState, useRef, useEffect } from 'react';
import { 
  ProjectState, 
  ReferenceFile, 
  GeneratedOutput, 
  AspectRatio, 
  ImageSize 
} from './types';
import { WorkflowNode } from './components/WorkflowNode';
import { 
  refineArchitecturalPrompt, 
  enhanceArchitecturalPrompt,
  generateConceptImage, 
  generateHighResRender, 
  generateArchitecturalVideo 
} from './services/geminiService';
import { 
  Upload, 
  Loader2, 
  Image as ImageIcon, 
  Wand2,
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
  Save,
  Library,
  Copy,
  MousePointer2
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

interface NodePosition {
  x: number;
  y: number;
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

  // Canvas State
  const [positions, setPositions] = useState<Record<NodeId, NodePosition>>({
    context: { x: 100, y: 100 },
    reference: { x: 100, y: 500 },
    prompt_lab: { x: 600, y: 100 },
    saved_prompts: { x: 1000, y: 100 },
    prompt: { x: 600, y: 500 },
    visualization: { x: 1100, y: 500 },
  });

  const [draggingNode, setDraggingNode] = useState<NodeId | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeStage, setActiveStage] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag Logic
  const handleMouseDown = (e: React.MouseEvent, id: NodeId) => {
    e.stopPropagation();
    const nodePos = positions[id];
    setDragOffset({
      x: e.clientX - nodePos.x,
      y: e.clientY - nodePos.y
    });
    setDraggingNode(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      setPositions(prev => ({
        ...prev,
        [draggingNode]: {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        }
      }));
    }
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
  };

  // Connection Drawing
  const drawConnection = (from: NodeId, to: NodeId) => {
    const p1 = positions[from];
    const p2 = positions[to];
    // Node width is w-96 = 384px.
    // Start well inside the first node (right side) and end well inside the second node (left side)
    // to ensure the line seems to emerge from behind without gaps.
    
    const startX = p1.x + 340; // 44px overlap inside the source node
    const startY = p1.y + 40;  // Roughly centered in the header
    
    const endX = p2.x + 44;    // 44px overlap inside the target node
    const endY = p2.y + 40;

    const deltaX = Math.abs(endX - startX);
    // Ensure control points create a nice S-curve even if nodes are close horizontally
    const controlPointOffset = Math.max(deltaX * 0.4, 80); 

    const path = `M ${startX} ${startY} C ${startX + controlPointOffset} ${startY}, ${endX - controlPointOffset} ${endY}, ${endX} ${endY}`;

    return (
      <path 
        d={path} 
        stroke="#475569" 
        strokeWidth="3" 
        fill="none" 
        strokeDasharray="6,4"
        className="animate-pulse-slow opacity-60"
      />
    );
  };

  // --- Handlers (Same as before) ---
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
    if (!output.imageUrl) return;
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

  const renderNode = (id: NodeId) => {
    const commonProps = {
        position: positions[id],
        onMouseDown: (e: React.MouseEvent) => handleMouseDown(e, id)
    };

    switch (id) {
      case 'context':
        return (
          <WorkflowNode 
            key={id}
            title="1. Documents & Consigna" 
            icon={FileText} 
            color="blue"
            isActive={activeStage === 1}
            status={project.contextFiles.length > 0 ? `${project.contextFiles.length} Files` : "0 Files"}
            {...commonProps}
          >
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Description</label>
                <textarea
                  className="w-full p-2 border border-slate-700 rounded bg-slate-800 text-slate-200 text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-none h-24"
                  placeholder="Describe vision..."
                  value={project.description}
                  onChange={(e) => setProject(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                  {project.contextFiles.map(f => (
                      <div key={f.id} className="aspect-square bg-slate-800 rounded border border-slate-700 relative group overflow-hidden">
                        {f.type === 'image' ? (
                          <img src={f.previewUrl} className="w-full h-full object-cover" alt="ref" />
                        ) : (
                          <div className="flex items-center justify-center h-full"><FileGeneric size={16} className="text-slate-500"/></div>
                        )}
                        <button onClick={() => deleteContextFile(f.id)} className="absolute top-0 right-0 p-1 bg-red-500/80 text-white opacity-0 group-hover:opacity-100"><X size={10}/></button>
                      </div>
                  ))}
                  <label className="aspect-square border border-dashed border-slate-700 rounded flex items-center justify-center hover:bg-slate-800 cursor-pointer text-slate-500 hover:text-blue-400 transition-colors">
                    <Upload size={14} />
                    <input type="file" multiple accept="image/*,.pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'context')} />
                  </label>
              </div>
              <button 
                onClick={() => setActiveStage(2)} 
                className="w-full py-1.5 bg-blue-600/20 text-blue-400 border border-blue-600/50 rounded hover:bg-blue-600 hover:text-white transition-all text-xs font-bold"
              >
                Confirm & Next
              </button>
            </div>
          </WorkflowNode>
        );

      case 'reference':
        return (
          <WorkflowNode 
            key={id}
            title="2. Base Image (Optional)" 
            icon={ImageIcon} 
            color="purple"
            isActive={activeStage === 2}
            status={project.exactReferences.length > 0 ? "Ready" : "Optional"}
            {...commonProps}
          >
            <div className="space-y-3">
                <div className="border border-dashed border-slate-700 bg-slate-800/50 rounded-lg p-3 flex flex-col items-center justify-center min-h-[100px]">
                  {project.exactReferences.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {project.exactReferences.map(f => (
                          <div key={f.id} className="relative aspect-video rounded overflow-hidden border border-slate-600 group">
                            <img src={f.previewUrl} alt="exact" className="w-full h-full object-cover" />
                            <button onClick={() => deleteReference(f.id)} className="absolute top-0 right-0 p-1 bg-red-500 text-white opacity-0 group-hover:opacity-100"><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-500">No image selected</span>
                    </div>
                  )}
                  <label className="mt-2 px-3 py-1 text-[10px] font-bold text-purple-400 bg-purple-900/20 border border-purple-500/30 rounded cursor-pointer hover:bg-purple-900/40">
                      Upload Image
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'exact')} />
                  </label>
                </div>
                <button 
                  onClick={generatePrompt}
                  disabled={project.isThinking}
                  className="w-full py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-50"
                >
                  {project.isThinking ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                  Generate Prompt
                </button>
            </div>
          </WorkflowNode>
        );

      case 'prompt_lab':
        return (
          <WorkflowNode 
            key={id}
            title="Prompt Lab" 
            icon={FlaskConical} 
            color="amber"
            status={labOutput ? "Result Ready" : "Idle"}
            {...commonProps}
          >
             <div className="space-y-2">
               <div>
                  <label className="text-[10px] font-bold text-slate-500 block">Base</label>
                  <input 
                    className="w-full p-1.5 border border-slate-700 bg-slate-800 text-slate-300 rounded text-xs outline-none focus:border-amber-500"
                    value={labInput}
                    onChange={e => setLabInput(e.target.value)}
                  />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 block">Instruction</label>
                  <input 
                    className="w-full p-1.5 border border-slate-700 bg-slate-800 text-slate-300 rounded text-xs outline-none focus:border-amber-500"
                    value={labInstruction}
                    onChange={e => setLabInstruction(e.target.value)}
                  />
               </div>
               <div className="flex gap-2 pt-1">
                 <button onClick={handleLabGenerate} disabled={labLoading} className="flex-1 py-1 bg-amber-600 text-white text-xs font-bold rounded">
                    {labLoading ? <Loader2 className="animate-spin inline" size={10} /> : "Test"}
                 </button>
                 {labOutput && (
                    <button onClick={() => handleSavePrompt(labOutput, labInstruction)} className="px-2 bg-slate-700 text-amber-400 rounded border border-slate-600"><Save size={12}/></button>
                 )}
               </div>
               {labOutput && (
                 <textarea 
                    className="w-full h-20 p-2 bg-slate-950 border border-slate-800 text-amber-100 text-[10px] font-mono rounded resize-none"
                    value={labOutput}
                    onChange={(e) => setLabOutput(e.target.value)}
                 />
               )}
             </div>
          </WorkflowNode>
        );

      case 'saved_prompts':
        return (
          <WorkflowNode 
            key={id}
            title="Saved Library" 
            icon={Library} 
            color="amber"
            status={`${savedPrompts.length} Items`}
            {...commonProps}
          >
             <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
               {savedPrompts.length === 0 ? (
                 <div className="text-center py-4 text-slate-600 text-[10px]">Empty</div>
               ) : (
                 savedPrompts.map((p) => (
                   <div key={p.id} className="bg-slate-800 border border-slate-700 rounded p-2 group">
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-amber-500 font-bold">{p.instruction}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                            <button onClick={() => navigator.clipboard.writeText(p.text)} className="text-slate-400 hover:text-white"><Copy size={10}/></button>
                            <button onClick={() => deleteSavedPrompt(p.id)} className="text-red-400 hover:text-red-300"><Trash2 size={10}/></button>
                        </div>
                     </div>
                     <p className="text-[10px] text-slate-400 line-clamp-2 font-mono">{p.text}</p>
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
            title="3. Prompt Engine" 
            icon={Sparkles} 
            color="emerald"
            isActive={activeStage === 3}
            status={project.generatedPrompt ? "Prompt Ready" : "Waiting..."}
            {...commonProps}
          >
              <div className="space-y-3">
                {project.exactReferences.length > 0 && (
                    <select 
                        className="w-full text-xs p-1 bg-slate-800 border border-slate-700 text-slate-300 rounded"
                        onChange={(e) => setProject(p => ({...p, selectedExactReferenceId: e.target.value}))}
                        value={project.selectedExactReferenceId || ''}
                    >
                        {project.exactReferences.map(r => <option key={r.id} value={r.id}>Apply to: {r.name}</option>)}
                    </select>
                )}

                <div className="bg-emerald-900/10 border border-emerald-500/20 p-2 rounded">
                    <input 
                        className="w-full bg-transparent text-xs text-emerald-300 placeholder-emerald-700 outline-none border-b border-emerald-800 mb-2 pb-1"
                        placeholder="Refine instruction..."
                        value={refinementInstruction}
                        onChange={(e) => setRefinementInstruction(e.target.value)}
                    />
                    <button onClick={handleRefinePrompt} disabled={!refinementInstruction || project.isThinking} className="w-full py-1 text-[10px] bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/40 uppercase font-bold">
                        {project.isThinking ? "Refining..." : "Refine"}
                    </button>
                </div>

                <div className="relative">
                    <textarea 
                      className="w-full p-2 border border-slate-700 rounded bg-slate-900 text-slate-300 text-[10px] font-mono h-32 resize-none focus:border-emerald-500 outline-none"
                      value={project.generatedPrompt}
                      onChange={(e) => setProject(p => ({ ...p, generatedPrompt: e.target.value }))}
                      placeholder="Generated prompt..."
                    />
                    {project.generatedPrompt && (
                        <button onClick={() => handleSavePrompt(project.generatedPrompt, 'Engine')} className="absolute top-1 right-1 p-1 bg-slate-800 border border-slate-600 rounded text-slate-400 hover:text-white"><Save size={10}/></button>
                    )}
                </div>

                <div className="flex justify-between items-center gap-2">
                    <select 
                        className="flex-1 text-[10px] bg-slate-800 text-slate-400 border border-slate-700 rounded p-1"
                        value={project.selectedAspectRatio}
                        onChange={(e) => setProject(p => ({ ...p, selectedAspectRatio: e.target.value as AspectRatio }))}
                    >
                        {Object.values(AspectRatio).map(ar => <option key={ar} value={ar}>{ar}</option>)}
                    </select>
                    <button 
                        onClick={handleGenerateConcepts}
                        disabled={project.isThinking || !project.generatedPrompt}
                        className="flex-1 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-500 disabled:opacity-50"
                    >
                        Render
                    </button>
                </div>
              </div>
          </WorkflowNode>
        );

      case 'visualization':
        return (
          <WorkflowNode 
            key={id}
            title="4. Visualization" 
            icon={Layers} 
            color="indigo"
            isActive={activeStage === 4}
            status={project.outputs.length > 0 ? `${project.outputs.length} Renders` : "Waiting for inputs..."}
            {...commonProps}
          >
              <div className="space-y-3">
                {project.isThinking && activeStage === 4 && (
                    <div className="flex items-center justify-center py-4 text-indigo-400">
                      <Loader2 className="animate-spin mr-2" size={16} />
                      <span className="text-xs">Processing...</span>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                    {project.outputs.map((out) => (
                        <div key={out.id} className="relative aspect-video bg-slate-900 rounded border border-slate-700 group overflow-hidden shadow-lg cursor-zoom-in" onClick={() => setFullscreenMedia({url: out.videoUrl || out.imageUrl!, type: out.videoUrl ? 'video' : 'image'})}>
                             <img src={out.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity pointer-events-none">
                                <div className="flex gap-1 pointer-events-auto">
                                    <button onClick={(e) => { e.stopPropagation(); handleDownload(out.imageUrl || '', out.id) }} className="p-1.5 bg-white text-black rounded hover:bg-slate-200"><Download size={12}/></button>
                                    {!out.videoUrl && (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); handleReuse(out, 'context') }} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-500" title="To Context"><FileText size={12}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleReuse(out, 'reference') }} className="p-1.5 bg-purple-600 text-white rounded hover:bg-purple-500" title="To Base"><ImageIcon size={12}/></button>
                                        </>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); deleteOutput(out.id) }} className="p-1.5 bg-red-600 text-white rounded hover:bg-red-500"><Trash2 size={12}/></button>
                                </div>
                             </div>
                        </div>
                    ))}
                </div>
              </div>
          </WorkflowNode>
        );
      
      default:
        return null;
    }
  };

  return (
    <div 
        className="w-screen h-screen bg-slate-950 overflow-hidden font-sans text-slate-200 relative select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={containerRef}
    >
       {/* Background Grid Pattern */}
       <div className="absolute inset-0 pointer-events-none opacity-20" 
            style={{ 
              backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', 
              backgroundSize: '24px 24px' 
            }} 
       />

       {/* Fullscreen Overlay */}
       {fullscreenMedia && (
         <div 
           className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-8 cursor-pointer"
           onClick={() => setFullscreenMedia(null)}
         >
            <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
               {fullscreenMedia.type === 'video' ? (
                 <video src={fullscreenMedia.url} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl border border-slate-800" />
               ) : (
                 <img src={fullscreenMedia.url} alt="Fullscreen" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl border border-slate-800" />
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

       {/* SVG Layer for Connections */}
       <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
         {drawConnection('context', 'reference')}
         {drawConnection('reference', 'prompt')}
         {drawConnection('prompt', 'visualization')}
         {drawConnection('prompt_lab', 'saved_prompts')}
       </svg>

       {/* Node Canvas */}
       <div className="absolute inset-0 z-10">
          {renderNode('context')}
          {renderNode('reference')}
          {renderNode('prompt_lab')}
          {renderNode('saved_prompts')}
          {renderNode('prompt')}
          {renderNode('visualization')}
       </div>

       {/* Floating UI: Instructions / Header */}
       <div className="fixed top-4 left-4 z-50 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-3 rounded-lg shadow-xl flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">AF</div>
             <div>
                <h1 className="font-bold text-sm text-white">ArchiFlow AI</h1>
                <p className="text-[10px] text-slate-400">Infinite Canvas • Gemini Powered</p>
             </div>
          </div>
       </div>

       <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-full shadow-xl text-[10px] text-slate-400 flex items-center gap-2">
             <MousePointer2 size={12} /> Drag nodes to rearrange
          </div>
       </div>

    </div>
  );
};

export default App;