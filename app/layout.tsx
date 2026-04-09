import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _geist = Geist({
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});
const _geistMono = Geist_Mono({
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'MTG Counterplay Reference - Find Instant-Speed Interaction',
  description: 'A competitive MTG utility for quickly referencing instant-speed cards, counterspells, flash creatures, and interaction from any Magic: The Gathering set.',
  generator: 'v0.app',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cards.scryfall.io" crossOrigin="" />
        <link rel="dns-prefetch" href="https://cards.scryfall.io" />
        <link rel="preconnect" href="https://svgs.scryfall.io" crossOrigin="" />
        <link rel="dns-prefetch" href="https://svgs.scryfall.io" />
        <link rel="preconnect" href="https://api.scryfall.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api.scryfall.com" />
      </head>
      <body className="font-sans antialiased">
        <NuqsAdapter>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
          <Analytics />
          <SpeedInsights />
        </NuqsAdapter>
      </body>
    </html>
  )
}
