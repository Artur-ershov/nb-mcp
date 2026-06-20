import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { generateImage, editImage } from "@/lib/nanobanana";

// nano banana calls can take a while — run on Node and give it room.
export const runtime = "nodejs";
export const maxDuration = 60;

const ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "21:9",
] as const;

type ImageContent = { type: "image"; data: string; mimeType: string };
type TextContent = { type: "text"; text: string };

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "generate_image",
      "Generate an image from a text prompt using Google's nano banana (Gemini 2.5 Flash Image). " +
        "Use for illustrations, mockups, logos, icons, backgrounds, concept art, product shots and other " +
        "visuals described in words. The generated image is returned inline.",
      {
        prompt: z
          .string()
          .min(1)
          .describe(
            "Detailed description of the image to generate. Be specific about subject, style, " +
              "composition, colours, lighting and mood for best results.",
          ),
        aspect_ratio: z
          .enum(ASPECT_RATIOS)
          .optional()
          .describe("Optional aspect ratio, e.g. '1:1' (square), '16:9' (wide), '9:16' (tall)."),
      },
      async ({ prompt, aspect_ratio }) => {
        try {
          const { images, text } = await generateImage(prompt, aspect_ratio);
          const content: Array<ImageContent | TextContent> = images.map((img) => ({
            type: "image",
            data: img.data,
            mimeType: img.mimeType,
          }));
          content.push({
            type: "text",
            text: text || `Generated ${images.length} image(s) with nano banana.`,
          });
          return { content };
        } catch (err) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Image generation failed: ${(err as Error).message}` },
            ],
          };
        }
      },
    );

    server.tool(
      "edit_image",
      "Edit, restyle, or combine existing image(s) with a natural-language instruction using nano banana " +
        "(Gemini 2.5 Flash Image). Provide one or more publicly reachable image URLs plus a prompt describing " +
        "the change (e.g. swap the background, change the style, add/remove an object, or blend several images " +
        "into one). The result is returned inline.",
      {
        prompt: z
          .string()
          .min(1)
          .describe("Instruction describing how to edit or combine the source image(s)."),
        image_urls: z
          .array(z.string().url())
          .min(1)
          .max(4)
          .describe(
            "Publicly reachable URL(s) of the source image(s). Pass multiple to compose/blend them.",
          ),
        aspect_ratio: z
          .enum(ASPECT_RATIOS)
          .optional()
          .describe("Optional output aspect ratio."),
      },
      async ({ prompt, image_urls, aspect_ratio }) => {
        try {
          const { images, text } = await editImage(prompt, image_urls, aspect_ratio);
          const content: Array<ImageContent | TextContent> = images.map((img) => ({
            type: "image",
            data: img.data,
            mimeType: img.mimeType,
          }));
          content.push({ type: "text", text: text || "Edited image with nano banana." });
          return { content };
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text", text: `Image edit failed: ${(err as Error).message}` }],
          };
        }
      },
    );
  },
  {
    // Shown to MCP clients (e.g. in Claude's connector list).
    serverInfo: {
      name: "nb-mcp",
      version: "0.1.0",
    },
  },
  {
    // Adapter config. Route lives at app/[transport]/route.ts, so basePath "/"
    // exposes the Streamable HTTP transport at "/mcp". Stateless (no Redis) is
    // fine for request/response tools.
    basePath: "/",
    verboseLogs: true,
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
