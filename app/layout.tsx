import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel_Decorative, Playfair_Display_SC, Rajdhani } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MusicProvider } from "@/contexts/MusicContext";
import { Web3Provider } from "@/contexts/Web3Provider";
import { ConvexClientProvider } from "@/contexts/ConvexClientProvider";
// PlayerCardsProvider removed - not needed for VibeFID miniapp
import { Analytics } from "@vercel/analytics/react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { NeynarMiniAppProvider } from "@/contexts/NeynarMiniAppProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel_Decorative({
  variable: "--font-vintage",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const playfair = Playfair_Display_SC({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const rajdhani = Rajdhani({
  variable: "--font-modern",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "VibeFID - Farcaster Identity Cards",
  description: "Generate and mint your unique Farcaster identity card as an NFT on Base!",
  manifest: "/.well-known/farcaster.json",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png" },
      { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png" },
    ],
  },
  openGraph: {
    title: "VibeFID - Farcaster Identity Cards",
    description: "Generate and mint your unique Farcaster identity card as an NFT on Base",
    url: "https://vibefid.xyz",
    images: [
      {
        url: "https://ipfs.filebase.io/ipfs/QmWbJ6JveX56Bse2L55PtDq5pkqfR9GLNoa1U41FNTNtwt",
        width: 1200,
        height: 630,
        alt: "VibeFID Game"
      }
    ],
    type: "website",
    siteName: "VibeFID",
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeFID - Farcaster Identity Cards",
    description: "Generate and mint your unique Farcaster identity card as an NFT on Base",
    images: ["https://ipfs.filebase.io/ipfs/QmWbJ6JveX56Bse2L55PtDq5pkqfR9GLNoa1U41FNTNtwt"],
  },
  other: {
    // Base.dev App ID (REQUIRED FOR ANALYTICS)
    "base:app_id": "694b002e4d3a403912ed7d24",
    // Farcaster Mini App Meta Tag (REQUIRED FOR DISCOVERY)
    "fc:miniapp": JSON.stringify({
      "version": "1",
      "imageUrl": "https://vibefid.xyz/opengraph-image",
      "button": {
        "title": "Mint Your Card",
        "action": {
          "type": "launch_miniapp",
          "name": "VibeFID",
          "url": "https://vibefid.xyz",
          "splashImageUrl": "https://vibefid.xyz/images/splash-200.png",
          "splashBackgroundColor": "#1a1a1a"
        }
      }
    }),
    // Backward compatibility with old frame spec
    "fc:frame": JSON.stringify({
      "version": "1",
      "imageUrl": "https://vibefid.xyz/opengraph-image",
      "button": {
        "title": "Mint Your Card",
        "action": {
          "type": "launch_miniapp",
          "name": "VibeFID",
          "url": "https://vibefid.xyz",
          "splashImageUrl": "https://vibefid.xyz/images/splash-200.png",
          "splashBackgroundColor": "#1a1a1a"
        }
      }
    }),
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${playfair.variable} ${rajdhani.variable} antialiased overflow-x-hidden`}
      >
        <ErrorBoundary>
          <NeynarMiniAppProvider>
            <ConvexClientProvider>
              <Web3Provider>
                
                  <LanguageProvider>
                    <MusicProvider>
                      {children}
                    </MusicProvider>
                  </LanguageProvider>
                
              </Web3Provider>
            </ConvexClientProvider>
          </NeynarMiniAppProvider>
        </ErrorBoundary>
        <link
          rel="stylesheet"
          href="https://api.openads.world/api/v1/serve/dynamic-css?publisher=0x2a9585da40de004d6ff0f5f12cfe726bd2f98b52"
        />
        <iframe
          className="openads-popup"
          src="https://api.openads.world/serve?publisher=0x2a9585da40de004d6ff0f5f12cfe726bd2f98b52&placement=300x250-0x2a9585da40de004d6ff0f5f12cfe726bd2f98b52&position=popup&parent_url=https%3A%2F%2Fvibemostwanted.xyz&app_id=c28f0313-c888-4d31-a8cc-c59fe2666177"
          title="Advertisement"
          width="300"
          height="250"
          style={{ border: "none" }}
          frameBorder="0"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allow="clipboard-write"
        />
        <iframe
          className="openads-floating"
          src="https://api.openads.world/serve?publisher=0x2a9585da40de004d6ff0f5f12cfe726bd2f98b52&placement=64x64-0x2a9585da40de004d6ff0f5f12cfe726bd2f98b52&position=floating&parent_url=https%3A%2F%2Fvibemostwanted.xyz&app_id=c28f0313-c888-4d31-a8cc-c59fe2666177"
          title="Advertisement"
          width="64"
          height="64"
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            width: "64px",
            height: "64px",
            border: "none",
            borderRadius: "50%",
            zIndex: 999999,
          }}
          frameBorder="0"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allow="clipboard-write"
        />
        <iframe
          className="openads-top-banner"
          src="https://api.openads.world/serve?publisher=0x2a9585da40de004d6ff0f5f12cfe726bd2f98b52&placement=320x50_top-0x2a9585da40de004d6ff0f5f12cfe726bd2f98b52&position=top&parent_url=https%3A%2F%2Fvibemostwanted.xyz&app_id=c28f0313-c888-4d31-a8cc-c59fe2666177"
          title="Advertisement"
          width="320"
          height="50"
          style={{ border: "none" }}
          frameBorder="0"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allow="clipboard-write"
        />
        <iframe
          className="openads-banner"
          src="https://api.openads.world/serve?publisher=0x2a9585da40de004d6ff0f5f12cfe726bd2f98b52&placement=320x50-0x2a9585da40de004d6ff0f5f12cfe726bd2f98b52&position=bottom&parent_url=https%3A%2F%2Fvibemostwanted.xyz&app_id=c28f0313-c888-4d31-a8cc-c59fe2666177"
          title="Advertisement"
          width="320"
          height="50"
          style={{ border: "none" }}
          frameBorder="0"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allow="clipboard-write"
        />
        <Analytics />
      </body>
    </html>
  );
}
