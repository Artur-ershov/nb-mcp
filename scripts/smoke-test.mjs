// Minimal MCP client smoke test: connects to the running server over
// Streamable HTTP, lists tools, and prints their input schemas.
// Usage: node scripts/smoke-test.mjs [url]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2] || "http://localhost:3000/mcp";

const transport = new StreamableHTTPClientTransport(new URL(url));
const client = new Client({ name: "nb-mcp-smoke-test", version: "0.0.0" });

await client.connect(transport);
console.log("✓ connected to", url);

const { tools } = await client.listTools();
console.log(`✓ tools/list returned ${tools.length} tool(s):\n`);
for (const t of tools) {
  console.log(`• ${t.name}`);
  console.log(`  ${t.description?.slice(0, 90)}...`);
  console.log(`  input: ${Object.keys(t.inputSchema?.properties ?? {}).join(", ")}`);
}

await client.close();
console.log("\n✓ done");
