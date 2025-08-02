import type React from "react"
import type { Metadata } from "next"
import { Noto_Sans_JP } from "next/font/google"
import "./globals.css"

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
})

export const metadata: Metadata = {
  title: "Serial Port Monitor",
  description: "Browser-based serial port monitor with Web Serial API",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="permissions-policy" content="serial=*" />
      </head>
      <body className={notoSansJP.className}>{children}</body>
    </html>
  )
}
