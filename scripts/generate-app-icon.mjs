/**
 * KF-21/KF-15 사진에서 앱 아이콘(app/icon.png, app/apple-icon.png) 생성
 * Usage: node scripts/generate-app-icon.mjs [source-image-path]
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const defaultSrc = path.join(root, "assets/kf21-source.png");
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : defaultSrc;

async function composeIcon(size) {
  const radius = Math.round(size * 0.22);
  const pad = Math.round(size * 0.05);
  const photoW = size - pad * 2;

  const planePhoto = await sharp(SRC)
    .extract({ left: 0, top: 0, width: 399, height: 330 })
    .modulate({ brightness: 1.06, saturation: 1.1 })
    .sharpen({ sigma: 0.6 })
    .toBuffer();

  const resized = await sharp(planePhoto)
    .resize(photoW, Math.round(photoW * 1.05), { fit: "cover", position: "top" })
    .toBuffer();

  const frame = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0a1628"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="34%" r="58%">
          <stop offset="0%" stop-color="rgba(56,189,248,0.18)"/>
          <stop offset="100%" stop-color="rgba(56,189,248,0)"/>
        </radialGradient>
        <clipPath id="round"><rect width="${size}" height="${size}" rx="${radius}"/></clipPath>
      </defs>
      <g clip-path="url(#round)">
        <rect width="${size}" height="${size}" fill="url(#bg)"/>
        <rect width="${size}" height="${size}" fill="url(#glow)"/>
      </g>
    </svg>`
  );

  const base = await sharp(frame).png().toBuffer();
  const top = Math.round(pad * 0.35);

  const withPhoto = await sharp(base)
    .composite([{ input: resized, top, left: pad, blend: "over" }])
    .png()
    .toBuffer();

  const vignette = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="round"><rect width="${size}" height="${size}" rx="${radius}"/></clipPath>
        <radialGradient id="v" cx="50%" cy="44%" r="66%">
          <stop offset="52%" stop-color="rgba(0,0,0,0)"/>
          <stop offset="100%" stop-color="rgba(10,16,28,0.9)"/>
        </radialGradient>
      </defs>
      <g clip-path="url(#round)"><rect width="${size}" height="${size}" fill="url(#v)"/></g>
    </svg>`
  );

  return sharp(withPhoto).composite([{ input: vignette, blend: "over" }]).png().toBuffer();
}

const icon512 = await composeIcon(512);
await sharp(icon512).toFile(path.join(root, "app/icon.png"));
await sharp(icon512).resize(180, 180).toFile(path.join(root, "app/apple-icon.png"));
console.log("Generated app/icon.png and app/apple-icon.png from", SRC);
