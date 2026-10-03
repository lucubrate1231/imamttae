import { defineConfig } from 'vite';

// base './' : 같은 빌드가 /imamttae/ 와 /imamttae/next/ 어디에 올라가도 작동하도록 상대 경로를 씁니다.
export default defineConfig({
  base: './',
  build: { target: 'es2020', outDir: 'dist', assetsInlineLimit: 0 },
});
