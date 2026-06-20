# 🍌 nb-mcp — image generation MCP for Claude

A **remote MCP server** running on **Cloudflare Workers** that lets Claude generate images.
Add it once as a **custom connector** and use it in **Claude Design**, **claude.ai**, and
**Claude Desktop**.

- **Free by default** — uses **Cloudflare Workers AI** (Flux), no API key, no billing. Perfect for testing.
- **Optional nano banana** — switch to Google **Gemini 2.5 Flash Image** when you want (needs a key + billing).

One tool: `generate_image` (text → image), returned inline so Claude can see it.

---

## Why Cloudflare Workers?

Claude's custom connectors are reached **from Anthropic's cloud over the public internet**, so the
server must be hosted. Cloudflare Workers is a great fit: generous free tier, one-command deploy, and
**Workers AI gives free image models via the `env.AI` binding** — so the default path needs no API key
and no billing at all.

---

## Deploy (≈2 minutes)

```bash
npm install
npx wrangler login          # opens a browser; or set CLOUDFLARE_API_TOKEN
npm run deploy
```

Wrangler prints your URL. The MCP endpoint is:

```
https://nb-mcp.<your-subdomain>.workers.dev/mcp
```

Open the root URL in a browser to confirm it's live. That's it — the default **Workers AI** backend
works immediately on the free tier (no key needed).

> **Free tier:** Workers AI includes a daily free allocation, enough for plenty of test images.
> Deploying the Worker itself is also free.

---

## Add it to Claude

1. In Claude, go to **Settings → Connectors** (a.k.a. **Customize → Connectors**).
2. Click **+ Add custom connector**.
3. **Name:** `nano banana` (anything). **URL:** your `…/mcp` URL.
4. Save (no OAuth needed — leave Advanced settings empty).
5. In a chat, open the **+** menu → **Connectors** and enable it, then ask Claude to make an image.

Try:
- “Generate an image of a neon cyberpunk street market, cinematic lighting.”
- “Make a flat-vector logo of a banana wearing sunglasses on white.”

---

## Tool: `generate_image`

| param | type | required | description |
|-------|------|----------|-------------|
| `prompt` | string | ✅ | What to draw. Be specific about subject, style, composition, colours, lighting, mood. |
| `backend` | `workers-ai` \| `nano-banana` | – | Model to use. Default `workers-ai` (free Flux). `nano-banana` = Google Gemini (needs key). |
| `steps` | integer 1–8 | – | Workers AI (Flux) diffusion steps. Higher = better/slower. Default 4. |

---

## Optional: enable nano banana (Gemini)

The repo keeps the original "nano banana" path as an option for when you want Google's model.

```bash
wrangler secret put GEMINI_API_KEY      # paste your Google Gemini key
```

Then either call the tool with `backend: "nano-banana"`, or make it the default by setting
`NB_BACKEND = "nano-banana"` under `[vars]` in `wrangler.toml` and redeploying.

> ⚠️ **Gemini image generation requires billing.** On Google's free tier the image model has a quota
> of **0** (you'll get HTTP 429). Enable billing on the project of your API key first. The default
> **Workers AI** backend has no such requirement.

---

## Configuration

| binding / var | where | purpose |
|---------------|-------|---------|
| `AI` | `wrangler.toml` `[ai]` | Workers AI binding (free image backend). Required for `workers-ai`. |
| `GEMINI_API_KEY` | `wrangler secret put` / `.dev.vars` | Only for the `nano-banana` backend. |
| `NB_BACKEND` | `[vars]` | Default backend: `workers-ai` (default) or `nano-banana`. |
| `NB_WORKERS_MODEL` | `[vars]` | Override Workers AI model (default `@cf/black-forest-labs/flux-1-schnell`). |
| `NB_GEMINI_MODEL` | `[vars]` | Override Gemini model (default `gemini-2.5-flash-image`). |

---

## Local development

```bash
npm install
npx wrangler login            # the AI binding always runs remotely, so dev needs auth too
npm run dev                   # http://localhost:8787  (endpoint: /mcp)

# in another terminal, verify the MCP protocol:
node scripts/smoke-test.mjs                                   # local
node scripts/smoke-test.mjs https://<worker>.workers.dev/mcp  # remote
```

For the `nano-banana` backend locally, copy `.dev.vars.example` → `.dev.vars` and add your key.

---

## Security notes

- The default **Workers AI** backend needs no secret. A `GEMINI_API_KEY` (if used) is stored as a
  Cloudflare secret and never sent to Claude.
- The connector is **unauthenticated** by default — anyone with the URL can call it and use your
  Workers AI / Gemini quota. Keep the URL private, or add auth (Cloudflare Access in front of the
  Worker, or OAuth in the MCP layer).

---

## How it works

```
Claude (Design / web / desktop)
        │  Streamable HTTP (MCP)  POST /mcp
        ▼
Cloudflare Worker  (src/index.ts)   ← stateless, hand-rolled MCP transport
        │
        ├─ backend "workers-ai" → env.AI.run(Flux)          ← free, no key
        └─ backend "nano-banana" → Gemini REST API          ← needs GEMINI_API_KEY + billing
        │
        ▼
   image returned inline to Claude
```

- **Transport:** stateless Streamable HTTP (`POST /mcp`, SSE response). No Durable Objects, no Redis.
- **Runtime deps:** none. Just Wrangler + TypeScript for tooling.
