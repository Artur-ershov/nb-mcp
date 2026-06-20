# 🍌 nb-mcp — Nano Banana MCP

A **remote MCP server** that gives Claude the ability to generate and edit images
with Google's **nano banana** (Gemini 2.5 Flash Image) model.

Deploy it once, add it as a **custom connector**, and then use nano banana directly
inside **Claude Design**, **claude.ai**, **Claude Desktop**, and any other MCP client.

- `generate_image` — turn a text prompt into an image
- `edit_image` — edit, restyle, or combine existing images with a natural-language instruction

The server speaks the modern **Streamable HTTP** MCP transport and is built to deploy on
**Vercel** in a couple of minutes. Your Gemini API key lives on the server and is never
exposed to Claude.

---

## Why a remote MCP server (and not a local one)?

Claude Design and claude.ai connect to **custom connectors from Anthropic's cloud**, not from
your computer — so the server has to be reachable on the public internet over HTTP. That's
exactly what this project is: a small hosted HTTP MCP server.

> If you only ever use **Claude Desktop**, a local (stdio) server also works — but the hosted
> URL below works there too, so one deployment covers every surface.

---

## 1. Get a Gemini API key

nano banana is part of the Google Gemini API. Grab a free key at
**https://aistudio.google.com/apikey**. You'll set it as the `GEMINI_API_KEY` environment
variable on your deployment.

---

## 2. Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel        # if you don't have it
vercel                 # link/create the project and deploy a preview
vercel env add GEMINI_API_KEY    # paste your key (Production + Preview)
vercel --prod          # deploy to production
```

### Option B — Git + Vercel dashboard

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New… → Project** and import the repo.
3. Under **Settings → Environment Variables**, add `GEMINI_API_KEY`.
4. Deploy.

After deploying, your MCP endpoint is:

```
https://<your-project>.vercel.app/mcp
```

Open the root URL (`https://<your-project>.vercel.app/`) in a browser to confirm it's live.

> **maxDuration:** image generation can take 10–30s. The route is configured for up to 60s,
> which is the limit on Vercel's Hobby plan. On Pro you can raise it.

---

## 3. Add it to Claude as a custom connector

1. In Claude, go to **Settings → Connectors** (also shown as **Customize → Connectors**).
2. Click **+ Add custom connector**.
3. **Name:** `nano banana` (anything you like).
   **URL:** `https://<your-project>.vercel.app/mcp`
4. Save. No OAuth is required (leave Advanced settings empty).
5. In a chat, open the **+** menu → **Connectors** and enable it for the conversation.

Now ask Claude things like:

- “Generate a 16:9 hero image of a neon-lit cyberpunk street market, cinematic lighting.”
- “Make me a minimalist logo: a banana wearing sunglasses, flat vector, on white.”
- “Take this image https://example.com/room.jpg and restyle it as a cozy Scandinavian interior.”
- “Combine https://…/logo.png and https://…/tshirt.jpg into a product mockup.”

> Custom remote connectors are available on Claude (web), Cowork, and Claude Desktop across
> Free/Pro/Max/Team/Enterprise. On Team/Enterprise, an Owner adds the connector for the org
> first. Availability inside **Claude Design's** UI follows the same connector system; if you
> don't see custom connectors there yet, add it in **claude.ai** with the same account.

---

## Tools

### `generate_image`
| param | type | required | description |
|-------|------|----------|-------------|
| `prompt` | string | ✅ | What to draw. Be specific about subject, style, composition, colours, lighting, mood. |
| `aspect_ratio` | enum | – | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9` |

### `edit_image`
| param | type | required | description |
|-------|------|----------|-------------|
| `prompt` | string | ✅ | How to edit / combine the source image(s). |
| `image_urls` | string[] (1–4) | ✅ | Publicly reachable image URL(s). Pass several to blend them. |
| `aspect_ratio` | enum | – | Optional output aspect ratio. |

Both tools return the resulting image **inline** so Claude can see and use it.

---

## Configuration

| env var | required | default | description |
|---------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ | – | Your Google Gemini API key. |
| `NB_MODEL` | – | `gemini-2.5-flash-image` | Override the model. |

Model options:

- `gemini-2.5-flash-image` — the classic **nano banana** (fast, great default)
- `gemini-3-pro-image` — **Nano Banana Pro** (higher quality, slower, pricier)
- `gemini-3.1-flash-image` — **Nano Banana 2**

---

## Local development

```bash
npm install
cp .env.example .env.local      # then put your GEMINI_API_KEY in .env.local
npm run dev                     # http://localhost:3000  (endpoint: /mcp)

# in another terminal — verify the MCP protocol end-to-end:
node scripts/smoke-test.mjs
```

`scripts/smoke-test.mjs` connects as an MCP client and lists the tools — handy for confirming a
deployment too: `node scripts/smoke-test.mjs https://<your-project>.vercel.app/mcp`.

---

## Security notes

- Your `GEMINI_API_KEY` stays server-side; Claude never receives it.
- This server is **unauthenticated** by default — anyone who knows the URL can call it and spend
  your Gemini quota. For personal use, keep the URL private. To lock it down, add OAuth via
  `mcp-handler`'s `withMcpAuth` helper (Claude's connector UI supports OAuth client id/secret),
  or put the deployment behind Vercel Authentication / a WAF rule.
- Images are returned inline as base64. Very large (e.g. 2K) outputs can bump into serverless
  response-size limits; the default model/resolution stays well within them.

---

## How it works

```
Claude (Design / web / desktop)
        │  Streamable HTTP (MCP)
        ▼
/app/[transport]/route.ts   ← mcp-handler (Streamable HTTP transport)
        │
        ▼
/lib/nanobanana.ts          ← @google/genai → Gemini "nano banana"
        │
        ▼
   generated image (returned inline to Claude)
```

- **Transport:** Streamable HTTP (the current MCP standard; the route exports `GET`/`POST`/`DELETE`).
- **Stateless:** no Redis/session store required — fine for request/response image tools.
- **Runtime:** Node.js serverless function (`@google/genai` needs Node, not Edge).

---

## Tech

[`next`](https://nextjs.org) · [`mcp-handler`](https://www.npmjs.com/package/mcp-handler) ·
[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk) ·
[`@google/genai`](https://www.npmjs.com/package/@google/genai) · `zod`
