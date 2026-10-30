import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: "CardOps", description: "Internal card inventory & listing tool" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <Link href="/" className="brand">CardOps</Link>
          <nav>
            <Link href="/import">Import (ManaBox)</Link>
            <Link href="/intake">Intake</Link>
            <Link href="/inventory">Inventory</Link>
            <Link href="/pick">Pick list</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
