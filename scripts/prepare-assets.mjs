// One-off helper: turns the supplied logo + cover into web assets.
// Usage: node scripts/prepare-assets.mjs <logo.png> <cover.png>
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const [logoPath, coverPath] = process.argv.slice(2);
mkdirSync('public/brand', { recursive: true });
mkdirSync('public/samples', { recursive: true });

// Remove the near-white background from the logo -> transparent PNG.
async function cutout(region, out, tint) {
  const { data, info } = await sharp(logoPath).extract(region).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2]];
  for (let i = 0; i < data.length; i += 4) {
    let a = 0;
    for (let c = 0; c < 3; c++) a = Math.max(a, (bg[c] - data[i + c]) / bg[c]);
    a = Math.min(1, Math.max(0, a * 1.15));
    if (a < 0.03) { data[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) {
      const v = tint ? tint[c] : (data[i + c] - (1 - a) * bg[c]) / a;
      data[i + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
    data[i + 3] = Math.round(a * 255);
  }
  await sharp(data, { raw: info }).trim().png().toFile(out);
}

const bird = { left: 360, top: 345, width: 560, height: 350 };
const word = { left: 150, top: 690, width: 960, height: 215 };
const full = { left: 140, top: 340, width: 980, height: 650 };
const cream = [239, 231, 220];
await cutout(bird, 'public/brand/bird.png');
await cutout(word, 'public/brand/wordmark.png');
await cutout(full, 'public/brand/logo-full.png');
await cutout(word, 'public/brand/wordmark-light.png', cream);
await cutout(full, 'public/brand/logo-full-light.png', cream);

const birdBuf = await sharp('public/brand/bird.png').resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
await sharp({ create: { width: 256, height: 256, channels: 4, background: '#F8F5EF' } })
  .composite([{ input: birdBuf, gravity: 'center' }]).png().toFile('public/brand/favicon.png');

await sharp(coverPath).jpeg({ quality: 88 }).toFile('public/brand/cover.jpg');

// Square crops of each sculpture in the cover (display coords at 2000px wide).
const meta = await sharp(coverPath).metadata();
const k = meta.width / 2000;
const crops = {
  bird: [160, 380, 280], reader: [335, 365, 300], manta: [520, 305, 390],
  dragon: [840, 342, 350], jellyfish: [1080, 365, 330], turtle: [1475, 440, 290],
};
for (const [name, [x, y, s]] of Object.entries(crops)) {
  const left = Math.round(x * k), top = Math.round(y * k);
  const size = Math.min(Math.round(s * k), meta.height - top, meta.width - left);
  await sharp(coverPath).extract({ left, top, width: size, height: size })
    .resize(900, 900, { kernel: 'lanczos3' }).jpeg({ quality: 86 }).toFile(`public/samples/${name}.jpg`);
}
console.log('assets ready');
