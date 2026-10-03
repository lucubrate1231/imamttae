/**
 * 장면 초안 → 앱 데이터(public/data/scenes.json)
 * - 숨긴 장면은 뺍니다.
 * - 작가 확인 메모(notes)는 앱에 싣지 않습니다.
 * - 글 제목에서 '몇 번째 여행'을 꺼내 붙입니다(작가 글 대목 아래 출처로 씀).
 * - 데이터 규칙(zod)을 통과하지 못하면 만들지 않습니다.
 */
import { ContentFile, StoryScene } from '../../shared/schema/content';

export function tripLabel(title: string): string | undefined {
  const m = /^\s*(\S.*?번째 여행)\s*[-–—:]/.exec(title);
  return m ? m[1] : undefined;
}

export function buildAppData(drafts: readonly unknown[], titles: ReadonlyMap<number, string>, generatedAt: string): ContentFile {
  const scenes: StoryScene[] = [];
  for (const raw of drafts) {
    const s = StoryScene.parse(raw);
    if (s.hidden) continue;
    const { notes: _notes, ...rest } = s;
    const title = titles.get(s.brunchNo);
    const trip = title ? tripLabel(title) : undefined;
    scenes.push({ ...rest, ...(trip ? { trip } : {}) });
  }
  return ContentFile.parse({ version: 1, generatedAt, scenes });
}

/** 작가 확인용 페이지(_review/check.html)에 쓸 '여쭤볼 것' 메모. 앱 데이터와 따로 둡니다 */
export function buildReviewNotes(drafts: readonly unknown[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of drafts) {
    const s = StoryScene.parse(raw);
    if (!s.hidden && s.notes) out[s.id] = s.notes;
  }
  return out;
}
