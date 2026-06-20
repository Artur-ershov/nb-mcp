import { GoogleGenAI } from "@google/genai";

/**
 * Framework-agnostic wrapper around Google's "nano banana" image models
 * (Gemini 2.5 Flash Image and friends). Kept independent of MCP/Next.js so it
 * can be reused if the server is ever hosted somewhere other than Vercel.
 */

const DEFAULT_MODEL = "gemini-2.5-flash-image";

export interface GeneratedImage {
  /** Base64-encoded image bytes (no data: prefix). */
  data: string;
  /** MIME type, e.g. "image/png". */
  mimeType: string;
}

export interface NanoBananaResult {
  images: GeneratedImage[];
  /** Any text the model returned alongside the image(s). */
  text: string;
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it as an environment variable on the server. " +
        "Get a key at https://aistudio.google.com/apikey",
    );
  }
  return new GoogleGenAI({ apiKey });
}

function getModel(): string {
  return process.env.NB_MODEL?.trim() || DEFAULT_MODEL;
}

/** Pull image + text parts out of a generateContent response. */
function extractResult(response: unknown): NanoBananaResult {
  const parts =
    (response as { candidates?: { content?: { parts?: unknown[] } }[] })
      ?.candidates?.[0]?.content?.parts ?? [];

  const images: GeneratedImage[] = [];
  let text = "";

  for (const part of parts as Array<{
    text?: string;
    inlineData?: { data?: string; mimeType?: string };
  }>) {
    if (part?.inlineData?.data) {
      images.push({
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      });
    } else if (part?.text) {
      text += part.text;
    }
  }

  return { images, text: text.trim() };
}

function withAspectRatio(prompt: string, aspectRatio?: string): string {
  if (!aspectRatio) return prompt;
  return `${prompt}\n\nRender the image with an aspect ratio of ${aspectRatio}.`;
}

/** Generate an image from a text prompt. */
export async function generateImage(
  prompt: string,
  aspectRatio?: string,
): Promise<NanoBananaResult> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: withAspectRatio(prompt, aspectRatio),
  });

  const result = extractResult(response);
  if (result.images.length === 0) {
    throw new Error(
      result.text ||
        "The model did not return an image. Try rephrasing or simplifying the prompt.",
    );
  }
  return result;
}

/** Fetch a remote image and turn it into a Gemini inlineData part. */
async function fetchImagePart(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch source image from ${url} (HTTP ${res.status}).`);
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { inlineData: { mimeType, data: buffer.toString("base64") } };
}

/** Edit / transform / combine one or more existing images. */
export async function editImage(
  prompt: string,
  imageUrls: string[],
  aspectRatio?: string,
): Promise<NanoBananaResult> {
  const ai = getClient();
  const imageParts = await Promise.all(imageUrls.map(fetchImagePart));

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: [{ text: withAspectRatio(prompt, aspectRatio) }, ...imageParts],
  });

  const result = extractResult(response);
  if (result.images.length === 0) {
    throw new Error(
      result.text || "The model did not return an edited image. Try a clearer instruction.",
    );
  }
  return result;
}

export const activeModel = getModel;
