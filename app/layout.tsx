import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Serial Port Monitor",
  description: "Browser-based serial port monitor with Web Serial API",
    generator: 'v0.dev'
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
      <body className={inter.className}>{children}</body>
    </html>
  )
}
