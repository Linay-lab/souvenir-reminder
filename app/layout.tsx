import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://souvenir-reminder.vercel.app"),

  title: "旅購｜旅行購物清單",
  description: "想買的，旅途中別再錯過。",

  openGraph: {
    title: "旅購｜旅行購物清單",
    description: "想買的，旅途中別再錯過。",
    url: "https://souvenir-reminder.vercel.app",
    siteName: "旅購",
    images: [
      {
        url: "/og-image.png",
        width: 1536,
        height: 1024,
        alt: "旅購｜旅行購物清單",
      },
    ],
    locale: "zh_TW",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
