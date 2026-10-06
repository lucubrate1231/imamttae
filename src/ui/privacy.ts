/**
 * 개인정보 안내(#/privacy, D45 — design-guide 12-2·10-8, 캔버스 PV-1)
 * - 들어가는 곳: 첫 화면 맨 아래 바닥줄 '개인정보 안내' · 저장한 곳 '이 휴대폰에만 저장돼요' 상자 끝 '개인정보 안내 보기 ›'
 * - 틀: ‹ 뒤로 → 제목 → 첫 문단 → 소제목 다섯 → 문의 상자(이메일 글자 · 메일 쓰기) → 적용 날짜
 * - 글은 기획 초안 → 디자인 PR이 오면 TEXT를 채움(그전에는 '준비 중'). 문의 이메일은 src/config.ts
 */
import { h } from './dom';

export interface PrivacyDeps {
  /** 문의 이메일(비어 있으면 준비 중) */
  email: string;
  back(): void;
}

/** 기획 초안이 오면 채울 자리(design-guide 10-8 — 소제목 다섯은 법·개인정보 점검 7번에서 뽑음) */
const TEXT: { lead: string; sections: { title: string; body: string }[]; since: string } = {
  lead: '안내 글을 준비하고 있어요.',
  sections: [
    { title: '받지 않는 것', body: '준비 중이에요.' },
    { title: '이 휴대폰에만 두는 것', body: '준비 중이에요.' },
    { title: '방문 통계', body: '준비 중이에요.' },
    { title: '함께 쓰는 서비스', body: '준비 중이에요.' },
    { title: '저장한 것 지우는 법', body: '준비 중이에요.' },
  ],
  since: '',
};

export function createPrivacy(d: PrivacyDeps): { el: HTMLElement } {
  const back = h('button', { type: 'button', class: 'pv-back', 'aria-label': '뒤로', text: '‹ 뒤로' });
  back.addEventListener('click', () => d.back());
  const mail = d.email
    ? [h('p', { class: 'pv-mail', text: d.email }), h('a', { class: 'btn line', href: `mailto:${d.email}`, text: '메일 쓰기' })]
    : [h('p', { class: 'pv-mail pending', text: '문의 이메일을 준비하고 있어요.' })];
  const el = h(
    'section',
    { class: 'privacy', 'aria-labelledby': 'pv-title' },
    back,
    h('h1', { class: 'pv-title', id: 'pv-title', text: '개인정보 안내' }),
    h('p', { class: 'pv-lead', text: TEXT.lead }),
    ...TEXT.sections.map((s) => h('section', { class: 'pv-sec' }, h('h2', { class: 'pv-h', text: s.title }), h('p', { class: 'pv-body', text: s.body }))),
    h('section', { class: 'pv-contact' }, h('h2', { text: '문의' }), h('p', { class: 'pv-desc', text: '궁금한 점은 이메일로 보내 주세요.' }), ...mail),
    h('p', { class: 'pv-date', text: TEXT.since ? `${TEXT.since}부터 적용해요.` : '적용 날짜는 안내 글과 함께 정해요.' }),
  );
  el.hidden = true;
  return { el };
}
