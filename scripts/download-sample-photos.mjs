// Downloads the bundled portfolio sample photos listed in
// src/modules/portfolio/sample-photos.ts into public/portfolio-samples/.
// Unsplash resizes and encodes on its CDN, so no local image tooling is needed.
// Run once after adding a photo: node scripts/download-sample-photos.mjs
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { samplePhotos } from '../src/modules/portfolio/sample-photos.ts';

const directory = 'public/portfolio-samples';
await mkdir(directory, { recursive: true });

async function exists(path) {
  return stat(path).then(
    () => true,
    () => false,
  );
}

const entries = Object.entries(samplePhotos);
// A few at a time keeps the CDN happy while still finishing quickly.
for (let index = 0; index < entries.length; index += 6) {
  await Promise.all(
    entries.slice(index, index + 6).map(async ([name, photo]) => {
      const path = `${directory}/${name}.webp`;
      if (await exists(path)) return;
      // Portraits are shown small; everything else at most 1200px wide.
      const width = /portrait|^person-/.test(name) ? 800 : 1200;
      const url = `https://images.unsplash.com/photo-${photo.unsplash}?w=${width}&q=50&fm=webp`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed for ${name}: ${response.status}`);
      await writeFile(path, Buffer.from(await response.arrayBuffer()));
      console.log(`Saved ${path}`);
    }),
  );
}
