/**
 * Gera todos os ícones PNG necessários para o PWA a partir de um SVG base.
 * Execute com: node generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, 'public', 'icons');

// SVG base do ícone — escudo roxo com "ITP"
const svgBase = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#7c3aed"/>
  <path d="M256 64 L416 128 L416 272 C416 368 256 448 256 448 C256 448 96 368 96 272 L96 128 Z" fill="#6d28d9" opacity="0.5"/>
  <text x="256" y="300" font-family="Arial Black, sans-serif" font-size="160" font-weight="900" text-anchor="middle" fill="white" letter-spacing="-8">ITP</text>
  <circle cx="256" cy="180" r="44" fill="white" opacity="0.25"/>
  <path d="M240 170 L256 158 L272 170 L272 192 C272 200 264 208 256 213 C248 208 240 200 240 192 Z" fill="white"/>
</svg>`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  if (!existsSync(iconsDir)) {
    await mkdir(iconsDir, { recursive: true });
  }

  for (const size of sizes) {
    const output = join(iconsDir, `icon-${size}.png`);
    await sharp(Buffer.from(svgBase))
      .resize(size, size)
      .png()
      .toFile(output);
    console.log(`✅ icon-${size}.png`);
  }

  // Screenshot placeholder (só para não quebrar o manifest)
  const screenshotSvgWide = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#0f172a"/>
    <text x="640" y="360" font-family="Arial Black" font-size="80" font-weight="900" text-anchor="middle" fill="#7c3aed">Sistema ITP</text>
    <text x="640" y="460" font-family="Arial" font-size="32" text-anchor="middle" fill="#94a3b8">Instituto Tia Pretinha</text>
  </svg>`;
  const screenshotSvgMobile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844">
    <rect width="390" height="844" fill="#0f172a"/>
    <text x="195" y="420" font-family="Arial Black" font-size="48" font-weight="900" text-anchor="middle" fill="#7c3aed">Sistema ITP</text>
    <text x="195" y="490" font-family="Arial" font-size="22" text-anchor="middle" fill="#94a3b8">Instituto Tia Pretinha</text>
  </svg>`;

  await sharp(Buffer.from(screenshotSvgWide)).resize(1280, 720).png().toFile(join(iconsDir, 'screenshot-wide.png'));
  console.log('✅ screenshot-wide.png');
  await sharp(Buffer.from(screenshotSvgMobile)).resize(390, 844).png().toFile(join(iconsDir, 'screenshot-mobile.png'));
  console.log('✅ screenshot-mobile.png');

  console.log('\n🎉 Todos os ícones PWA gerados em public/icons/');
}

generate().catch(console.error);
