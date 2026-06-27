import { GoogleGenAI } from "@google/genai";
import type { Tema } from "./worldMaster";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

// Generate a single image with Imagen 3 and return it as a data URL.
// Returns null gracefully when the API key is missing or the call fails.
const STYLE: Record<Tema, string> = {
  cyberpunk: "cyberpunk pixel art, 16-bit retro RPG, neon colors, rain",
  dnd: "fantasy pixel art, 16-bit retro RPG, medieval, torch light",
};

export async function renderImage(
  prompt: string,
  aspectRatio: "1:1" | "16:9" = "1:1",
  tema: Tema = "cyberpunk",
): Promise<string | null> {
  if (!process.env.GOOGLE_API_KEY) return null;
  try {
    const styledPrompt = `${prompt}, ${STYLE[tema]}`;
    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt: styledPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/jpeg",
        aspectRatio,
      },
    });
    const bytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!bytes) return null;
    return `data:image/jpeg;base64,${bytes}`;
  } catch (err) {
    console.error("[imageMaster] error:", err);
    return null;
  }
}
