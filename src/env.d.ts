/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_KAKAO_JS_KEY?: string;
  readonly VITE_MAP_MODE?: 'kakao' | 'fake';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
