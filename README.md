# Serial Port Monitor

A web-based serial port monitor built with Next.js and the Web Serial API.

## Features

- Connect to serial devices via Web Serial API
- Real-time data monitoring with green terminal-style display
- Dark/Light mode support
- Configurable baud rates (300 to 2,000,000 bps) with custom input
- Auto-scroll functionality
- Audio notifications for received data
- Demo mode for testing
- Japanese character support (UTF-8)

## Browser Support

- Chrome 89+
- Edge 89+
- Opera 75+

Requires HTTPS connection or localhost for Web Serial API access.

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Deployment

This project is configured for static export and can be deployed to:
- Cloudflare Pages
- Vercel
- GitHub Pages
- Any static hosting service

\`\`\`bash
npm run build
\`\`\`

The built files will be in the `out` directory.
