import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const archivo = localFont({
  src: "../fonts/archivo-var.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "100 900",
});

const plexSans = localFont({
  src: "../fonts/plex-sans-var.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 700",
});

const plexMono = localFont({
  src: [
    { path: "../fonts/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AFTER DARK — CDJ-3000X / DJM-A9",
  description:
    "The night is yours. AlphaTheta CDJ-3000X and Pioneer DJ DJM-A9 — professional instruments for the moments that matter.",
  openGraph: {
    title: "AFTER DARK — CDJ-3000X / DJM-A9",
    description: "The night is yours. Professional instruments for the moments that matter.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#080809",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
