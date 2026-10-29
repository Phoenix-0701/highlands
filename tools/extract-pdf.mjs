import fs from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const source = process.argv[2];
const name = path.basename(source, '.pdf');
const pdf = await getDocument({ data: new Uint8Array(await fs.readFile(source)), useSystemFonts: true }).promise;
const output = [];
for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n);
  const text = await page.getTextContent();
  let lines = '';
  for (const item of text.items) if ('str' in item) lines += item.str + (item.hasEOL ? '\n' : ' ');
  output.push(`\n=== PAGE ${n} ===\n${lines}`);
  if (process.argv.includes('--render')) {
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
    await fs.mkdir(`docs/sources/${name}`, { recursive: true });
    await fs.writeFile(`docs/sources/${name}/page-${n}.png`, canvas.toBuffer('image/png'));
  }
}
await fs.writeFile(`docs/sources/${name}.txt`, output.join('\n'));
console.log(`${name}: ${pdf.numPages} pages`);
