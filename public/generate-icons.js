// Regenerate PWA icons: node public/generate-icons.js
// Requires: npm i --save-dev sharp  (already in devDependencies)
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#f472b6"/>
      <stop offset="35%"  stop-color="#fb923c"/>
      <stop offset="65%"  stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#60a5fa"/>
    </linearGradient>
    <clipPath id="heartClip">
      <path d="M340 130 C340 108 358 96 372 96 C386 96 398 106 400 118 C402 106 414 96 428 96 C442 96 460 108 460 130 C460 155 434 178 400 200 C366 178 340 155 340 130Z"/>
    </clipPath>
  </defs>
  <!-- Gradient background with rounded corners -->
  <rect width="512" height="512" rx="112" ry="112" fill="url(#bg)"/>
  <!-- White card inset -->
  <rect x="36" y="36" width="440" height="440" rx="72" ry="72" fill="white" opacity="0.92"/>
  <!-- Dumbbell -->
  <rect x="148" y="244" width="140" height="24" rx="12" fill="#3b82f6"/>
  <rect x="136" y="232" width="28" height="48" rx="8" fill="#2563eb"/>
  <rect x="272" y="232" width="28" height="48" rx="8" fill="#2563eb"/>
  <rect x="108" y="218" width="30" height="76" rx="10" fill="#fbbf24"/>
  <rect x="298" y="218" width="30" height="76" rx="10" fill="#fbbf24"/>
  <!-- Heart with ECG line -->
  <path d="M340 130 C340 108 358 96 372 96 C386 96 398 106 400 118 C402 106 414 96 428 96 C442 96 460 108 460 130 C460 155 434 178 400 200 C366 178 340 155 340 130Z" fill="#ef4444"/>
  <polyline points="355,138 368,138 376,118 384,158 392,128 400,138 416,138 424,128 432,148 444,138 458,138"
            fill="none" stroke="#fef08a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"
            clip-path="url(#heartClip)"/>
  <!-- Running shoe -->
  <ellipse cx="178" cy="390" rx="90" ry="22" fill="#bfdbfe"/>
  <path d="M100 375 Q110 330 155 325 Q195 320 230 340 Q255 355 258 370 Q240 360 200 358 Q165 356 140 368 Q120 378 100 375Z" fill="#3b82f6"/>
  <path d="M100 375 Q108 355 135 348 Q155 343 170 348 Q145 355 128 368 Q114 375 100 375Z" fill="#60a5fa"/>
  <line x1="155" y1="340" x2="165" y2="358" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <line x1="175" y1="335" x2="183" y2="355" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <line x1="195" y1="333" x2="200" y2="353" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <path d="M215 345 Q240 350 258 368 Q245 362 220 360 Q200 358 185 355Z" fill="#fbbf24" opacity="0.9"/>
  <!-- Yoga mat roll -->
  <ellipse cx="390" cy="370" rx="28" ry="56" fill="#4ade80"/>
  <ellipse cx="390" cy="370" rx="20" ry="48" fill="#22c55e"/>
  <ellipse cx="390" cy="314" rx="28" ry="14" fill="#86efac"/>
  <ellipse cx="390" cy="314" rx="18" ry="9"  fill="#4ade80"/>
  <ellipse cx="390" cy="314" rx="9"  ry="4"  fill="#22c55e"/>
  <ellipse cx="390" cy="426" rx="28" ry="14" fill="#16a34a"/>
</svg>`;

const buf = Buffer.from(svg);
const sizes = [
  { size: 512, name: 'pwa-512x512.png' },
  { size: 192, name: 'pwa-192x192.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];
for (const { size, name } of sizes) {
  await sharp(buf).resize(size, size).png().toFile(path.join(__dirname, name));
  console.log('Generated', name);
}
