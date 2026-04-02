import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'CRM EX GROW - Gerencie seus leads',
  description: 'CRM completo com pipeline visual, integracoes com Meta Ads e webhooks personalizados. Gerencie seus leads de forma simples e eficiente.',
  icons: {
    icon: '/logo-exgrow.png',
    apple: '/logo-exgrow.png',
  },
  openGraph: {
    title: 'CRM EX GROW - Gerencie seus leads',
    description: 'CRM completo com pipeline visual, integracoes com Meta Ads e webhooks personalizados.',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CRM EX GROW - Gerencie seus leads',
    description: 'CRM completo com pipeline visual, integracoes com Meta Ads e webhooks personalizados.',
    images: ['/og-image.png'],
  },
    generator: 'v0.app'
}

export const viewport = {
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="exgrow-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
