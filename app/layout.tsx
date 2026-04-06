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
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <Nav auth={auth} />
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
