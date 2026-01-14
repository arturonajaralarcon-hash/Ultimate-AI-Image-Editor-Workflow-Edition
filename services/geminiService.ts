import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio, ImageSize } from "../types";

// Helper to convert File to Base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is "data:mime/type;base64,....."
      const result = reader.result as string;
      const base64String = result.split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 1. Analyze Context & Refine Prompt (Thinking Mode + Search)
export const refineArchitecturalPrompt = async (
  userDescription: string,
  contextFiles: File[]
): Promise<{ refinedPrompt: string; thoughts: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [{ text: `You are an expert architectural prompt engineer. 
  Your task is to take a user's rough description of an architectural project and convert it into a highly detailed, photorealistic prompt suitable for image generation models. 
  Analyze any provided context files (images, PDFs, text documents) for style, requirements, materials, and form.
  
  User Description: ${userDescription}
  
  Please provide:
  1. A short analysis of the requirements.
  2. A Final Detailed Prompt that captures every nuance.` }];

  for (const file of contextFiles) {
    const filePart = await fileToGenerativePart(file);
    parts.push(filePart);
  }

  // Uses Gemini 3 Pro with Thinking for complex reasoning
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      thinkingConfig: { thinkingBudget: 32768 }, // Max thinking
      tools: [{ googleSearch: {} }] // Use search to understand architectural terms/locations if needed
    }
  });

  // Extract thoughts if available (though usually internal, the model output contains the reasoning)
  return {
    refinedPrompt: response.text || "Failed to generate prompt.",
    thoughts: "Thinking process complete."
  };
};

// 1.5 Enhance Prompt (The "Agent" Logic)
export const enhanceArchitecturalPrompt = async (
  currentPrompt: string,
  userInstruction: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Constructed based on "Gemini Image Prompt Enhancement Agent" profile
  const systemInstruction = `
    You are the Gemini Image Prompt Enhancement Agent (Version 1.0).
    Your goal is to refine and enhance user-provided prompts for an image editing application.
    
    CORE RULES:
    1. Reference Integrity: Preserve all '@' prefixed database references and external references exactly as they appear.
    2. Command Translation: Translate shape-based commands (e.g., "Remove RED marked shapes") into explicit instructions:
       - "Remove [COLOR]" -> "Remove the elements contained within the area marked in [COLOR]. After the removal, seamlessly blend the resulting area with the surrounding landscape and eliminate any visible [COLOR] sketch lines."
       - "Insert in [COLOR]" -> "Inside the area marked in [COLOR], insert [SUBJECT]. Ensure lighting, shadows, and perspective match. After insertion, remove any visible [COLOR] guide lines."
    3. Mandatory Cleanup: If shape-based editing is requested, ALWAYS add instructions to remove guide lines and blend.
    4. No Invented Content: Do not add thematic elements not implied by the request.
    5. Output: Return ONLY the refined prompt text. No markdown, no conversation.

    CONTEXT - GEMINI GEMS RECIPES (Use these to enhance detail if generic terms are used):
    - Lighting: Golden Hour, Soft Natural, Dramatic, Bioluminescent.
    - Style: Photorealistic, Brutalist, Organic, Minimalist.
    - Materials: Glass, Steel, Corten, Concrete, Bamboo.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { text: `Current Prompt: "${currentPrompt}"` },
        { text: `User Instruction/Refinement Request: "${userInstruction}"` },
        { text: `Refine the prompt based on the instruction. If the instruction implies shape editing (Red/Blue/Green/Yellow), apply the specific translation rules.` }
      ]
    },
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7 
    }
  });

  return response.text || currentPrompt;
};

// 2. Generate/Edit Concept (Gemini 2.5 Flash Image - Nano Banana)
export const generateConceptImage = async (
  prompt: string,
  referenceImage?: File,
  aspectRatio: AspectRatio = AspectRatio.LANDSCAPE_16_9
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [];
  
  if (referenceImage) {
    const imgPart = await fileToGenerativePart(referenceImage);
    parts.push(imgPart);
    parts.push({ text: `Edit this image based on the following instructions: ${prompt}` });
  } else {
    parts.push({ text: prompt });
  }

  // Gemini 2.5 Flash Image for fast editing/generation
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
        // Nano banana models don't support responseMimeType or flexible imageConfig like Pro
        // But we can prompt for aspect ratio in text if needed, or rely on input image dimensions
    }
  });

  // Handle response
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

// 3. Generate Hyper-Realistic Render (Gemini 3 Pro Image)
export const generateHighResRender = async (
  prompt: string,
  aspectRatio: AspectRatio,
  resolution: ImageSize
): Promise<string> => {
  // Ensure we get a fresh key if user selected one via aistudio, though typically process.env.API_KEY is fine if injected
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Gemini 3 Pro Image supports specific config for size and AR
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: `Hyper-realistic architectural render, 8k, detailed textures, dramatic lighting. ${prompt}` }] },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: resolution
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No high-res image generated");
};

// 4. Generate Video (Veo)
export const generateArchitecturalVideo = async (
  imageFile: File,
  prompt: string
): Promise<string> => {
  // Check for API Key selection for Veo
  if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
     await window.aistudio.openSelectKey();
  }

  // Re-init with potentially new key context
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imgData = await fileToGenerativePart(imageFile);

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Cinematic architectural tour. ${prompt}`,
    image: {
        imageBytes: imgData.inlineData.data,
        mimeType: imgData.inlineData.mimeType
    },
    config: {
      numberOfVideos: 1,
      resolution: '1080p',
      aspectRatio: '16:9' // Veo supports 16:9 or 9:16
    }
  });

  // Poll for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed");

  // Fetch actual video bytes
  const vidResponse = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
  const blob = await vidResponse.blob();
  return URL.createObjectURL(blob);
};