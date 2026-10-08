// Thumbnails til /ev/ (oversigten): node tools/shoot_ev.mjs <base-url> <ud-mappe>
// Kræver playwright-core + Chrome. Kør mod `wrangler dev --local` efter ./build.sh, læg resultatet i ev/thumbs/.
import { chromium } from 'playwright-core';
import { readdirSync } from 'fs';
const base = process.argv[2] || 'http://localhost:8788', out = process.argv[3] || 'ev/thumbs';
const files = readdirSync('ev').filter(f => /^(firmafest|bryllup)-[a-e]-[a-z]+\.html$/.test(f)).map(f => f.replace('.html', ''));
const b = await chromium.launch({ channel: 'chrome' });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const jobs = files.flatMap(f => [[f, 'd', { width: 1440, height: 900 }], [f, 'm', { width: 390, height: 844 }]]);
const run = async ([f, n, vp]) => {
  const c = await b.newContext({ viewport: vp, userAgent: UA, deviceScaleFactor: 1 }); const p = await c.newPage();
  await p.goto(`${base}/ev/${f}?nt=1`, { waitUntil: 'load' });
  await p.evaluate(() => { document.querySelectorAll('.rv').forEach(e => e.classList.add('in')); document.querySelectorAll('video').forEach(v => v.pause()); });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${f}-${n}.png` }); await c.close();
};
for (let i = 0; i < jobs.length; i += 6) await Promise.all(jobs.slice(i, i + 6).map(run));
await b.close(); console.log('thumbs:', jobs.length);
