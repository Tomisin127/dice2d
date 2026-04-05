import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Orbitron } from "next/font/google";
import localFont from "next/font/local";
import "@coinbase/onchainkit/styles.css";
import "./globals.css";
import { ResponseLogger } from "@/components/response-logger";
import { cookies } from "next/headers";
import { ReadyNotifier } from "@/components/ready-notifier";
import { Providers } from "./providers";
import FarcasterWrapper from "@/components/FarcasterWrapper";
import { Toaster } from "sonner";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestId = (await cookies()).get("x-request-id")?.value;

  return (
        <html lang="en">
          <head>
            {requestId && <meta name="x-request-id" content={requestId} />}
          </head>
          <body
            className={`${spaceGrotesk.variable} ${orbitron.variable} ${jetbrainsMono.variable} ${geistSans.variable} antialiased bg-background`}
          >
            {/* Do not remove this component, we use it to notify the parent that the mini-app is ready */}
            <ReadyNotifier />
            <Providers>
      <FarcasterWrapper>
        {children}
      </FarcasterWrapper>
      </Providers>
            <ResponseLogger />
            <Toaster richColors position="top-center" />
          </body>
        </html>
      );
}

export const metadata: Metadata = {
        title: "Dice2D | Roll & Win on Base",
        description: "The ultimate dice rolling game on Base. Roll 3+ to reveal tiles, complete all 6 to win! Swap ETH for DICE2D tokens.",
        other: { 
          "fc:frame": JSON.stringify({
            "version": "next",
            "imageUrl": "https://files.catbox.moe/h60ivy.jpeg",
            "button": {
              "title": "Open with Ohara",
              "action": {
                "type": "launch_frame",
                "name": "Dice2D",
                "url": "https://shinning-window-190.app.ohara.ai",
                "splashImageUrl": "https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/farcaster/splash_images/splash_image1.svg",
                "splashBackgroundColor": "#ffffff"
              }
            }
          }),
          'base:app_id': '69501fe84d3a403912ed8290'
        }
    };
