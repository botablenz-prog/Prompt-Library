import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prompt Library",
  description: "Find, adapt, and manage your AI prompts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <nav className="border-b border-zinc-800 px-6 py-4">
          <div className="mx-auto max-w-4xl flex items-center justify-between">
            <a href="/" className="text-sm font-semibold tracking-tight text-zinc-100 hover:text-white">
              Prompt Library
            </a>
            <div className="flex items-center gap-2">
              <a
                href="/api/export"
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
              >
                ↓ Export JSON
              </a>
              <a
                href="/prompts/new"
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                + New Prompt
              </a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
