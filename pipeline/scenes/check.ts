/**
 * 장면 초안 검사: 앱에 넣기 전에 사고를 막습니다.
 * - 데이터 규칙(zod)
 * - 작가 글 대목이 원문 그대로인가(한 문단 안의 연속된 글)
 * - 사진이 그 글에 실제로 있는 사진인가
 * - 가는 곳(주차장·입구)이 장면에서 15km 안인가 (예: 서산 부석사 / 영주 부석사 혼동 방지)
 * - 다녀온 날이 글의 날짜 줄과 맞는가
 */
import { StoryScene } from '../../shared/schema/content';
import { distanceKm } from '../../src/domain/geo';
import { normalizePhotoUrl, type Story } from '../brunch/normalize';

export const MAX_DEST_KM = 15;

export function storyPhotoSet(story: Story): Set<string> {
  const set = new Set<string>();
  for (const it of story.items) {
    if (it.t === 'img') set.add(normalizePhotoUrl(it.src));
    if (it.t === 'gallery') for (const g of it.imgs) set.add(normalizePhotoUrl(g.src));
  }
  return set;
}

export function checkScene(raw: unknown, story: Story): string[] {
  const out: string[] = [];
  const parsed = StoryScene.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) out.push(`데이터 규칙: ${i.path.join('.')} ${i.message}`);
    return out;
  }
  const s = parsed.data;
  if (s.brunchNo !== story.brunchNo) out.push(`글 번호가 다름: ${s.brunchNo} ≠ ${story.brunchNo}`);

  const paras = story.items.filter((x): x is { t: 'p'; text: string } => x.t === 'p').map((x) => x.text);
  if (!paras.some((p) => p.includes(s.excerpt))) out.push('작가 글 대목이 원문과 다름(한 문단 안의 원문 그대로여야 함)');

  const photos = storyPhotoSet(story);
  s.photos.forEach((p, i) => {
    if (!photos.has(normalizePhotoUrl(p.src))) out.push(`사진 ${i + 1}이 이 글에 없는 사진임`);
  });

  const km = distanceKm(s.spot, s.dest);
  if (km > MAX_DEST_KM) out.push(`가는 곳이 장면에서 ${km.toFixed(1)}km — 15km 안이어야 함`);

  if (story.visit) {
    const v = story.visit;
    const start = `${v.year}-${String(v.month).padStart(2, '0')}`;
    if (!s.visited.startsWith(start) && !(v.endMonth && s.visited.startsWith(`${v.year}-${String(v.endMonth).padStart(2, '0')}`))) {
      out.push(`다녀온 날 ${s.visited} 이 글의 날짜 줄(${story.dateLine})과 다름`);
    }
  }
  return out;
}
