import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { SmoothScroll } from '@/components/smooth-scroll'
import { TopNav } from '@/components/top-nav'
import { ChatbotProvider } from '@/components/chatbot/chatbot-provider'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Scope — News you can weigh',
  description:
    'Scope shows you not just what happened, but who is saying what about it and how much to trust it. AI synthesis, source bias, and a validity score for every story.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0c' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={geistMono.variable}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-paper text-ink font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SmoothScroll>
            <ChatbotProvider>
              <TopNav />
              {children}
            </ChatbotProvider>
          </SmoothScroll>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
