import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const beVietnamPro = localFont({
  src: [
    { path: '../public/fonts/be-vietnam-pro/BeVietnamPro-Light.ttf', weight: '300', style: 'normal' },
    { path: '../public/fonts/be-vietnam-pro/BeVietnamPro-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/be-vietnam-pro/BeVietnamPro-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../public/fonts/be-vietnam-pro/BeVietnamPro-SemiBold.ttf', weight: '600', style: 'normal' },
    { path: '../public/fonts/be-vietnam-pro/BeVietnamPro-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
})

// Headings: a serif with a full Vietnamese glyph set, so stacked diacritics (ữ, ặ, ồ) stay
// balanced at display sizes where the bold sans looked heavy. Body text keeps Be Vietnam Pro.
const playfair = localFont({
  src: [
    { path: '../public/fonts/playfair-display/PlayfairDisplay[wght].ttf', weight: '400 900', style: 'normal' },
    { path: '../public/fonts/playfair-display/PlayfairDisplay-Italic[wght].ttf', weight: '400 900', style: 'italic' },
  ],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Đà Lạt Cafe | A little craft. A lot of soul.',
  description: 'Khám phá cà phê thủ công, bánh tươi và hạt nguyên chất. Find your daily ritual at Đà Lạt Cafe.',
  generator: 'v0.app',
  // The brand mark (components/brand/logo.tsx) works on light and dark tabs as it is.
  icons: {
    icon: [{ url: '/logo-mark.svg', type: 'image/svg+xml' }],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#FAF8F5',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={beVietnamPro.variable} style={{ colorScheme: 'light' }}>
      <body className={`${beVietnamPro.className} ${playfair.variable} font-sans antialiased leading-relaxed min-h-screen selection:bg-amber-700/20 selection:text-amber-900 dark:selection:text-amber-200`}>
        {/* Light theme only: every page is designed on a light background and there is no theme
            switch. next-themes is gone because it injected <script> tags that React 19 rejects. */}
        {children}
        <Toaster richColors position="top-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
