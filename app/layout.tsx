import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beer Pong Turnier",
  description: "Turnierplan, Teams, Spiele und Resultate für unser Beer-Pong-Turnier.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
