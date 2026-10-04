import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' : 같은 빌드가 /imamttae/ 와 /imamttae/next/ 어디에 올라가도 작동하도록 상대 경로를 씁니다.
// _review/ : 디자인 시안 페이지(검토용). 앱과 같은 부품(카카오 지도 연결 등)을 씁니다.
export default defineConfig({
  base: './',
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
