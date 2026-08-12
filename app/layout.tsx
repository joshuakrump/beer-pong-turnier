import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "./components/navigation";
import { AutoRefresh } from "./components/auto-refresh";

export const metadata: Metadata = {
  title: "Beer Pong Turnier",
  description: "Spielplan, Gruppenwertung und Finalrunde für das Beer-Pong-Turnier.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <Navigation />
        <AutoRefresh intervalMs={5000} />
        {children}
      </body>
    </html>
  );
}
