import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";

export const metadata = { title: "CardOps", description: "Lager, indkøb og salg af Magic-kort" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <div className="shell">
          <aside className="side">
            <Link href="/" className="brand">CardOps</Link>
            <Nav />
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
