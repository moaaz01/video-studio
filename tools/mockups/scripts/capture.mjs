#!/usr/bin/env node
/**
 * Capture the mockup factory to 2× PNGs.
 *
 *   npm run capture                 # build, serve dist/, capture every screen
 *   npm run capture -- --only waha-storefront
 *   npm run capture -- --no-build   # reuse dist/
 *
 * The browser is real Edge/Chromium at an exact CSS viewport and a device pixel
 * ratio of 2. Screens are only written after `document.fonts.ready` and two
 * animation frames, so Arabic shaping and the IBM Plex metrics are final.
 *
 * The factory is served by a tiny static server rather than `vite preview`: the
 * capture step then has no dev-server dependency, no HMR, and no port race.
 */
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.resolve(HERE, '..');
const ROOT = path.resolve(TOOL, '..', '..');
const DIST = path.join(TOOL, 'dist');
const MANIFEST_PATH = path.join(TOOL, 'screens.json');
const BRANDS_PATH = path.join(TOOL, 'brands.json');
const PORT = 5180;
const BASE_URL = `http://127.0.0.1:${PORT}/`;

const args = process.argv.slice(2);
const only = args
  .filter((arg, index) => arg === '--only' || args[index - 1] === '--only')
  .flatMap((arg) => (arg === '--only' ? [] : arg.split(',')))
  .filter(Boolean);
const noBuild = args.includes('--no-build');
const browserOverride = process.env.MOCKUP_BROWSER || '';

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const brands = JSON.parse(fs.readFileSync(BRANDS_PATH, 'utf8'));

function fail(message) {
  console.error(`\n  capture failed: ${message}\n`);
  process.exit(1);
}

if (manifest.version !== 1) fail(`screens.json version ${manifest.version} is not supported`);
if (!Array.isArray(manifest.screens) || manifest.screens.length === 0) fail('screens.json has no screens');

const slugs = new Set();
for (const screen of manifest.screens) {
  for (const key of ['slug', 'title', 'screen', 'brand', 'mode', 'width', 'height', 'scale']) {
    if (screen[key] === undefined) fail(`${screen.slug || '(unnamed)'} is missing "${key}"`);
  }
  if (slugs.has(screen.slug)) fail(`duplicate slug "${screen.slug}"`);
  slugs.add(screen.slug);
  if (!brands[screen.brand]) fail(`${screen.slug} references unknown brand "${screen.brand}"`);
  if (!['light', 'dark'].includes(screen.mode)) fail(`${screen.slug} has mode "${screen.mode}"`);
  if (!(screen.width > 0 && screen.height > 0)) fail(`${screen.slug} has an invalid viewport`);
  if (![1, 2, 3].includes(screen.scale)) fail(`${screen.slug} has an unsupported scale ${screen.scale}`);
}

const selected = only.length
  ? manifest.screens.filter((screen) => only.includes(screen.slug))
  : manifest.screens;
if (selected.length === 0) fail(`no screens matched --only ${only.join(',')}`);

function build() {
  console.log('\n  building the factory…');
  if (process.platform === 'win32') {
    execFileSync('cmd.exe', ['/c', 'npm', 'run', 'build'], {cwd: TOOL, stdio: 'inherit'});
  } else {
    execFileSync('npm', ['run', 'build'], {cwd: TOOL, stdio: 'inherit'});
  }
}

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('not a PNG');
  }
  return {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** A deterministic static server for `dist/`; no dev server, no HMR. */
function serveDist() {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', BASE_URL);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const candidate = path.resolve(DIST, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!candidate.startsWith(DIST + path.sep) && candidate !== path.join(DIST, 'index.html')) {
      response.writeHead(403);
      response.end('forbidden');
      return;
    }
    fs.readFile(candidate, (error, data) => {
      if (error) {
        response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
        response.end('not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(candidate)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function launchBrowser() {
  const candidates = browserOverride ? [browserOverride] : ['msedge', 'chrome', 'chromium'];
  let lastError;
  for (const channel of candidates) {
    try {
      const browser = await chromium.launch({channel, headless: true});
      console.log(`  browser: ${channel}`);
      return browser;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `no Chromium-based browser found (tried ${candidates.join(', ')}). ` +
      `Install Edge/Chrome, or set MOCKUP_BROWSER to a Playwright channel.\n${lastError?.message || ''}`,
  );
}

async function main() {
  if (!noBuild) build();
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    fail('dist/index.html is missing — run without --no-build');
  }

  console.log(`\n  serving ${path.relative(ROOT, DIST)} at ${BASE_URL}`);
  const server = await serveDist();

  try {
    const browser = await launchBrowser();
    const outRoot = path.resolve(ROOT, manifest.outDir);
    fs.mkdirSync(outRoot, {recursive: true});

    const captured = [];
    try {
      // Group by scale + colour scheme so one context serves every screen that
      // shares them. Reusing the page keeps Edge's buffer pressure low; the app
      // still reloads per screen and the Theme mode comes from the manifest.
      const groups = new Map();
      for (const screen of selected) {
        const key = `${screen.scale}:${screen.mode}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(screen);
      }

      for (const [key, screens] of groups) {
        const [scale, scheme] = key.split(':');
        const context = await browser.newContext({
          viewport: {width: screens[0].width, height: screens[0].height},
          deviceScaleFactor: Number(scale),
          locale: 'ar-SA',
          timezoneId: 'Asia/Riyadh',
          colorScheme: scheme,
          reducedMotion: 'no-preference',
        });
        const page = await context.newPage();
        try {
          for (const screen of screens) {
            await page.setViewportSize({width: screen.width, height: screen.height});
            const target = `${BASE_URL}?screen=${encodeURIComponent(screen.slug)}`;
            let lastError;
            for (let attempt = 0; attempt < 2; attempt += 1) {
              try {
                await page.goto(target, {waitUntil: 'domcontentloaded', timeout: 60000});
                lastError = null;
                break;
              } catch (error) {
                lastError = error;
                await page.waitForTimeout(400);
              }
            }
            if (lastError) throw lastError;
            await page.waitForSelector('html[data-mockup-ready="true"]', {timeout: 30000});
            if (await page.locator('[data-mockup-error]').count()) {
              const message = await page.locator('[data-mockup-error]').innerText();
              throw new Error(`${screen.slug}: ${message.replace(/\s+/g, ' ').slice(0, 300)}`);
            }
            await page.evaluate(async () => {
              await document.fonts.ready;
            });
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
                ),
            );

            const brand = brands[screen.brand];
            const prefix = `${brand.slug}-`;
            const name = screen.slug.startsWith(prefix) ? screen.slug.slice(prefix.length) : screen.slug;
            const dir = path.join(outRoot, brand.slug);
            fs.mkdirSync(dir, {recursive: true});
            const destination = path.join(dir, `${name}.png`);
            await page.screenshot({path: destination, animations: 'disabled', caret: 'hide', scale: 'device'});

            const buffer = fs.readFileSync(destination);
            const size = pngSize(buffer);
            const expected = {width: screen.width * screen.scale, height: screen.height * screen.scale};
            if (size.width !== expected.width || size.height !== expected.height) {
              throw new Error(
                `${screen.slug}: wrote ${size.width}×${size.height}, expected ${expected.width}×${expected.height}`,
              );
            }
            captured.push({
              slug: screen.slug,
              title: screen.title,
              path: `mockups/${brand.slug}/${name}.png`,
              screen: screen.screen,
              brand: screen.brand,
              mode: screen.mode,
              cssWidth: screen.width,
              cssHeight: screen.height,
              width: size.width,
              height: size.height,
              scale: screen.scale,
              bytes: buffer.length,
              sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
            });
            console.log(
              `  ${screen.slug.padEnd(24)} ${size.width}×${size.height}  ${(buffer.length / 1024).toFixed(0)} KB`,
            );
          }
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }

    const manifestOut = {
      version: 1,
      generatedAt: new Date().toISOString(),
      factory: 'tools/mockups',
      source: 'tools/mockups/screens.json',
      screens: captured,
    };
    fs.writeFileSync(
      path.join(outRoot, 'manifest.json'),
      `${JSON.stringify(manifestOut, null, 2)}\n`,
      'utf8',
    );
    console.log(`\n  ${captured.length} screen(s) → ${path.relative(ROOT, outRoot)}`);
    console.log(`  manifest → ${path.relative(ROOT, path.join(outRoot, 'manifest.json'))}\n`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(`\n  capture failed: ${error.message}\n`);
  process.exit(1);
});
