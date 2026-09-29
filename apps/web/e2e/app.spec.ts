import { expect, test } from '@playwright/test';

const API = 'http://localhost:8787';

async function sms(body: string) {
  const res = await fetch(`${API}/sms-webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: `9199${Math.floor(Math.random() * 1e6)}`,
      message: body,
      requestId: crypto.randomUUID(),
    }),
  });
  expect(res.ok).toBe(true);
}

test('cold-cache load on throttled 3G shows a recommendation in < 3 s', async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  // Chrome DevTools "Fast 3G": 1.6 Mbps down, 750 kbps up, 150 ms RTT (40 ms × 3.75 slowdown ≈ 562 ms is "Slow 3G").
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Tap for details/ }).first()).toBeVisible();
  const ms = Date.now() - t0;
  test.info().annotations.push({ type: 'first-recommendation-ms', description: String(ms) });
  expect(ms).toBeLessThan(3000);
});

test('airplane mode → ranked list still renders → offline banner', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Tap for details/ }).first()).toBeVisible();
  // The drill phone is "pre-installed and warmed" (§14.2): wait for the app shell to be precached.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await expect(page.getByText(/Offline · showing last data from/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Tap for details/ }).first()).toBeVisible();
  // Reload while offline: service worker shell + IndexedDB cache.
  await page.reload();
  await expect(page.getByRole('button', { name: /Tap for details/ }).first()).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/Offline ·/)).toBeHidden({ timeout: 10_000 });
});

test('SMS webhook → PWA card updates within 4 s', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('Napoklu');
  const card = page.getByRole('button', { name: /^Napoklu:/ });
  await expect(card).toBeVisible();
  await card.click();
  const signals = page.getByRole('heading', { name: /^(Signals|Says hazard) \(\d+\)$/ });
  const before = Number((await signals.textContent())?.match(/\((\d+)\)/)?.[1]);
  const t0 = Date.now();
  await sms('Napoklu flooded near school');
  await expect(signals).toHaveText(new RegExp(`\\(${before + 1}\\)`), { timeout: 4000 });
  test.info().annotations.push({ type: 'sms-to-card-ms', description: String(Date.now() - t0) });
});

test('contradiction → both sides visible on the card', async ({ page }) => {
  await page.goto('/');
  await sms('Madikeri flooded, market under water');
  await sms('Madikeri water gone down, we are safe');
  await page.getByRole('searchbox').fill('Madikeri');
  const card = page.getByRole('button', { name: /^Madikeri:/ });
  await expect(card.getByText('Sources disagree')).toBeVisible({ timeout: 6000 });
  await expect(card).toContainText(/says? safe/);
  await card.click();
  await expect(page.getByRole('heading', { name: /Says safe/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Says hazard/ })).toBeVisible();
});
