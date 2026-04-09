import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { getUser, getAuthState } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Prompt Library",
  description: "Find, adapt, and manage your AI prompts",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  const auth = getAuthState(user);

  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <Nav auth={auth} />
        <main className="flex-1 mx-auto max-w-4xl w-full px-6 py-8">{children}</main>
        <footer className="border-t border-zinc-800 py-6 text-center">
          <p className="text-xs text-zinc-600">
            Open-source project by <span className="text-zinc-500">Botable</span> — AI tools for everyday work
          </p>
        </footer>
      </body>
    </html>
  );
}
