import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import { Navigation } from "./components/navigation";
import { AutoRefresh } from "./components/auto-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Beer Pong Tournament",
  description: "Live-Spielplan, Rangliste und Finalrunde für das Beer-Pong-Turnier.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <Navigation />
        <AutoRefresh />
        {children}
      </body>
    </html>
  );
}
