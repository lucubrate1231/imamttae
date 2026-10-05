// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOf, watchForUpdate } from '../../src/pwa';

/**
 * 새 판이 나오면 저절로 다시 불러오기(10/6 사용자): 아이폰은 홈 화면 앱·사파리 탭을 다시 열 때 예전 화면을 되살려서
 * 새로고침 버튼이 없는 홈 화면 앱은 예전 판(지도 버그)이 계속 돌았음
 */
const html = (h: string) => `<!doctype html><head><script type="module" crossorigin src="./assets/main-${h}.js"></script></head>`;

describe('buildOf: 페이지의 판 이름(앱 파일 이름의 해시)', () => {
  it('HTML 글에서', () => expect(buildOf(html('D3ECHhoj'))).toBe('D3ECHhoj'));
  it('개발 서버처럼 해시가 없으면 null', () => expect(buildOf('<script type="module" src="/src/main.ts"></script>')).toBeNull());
});

describe('watchForUpdate: 다시 화면에 나올 때 새 판이 있으면 다시 불러옴', () => {
  afterEach(() => vi.restoreAllMocks());
  const setup = (served: string) => {
    const reload = vi.fn();
    const fetchHtml = vi.fn(async () => html(served));
    const stop = watchForUpdate(window, { current: 'OLD', fetchHtml, reload, minGapMs: 0 });
    return { reload, fetchHtml, stop };
  };
  const show = async () => {
    window.dispatchEvent(new Event('pageshow'));
    await new Promise((r) => setTimeout(r, 0));
  };

  it('새 판이면 다시 불러옴', async () => {
    const { reload, stop } = setup('NEW');
    await show();
    expect(reload).toHaveBeenCalledTimes(1);
    stop();
  });
  it('같은 판이면 그대로', async () => {
    const { reload, fetchHtml, stop } = setup('OLD');
    await show();
    expect(fetchHtml).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    stop();
  });
  it('인터넷이 끊겨 확인을 못 하면 그대로(멈추지 않음)', async () => {
    const reload = vi.fn();
    const stop = watchForUpdate(window, { current: 'OLD', fetchHtml: () => Promise.reject(new Error('offline')), reload, minGapMs: 0 });
    await show();
    expect(reload).not.toHaveBeenCalled();
    stop();
  });
  it('지금 판을 모르면(개발 서버) 아무것도 안 함', () => {
    const fetchHtml = vi.fn();
    const stop = watchForUpdate(window, { current: null, fetchHtml, reload: vi.fn() });
    window.dispatchEvent(new Event('pageshow'));
    expect(fetchHtml).not.toHaveBeenCalled();
    stop();
  });
});
