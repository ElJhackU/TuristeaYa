import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pages } from '../src/pages/index.js';

// Set PLAYWRIGHT_PACKAGE to a local Playwright package.json if it is not installed here.
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const user = { id: '00000000-0000-4000-8000-000000000001' };
  await page.route('https://backend-turisteaya.onrender.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/auth/login') ? { access_token: 'fixture', refresh_token: 'refresh', user }
      : path.endsWith('/me') ? { id: user.id, full_name: 'Cuenta de prueba' } : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('http://127.0.0.1:4173/');
  for (const [name, definition] of Object.entries(pages)) {
    await page.goto(`http://127.0.0.1:4173/#/${name}`);
    await page.waitForFunction((title) => document.title === title, `${definition.name} · TuristeaYA`);
    assert.equal(await page.locator('main').count(), 1, name);
  }
  await page.goto('http://127.0.0.1:4173/#/iniciar-sesion');
  await page.locator('[name=email]').fill('test@example.com');
  await page.locator('[name=password]').fill('Test-password-1');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL('**/#/inicio');
  await page.goto('http://127.0.0.1:4173/#/perfil');
  await page.getByText('Cuenta de prueba', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await page.waitForURL('**/#/bienvenida');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('turisteaya.session')), null);
  assert.deepEqual(errors, []);
  console.log(`PASS: ${Object.keys(pages).length} pantallas, login y logout con API simulada; sin errores JavaScript.`);
} finally { await browser.close(); }
