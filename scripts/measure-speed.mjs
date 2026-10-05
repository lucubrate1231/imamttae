#!/usr/bin/env node
/** 첫 화면 속도 도구. --self-test는 도구 자체의 검사이며 앱 파일을 바꾸지 않습니다. */

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
    const { chromium } = await import('@playwright/test');
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
      } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
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
        const prepareFresh = async (context, page) => {
          await prepare(context);
          assert.equal(context._options.serviceWorkers, 'block');
          assert.deepEqual(page.viewportSize(), { width: 390, height: 844 });
          await page.addInitScript(() => {
            if (localStorage.getItem('previous')) throw new Error('캐시가 남음');
            localStorage.setItem('previous', 'yes');
          });
        };
        for (let run = 0; run < 2; run++) {
          const row = await measureOnce(browser, { url, caseName: 'normal', timeoutMs: 1500, prepare: prepareFresh });
          assert.ok(row.cards > 0);
        }
        assert.equal(browser.contexts().length, 0);
      });
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  });
}

if (process.argv.includes('--self-test')) await selfTest();
