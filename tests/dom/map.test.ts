// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createMap, pickMapMode } from '../../src/map';
import { createKakaoMap } from '../../src/map/kakaoMap';
import { createListMap } from '../../src/map/listMap';
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
    const m = createKakaoMap(stub.kakao, { reduceMotion: true });
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

  it('F1-AC5·AC6: 고르면 그 핀만 이름표(on)와 맨 위, "움직임 줄이기"면 바로 그 장소로 확대', async () => {
    const { log, m, fire } = await mount();
    m.setPins(pins);
    fire('tilesloaded');
    m.select('s-sea');
    expect(log.overlays.map((o) => o.el.classList.contains('on'))).toEqual([false, true, false]);
    expect(log.overlays[1]!.z).toBeGreaterThan(log.overlays[0]!.z);
    expect(log.calls.slice(-2)).toEqual(['level 10', 'center 37.47,129.16']);
  });
});
