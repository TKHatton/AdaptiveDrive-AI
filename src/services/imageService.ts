import { GoogleGenAI } from "@google/genai";

let cachedImages: Map<string, string> = new Map();

export async function generateEnvironmentImage(prompt: string): Promise<string | null> {
  // Check cache first
  if (cachedImages.has(prompt)) {
    return cachedImages.get(prompt)!;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. Skipping environment image generation.");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const dataUrl = `data:image/png;base64,${part.inlineData.data}`;
        cachedImages.set(prompt, dataUrl);
        return dataUrl;
      }
    }
  } catch (error: any) {
    console.warn("Environment image generation failed:", error?.message || error);
    // Non-critical failure. The 3D scene works fine without a generated background.
  }

  return null;
}
