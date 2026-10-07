/**
 * 장면별 카톡 미리보기(D63, 10/7 프프 — 백로그 ★3·D15를 당김)
 * 카톡은 주소의 # 뒤를 보지 않아 어떤 장면을 보내도 앱 공통 카드만 떴어요. 그래서 빌드 때 장면마다 작은 공유 페이지
 * `s/<장면 번호>/index.html`을 만들고(vite.config.ts), 그 페이지에 그 장면의 카드 정보(og)를 넣어요.
 * 사람이 열면 바로 앱의 그 장면(`../../#/scene/<번호>`)으로 넘어가요(주소 뒤 ?from=share 그대로 — 통계).
 * - 작가 이름은 넣지 않음(D58·D59), '제철'은 쓰지 않음(D12)
 * - 숨긴 장면·준비 중 글은 만들지 않음. 없어진 장면 주소는 public/404.html이 앱 첫 화면으로 보냄
 * - 검색 막기(noindex)는 앱과 같이 정식 출시 전까지
 * - 응모작이 수상하면(2027년 2월 초): 장면 데이터(사진·대목·contestEntry)를 바꾸면 다음 배포에 공유 페이지도 같이 바뀜 → 카카오 공유 디버거에서 그 장면 주소를 캐시 초기화
 */
import type { ContentFile, StoryScene } from '../../shared/schema/content';

/** 앱 공통 카드 그림(D58 — 고래불 일출 #96). 장면 사진을 카톡이 못 불러올 때의 다음 후보 */
export const COMMON_IMAGE = 'https://lucubrate1231.github.io/imamttae/brand/og-image.jpg';

type CardScene = Pick<StoryScene, 'id' | 'name' | 'region' | 'best' | 'photos'>;

export interface ShareCard {
  title: string;
  description: string;
  /** 첫 사진을 1200×630으로 가운데 맞춰 자른 카카오 썸네일(브런치 사진은 카카오 서버에 있음). 썸네일 서비스는 가운데 자르기만 해서 focus는 쓰지 못함 */
  image: string;
  fallbackImage: string;
}

export function shareCard(s: CardScene): ShareCard {
  const when = s.best?.note ? ` · 추천 시기 ${s.best.note}` : '';
  return {
    title: `${s.name} — 이맘때 풍경`,
    description: `${s.region}${when} · 작가가 아내와 직접 다녀온 곳`,
    image: `https://img1.daumcdn.net/thumb/C1200x630.q75/?fname=${encodeURIComponent(s.photos[0]!.src)}`,
    fallbackImage: COMMON_IMAGE,
  };
}

/** 공유 페이지(s/<번호>/)에서 앱의 그 장면으로 가는 주소. search는 '?from=share' 같은 주소 뒤 꼬리 */
export function redirectTarget(id: string, search: string): string {
  return `../../${search}#/scene/${id}`;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sharePageHtml(s: CardScene): string {
  const c = shareCard(s);
  const app = `../../#/scene/${s.id}`;
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${esc(c.title)}</title>
    <meta name="description" content="${esc(c.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(c.title)}" />
    <meta property="og:description" content="${esc(c.description)}" />
    <meta property="og:image" content="${esc(c.image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(s.name)}" />
    <meta property="og:image" content="${esc(c.fallbackImage)}" />
    <meta http-equiv="refresh" content="0; url=${app}" />
    <script>location.replace(${JSON.stringify('../../')} + location.search + ${JSON.stringify(`#/scene/${s.id}`)});</script>
    <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf9f4;color:#1f2a24;font:18px/1.7 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;padding:24px;text-align:center}a{color:#2f5d46;font-weight:700}</style>
  </head>
  <body>
    <p><a href="${app}">${esc(s.name)} 보러 가기</a></p>
  </body>
</html>
`;
}

/** 보이는 이야기 장면마다 공유 페이지 하나(숨긴 장면·준비 중 글 빼고) */
export function sharePages(content: Pick<ContentFile, 'scenes'>): { fileName: string; html: string }[] {
  return content.scenes
    .filter((s): s is StoryScene => s.kind === 'story' && !s.hidden)
    .map((s) => ({ fileName: `s/${s.id}/index.html`, html: sharePageHtml(s) }));
}
