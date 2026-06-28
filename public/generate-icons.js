// Regenerate PWA icons from icon-source.png: node public/generate-icons.js
// Requires: npm i --save-dev sharp  (already in devDependencies)
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, 'icon-source-2.png');

const sizes = [
  { size: 512, name: 'pwa-512x512.png' },
  { size: 192, name: 'pwa-192x192.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];
for (const { size, name } of sizes) {
  await sharp(src).resize(size, size).png().toFile(path.join(__dirname, name));
  console.log('Generated', name);
}
