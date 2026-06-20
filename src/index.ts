/**
 * nb-mcp — a remote MCP server on Cloudflare Workers for image generation.
 *
 * Tool:
 *   - generate_image: text prompt -> image
 *
 * Backends:
 *   - "workers-ai" (default): Cloudflare Workers AI (Flux). Free, no API key — great for testing.
 *   - "nano-banana": Google Gemini 2.5 Flash Image (needs GEMINI_API_KEY + billing on the Google project).
 *
 * Transport: stateless Streamable HTTP MCP at POST /mcp. Add the deployed
 * https://<worker>.workers.dev/mcp URL as a custom connector in Claude.
 */

interface Env {
  /** Workers AI binding (configured in wrangler.toml). */
  AI: { run: (model: string, inputs: unknown, options?: unknown) => Promise<unknown> };
  /** Optional — only needed for the "nano-banana" (Gemini) backend. */
  GEMINI_API_KEY?: string;
  /** Optional default backend: "workers-ai" | "nano-banana". */
  NB_BACKEND?: string;
  /** Optional Workers AI model override. */
  NB_WORKERS_MODEL?: string;
  /** Optional Gemini model override. */
  NB_GEMINI_MODEL?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

const SERVER_INFO = { name: "nb-mcp", version: "0.1.0" };
const DEFAULT_PROTOCOL = "2025-06-18";
const DEFAULT_WORKERS_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-image";

const TOOLS = [
  {
    name: "generate_image",
    description:
      "Generate an image from a text prompt. By default uses Cloudflare Workers AI (Flux), " +
      "which is free and needs no API key — ideal for quick testing. Can optionally use Google " +
      "nano banana (Gemini 2.5 Flash Image) when GEMINI_API_KEY is configured. The image is returned inline.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Detailed description of the image. Be specific about subject, style, composition, colours, lighting and mood.",
        },
        backend: {
          type: "string",
          enum: ["workers-ai", "nano-banana"],
          description:
            "Model to use. 'workers-ai' (default) is free Cloudflare Flux; 'nano-banana' is Google Gemini (needs GEMINI_API_KEY).",
        },
        steps: {
          type: "integer",
          minimum: 1,
          maximum: 8,
          description: "Workers AI (Flux) diffusion steps, 1-8. Higher = better/slower. Default 4.",
        },
      },
      required: ["prompt"],
    },
  },
];

// ----------------------------- backends -----------------------------

function clampSteps(steps: unknown): number {
  if (typeof steps !== "number" || !Number.isFinite(steps)) return 4;
  return Math.max(1, Math.min(8, Math.round(steps)));
}

async function generateWithWorkersAI(env: Env, prompt: string, steps: unknown): Promise<Content[]> {
  const model = env.NB_WORKERS_MODEL || DEFAULT_WORKERS_MODEL;
  const res = (await env.AI.run(model, { prompt, steps: clampSteps(steps) })) as { image?: string };
  if (!res?.image) {
    throw new Error("Workers AI did not return an image.");
  }
  // Flux schnell returns a base64-encoded JPEG.
  return [
    { type: "image", data: res.image, mimeType: "image/jpeg" },
    { type: "text", text: `Generated with Cloudflare Workers AI (${model}).` },
  ];
}

async function generateWithNanoBanana(env: Env, prompt: string): Promise<Content[]> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "The 'nano-banana' backend needs GEMINI_API_KEY. Set it with `wrangler secret put GEMINI_API_KEY` " +
        "and enable billing on the Google project. Use the default 'workers-ai' backend for free generation.",
    );
  }
  const model = env.NB_GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await resp.json()) as Json;
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const out: Content[] = [];
  let text = "";
  for (const p of parts) {
    if (p?.inlineData?.data) {
      out.push({ type: "image", data: p.inlineData.data, mimeType: p.inlineData.mimeType || "image/png" });
    } else if (p?.text) {
      text += p.text;
    }
  }
  if (out.length === 0) {
    throw new Error(text || "nano banana did not return an image.");
  }
  out.push({ type: "text", text: text || `Generated with nano banana (${model}).` });
  return out;
}

async function runTool(env: Env, name: string, args: Json): Promise<Content[]> {
  if (name !== "generate_image") {
    throw new Error(`Unknown tool: ${name}`);
  }
  const prompt = args?.prompt;
  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new Error("'prompt' is required and must be a non-empty string.");
  }
  const backend = String(args?.backend || env.NB_BACKEND || "workers-ai");
  if (backend === "nano-banana") {
    return generateWithNanoBanana(env, prompt);
  }
  return generateWithWorkersAI(env, prompt, args?.steps);
}

// --------------------------- MCP dispatch ---------------------------

function rpcResult(id: Json, result: Json) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: Json, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleMessage(env: Env, msg: Json): Promise<Json | null> {
  const id = msg?.id;
  const method = msg?.method;
  const params = msg?.params;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: params?.protocolVersion || DEFAULT_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });
    case "tools/call": {
      try {
        const content = await runTool(env, params?.name, params?.arguments ?? {});
        return rpcResult(id, { content });
      } catch (e: Json) {
        return rpcResult(id, {
          content: [{ type: "text", text: `Error: ${e?.message || String(e)}` }],
          isError: true,
        });
      }
    }
    default:
      if (isNotification) return null;
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ----------------------------- HTTP ---------------------------------

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function sse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...CORS },
  });
}

const INFO_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>nb-mcp</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:64px auto;padding:0 24px;background:#0b0b0c;color:#f3f3f3;line-height:1.6">
<h1>🍌 nb-mcp</h1>
<p>Remote MCP server for image generation. Free by default via Cloudflare Workers AI (Flux); optional Google nano banana (Gemini).</p>
<p>MCP endpoint: <code>/mcp</code></p>
<p>Add this <code>/mcp</code> URL as a custom connector in Claude → Settings → Connectors.</p>
<p>Tool: <code>generate_image</code> (param <code>backend</code>: <code>workers-ai</code> | <code>nano-banana</code>).</p>
</body></html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(INFO_PAGE, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
      });
    }

    if (url.pathname === "/mcp") {
      if (request.method === "DELETE") {
        return new Response(null, { status: 204, headers: CORS }); // stateless: nothing to clean up
      }
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: CORS });
      }

      let payload: Json;
      try {
        payload = await request.json();
      } catch {
        return new Response(JSON.stringify(rpcError(null, -32700, "Parse error")), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }

      const messages = Array.isArray(payload) ? payload : [payload];
      const responses: Json[] = [];
      for (const m of messages) {
        const r = await handleMessage(env, m);
        if (r !== null) responses.push(r);
      }

      if (responses.length === 0) {
        return new Response(null, { status: 202, headers: CORS }); // only notifications
      }

      const body = responses.map((r) => `event: message\ndata: ${JSON.stringify(r)}\n\n`).join("");
      return sse(body);
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
