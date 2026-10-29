#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    selector: { type: 'string' },
    viewport: { type: 'string', default: 'desktop' },
    theme: { type: 'string', default: 'light' },
    mock: { type: 'string' },
    out: { type: 'string' },
    fullPage: { type: 'boolean', default: false },
    cdp: { type: 'string' },
  },
  strict: false,
});

if (!values.url) {
  console.error('❌ Error: --url is required.');
  process.exit(1);
}

const isMobile = values.viewport === 'mobile';
const viewport = isMobile ? { width: 375, height: 812 } : { width: 1280, height: 800 };
const outputDir = path.resolve('.screenshots');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const outputPath = values.out ? path.resolve(values.out) : path.join(outputDir, `screenshot-${Date.now()}.png`);

let mockData = null;
if (values.mock) {
  try {
    mockData = fs.existsSync(values.mock)
      ? JSON.parse(fs.readFileSync(values.mock, 'utf8'))
      : JSON.parse(values.mock);
  } catch (err) {
    console.error(`⚠️ Warning: Failed to parse mock JSON: ${err.message}`);
  }
}

// Accelerated headless launch flags
const launchArgs = [
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--mute-audio',
  '--no-first-run',
];

const browser = values.cdp
  ? await chromium.connectOverCDP(values.cdp)
  : await chromium.launch({ headless: true, args: launchArgs });

try {
  const context = await browser.newContext({
    viewport,
    colorScheme: values.theme === 'dark' ? 'dark' : 'light',
    isMobile,
    hasTouch: isMobile,
  });

  const page = await context.newPage();

  // Fast abort for tracking/telemetry
  await page.route(/(google-analytics|sentry|datadog|segment|intercom|mixpanel)/i, (route) => route.abort());

  // Zero-backend: Intercept API calls with pure mock fixtures
  if (mockData) {
    await page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData),
      });
    });
  }

  // Fast navigation: domcontentloaded instead of networkidle
  await page.goto(values.url, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Targeted capture with instant CSS animation freeze
  if (values.selector) {
    const loc = page.locator(values.selector).first();
    await loc.waitFor({ state: 'visible', timeout: 5000 });
    await loc.screenshot({ path: outputPath, animations: 'disabled' });
  } else {
    await page.screenshot({ path: outputPath, fullPage: values.fullPage, animations: 'disabled' });
  }

  console.log(`SCREENSHOT_PATH:${outputPath}`);
} finally {
  await browser.close();
}
