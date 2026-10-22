import fs from 'fs'
import path from 'path'
import { loadDB, saveDB, UPLOADS_DIR } from './db.js'

export function seedInitialData() {
  const db = loadDB()
  if (db.media && db.media.length > 0) {
    return
  }

  const sampleImages = [
    {
      id: 'media-1',
      albumId: 'album-default-1',
      filename: 'sample-porsche-gt3.svg',
      originalName: 'Porsche 911 GT3 RS.svg',
      mimeType: 'image/svg+xml',
      size: 4200,
      width: 1920,
      height: 1080,
      isVideo: false,
      title: 'Porsche 911 GT3 RS Track Edition',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: 'media-2',
      albumId: 'album-default-1',
      filename: 'sample-ferrari-f40.svg',
      originalName: 'Ferrari F40 Competizione.svg',
      mimeType: 'image/svg+xml',
      size: 4500,
      width: 1920,
      height: 1080,
      isVideo: false,
      title: 'Ferrari F40 Competizione Retro',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'media-3',
      albumId: 'album-default-1',
      filename: 'sample-shelby-cobra.svg',
      originalName: 'Shelby Cobra 427.svg',
      mimeType: 'image/svg+xml',
      size: 4100,
      width: 1920,
      height: 1080,
      isVideo: false,
      title: 'Shelby Cobra 427 S/C Roadster',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'media-4',
      albumId: 'album-default-2',
      filename: 'sample-cyber-hypercar.svg',
      originalName: 'Aero Prototype X.svg',
      mimeType: 'image/svg+xml',
      size: 4800,
      width: 1920,
      height: 1080,
      isVideo: false,
      title: 'Aero Prototype Hypercar (Confidential)',
      createdAt: new Date().toISOString()
    },
    {
      id: 'media-5',
      albumId: 'album-default-2',
      filename: 'sample-track-lap.mp4',
      originalName: 'Nurburgring Hot Lap Teaser.mp4',
      mimeType: 'video/mp4',
      size: 85000,
      width: 1280,
      height: 720,
      isVideo: true,
      title: 'Nurburgring Hot Lap Telemetry (Video)',
      createdAt: new Date().toISOString()
    }
  ]

  // Generate SVGs
  const createSvgCard = (title, subtitle, accentColor, bgGradient) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradient[0]}" />
      <stop offset="50%" stop-color="${bgGradient[1]}" />
      <stop offset="100%" stop-color="${bgGradient[2]}" />
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.8" />
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.1" />
    </linearGradient>
    <filter id="blurFilter" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="60" />
    </filter>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)" />
  <circle cx="1500" cy="300" r="350" fill="${accentColor}" opacity="0.15" filter="url(#blurFilter)" />
  <circle cx="300" cy="800" r="400" fill="#3b82f6" opacity="0.1" filter="url(#blurFilter)" />
  
  <g transform="translate(180, 420)">
    <rect x="-20" y="-80" width="12" height="180" rx="6" fill="${accentColor}" />
    <text x="30" y="0" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="74" fill="#ffffff" letter-spacing="-1px">${title}</text>
    <text x="30" y="65" font-family="'Plus Jakarta Sans', sans-serif" font-weight="500" font-size="32" fill="#94a3b8" letter-spacing="0.5px">${subtitle}</text>
  </g>

  <!-- Car Silhouette / Geometric Vector Artwork -->
  <g transform="translate(980, 460) scale(1.6)">
    <path d="M 50 140 C 120 135, 180 100, 260 70 C 350 35, 470 35, 520 70 C 560 95, 620 120, 720 120 C 760 120, 800 135, 830 160 L 840 200 C 800 200, 780 180, 730 180 C 680 180, 660 215, 610 215 C 560 215, 540 180, 490 180 L 290 180 C 260 180, 240 215, 190 215 C 140 215, 120 180, 70 180 C 40 180, 20 190, 0 200 Z" fill="none" stroke="${accentColor}" stroke-width="6" stroke-linecap="round" />
    <circle cx="190" cy="205" r="32" fill="#0f172a" stroke="${accentColor}" stroke-width="6" />
    <circle cx="670" cy="205" r="32" fill="#0f172a" stroke="${accentColor}" stroke-width="6" />
  </g>

  <!-- High-res Grid and HUD accents -->
  <line x1="180" y1="920" x2="1740" y2="920" stroke="#334155" stroke-dasharray="10 10" stroke-width="2" />
  <text x="180" y="970" font-family="'JetBrains Mono', monospace" font-size="20" fill="#64748b">VAULT_ASSET_ID // ENCRYPTED STORAGE NODE #09</text>
  <text x="1560" y="970" font-family="'JetBrains Mono', monospace" font-size="20" fill="${accentColor}">RESOLUTION: 4K UHD</text>
</svg>
`

  // Write SVGs to uploads dir
  fs.writeFileSync(
    path.join(UPLOADS_DIR, 'sample-porsche-gt3.svg'),
    createSvgCard('PORSCHE 911 GT3 RS', 'Aerodynamic Carbon Fiber Aero Spec • High Revving Flat-Six', '#3b82f6', ['#090d16', '#0f172a', '#1e293b'])
  )
  fs.writeFileSync(
    path.join(UPLOADS_DIR, 'sample-ferrari-f40.svg'),
    createSvgCard('FERRARI F40 COMPETIZIONE', 'Twin-Turbocharged 2.9L V8 • Iconic Kevlar Aerodynamics', '#ef4444', ['#180808', '#2a0e0e', '#3f1515'])
  )
  fs.writeFileSync(
    path.join(UPLOADS_DIR, 'sample-shelby-cobra.svg'),
    createSvgCard('SHELBY COBRA 427 S/C', 'Legendary American Big-Block V8 • Guardman Blue Livery', '#10b981', ['#051d14', '#0c2d20', '#154130'])
  )
  fs.writeFileSync(
    path.join(UPLOADS_DIR, 'sample-cyber-hypercar.svg'),
    createSvgCard('AERO PROTOTYPE X', 'Electric Quad-Motor Monocoque • Top Speed Classification: Secret', '#8b5cf6', ['#100a26', '#1e1145', '#2c1963'])
  )

  // Write a minimal valid mp4 video buffer placeholder
  // A tiny valid blank MP4 file structure or minimal base64 representation
  const minimalMp4Base64 = 'AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAAhtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAAAABAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAcYXRvbQAAAAhkYXRhAAAAAA=='
  fs.writeFileSync(path.join(UPLOADS_DIR, 'sample-track-lap.mp4'), Buffer.from(minimalMp4Base64, 'base64'))

  db.media = sampleImages
  if (db.albums[0]) db.albums[0].coverId = 'media-1'
  if (db.albums[1]) db.albums[1].coverId = 'media-4'
  saveDB(db)
}
