// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createMap, pickMapMode } from '../../src/map';
import { createKakaoMap } from '../../src/map/kakaoMap';
import { createListMap } from '../../src/map/listMap';
import { createLazyMap } from '../../src/map/lazyMap';
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

  it("풍경 찾기: fit()은 올린 핀이 모두 보이게 지도를 맞춤(한 곳으로 확대하지 않음)", async () => {
    const { log, m, fire } = await mount();
    m.setPins(pins);
    fire("tilesloaded");
    m.fit();
    expect(log.calls.at(-1)).toBe("bounds 3");
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
