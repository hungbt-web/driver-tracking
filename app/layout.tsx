import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
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
  title: "Driver Schedule View",
  description: "Calendar view for driver etape scheduling",
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
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto flex w-full max-w-8xl items-center justify-between px-6 py-4">
              <h1 className="text-lg font-semibold text-[#333333]">
                Suivi Driver
              </h1>
              <nav className="flex items-center gap-4 text-sm">
                <Link
                  href="/"
                  className="rounded-md px-3 py-1.5 text-[#333333] hover:bg-gray-100"
                >
                  Mission Etapes
                </Link>
                <Link
                  href="/missions-gps"
                  className="rounded-md px-3 py-1.5 text-[#333333] hover:bg-gray-100"
                >
                  Missions GPS
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
