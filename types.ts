export enum AppStep {
  INITIAL_INPUT = 0,
  REFERENCE_UPLOAD = 1,
  PROMPT_ENGINEERING = 2,
  GENERATION = 3,
  FINAL_OUTPUT = 4
}

export enum AspectRatio {
  SQUARE = '1:1',
  LANDSCAPE_4_3 = '4:3',
  LANDSCAPE_16_9 = '16:9',
  PORTRAIT_3_4 = '3:4',
  PORTRAIT_9_16 = '9:16',
  ULTRAWIDE = '21:9'
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K'
}

export interface ReferenceFile {
  id: string;
  file: File;
  previewUrl: string; // URL for image preview or icon
  name: string;
  type: 'image' | 'pdf' | 'text' | 'other';
}

export interface GeneratedOutput {
  id: string;
  imageUrl?: string;
  videoUrl?: string;
  prompt: string;
  type: 'concept' | 'hyper-realistic' | 'video';
  baseImageId?: string; // If based on a reference
}

export interface ProjectState {
  description: string;
  contextFiles: ReferenceFile[]; // Initial docs/images
  exactReferences: ReferenceFile[]; // Images to edit
  generatedPrompt: string;
  thinkingProcess: string; // To show the "thought" trace
  outputs: GeneratedOutput[];
  isThinking: boolean;
  selectedAspectRatio: AspectRatio;
  selectedResolution: ImageSize;
  selectedExactReferenceId?: string; // Which reference image to apply the prompt to
}