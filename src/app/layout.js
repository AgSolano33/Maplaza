import { Geist, Geist_Mono, Lato, Merriweather, Montserrat, Nunito, Open_Sans, Oswald, Playfair_Display, Poppins, Roboto, Source_Sans_3 } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeRoboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-theme-roboto", display: "swap" });
const themeOpenSans = Open_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-theme-open-sans", display: "swap" });
const themeLato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-theme-lato", display: "swap" });
const themeMontserrat = Montserrat({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-theme-montserrat", display: "swap" });
const themePoppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-theme-poppins", display: "swap" });
const themeNunito = Nunito({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-theme-nunito", display: "swap" });
const themeOswald = Oswald({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-theme-oswald", display: "swap" });
const themeMerriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-theme-merriweather", display: "swap" });
const themePlayfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-theme-playfair", display: "swap" });
const themeSourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-theme-source-sans", display: "swap" });
const themeFontVariables = [themeRoboto, themeOpenSans, themeLato, themeMontserrat, themePoppins, themeNunito, themeOswald, themeMerriweather, themePlayfair, themeSourceSans].map((font) => font.variable).join(" ");

export const metadata = {
  title: "MAPLASA",
  description: "Formularios de reclutamiento y encuestas de clima laboral.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} ${themeFontVariables} h-full`}>
      <body className="min-h-full bg-canvas font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
