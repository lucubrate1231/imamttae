import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** 저작권(D65, 10/8 프프): 오픈소스 라이선스 파일을 두면 작가 글 대목까지 누구나 가져다 써도 되는 것처럼 보여서 두지 않음 */
describe('저작권', () => {
  it('저장소에 LICENSE 파일이 없음', () => {
    for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING']) expect(existsSync(f), f).toBe(false);
  });
  it("README의 '글과 사진의 저작권은 이상호 작가에게 있습니다' 줄은 그대로", () => {
    expect(readFileSync('README.md', 'utf8')).toContain('글과 사진의 저작권은 이상호 작가에게 있습니다.');
  });
});
