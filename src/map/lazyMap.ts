/**
 * 기다리지 않는 지도(#77): 카카오 SDK가 오기 전에도 화면은 바로 그립니다.
 * - 그동안 화면이 부른 핀 올리기·고르기·누르기·맞추기를 기억했다가, 지도가 준비되면 그대로 옮깁니다.
 * - 지도는 mount를 부를 때 처음 만듭니다(풍경 찾기 지도는 그 탭을 처음 열 때).
 * - 만들기가 실패하면 '지도를 불러오지 못했어요'(F1-AC10). 그동안 지도 칸은 바다색 바탕만(글자 없음).
 */
import { createFailedMap } from './failedMap';
import type { MapAdapter, MapPin } from './types';

/** giveUpMs: 이만큼 기다려도 지도가 안 붙으면 '지도를 불러오지 못했어요'(빈 칸으로 남지 않게, 10/5 아이폰) */
export function createLazyMap(make: () => Promise<MapAdapter>, opts: { giveUpMs?: number } = {}): MapAdapter {
  const giveUpMs = opts.giveUpMs ?? 15_000;
  let inner: MapAdapter | null = null; // 붙은 뒤에만 채움
  let started: Promise<void> | null = null;
  let destroyed = false;
  let pins: readonly MapPin[] | null = null;
  let selected: string | null = null;
  let wantFit = false;
  let handler: ((id: string) => void) | null = null;

  /** 지도를 붙이고 그동안 기억한 것을 옮김. 어디서든 오류가 나면 던짐 */
  async function attachInner(el: HTMLElement): Promise<MapAdapter> {
    const m = await make();
    if (destroyed) return m;
    await m.mount(el);
    replay(m);
    return m;
  }

  /** 그동안 기억한 핀·고른 곳·누르기·맞추기를 지도에 옮김 */
  function replay(m: MapAdapter): void {
    if (handler) m.onPinClick(handler);
    if (pins) m.setPins(pins);
    if (selected !== null) m.select(selected);
    if (wantFit) m.fit();
  }

  function finish(m: MapAdapter): void {
    if (destroyed) return m.destroy();
    inner = m;
  }

  async function attach(el: HTMLElement): Promise<void> {
    type Got = { m: MapAdapter } | { e: unknown };
    const job: Promise<Got> = attachInner(el).then((m) => ({ m }), (e: unknown) => ({ e }));
    let timer = 0;
    const late = new Promise<null>((ok) => (timer = window.setTimeout(() => ok(null), giveUpMs)));
    const got = await Promise.race([job, late]);
    window.clearTimeout(timer);
    if (got && 'm' in got) return finish(got.m);
    console.warn('[imamttae] 지도 대체:', got ? (got.e instanceof Error ? got.e.message : got.e) : '지도가 너무 늦습니다');
    const failed = createFailedMap();
    await failed.mount(el);
    finish(failed);
    // 너무 늦었을 뿐이면, 나중에라도 오면 안내를 지우고 지도로 바꿈
    if (!got)
      void job.then((r) => {
        if (!('m' in r) || destroyed) return;
        failed.destroy();
        replay(r.m); // 안내를 보이는 동안 바뀐 핀·고른 곳까지
        finish(r.m);
      });
  }

  return {
    get kind() {
      return inner?.kind ?? 'loading';
    },
    mount(el) {
      started ??= attach(el);
      return started;
    },
    setPins(list) {
      pins = list;
      wantFit = false; // 새 핀이면 맞추기도 새로
      inner?.setPins(list);
    },
    select(id) {
      selected = id;
      inner?.select(id);
    },
    fit() {
      wantFit = true;
      inner?.fit();
    },
    onPinClick(cb) {
      handler = cb;
      inner?.onPinClick(cb);
    },
    destroy() {
      destroyed = true;
      inner?.destroy();
      inner = null;
    },
  };
}
