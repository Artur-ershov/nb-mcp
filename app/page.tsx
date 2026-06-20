export default function Home() {
  return (
    <main
      style={{
        maxWidth: 680,
        margin: "0 auto",
        padding: "64px 24px",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 40, marginBottom: 8 }}>🍌 nb-mcp</h1>
      <p style={{ fontSize: 18, color: "#bdbdbd", marginTop: 0 }}>
        Remote MCP server for Google&apos;s <strong>nano banana</strong> (Gemini 2.5 Flash
        Image) — image generation &amp; editing for Claude.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 40 }}>MCP endpoint</h2>
      <pre
        style={{
          background: "#161618",
          border: "1px solid #2a2a2e",
          borderRadius: 8,
          padding: "12px 16px",
          overflowX: "auto",
        }}
      >
        <code>{`https://<your-deployment>/mcp`}</code>
      </pre>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Add it to Claude</h2>
      <ol style={{ paddingLeft: 20 }}>
        <li>
          Open Claude → <em>Settings → Connectors</em> (or{" "}
          <em>Customize → Connectors</em>).
        </li>
        <li>
          Click <em>+ Add custom connector</em>.
        </li>
        <li>
          Paste the <code>/mcp</code> URL above and save.
        </li>
        <li>
          Enable the connector in a chat (the <code>+</code> menu) and ask Claude to generate
          an image.
        </li>
      </ol>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Tools</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li>
          <code>generate_image</code> — text → image
        </li>
        <li>
          <code>edit_image</code> — image(s) + instruction → edited image
        </li>
      </ul>

      <p style={{ marginTop: 40, color: "#8a8a8a", fontSize: 14 }}>
        Powered by the Google Gemini API. Your API key stays on the server and is never exposed
        to Claude.
      </p>
    </main>
  );
}
