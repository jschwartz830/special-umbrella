// Run this once with: node public/generate-icons.js
// Generates simple placeholder PNG icons for PWA
// For production, replace with proper icons

import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'

function generate(size, filename) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#0ea5e9')
  grad.addColorStop(1, '#0369a1')
  ctx.fillStyle = grad
  ctx.roundRect(0, 0, size, size, size * 0.2)
  ctx.fill()

  // Dumbbell icon (simplified)
  ctx.fillStyle = 'white'
  const cx = size / 2
  const cy = size / 2
  const s = size * 0.55

  // Bar
  ctx.fillRect(cx - s/2, cy - s * 0.06, s, s * 0.12)
  // Left weight
  ctx.beginPath()
  ctx.roundRect(cx - s/2 - s*0.12, cy - s*0.22, s*0.12, s*0.44, s*0.04)
  ctx.fill()
  // Right weight
  ctx.beginPath()
  ctx.roundRect(cx + s/2, cy - s*0.22, s*0.12, s*0.44, s*0.04)
  ctx.fill()

  writeFileSync(filename, canvas.toBuffer('image/png'))
  console.log(`Generated ${filename}`)
}

generate(192, 'public/pwa-192x192.png')
generate(512, 'public/pwa-512x512.png')
generate(180, 'public/apple-touch-icon.png')
