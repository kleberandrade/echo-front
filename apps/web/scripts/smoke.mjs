/**
 * Smoke test (sprint-04): sobe o site buildado, abre o replay demo no
 * Chromium, dá scrub até o fim, valida o placar renderizado e captura
 * screenshots. Requer `pnpm build` antes.
 *   node scripts/smoke.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 3411;
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'pipe',
});

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('next start não respondeu em 30s');
}

try {
  await waitReady();
  // PW_CHROMIUM permite apontar para um Chromium local quando a versão do
  // playwright não bate com os browsers instalados (ex.: sandbox de CI).
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  );
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  mkdirSync('screenshots', { recursive: true });

  await page.goto(`http://localhost:${PORT}/replay/demo`, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(2500); // alguns ciclos de reprodução
  await page.screenshot({ path: 'screenshots/replay-mid.png' });

  // Scrub até o fim.
  const slider = page.locator('input[type="range"]');
  const max = await slider.getAttribute('max');
  await slider.fill(max);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/replay-end.png' });

  const body = await page.textContent('body');
  if (!/fim: (fragments_delivered|time_up)/.test(body ?? '')) {
    throw new Error('placar/fim de partida não renderizado após scrub até o fim');
  }
  if (!/replay verificado ✓/.test(body ?? '')) {
    throw new Error('replay não verificou o hash no browser (paridade Node×browser falhou?)');
  }

  // Visão por time (fog of war).
  await page.keyboard.press('2');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/replay-team-view.png' });

  await browser.close();
  console.log('SMOKE OK — placar final renderizado, hash verificado no browser, screenshots salvos');
} finally {
  server.kill();
}
