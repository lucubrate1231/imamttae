import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { placesPageData } from './pipeline/places/pageData';
import { coversPageData } from './pipeline/covers/pageData';
import { sharePages } from './src/domain/sharePage';

/**
 * 좌표 확인 페이지를 미리보기에 올림: /next/_review/places/ (10/5 — 콘텐츠 세션에서 이어서 하려고).
 * 알파(루트)에는 _review가 올라가지 않음(scripts/publish-pages.sh). 카카오 좌표·내부 메모는 넣지 않음(pipeline/places/pageData.ts)
 */
const placesPage = {
  name: 'places-page',
  generateBundle(this: { emitFile(f: { type: 'asset'; fileName: string; source: string }): void }) {
    const read = (p: string) => JSON.parse(readFileSync(resolve(__dirname, p), 'utf8'));
    const data = placesPageData(read('content/scenes/drafts.json').scenes, read('tools/places/candidates.json'), read('tools/places/picked-seed.json'));
    this.emitFile({ type: 'asset', fileName: '_review/places/index.html', source: readFileSync(resolve(__dirname, 'tools/places/index.html'), 'utf8') });
    this.emitFile({ type: 'asset', fileName: '_review/places/data.json', source: JSON.stringify(data) });
    // 풍경 대표 사진 고르기(D44, 10/6): /next/_review/covers/
    const app = read('public/data/scenes.json');
    this.emitFile({ type: 'asset', fileName: '_review/covers/index.html', source: readFileSync(resolve(__dirname, 'tools/covers/index.html'), 'utf8') });
    this.emitFile({ type: 'asset', fileName: '_review/covers/data.json', source: JSON.stringify(coversPageData(app.scenes, app.typeCovers ?? {})) });
    // 장면별 카톡 미리보기(D63): 보이는 장면마다 s/<번호>/index.html — 그 장면의 카드 정보, 열면 앱의 그 장면으로
    for (const p of sharePages(app)) this.emitFile({ type: 'asset', fileName: p.fileName, source: p.html });
  },
};

// base './' : 같은 빌드가 베타(imamttae.site/)와 미리보기(imamttae.site/next/) 어디에 올라가도 작동하도록 상대 경로를 씁니다(D64 — 옛 /imamttae/도).
// _review/ : 디자인 시안 페이지(검토용). 앱과 같은 부품(카카오 지도 연결 등)을 씁니다.
export default defineConfig({
  base: './',
  plugins: [placesPage],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        review: resolve(__dirname, '_review/index.html'),
        v2: resolve(__dirname, '_review/v2.html'),
        check: resolve(__dirname, '_review/check.html'),
        a2hsLab: resolve(__dirname, '_review/a2hs-lab.html'), // 홈 화면에 추가 실기기 확인(D33)
      },
    },
  },
});
