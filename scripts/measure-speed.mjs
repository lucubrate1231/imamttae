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
}

if (process.argv.includes('--self-test')) await selfTest();
