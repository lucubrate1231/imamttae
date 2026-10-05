/**
 * 좌표 다시 만들기(카카오 로컬 API 결과 저장 금지 — docs/kakao-local-data.md, 사용자 결정 ③)
 * 저장해도 되는 출처로 장면 위치(spot)·길찾기 목적지(dest) '후보'를 만듭니다. 앱 데이터는 바꾸지 않아요.
 * - 장면 위치: 한국관광공사 국문 관광정보(TourAPI KorService2, 장면 이름으로 검색)
 * - 목적지: 전국주차장정보표준데이터(.cache/public-data/전국주차장정보표준데이터.csv) 중 장면 위치에서 가까운 것
 * - 기존(카카오) 좌표는 출발점으로도 쓰지 않습니다.
 *   npx tsx pipeline/places/candidates.ts   → .cache/places/candidates.json + 요약
 * 키: .env.local 의 DATA_GO_KR_KEY(화면·파일에 찍지 않음)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { distanceKm } from '../../src/domain/geo';

type Scene = { id: string; kind: string; name: string; region: string; hidden?: boolean };
export interface TourHit { title: string; addr: string; lat: number; lng: number; contentId: string }
export interface Parking { id: string; name: string; type: string; addr: string; lat: number; lng: number; org: string }

function envKey(): string {
  const line = readFileSync('.env.local', 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATA_GO_KR_KEY='));
  if (!line) throw new Error('.env.local 에 DATA_GO_KR_KEY 가 없어요');
  return line.slice('DATA_GO_KR_KEY='.length).trim();
}

/** 따옴표 안 쉼표를 지키는 CSV 한 줄 나누기 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) {
      if (c === '"' && line[i + 1] === '"') (cur += '"', i++);
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') (out.push(cur), (cur = ''));
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function loadParking(path = '.cache/public-data/전국주차장정보표준데이터.csv'): Parking[] {
  const txt = new TextDecoder('euc-kr').decode(readFileSync(path));
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const H = splitCsvLine(lines[0]!);
  const at = (n: string) => H.indexOf(n);
  const [iId, iName, iType, iRoad, iLot, iLat, iLng, iOrg] = ['주차장관리번호', '주차장명', '주차장구분', '소재지도로명주소', '소재지지번주소', '위도', '경도', '관리기관명'].map(at);
  return lines.slice(1).flatMap((l) => {
    const r = splitCsvLine(l);
    const lat = Number(r[iLat!]);
    const lng = Number(r[iLng!]);
    if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) return [];
    return [{ id: r[iId!]!, name: r[iName!]!, type: r[iType!]!, addr: r[iRoad!] || r[iLot!] || '', lat, lng, org: r[iOrg!]! }];
  });
}

async function searchTour(keyword: string, key: string): Promise<TourHit[]> {
  const u = `https://apis.data.go.kr/B551011/KorService2/searchKeyword2?${new URLSearchParams({ serviceKey: key, MobileOS: 'ETC', MobileApp: 'imamttae', _type: 'json', keyword, numOfRows: '10', pageNo: '1' })}`;
  const r = await fetch(u);
  const j = (await r.json()) as { response?: { body?: { items?: { item?: Record<string, string>[] } | '' } } };
  const items = (j.response?.body?.items || { item: [] }) as { item?: Record<string, string>[] };
  return [].concat((items.item ?? []) as never).map((x: Record<string, string>) => ({ title: x.title!, addr: x.addr1 ?? '', lat: Number(x.mapy), lng: Number(x.mapx), contentId: x.contentid! }));
}

/** 장면 이름에서 검색어 후보: 그대로 → 지역 앞말 뺀 이름 → 앞 두 낱말 */
export function keywords(name: string): string[] {
  const words = name.split(/\s+/);
  const list = [name, words.slice(1).join(' '), words.slice(0, 2).join(' '), words[1] ?? '', words[0] ?? ''];
  return [...new Set(list.filter((k) => k.length >= 2))];
}

/** 지역('전북 정읍')의 시·군 낱말이 주소에 있으면 맞는 곳으로 봄 */
export function regionMatch(region: string, addr: string): boolean {
  const town = region.split(/\s+/)[1] ?? '';
  return !!town && addr.includes(town.replace(/(시|군)$/, ''));
}

async function main(): Promise<void> {
  const key = envKey();
  const scenes = (JSON.parse(readFileSync('public/data/scenes.json', 'utf8')).scenes as Scene[]).filter((s) => s.kind === 'story' && !s.hidden);
  const parking = loadParking();
  const out: unknown[] = [];
  let spotFound = 0;
  let destFound = 0;
  for (const s of scenes) {
    let spot: (TourHit & { query: string }) | null = null;
    for (const k of keywords(s.name)) {
      const hits = (await searchTour(k, key)).filter((h) => regionMatch(s.region, h.addr));
      await new Promise((r) => setTimeout(r, 150));
      if (hits.length) {
        spot = { ...hits[0]!, query: k };
        break;
      }
    }
    const near = spot
      ? parking
          .map((p) => ({ ...p, km: distanceKm(spot!, p) }))
          .filter((p) => p.km <= 3)
          .sort((a, b) => a.km - b.km)
          .slice(0, 3)
      : [];
    if (spot) spotFound++;
    if (near.length) destFound++;
    out.push({ id: s.id, name: s.name, region: s.region, spot, parking: near });
  }
  mkdirSync('.cache/places', { recursive: true });
  writeFileSync('.cache/places/candidates.json', JSON.stringify(out, null, 2));
  console.log(`장면 ${scenes.length}곳 · 관광정보로 장면 위치 후보 ${spotFound}곳 · 3km 안 공영주차장 후보 ${destFound}곳`);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('candidates.ts')) void main();
