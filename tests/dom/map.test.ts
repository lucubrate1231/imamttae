// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createMap, pickMapMode } from '../../src/map';
import { kakaoSdkStage, loadKakaoSdk, resetKakaoSdkForTest } from '../../src/map/kakaoSdk';
import { createKakaoMap } from '../../src/map/kakaoMap';
import { createListMap } from '../../src/map/listMap';
import { createLazyMap } from '../../src/map/lazyMap';
import { createFailedMap } from '../../src/map/failedMap';
import { createKakaoStub } from '../fixtures/kakaoStub';
import type { MapPin } from '../../src/map/types';

const pins: MapPin[] = [
  { id: 's-005-jujeongol', lat: 38.0825, lng: 128.4282, label: '주전골', kind: 'peak' },
  { id: 's-sea', lat: 37.47, lng: 129.16, label: '추암', kind: 'record' },
  { id: 'p-033-taejongdae', lat: 35.0532, lng: 129.0871, label: '태종대', kind: 'placeholder' },
];

describe('지도 고르기', () => {
  it('?map=fake 주소면 가짜 지도', () => {
    expect(pickMapMode('?map=fake', 'kakao')).toBe('fake');
    expect(pickMapMode('', 'fake')).toBe('fake');
    expect(pickMapMode('', undefined)).toBe('kakao');
  });

  it('F1-AC10: 카카오 SDK를 못 불러오면 "지도를 불러오지 못했어요"를 보여 주고 이유를 남긴다', async () => {
    const load = vi.fn().mockRejectedValue(new Error('카카오 지도 SDK를 불러오지 못했습니다'));
    const r = await createMap('kakao', 'key', load);
    expect(r.map.kind).toBe('failed');
    expect(r.fallbackReason).toMatch(/불러오지 못했습니다/);
    const el = document.createElement('div');
    await r.map.mount(el);
    r.map.setPins(pins);
    r.map.select('s-005-jujeongol');
    expect(el.querySelector('.mapfail')?.textContent).toBe('지도를 불러오지 못했어요.');
  });

  it('키가 없어도 멈추지 않음', async () => {
    const r = await createMap('kakao', '');
    expect(r.map.kind).toBe('failed');
  });
});

describe('목록 지도(가짜 지도)', () => {
  it('핀을 종류별 버튼으로 그리고, 누르면 장면 id. 고른 핀은 aria-current', async () => {
    const m = createListMap();
    const el = document.createElement('div');
    await m.mount(el);
    const clicked: string[] = [];
    m.onPinClick((id) => clicked.push(id));
    m.setPins(pins);
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('button[data-pin-id]')];
    expect(buttons.map((b) => b.className)).toEqual(['listpin listpin--peak', 'listpin listpin--record', 'listpin listpin--placeholder']);
    buttons[2]!.click();
    expect(clicked).toEqual(['p-033-taejongdae']);
    m.select('s-sea');
    expect(buttons.map((b) => b.getAttribute('aria-current'))).toEqual([null, 'true', null]);
  });
});

describe('카카오 지도 어댑터 (가짜 SDK로 확인)', () => {
  const mount = async () => {
    const stub = createKakaoStub();
    const m = createKakaoMap(stub.kakao);
    await m.mount(document.createElement('div'));
    return { ...stub, m };
  };

  it('작은 지도는 손으로 움직이지 않음(페이지 스크롤과 다투지 않게)', async () => {
    const { log } = await mount();
    expect(log.maps[0]!.opts).toMatchObject({ draggable: false, scrollwheel: false, disableDoubleClickZoom: true });
    expect(log.maps[0]!.zoomable).toBe(false);
  });

  it('핀을 위도·경도 순서로 올리고, 다시 그리면 이전 핀을 지운다. 종류는 class로', async () => {
    const { log, m } = await mount();
    m.setPins(pins);
    expect(log.overlays.map((o) => [o.lat, o.lng])).toEqual([[38.0825, 128.4282], [37.47, 129.16], [35.0532, 129.0871]]);
    expect(log.overlays.map((o) => o.el.className)).toEqual(['pin p', 'pin r', 'pin ph']);
    m.setPins([pins[0]!]);
    expect(log.overlays.filter((o) => o.onMap)).toHaveLength(1);
  });

  it('핀을 누르면 장면 id', async () => {
    const { log, m } = await mount();
    let got = '';
    m.onPinClick((id) => (got = id));
    m.setPins(pins);
    log.overlays[1]!.el.click();
    expect(got).toBe('s-sea');
  });

  it('F1-AC5·AC6(D39): 고르면 그 핀만 이름표(on)와 맨 위, 지도는 전국 그대로(확대·이동 없음)', async () => {
    vi.useFakeTimers();
    try {
      const stub = createKakaoStub();
      const m = createKakaoMap(stub.kakao);
      await m.mount(document.createElement('div'));
      m.setPins(pins);
      const before = stub.log.calls.length;
      m.select('s-sea'); // 지도 조각이 뜨기 전에 골라도 바로 이름표
      expect(stub.log.overlays.map((o) => o.el.classList.contains('on'))).toEqual([false, true, false]);
      expect(stub.log.overlays[1]!.z).toBeGreaterThan(stub.log.overlays[0]!.z);
      stub.fire('tilesloaded');
      vi.advanceTimersByTime(10_000);
      expect(stub.log.calls.slice(before)).toEqual([]); // 확대·가운데 옮기기를 부르지 않음 → 지도 그림을 다시 받지 않음
    } finally {
      vi.useRealTimers();
    }
  });

  it('D39: 고른 곳이 작은 지도 칸 밖이면 확대 없이 그곳이 보이게 옮김(칸 안이면 그대로)', async () => {
    const stub = createKakaoStub();
    const m = createKakaoMap(stub.kakao);
    await m.mount(document.createElement('div'));
    m.setPins(pins);
    const before = stub.log.calls.length;
    m.select('s-sea'); // 37.47 — 칸 안
    expect(stub.log.calls.slice(before)).toEqual([]);
    m.select('s-005-jujeongol'); // 38.08 — 칸 위로 벗어남(설악)
    expect(stub.log.calls.slice(before)).toEqual(['pan 38.0825,128.4282']);
    expect(stub.log.calls.some((c) => c.startsWith('level'))).toBe(false);
  });

  it('첫 화면 지도(10/5 사용자 — 9단계): 9단계로 시작하고, 고르면 움직임 없이 그곳을 가운데로(단계는 그대로)', async () => {
    vi.useFakeTimers();
    try {
      const stub = createKakaoStub();
      const m = createKakaoMap(stub.kakao, { focusLevel: 9 });
      await m.mount(document.createElement('div'));
      m.setPins(pins);
      expect(stub.log.maps).toHaveLength(0); // 처음 고를 때까지 지도를 만들지 않음(다른 곳 지도 그림을 먼저 받지 않게)
      const before = stub.log.calls.length;
      m.select('s-sea');
      const made = stub.log.maps[0]!;
      expect(made.level).toBe(9);
      expect([(made.opts.center as { getLat(): number }).getLat(), (made.opts.center as { getLng(): number }).getLng()]).toEqual([37.47, 129.16]); // 첫 카드 장소에서 바로 시작
      expect(stub.log.overlays.filter((o) => o.onMap)).toHaveLength(3);
      expect(stub.log.calls.some((c) => c.startsWith('bounds'))).toBe(false); // 전국 맞추기를 하지 않음
      expect(stub.log.overlays[1]!.el.classList.contains('on')).toBe(true);
      m.select('s-005-jujeongol');
      vi.advanceTimersByTime(5000);
      expect(stub.log.calls.slice(before)).toEqual(['center 37.47,129.16', 'center 38.0825,128.4282']); // 확대·옮기기 움직임 없음
    } finally {
      vi.useRealTimers();
    }
  });

  it("풍경 찾기: fit()은 올린 핀이 모두 보이게 지도를 맞춤(한 곳으로 확대하지 않음)", async () => {
    const { log, m, fire } = await mount();
    m.setPins(pins);
    fire("tilesloaded");
    m.fit();
    expect(log.calls.at(-1)).toBe("bounds 3");
  });
});

describe('어느 화면도 9단계보다 가까이 가지 않음(메시지 V 1-1 — 7·8단계는 등고선이 빽빽함)', () => {
  it('풍경 찾기 fit()이 핀이 하나뿐이거나 모여 있어 9보다 가까이 맞추면 9로', async () => {
    const stub = createKakaoStub();
    const m = createKakaoMap(stub.kakao);
    await m.mount(document.createElement('div'));
    m.setPins(pins.slice(0, 1));
    stub.log.fitLevel = 6; // 핀 하나에 맞추면 카카오가 6단계까지 당김
    m.fit();
    expect(stub.log.calls.at(-1)).toBe('level 9');
  });
  it('핀이 퍼져 있어 9보다 멀면 그대로', async () => {
    const stub = createKakaoStub();
    const m = createKakaoMap(stub.kakao);
    await m.mount(document.createElement('div'));
    m.setPins(pins);
    m.fit();
    expect(stub.log.calls.at(-1)).toBe('bounds 3');
  });
});

describe("지도 없이도 fit()을 불러도 멈추지 않음", () => {
  it("목록 지도·실패 지도", async () => {
    const l = createListMap();
    await l.mount(document.createElement("div"));
    expect(() => l.fit()).not.toThrow();
  });
});

describe('#77 기다리지 않는 지도(createLazyMap)', () => {
  it('지도가 오기 전에 올린 핀·고른 곳·누르기를 기억했다가, 지도가 오면 그대로 옮김', async () => {
    let give!: (m: ReturnType<typeof createListMap>) => void;
    const lazy = createLazyMap(() => new Promise((r) => (give = r)));
    const el = document.createElement('div');
    const mounted = lazy.mount(el);
    const clicked: string[] = [];
    lazy.onPinClick((id) => clicked.push(id));
    lazy.setPins(pins);
    lazy.select('s-sea');
    expect(el.querySelector('button')).toBeNull();
    give(createListMap());
    await mounted;
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('button[data-pin-id]')];
    expect(buttons).toHaveLength(3);
    expect(buttons[1]!.getAttribute('aria-current')).toBe('true');
    buttons[0]!.click();
    expect(clicked).toEqual(['s-005-jujeongol']);
    lazy.setPins(pins.slice(0, 1)); // 지도가 온 뒤에는 바로 넘김
    expect(el.querySelectorAll('button[data-pin-id]')).toHaveLength(1);
  });

  it('mount 전에는 지도를 만들지 않음(풍경 찾기 지도는 그 탭을 처음 열 때)', async () => {
    const make = vi.fn(async () => createListMap());
    const lazy = createLazyMap(make);
    lazy.setPins(pins);
    lazy.fit();
    expect(make).not.toHaveBeenCalled();
    await lazy.mount(document.createElement('div'));
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('만들기가 실패하면 "지도를 불러오지 못했어요"', async () => {
    const lazy = createLazyMap(() => Promise.reject(new Error('막힘')));
    const el = document.createElement('div');
    await lazy.mount(el);
    expect(lazy.kind).toBe('failed');
    expect(el.querySelector('.mapfail')?.textContent).toBe('지도를 불러오지 못했어요.');
  });

  it('지도가 오기 전에 화면을 닫으면, 온 지도도 정리함', async () => {
    const inner = createListMap();
    const destroy = vi.spyOn(inner, 'destroy');
    let give!: (m: typeof inner) => void;
    const lazy = createLazyMap(() => new Promise((r) => (give = r)));
    const mounted = lazy.mount(document.createElement('div'));
    lazy.destroy();
    give(inner);
    await mounted;
    expect(destroy).toHaveBeenCalled();
  });
});

describe('지도 칸이 빈 채로 남지 않음(10/5 아이폰에서 지도 칸이 비어 있던 것)', () => {
  it('SDK 파일은 왔는데 카카오 지도 준비(maps.load)가 끝내 안 끝나면 시간이 지나 실패로 넘어감', async () => {
    resetKakaoSdkForTest();
    let script: HTMLScriptElement | null = null;
    const doc = { createElement: (t: string) => document.createElement(t), head: { append: (s: HTMLScriptElement) => (script = s) } } as unknown as Document;
    const p = loadKakaoSdk('key', 50, doc);
    (window as unknown as { kakao: unknown }).kakao = { maps: { load: () => {} } }; // 콜백을 부르지 않음
    script!.onload!(new Event('load'));
    await expect(p).rejects.toThrow(/늦습니다/);
    delete (window as unknown as { kakao?: unknown }).kakao;
    resetKakaoSdkForTest();
  });

  it('지도를 붙이다 오류가 나면 "지도를 불러오지 못했어요"', async () => {
    const broken = { ...createListMap(), mount: () => Promise.reject(new Error('붙이기 실패')) };
    const lazy = createLazyMap(async () => broken);
    const el = document.createElement('div');
    lazy.setPins(pins);
    lazy.select('s-sea');
    await lazy.mount(el);
    expect(lazy.kind).toBe('failed');
    expect(el.querySelector('.mapfail')?.textContent).toBe('지도를 불러오지 못했어요.');
  });

  it('지도가 정한 시간 안에 안 오면 "지도를 불러오지 못했어요", 나중에라도 오면 지도로 바꿈', async () => {
    let give!: (m: ReturnType<typeof createListMap>) => void;
    const lazy = createLazyMap(() => new Promise((r) => (give = r)), { giveUpMs: 30 });
    const el = document.createElement('div');
    lazy.setPins(pins);
    await lazy.mount(el);
    expect(lazy.kind).toBe('failed');
    expect(el.querySelector('.mapfail')).not.toBeNull();
    give(createListMap());
    await new Promise((r) => setTimeout(r, 0));
    expect(lazy.kind).toBe('list');
    expect(el.querySelector('.mapfail')).toBeNull();
    expect(el.querySelectorAll('button[data-pin-id]')).toHaveLength(3);
  });
});

describe('미리보기에서는 지도를 못 불러온 까닭을 작게 보여 줌(홈 화면 앱에서 지도 칸이 비던 것 찾기, 10/5)', () => {
  it('까닭을 넘기면 안내 아래 작은 글자로', async () => {
    const el = document.createElement('div');
    await createFailedMap('카카오 지도 응답이 늦습니다').mount(el);
    expect(el.querySelector('.mapfail')?.firstChild?.textContent).toBe('지도를 불러오지 못했어요.');
    expect(el.querySelector('.mapfail-why')?.textContent).toBe('카카오 지도 응답이 늦습니다');
  });
  it('까닭을 안 넘기면(알파) 안내만', async () => {
    const el = document.createElement('div');
    await createFailedMap().mount(el);
    expect(el.querySelector('.mapfail-why')).toBeNull();
  });
  it('createMap·기다리는 지도에 showReason을 주면 그 까닭이 칸에 보임', async () => {
    const r = await createMap('kakao', 'key', () => Promise.reject(new Error('SDK 막힘')), { showReason: true });
    const el = document.createElement('div');
    await r.map.mount(el);
    expect(el.querySelector('.mapfail-why')?.textContent).toBe('SDK 막힘');
    const lazy = createLazyMap(() => new Promise(() => {}), { giveUpMs: 20, showReason: true });
    const el2 = document.createElement('div');
    await lazy.mount(el2);
    expect(el2.querySelector('.mapfail-why')?.textContent).toBe('지도가 너무 늦습니다');
  });
});

describe('미리보기: 지도를 기다리는 동안 몇 초째·어느 단계인지 작게 보여 줌(사파리에서 지도 칸이 비던 것 찾기, 10/5)', () => {
  it('기다리는 동안 상태 글자, 지도가 오면 지움', async () => {
    let give!: (m: ReturnType<typeof createListMap>) => void;
    const lazy = createLazyMap(() => new Promise((r) => (give = r)), { showReason: true, status: () => 'SDK 파일 받는 중' });
    const el = document.createElement('div');
    const mounted = lazy.mount(el);
    expect(el.querySelector('.mapwait')?.textContent).toBe('지도 기다리는 중 · 0초 · SDK 파일 받는 중');
    give(createListMap());
    await mounted;
    expect(el.querySelector('.mapwait')).toBeNull();
  });
  it('showReason이 없으면(알파) 아무 글자 없음', async () => {
    const lazy = createLazyMap(() => new Promise(() => {}), { status: () => 'x' });
    const el = document.createElement('div');
    void lazy.mount(el);
    expect(el.querySelector('.mapwait')).toBeNull();
  });
  it('SDK 단계: 파일 받는 중 → 지도 준비 중 → 준비 끝', async () => {
    resetKakaoSdkForTest();
    let script: HTMLScriptElement | null = null;
    const doc = { createElement: (t: string) => document.createElement(t), head: { append: (s: HTMLScriptElement) => (script = s) } } as unknown as Document;
    const p = loadKakaoSdk('key', 1000, doc);
    expect(kakaoSdkStage()).toBe('SDK 파일 받는 중');
    let ready!: () => void;
    (window as unknown as { kakao: unknown }).kakao = { maps: { load: (cb: () => void) => (ready = cb) } };
    script!.onload!(new Event('load'));
    expect(kakaoSdkStage()).toBe('지도 준비 중');
    ready();
    await p;
    expect(kakaoSdkStage()).toBe('지도 준비 끝');
    delete (window as unknown as { kakao?: unknown }).kakao;
    resetKakaoSdkForTest();
  });
});

describe('숨은 칸에서 만든 지도도 보이면 다시 맞춤(10/5 — 저장한 곳에서 열고 첫 화면으로 가면 지도가 깨짐)', () => {
  it('칸 크기가 0에서 생기거나 바뀌면 relayout 하고 고른 곳을 다시 가운데로', async () => {
    const watchers: ((() => void))[] = [];
    const Orig = (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class { constructor(cb: () => void) { watchers.push(cb); } observe() {} disconnect() {} };
    try {
      const stub = createKakaoStub();
      const m = createKakaoMap(stub.kakao, { focusLevel: 9 });
      const host = document.createElement('div');
      await m.mount(host);
      m.setPins(pins);
      m.select('s-sea'); // 숨은 칸(0×0)에서 지도를 만듦
      const before = stub.log.calls.length;
      Object.defineProperty(host, 'clientWidth', { value: 358, configurable: true });
      Object.defineProperty(host, 'clientHeight', { value: 210, configurable: true });
      watchers.forEach((w) => w()); // 첫 화면이 보여 칸 크기가 생김
      expect(stub.log.calls.slice(before)).toEqual(['relayout', 'center 37.47,129.16']);
    } finally {
      (window as unknown as { ResizeObserver?: unknown }).ResizeObserver = Orig;
    }
  });
});

describe('화면이 다시 보이면 지도를 다시 맞춤(카톡 → 사파리로 열기: 사파리가 뒤에서 페이지를 먼저 열 수 있음, 10/6)', () => {
  it('pageshow·visibilitychange(보임) 때 relayout + 고른 곳 가운데로(크기가 같아도)', async () => {
    const stub = createKakaoStub();
    const m = createKakaoMap(stub.kakao, { focusLevel: 9 });
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 358, configurable: true });
    Object.defineProperty(host, 'clientHeight', { value: 210, configurable: true });
    await m.mount(host);
    m.setPins(pins);
    m.select('s-sea');
    const before = stub.log.calls.length;
    window.dispatchEvent(new Event('pageshow'));
    expect(stub.log.calls.slice(before)).toEqual(['relayout', 'center 37.47,129.16']);
    const mid = stub.log.calls.length;
    document.dispatchEvent(new Event('visibilitychange')); // 시험 환경은 늘 보임
    expect(stub.log.calls.slice(mid)).toEqual(['relayout', 'center 37.47,129.16']);
    m.destroy();
    const end = stub.log.calls.length;
    window.dispatchEvent(new Event('pageshow'));
    expect(stub.log.calls.length).toBe(end); // 치운 뒤에는 듣지 않음
  });
});
