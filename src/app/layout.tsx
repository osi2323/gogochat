import type { Metadata } from "next";
import { GlobalSiteTitleSync } from "@/components/app/GlobalSiteTitleSync";
import {
  Audiowide,
  Bebas_Neue,
  Caveat,
  Cinzel,
  Comfortaa,
  Cormorant_Garamond,
  Geist,
  Geist_Mono,
  Grenze_Gotisch,
  Kalam,
  Lobster_Two,
  Monoton,
  Noto_Sans_Symbols_2,
  Orbitron,
  Pacifico,
  Playfair_Display,
  Space_Grotesk,
  Turret_Road,
  Permanent_Marker,
} from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansSymbols2 = Noto_Sans_Symbols_2({
  variable: "--font-noto-symbols",
  subsets: ["latin"],
  weight: "400",
});

const comfortaa = Comfortaa({
  variable: "--font-chat-comfortaa",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const kalam = Kalam({
  variable: "--font-chat-kalam",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const lobsterTwo = Lobster_Two({
  variable: "--font-chat-lobster-two",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const orbitron = Orbitron({
  variable: "--font-chat-orbitron",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const turretRoad = Turret_Road({
  variable: "--font-chat-turret-road",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-chat-cormorant-garamond",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-chat-playfair-display",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-chat-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const audiowide = Audiowide({
  variable: "--font-chat-audiowide",
  subsets: ["latin"],
  weight: "400",
});

const pacifico = Pacifico({
  variable: "--font-chat-pacifico",
  subsets: ["latin"],
  weight: "400",
});

const caveat = Caveat({
  variable: "--font-chat-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const permanentMarker = Permanent_Marker({
  variable: "--font-chat-permanent-marker",
  subsets: ["latin"],
  weight: "400",
});

const bebasNeue = Bebas_Neue({
  variable: "--font-chat-bebas-neue",
  subsets: ["latin"],
  weight: "400",
});

const monoton = Monoton({
  variable: "--font-chat-monoton",
  subsets: ["latin"],
  weight: "400",
});

const cinzel = Cinzel({
  variable: "--font-chat-cinzel",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const grenzeGotisch = Grenze_Gotisch({
  variable: "--font-chat-grenze-gotisch",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "KingMobile",
  description: "KingMobile giris sayfasi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansSymbols2.variable} ${spaceGrotesk.variable} ${comfortaa.variable} ${bebasNeue.variable} ${kalam.variable} ${pacifico.variable} ${caveat.variable} ${permanentMarker.variable} ${lobsterTwo.variable} ${orbitron.variable} ${audiowide.variable} ${turretRoad.variable} ${monoton.variable} ${cormorantGaramond.variable} ${playfairDisplay.variable} ${cinzel.variable} ${grenzeGotisch.variable} antialiased`}
      >
        <GlobalSiteTitleSync />
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
