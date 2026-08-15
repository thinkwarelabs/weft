import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { ToastProvider } from '@/components/legacy/Toast'
import { cn } from '@/lib/utils'
import './globals.css'

// Geist replaced Inter when shadcn's Nova preset landed. Note that the invoice
// PDF still renders with the Inter TTFs in src/lib/pdf/fonts/ — that is a
// separate rendering path with its own embedded fonts, and deliberately not
// coupled to whatever the web UI uses.
const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Weft — Thinkware Labs',
  description: 'Internal platform for Thinkware Labs',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
