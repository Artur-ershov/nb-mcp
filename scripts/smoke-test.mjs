// Dependency-free MCP smoke test over Streamable HTTP.
// Verifies initialize + tools/list against a running server.
// Usage: node scripts/smoke-test.mjs [url]
//   local:  node scripts/smoke-test.mjs                       (http://localhost:8787/mcp)
//   remote: node scripts/smoke-test.mjs https://<worker>.workers.dev/mcp
const url = process.argv[2] || "http://localhost:8787/mcp";

async function rpc(method, params, id) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (res.status === 202) return null;
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  let jsonStr = text;
  if (ct.includes("text/event-stream")) {
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    jsonStr = dataLine ? dataLine.slice(5).trim() : "{}";
  }
  return JSON.parse(jsonStr);
}

const init = await rpc(
  "initialize",
  { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } },
  1,
);
console.log("✓ initialize:", JSON.stringify(init.result?.serverInfo), "| proto", init.result?.protocolVersion);

const list = await rpc("tools/list", {}, 2);
const tools = list.result?.tools ?? [];
console.log(`✓ tools/list: ${tools.length} tool(s)`);
for (const t of tools) {
  console.log(`  • ${t.name} — params: ${Object.keys(t.inputSchema?.properties ?? {}).join(", ")}`);
}

console.log("\n✓ MCP protocol OK");
console.log(
  "(generate_image needs Cloudflare auth for the AI binding — test it after `wrangler deploy`, or `wrangler login` for local dev.)",
);
