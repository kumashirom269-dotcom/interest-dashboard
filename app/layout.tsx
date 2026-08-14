import type { Metadata, Viewport } from "next";
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
  title: "関心情報ダッシュボード",
  description: "自分専用の関心情報ダッシュボード",
};

// viewportFit: "cover"は、iPhoneアプリ化（Capacitor）でノッチ・ホームインジケーター
// まで画面いっぱいに表示させた際に、CSS側のenv(safe-area-inset-*)を有効にするために必要
// （globals.css参照）。通常のブラウザ表示には影響しない。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3A3190",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
