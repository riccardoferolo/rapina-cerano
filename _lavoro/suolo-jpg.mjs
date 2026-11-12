import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENTRATA = fileURLToPath(new URL('./suolo.png', import.meta.url));
const USCITA = fileURLToPath(new URL('../public/cerano/suolo.jpg', import.meta.url));
const QUALITA = 0.84;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const pagina = await browser.newPage();
  const base64 = readFileSync(ENTRATA).toString('base64');
  const jpg = await pagina.evaluate(async ([dati, q]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${dati}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', q).split(',')[1];
  }, [base64, QUALITA]);
  writeFileSync(USCITA, Buffer.from(jpg, 'base64'));
  console.log(`suolo.jpg: ${(Buffer.from(jpg, 'base64').length / 1024).toFixed(0)} kB`);
} finally {
  await browser.close();
}
