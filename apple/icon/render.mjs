// icon.svg → iOS uygulama simgesi (1024, saydamlıksız) ve açılış ekranı (2732, ortada simge).
// Kullanım (depo kökünden): node apple/icon/render.mjs   — Playwright + Chromium gerekir.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright'); // require: global kurulumu da bulur
const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, '../ios/App/App/Assets.xcassets');
const svg = readFileSync(join(here, 'icon.svg'), 'utf8');
const SPLASH_BG = '#7cc46a'; // capacitor.config.json → backgroundColor

const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(html, size, path) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  // JPEG değil PNG; omitBackground yok → saydamlık olmaz (App Store simgesi alfa kanalı kabul etmez)
  await page.screenshot({ path, type: 'png' });
}

await shot(svg.replace('width="1024" height="1024"', 'width="1024" height="1024" style="display:block"'), 1024,
  join(assets, 'AppIcon.appiconset/AppIcon-512@2x.png'));

// Açılış ekranı: yeşil zemin, ortada yuvarlatılmış simge (storyboard'da aspectFill, kenarlar kırpılabilir)
const splash = `<div style="width:2732px;height:2732px;background:${SPLASH_BG};display:flex;align-items:center;justify-content:center">
  <div style="width:720px;height:720px;border-radius:160px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.25)">
    ${svg.replace('width="1024" height="1024"', 'width="720" height="720" style="display:block"')}
  </div></div>`;
for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  await shot(splash, 2732, join(assets, 'Splash.imageset', n));

await browser.close();
console.log('Simge ve açılış ekranı güncellendi');
