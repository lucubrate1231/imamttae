/**
 * 가고 싶어요(F2-AC2c) — 화면이 쓰는 모양.
 * 휴대폰에 남는 저장은 Codex 일 2(docs/tasks/codex-2-가고싶어요-저장.md)의 createWantedStore가 만듭니다.
 * 그전까지는 화면을 닫으면 사라지는 임시 저장을 씁니다(10/3 사용자 결정).
 */
export interface WantedLike {
  isWanted(sceneId: string): boolean;
  /** 바뀐 뒤 상태(true = 담음) */
  toggleWanted(sceneId: string): boolean;
}

export function createMemoryWanted(): WantedLike {
  const ids = new Set<string>();
  return {
    isWanted: (id) => ids.has(id),
    toggleWanted(id) {
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return ids.has(id);
    },
  };
}
