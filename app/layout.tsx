import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel_Decorative, Playfair_Display_SC, Rajdhani } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MusicProvider } from "@/contexts/MusicContext";
import { Web3Provider } from "@/contexts/Web3Provider";
import { ConvexClientProvider } from "@/contexts/ConvexClientProvider";
// PlayerCardsProvider removed - not needed for VibeFID miniapp
import { FarcasterNotificationRegistration } from "@/components/FarcasterNotificationRegistration";
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
        url: "https://vibefid.xyz/screenshot.jpg",
        width: 1200,
        height: 800,
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
    images: ["https://vibefid.xyz/screenshot.jpg"],
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
          "url": "https://vibefid.xyz"
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
          "url": "https://vibefid.xyz"
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
                      <FarcasterNotificationRegistration />
                      {children}
                    </MusicProvider>
                  </LanguageProvider>
                
              </Web3Provider>
            </ConvexClientProvider>
          </NeynarMiniAppProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
}
