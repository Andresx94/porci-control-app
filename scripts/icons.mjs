// Genera los PNG de la PWA desde public/icon.svg. Uso: npm run icons
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');

// margen: fracción por lado que se deja libre (zona segura para íconos "maskable")
async function generar(nombre, tam, margen = 0) {
  const interior = Math.round(tam * (1 - margen * 2));
  const borde = Math.floor((tam - interior) / 2);
  const resto = tam - interior - borde;
  await sharp(svg, { density: 384 })
    .resize(interior, interior)
    .extend({ top: borde, bottom: resto, left: borde, right: resto, background: '#2E7D32' })
    .png()
    .toFile(`public/${nombre}`);
}

await generar('pwa-192x192.png', 192);
await generar('pwa-512x512.png', 512);
await generar('maskable-512x512.png', 512, 0.12);
await generar('apple-touch-icon.png', 180);
console.log('Iconos generados en public/');
