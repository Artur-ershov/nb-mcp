import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "nb-mcp — Nano Banana MCP",
  description:
    "Remote MCP server exposing Google's nano banana (Gemini 2.5 Flash Image) for image generation and editing in Claude.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          background: "#0b0b0c",
          color: "#f5f5f5",
        }}
      >
        {children}
      </body>
    </html>
  );
}
