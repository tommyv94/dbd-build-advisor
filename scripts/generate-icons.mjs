/**
 * Renders build/icon.svg → build/icon.png + build/icon.ico for Electron / Windows.
 * Requires: npm install (sharp, png-to-ico are devDependencies)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');
const svgPath = path.join(buildDir, 'icon.svg');

/** NSIS installer requires standard ICO sizes — 512px entries break makensis */
const icoSizes = [16, 32, 48, 256];

async function main() {
  const svg = await readFile(svgPath);

  const png512 = await sharp(svg).resize(512, 512).png().toBuffer();
  await writeFile(path.join(buildDir, 'icon.png'), png512);

  const icoParts = await Promise.all(
    icoSizes.map(async (size) => sharp(svg).resize(size, size).png().toBuffer()),
  );

  const ico = await pngToIco(icoParts);
  await writeFile(path.join(buildDir, 'icon.ico'), ico);

  console.log('Generated build/icon.png and build/icon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
