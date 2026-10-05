/**
 * 장면 초안 → 앱 데이터(public/data/scenes.json)
 * - 숨긴 장면은 뺍니다.
 * - 작가 확인 메모는 공개 저장소에 두지 않습니다(비공개 저장소 lucubrate1231/imamttae-notes, 공개 전 점검 6번).
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
    const title = titles.get(s.brunchNo);
    const trip = title ? tripLabel(title) : undefined;
    scenes.push({ ...s, ...(trip ? { trip } : {}) });
  }
  return ContentFile.parse({ version: 1, generatedAt, scenes });
}

