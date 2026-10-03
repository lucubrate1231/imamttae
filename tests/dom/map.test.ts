// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createMap, pickMapMode } from '../../src/map';
import { createKakaoMap } from '../../src/map/kakaoMap';
import { createKakaoStub } from '../fixtures/kakaoStub';

const pins = [
  { id: 's-005-jujeongol', lat: 38.0825, lng: 128.4282, label: '주전골', kind: 'story' as const },
  { id: 'p-033-taejongdae', lat: 35.0532, lng: 129.0871, label: '태종대', kind: 'placeholder' as const },
];

describe('지도 고르기', () => {
  it('?map=fake 주소면 가짜 지도', () => {
    expect(pickMapMode('?map=fake', 'kakao')).toBe('fake');
    expect(pickMapMode('', 'fake')).toBe('fake');
    expect(pickMapMode('', undefined)).toBe('kakao');
  });

  it('카카오 SDK를 못 불러오면 목록 지도로 바꾸고 이유를 남긴다', async () => {
    const load = vi.fn().mockRejectedValue(new Error('카카오 지도 SDK를 불러오지 못했습니다'));
    const r = await createMap('kakao', 'key', load);
    expect(r.map.kind).toBe('list');
    expect(r.fallbackReason).toMatch(/불러오지 못했습니다/);
  });

  it('키가 없어도 멈추지 않고 목록 지도', async () => {
    const r = await createMap('kakao', '');
    expect(r.map.kind).toBe('list');
  });
});

describe('목록 지도(가짜 지도)', () => {
  it('핀을 버튼으로 그리고, 누르면 장면 id를 알려 준다', async () => {
    const r = await createMap('fake', '');
    const el = document.createElement('div');
    await r.map.mount(el);
    const clicked: string[] = [];
    r.map.onPinClick((id) => clicked.push(id));
    r.map.setPins(pins);
    const buttons = el.querySelectorAll('button[data-pin-id]');
    expect(buttons).toHaveLength(2);
    (buttons[1] as HTMLButtonElement).click();
    expect(clicked).toEqual(['p-033-taejongdae']);
  });
});

describe('카카오 지도 어댑터 (가짜 SDK로 확인)', () => {
  it('핀을 위도·경도 순서로 지도에 올리고, 다시 그리면 이전 핀을 지운다', async () => {
    const { kakao, log } = createKakaoStub();
    const m = createKakaoMap(kakao);
    await m.mount(document.createElement('div'));
    m.setPins(pins);
    expect(log.overlays.map((o) => [o.lat, o.lng])).toEqual([[38.0825, 128.4282], [35.0532, 129.0871]]);
    m.setPins([pins[0]!]);
    expect(log.overlays.filter((o) => o.onMap)).toHaveLength(1);
  });

  it('핀을 누르면 장면 id', async () => {
    const { kakao, log } = createKakaoStub();
    const m = createKakaoMap(kakao);
    await m.mount(document.createElement('div'));
    let got = '';
    m.onPinClick((id) => (got = id));
    m.setPins(pins);
    log.overlays[0]!.el.click();
    expect(got).toBe('s-005-jujeongol');
  });
});
