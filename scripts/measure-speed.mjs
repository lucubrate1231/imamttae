#!/usr/bin/env node
/** 첫 화면 속도 도구. --self-test는 도구 자체의 검사이며 앱 파일을 바꾸지 않습니다. */
import { chromium, devices } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const CASES = ['normal', 'slow4g', 'kakao-slow', 'kakao-blocked'];
const METRICS = ['data', 'cards', 'mapTiles', 'pins', 'sdk'];

export function parseArgs(args) {
  let url = 'https://lucubrate1231.github.io/imamttae/next/';
  let runs = 5;
  let caseName = 'all';
  let hasUrl = false;
  const fail = (text) => { throw new Error(`옵션 오류: ${text}`); };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--runs') {
      const value = args[++i];
      if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) fail('--runs 뒤에 1 이상 정수를 넣으세요.');
      runs = Number(value);
    } else if (arg === '--case') {
      caseName = args[++i];
      if (caseName !== 'all' && !CASES.includes(caseName)) fail('--case는 all, normal, slow4g, kakao-slow, kakao-blocked 중 하나입니다.');
    } else if (arg.startsWith('-') || hasUrl) fail('주소 하나와 --runs, --case만 사용할 수 있습니다.');
    else { url = arg; hasUrl = true; }
  }
  let parsed;
  try { parsed = new URL(url); } catch { fail('http 또는 https 주소를 넣으세요.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.searchParams.get('map') === 'fake') fail('가짜 지도 없이 http 또는 https 주소로 재세요.');
  return { url: parsed.href, runs, caseName };
}

export function summarize(values) {
  const sorted = values.map((value) => value ?? Infinity).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    median: Number.isFinite(median) ? median : null,
    max: Number.isFinite(sorted.at(-1)) ? sorted.at(-1) : null,
    complete: values.filter((value) => value !== null).length, total: values.length,
  };
}

export function formatSummary(values) {
  const { median, max, complete, total } = summarize(values);
  if (!complete) return '—';
  const seconds = (value) => value === null ? '—' : (value / 1000).toFixed(2);
  const count = complete === total ? '' : `; ${complete}/${total}회 완료`;
  return `${seconds(median)}${median === null ? '' : '초'} (${seconds(max)}${count})`;
}

export function renderTable(results) {
  return [
    '| 경우 | 데이터 | 사진 카드 | 지도 조각 | 핀 | SDK |',
    '|---|---|---|---|---|---|',
    ...results.map(({ caseName, samples }) => `| ${caseName} | ${METRICS.map((metric) => formatSummary(samples.map((row) => row[metric]))).join(' | ')} |`),
  ].join('\n');
}

/** 페이지 안에서 확인하므로 Playwright가 결과를 받아 오는 시간이 섞이지 않습니다. */
function probe({ metric, timeoutMs, blocked }) {
  const visible = (el) => {
    if (!el || el.getBoundingClientRect().width <= 0 || el.getBoundingClientRect().height <= 0) return false;
    for (let parent = el; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const time = performance.now();
  // 늦게 온 값이 제한 시간 안에 온 것처럼 기록되지 않도록 먼저 확인합니다.
  if (time > timeoutMs) return { value: null };
  if (metric === 'data' || metric === 'sdk') {
    if (!(blocked && metric === 'sdk')) {
      const entry = performance.getEntriesByType('resource').find((resource) => {
        const url = new URL(resource.name);
        return metric === 'data' ? url.pathname.endsWith('/data/scenes.json') : url.hostname === 'dapi.kakao.com';
      });
      if (entry?.responseEnd > 0) return { value: entry.responseEnd };
    }
  } else if (metric === 'cards') {
    const image = document.querySelector('.rail .big .photo img');
    if (image?.complete && image.naturalWidth > 0 && visible(image)) return { value: time };
  } else if (metric === 'mapTiles') {
    const loaded = [...document.querySelectorAll('.mapsec .kmap img')].some((image) => {
      const host = new URL(image.currentSrc || image.src, location.href).hostname;
      return (host === 'daumcdn.net' || host.endsWith('.daumcdn.net')) && image.complete && image.naturalWidth > 0 && visible(image);
    });
    if (loaded) return { value: time };
  } else if (metric === 'pins' && [...document.querySelectorAll('.mapsec .kmap .pin')].some(visible)) return { value: time };
  return false;
}

export async function measureOnce(browser, { url, caseName, timeoutMs = 15000, sdkDelayMs = 5000, prepare }) {
  const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => performance.setResourceTimingBufferSize(2000));
    await prepare?.(context, page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (caseName === 'slow4g') await cdp.send('Network.emulateNetworkConditions', {
      offline: false, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, latency: 150,
    });
    if (caseName === 'kakao-slow' || caseName === 'kakao-blocked') {
      await page.route('**/*', async (route) => {
        const host = new URL(route.request().url()).hostname;
        try {
          if (caseName === 'kakao-blocked' && (host === 'dapi.kakao.com' || host === 'daumcdn.net' || host.endsWith('.daumcdn.net'))) return await route.abort();
          if (caseName === 'kakao-slow' && host === 'dapi.kakao.com') await delay(sdkDelayMs);
          await route.fallback();
        } catch (error) { if (!page.isClosed()) throw error; }
      });
    }
    try { await page.goto(url, { waitUntil: 'commit', timeout: timeoutMs }); }
    catch { return Object.fromEntries(METRICS.map((metric) => [metric, null])); }
    const values = await Promise.all(METRICS.map(async (metric) => {
      try {
        const handle = await page.waitForFunction(probe, { metric, timeoutMs, blocked: caseName === 'kakao-blocked' }, { polling: 'raf', timeout: timeoutMs + 1000 });
        return (await handle.jsonValue()).value;
      } catch { return null; }
    }));
    return Object.fromEntries(METRICS.map((metric, i) => [metric, values[i]]));
  } finally { await context.close(); }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}) });
  const results = [];
  try {
    for (const caseName of options.caseName === 'all' ? CASES : [options.caseName]) {
      const samples = [];
      for (let run = 1; run <= options.runs; run++) {
        console.error(`${caseName}: ${run}/${options.runs}회 측정 중`);
        samples.push(await measureOnce(browser, { ...options, caseName }));
      }
      results.push({ caseName, samples });
    }
  } finally { await browser.close(); }
  console.log('가운데 값(가장 느린 값), 단위는 초. —는 15초 안에 확인하지 못한 값입니다.');
  console.log(renderTable(results));
}

async function selfTest() {
  const { test } = await import('node:test');
  const assert = await import('node:assert/strict');
  test('기본 주소·횟수·네 경우를 사용한다', () => {
    assert.deepEqual(parseArgs([]), { url: 'https://lucubrate1231.github.io/imamttae/next/', runs: 5, caseName: 'all' });
  });
  test('주소와 옵션의 순서가 달라도 읽는다', () => {
    assert.deepEqual(parseArgs(['--runs', '3', 'http://localhost:8080/', '--case', 'normal']),
      { url: 'http://localhost:8080/', runs: 3, caseName: 'normal' });
  });
  for (const args of [['--runs', '0'], ['--runs', '1.5'], ['--runs'], ['--case', 'typo'], ['--unknown'], ['file:///tmp/index.html'], ['https://example.com/?map=fake']]) {
    test(`잘못된 옵션을 거절한다: ${args[0]}`, () => assert.throws(() => parseArgs(args), /옵션 오류:/));
  }
  test('홀수 횟수는 가운데 값, 가장 느린 값을 표시한다', () => {
    assert.deepEqual(summarize([300, 100, 200]), { median: 200, max: 300, complete: 3, total: 3 });
  });
  test('짝수 횟수는 가운데 두 값의 평균이다', () => {
    assert.equal(summarize([400, 100, 200, 300]).median, 250);
  });
  test('시간 초과를 가장 느린 값에서 숨기지 않는다', () => {
    assert.deepEqual(summarize([100, null, 200]), { median: 200, max: null, complete: 2, total: 3 });
    assert.equal(summarize([100, null, null]).median, null);
  });
  test('모두 시간 초과면 빈 칸 대신 —를 출력한다', () => {
    assert.equal(formatSummary([null, null, null]), '—');
  });
  test('결과는 다섯 지표를 담은 마크다운 표다', () => {
    const row = { data: 100, cards: 200, mapTiles: null, pins: null, sdk: null };
    const output = renderTable([{ caseName: 'kakao-blocked', samples: [row] }]);
    assert.match(output, /\| 경우 \| 데이터 \| 사진 카드 \| 지도 조각 \| 핀 \| SDK \|/);
    assert.match(output, /\| kakao-blocked \| 0.10초 \(0.10\) \| 0.20초 \(0.20\) \| — \| — \| — \|/);
  });
  await test('브라우저에서 요청 지연·차단·화면 시점을 지킨다', async (t) => {
    const { createServer } = await import('node:http');
    const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=';
    const html = `<meta name="viewport" content="width=device-width,initial-scale=1"><script>
      fetch('/data/scenes.json');
      const sdk = document.createElement('script'); sdk.src = 'https://dapi.kakao.com/probe.js';
      function cards() {
        document.body.insertAdjacentHTML('beforeend', '<div class="rail"><div class="big"><div class="photo"><img style="display:none;width:10px;height:10px" src="data:image/png;base64,${pixel}"></div></div></div>');
        setTimeout(() => document.querySelector('.photo img').style.display = 'block', 100);
      }
      sdk.onload = () => {
        cards(); document.body.insertAdjacentHTML('beforeend', '<div class="mapsec"><div class="kmap"><img src="https://map.test.daumcdn.net/tile.png"><div class="pin" style="width:10px;height:10px">핀</div></div></div>');
      };
      sdk.onerror = cards; document.head.append(sdk);
    </script>`;
    const server = createServer((req, res) => {
      if (req.url === '/data/scenes.json') {
        setTimeout(() => { res.setHeader('Content-Type', 'application/json'); res.end('{"scenes":[]}'); }, 60);
      } else if (req.url === '/sw.js') { res.setHeader('Content-Type', 'application/javascript'); res.end('// test service worker'); }
      else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch();
    const url = `http://127.0.0.1:${server.address().port}/`;
    const prepare = async (context) => {
      await context.route('https://dapi.kakao.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: '// test SDK' }));
      await context.route('https://map.test.daumcdn.net/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from(pixel, 'base64') }));
    };
    try {
      await t.test('완료한 요청과 실제 보이는 카드·지도·핀 시점을 페이지 안에서 잰다', async () => {
        const row = await measureOnce(browser, { url, caseName: 'normal', timeoutMs: 1500, prepare });
        assert.ok(row.data >= 50); assert.ok(row.sdk > 0);
        assert.ok(row.cards >= 100); assert.ok(row.mapTiles > 0); assert.ok(row.pins > 0);
      });
      await t.test('SDK만 늦춰도 카드·지도 측정이 끝나고 지연을 포함한다', async () => {
        const row = await measureOnce(browser, { url, caseName: 'kakao-slow', timeoutMs: 1500, sdkDelayMs: 200, prepare });
        assert.ok(row.sdk >= 200); assert.ok(row.cards >= 300); assert.ok(row.data < row.sdk);
      });
      await t.test('SDK와 지도 그림을 막아도 카드는 숫자이고 지도·핀·SDK는 —다', async () => {
        const row = await measureOnce(browser, { url, caseName: 'kakao-blocked', timeoutMs: 600, prepare });
        assert.ok(row.cards > 0); assert.equal(row.mapTiles, null); assert.equal(row.pins, null); assert.equal(row.sdk, null);
      });
      await t.test('느린 4G에서도 데이터와 카드 측정이 끝난다', async () => {
        const row = await measureOnce(browser, { url, caseName: 'slow4g', timeoutMs: 1500, prepare });
        assert.ok(row.data > 0); assert.ok(row.cards > 0);
      });
      await t.test('매번 390×844 새 문맥이고 저장값과 서비스 워커를 가져오지 않는다', async () => {
        const pageErrors = [];
        const workers = [];
        const prepareFresh = async (context, page) => {
          await prepare(context);
          context.on('serviceworker', (worker) => workers.push(worker));
          page.on('pageerror', (error) => pageErrors.push(error.message));
          assert.deepEqual(page.viewportSize(), { width: 390, height: 844 });
          await page.addInitScript(() => {
            if (localStorage.getItem('previous')) throw new Error('캐시가 남음');
            localStorage.setItem('previous', 'yes');
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
          });
        };
        for (let run = 0; run < 2; run++) {
          const row = await measureOnce(browser, { url, caseName: 'normal', timeoutMs: 1500, prepare: prepareFresh });
          assert.ok(row.cards > 0);
        }
        assert.equal(browser.contexts().length, 0);
        assert.deepEqual(pageErrors, []); assert.deepEqual(workers, []);
      });
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--self-test')) await selfTest();
  else await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
