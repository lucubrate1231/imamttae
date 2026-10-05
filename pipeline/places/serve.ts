/**
 * 좌표 확인 페이지(이 컴퓨터에서만): npx tsx pipeline/places/serve.ts → http://localhost:8090
 * 장면마다 관광정보·공영주차장 후보를 오픈스트리트맵 지도에 띄우고, 사람이 고르거나 지도를 눌러 정한 값을
 * .cache/places/picked.json 에 저장합니다(저장소에 올라가지 않음). 앱 데이터에 넣는 것은 apply.ts.
 * 카카오 로컬 API 결과 저장 금지 때문에 기존(카카오) 좌표는 이 페이지에 보여 주지 않아요(docs/kakao-local-data.md).
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const PORT = 8090;
const PICKED = '.cache/places/picked.json';

type Draft = { id: string; kind: string; name: string; region: string; brunchUrl?: string; hidden?: boolean; types?: string[]; photos?: { src: string }[] };

function scenes() {
  const drafts = (JSON.parse(readFileSync('content/scenes/drafts.json', 'utf8')) as { scenes: Draft[] }).scenes;
  const notesPath = '../imamttae-notes/scene-notes.json';
  const notes: Record<string, string> = existsSync(notesPath) ? JSON.parse(readFileSync(notesPath, 'utf8')).notes : {};
  // 좌표(spot·dest)는 일부러 넘기지 않음
  return drafts
    .filter((s) => s.kind === 'story' && !s.hidden)
    .map((s) => ({ id: s.id, name: s.name, region: s.region, brunchUrl: s.brunchUrl, types: s.types, photo: s.photos?.[0]?.src ?? null, note: notes[s.id] ?? '' }));
}

const json = (res: import('node:http').ServerResponse, body: unknown, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(readFileSync('tools/places/index.html'));
  }
  if (url.pathname === '/api/scenes') return json(res, scenes());
  if (url.pathname === '/api/candidates') return json(res, existsSync('.cache/places/candidates.json') ? JSON.parse(readFileSync('.cache/places/candidates.json', 'utf8')) : []);
  if (url.pathname === '/api/picked' && req.method === 'GET') return json(res, existsSync(PICKED) ? JSON.parse(readFileSync(PICKED, 'utf8')) : {});
  if (url.pathname === '/api/picked' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { id, value } = JSON.parse(body) as { id: string; value: unknown };
        const all = existsSync(PICKED) ? JSON.parse(readFileSync(PICKED, 'utf8')) : {};
        if (value === null) delete all[id];
        else all[id] = { ...(value as object), savedAt: new Date().toISOString() };
        mkdirSync('.cache/places', { recursive: true });
        writeFileSync(PICKED, JSON.stringify(all, null, 2));
        json(res, { ok: true, count: Object.keys(all).length });
      } catch (e) {
        json(res, { ok: false, error: String(e) }, 400);
      }
    });
    return;
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => console.log(`좌표 확인 페이지: http://localhost:${PORT}  (끝내려면 Ctrl+C)`));
