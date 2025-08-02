# Serial Port Monitor

A web-based serial port monitor built with Next.js and the Web Serial API. Features dark mode support and Japanese character handling.

## Features

- Connect to serial ports via Web Serial API
- Real-time data monitoring with auto-scroll
- Dark/Light mode toggle
- Sound notifications for received data
- Demo mode for testing
- Support for Japanese and multi-byte characters
- Customizable baud rates
- Export functionality

## Browser Support

- Chrome 89+
- Edge 89+
- Opera 75+

## Requirements

- HTTPS connection or localhost
- Modern browser with Web Serial API support

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)

## Deployment

This project is configured for static export and can be deployed to:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

Run `npm run build` to create a production build.
