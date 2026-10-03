/**
 * 제목 글꼴 만들기:  npx tsx scripts/build-title-font.ts
 * (장면 데이터를 바꾼 뒤. 빠뜨리면 tests/contract/titleFont.test.ts 가 알려 줌)
 *
 * 제목·작가의 한마디(명조, 고운바탕 700)에 쓰는 글자만 담은 글꼴 파일 하나를 만들어 앱에 둡니다.
 * - 왜: 구글에서 95조각으로 받으면 늦게 온 조각의 글자만 다른 글꼴로 섞여 보였습니다(10/3 사용자 발견 '덮·밭·쭉·릇').
 * - 결정(10/3 사용자): 앱이 직접 갖기, 파일이 오는 동안은 제목을 잠깐 비워 두기(font-display: block).
 * - 글꼴은 무료 공개 글꼴(SIL OFL)이라 앱에 함께 둘 수 있고, 허락서를 같이 둡니다.
 * - 구글 글꼴 서비스에 '이 글자들만' 요청해 파일 하나로 받습니다(text= 기능).
 *
 * 화면에 새 명조 제목을 더하면 아래 UI_TEXT 에도 그 글자를 넣고 다시 돌립니다.
 * 데이터 PR이 아직 안 합쳐졌을 때 그 글자까지 미리 담으려면: --also <다른 scenes.json>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TITLE_FONT = {
  woff2: 'src/styles/fonts/gowun-batang-title.woff2',
  chars: 'src/styles/fonts/gowun-batang-title.chars.txt',
  license: 'src/styles/fonts/OFL-GowunBatang.txt',
} as const;

/** 화면에서 명조로 쓰는 고정 글(장면 데이터 말고). 시안 v2: 큰 제목·작은 제목 막대·작가 부부가 다녀온 곳 제목 */
export const UI_TEXT = ['0123456789', '월에 만나는 자연', '월, 작가 부부가 다녀온 곳'];

type SceneLike = { name?: unknown; excerpt?: unknown };

/** 명조로 그리는 글자 모음: 모든 장면 이름 + 작가 글 대목 + 화면 고정 글. 빈칸은 뺌 */
export function titleChars(content: unknown): Set<string> {
  const scenes: SceneLike[] = Array.isArray(content)
    ? content
    : ((content as { scenes?: SceneLike[] } | null)?.scenes ?? []);
  const out = new Set<string>();
  const add = (s: unknown) => {
    if (typeof s === 'string') for (const c of s) if (c.trim()) out.add(c);
  };
  for (const s of scenes) {
    add(s.name);
    add(s.excerpt);
  }
  UI_TEXT.forEach(add);
  return out;
}

// 구글이 woff2 파일을 주도록 요즘 크롬처럼 요청
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const LICENSE_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/gowunbatang/OFL.txt';

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`받지 못함(${res.status}): ${url.slice(0, 120)}`);
  return res;
}

async function main(): Promise<void> {
  const files = ['public/data/scenes.json'];
  const also = process.argv.indexOf('--also');
  if (also > 0 && process.argv[also + 1]) files.push(process.argv[also + 1]!);
  const chars = new Set<string>();
  for (const f of files) titleChars(JSON.parse(readFileSync(f, 'utf8'))).forEach((c) => chars.add(c));
  const text = [...chars].sort().join('');

  const css = await (await fetchOk(`https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&text=${encodeURIComponent(text)}`)).text();
  const urls = [...css.matchAll(/url\((https:[^)]+)\)\s*format\(['"]woff2['"]\)/g)].map((m) => m[1]!);
  if (urls.length !== 1) throw new Error(`글꼴 파일이 하나가 아님(${urls.length}개). 구글 응답이 바뀌었는지 확인하세요.`);
  const font = Buffer.from(await (await fetchOk(urls[0]!)).arrayBuffer());
  const license = await (await fetchOk(LICENSE_URL)).text();

  mkdirSync(dirname(TITLE_FONT.woff2), { recursive: true });
  writeFileSync(TITLE_FONT.woff2, font);
  writeFileSync(TITLE_FONT.chars, text + '\n');
  writeFileSync(TITLE_FONT.license, license);
  console.log(`제목 글꼴: 글자 ${text.length}자, ${(font.length / 1024).toFixed(1)}KB → ${TITLE_FONT.woff2}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
