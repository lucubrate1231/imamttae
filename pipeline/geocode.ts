/**
 * 카카오 장소 검색(좌표 찾기). 키는 환경 변수 KAKAO_REST_KEY 로만 받습니다(코드·파일에 적지 않음).
 *   KAKAO_REST_KEY=… npx tsx pipeline/geocode.ts "정읍 내장산 우화정" "내장산 주차장"
 * 검색어에는 꼭 지역 이름을 붙입니다('부석사'만 쓰면 서산 부석사가 먼저 나옴).
 */
export interface Place { name: string; category: string; address: string; lat: number; lng: number }

export async function searchPlaces(query: string, key = process.env.KAKAO_REST_KEY ?? '', size = 5): Promise<Place[]> {
  if (!key) throw new Error('KAKAO_REST_KEY 가 없습니다');
  const u = `https://dapi.kakao.com/v2/local/search/keyword.json?${new URLSearchParams({ query, size: String(size) })}`;
  const r = await fetch(u, { headers: { Authorization: `KakaoAK ${key}` } });
  if (!r.ok) throw new Error(`카카오 검색 응답 ${r.status}`);
  const d = (await r.json()) as { documents: Record<string, string>[] };
  return d.documents.map((x) => ({
    name: x.place_name ?? '',
    category: (x.category_name ?? '').split(' > ').slice(-2).join(' > '),
    address: x.road_address_name || x.address_name || '',
    lat: Number(x.y),
    lng: Number(x.x),
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const q of process.argv.slice(2)) {
    const list = await searchPlaces(q);
    console.log(`## ${q}`);
    for (const p of list) console.log(`  ${p.name} | ${p.category} | ${p.address} | ${p.lat.toFixed(7)}, ${p.lng.toFixed(7)}`);
    if (!list.length) console.log('  (결과 없음)');
  }
}
