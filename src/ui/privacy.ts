/**
 * 이용 안내와 개인정보(#/privacy, D45 — design-guide 12-2·12-3·10-8, 캔버스 ⑨줄 PV-1. 10/7 '개인정보 안내'에서 넓힘)
 * - 들어가는 곳: 첫 화면 맨 아래 바닥줄 '이용 안내 · 개인정보'(맨 위부터) · 저장한 곳 상자 끝 '개인정보 안내 보기 ›'(#/privacy/personal — '개인정보' 구역부터)
 * - 틀: ‹ 뒤로 → 제목 → 구역 1 '이 앱의 정보는'(점 여섯) → 띠 → 구역 2 '개인정보'(첫 문단 + 소제목 여섯) → 문의 상자 → 운영·적용 날짜
 * - 글은 10-8 표(10/7 기획 초안) 그대로. 문의 이메일은 src/config.ts, 적용 날짜는 v0.1.0 배포 날 SINCE에 채움
 */
import { h } from './dom';

export interface PrivacyDeps {
  /** 문의 이메일(비어 있으면 준비 중) */
  email: string;
  back(): void;
}

/** 적용 날짜 — v0.1.0을 베타 주소에 올리는 날 채움(예: '2026년 10월 ○일'). 비어 있으면 '운영: 이맘때 풍경'만 */
const SINCE = '';

/** 구역 1 '이 앱의 정보는' — 안전·책임 한계(12-3 ②) */
const INFO = [
  '장소·추천 시기·주차 안내는 이상호 작가가 다녀온 때의 기록이에요. 그 뒤로 길이 막히거나 주차장이 바뀌었을 수 있어요.',
  '떠나기 전에 국립공원·지자체의 현장 안내와 날씨를 확인하세요.',
  '출입 통제 구역이나 정해진 길이 아닌 곳에는 들어가지 마세요.',
  '산길·물가·눈길은 날씨와 몸 상태에 맞게, 무리하지 마세요.',
  "길찾기는 고른 지도 앱이 안내해요. 실제와 다르면 장소 화면 맨 아래 '이곳 정보가 달라졌나요?'로 알려 주세요.",
  '이 앱은 갈 곳을 고르는 데 도움을 드리는 안내예요. 현장 상황과 안전은 직접 확인해 주세요.',
];

const LEAD = '이맘때 풍경은 로그인 없이 쓰는 무료 앱이에요. 이름·연락처 같은 개인정보를 받지 않고, 쓰시는 기록은 이 휴대폰에만 둬요.';

/** 구역 2 '개인정보'의 소제목 여섯 — 줄 배열은 점 목록, 글자는 문단 */
const PERSONAL: { title: string; body: (string | string[])[] }[] = [
  { title: '받지 않는 것', body: [['이름, 전화번호, 이메일, 로그인 정보', '내 위치 — 앱이 위치를 묻지 않아요']] },
  {
    title: '이 휴대폰에만 두는 것',
    body: [
      ['저장한 곳, 다녀온 곳과 그 날짜', '처음 연 달, 고른 길찾기 앱, 안내를 닫은 기록, 어떤 초대 주소로 들어왔는지', '인터넷이 끊겨도 열리게 하는 앱 화면 사본 — 개인 기록은 아니에요'],
      '저희 쪽으로 보내지 않아요. 그래서 휴대폰을 바꾸거나 다른 앱(카톡·크롬)으로 열면 기록이 따로예요.',
    ],
  },
  {
    title: '방문 통계',
    body: ['더 나은 앱을 만들려고 어느 화면을 열고 어떤 버튼을 눌렀는지 세어요(Umami). 쿠키를 쓰지 않고, 누구인지 알 수 있는 번호를 만들지 않아요. 휴대폰 종류와 대략의 지역 정도만 함께 남아요.'],
  },
  {
    title: '함께 쓰는 서비스',
    body: [
      [
        '지도는 카카오맵, 사진은 브런치(카카오), 글꼴은 구글, 앱을 올려 둔 곳은 GitHub예요.',
        '[길찾기]를 누르면 고른 앱(티맵·카카오맵·네이버지도)에 가는 곳만 넘겨요. 앱이 없으면 구글 플레이·앱 스토어의 설치 화면으로 연결해요.',
        "'찾아보기'는 구글 검색, '의견 보내기'는 구글 폼으로 열려요.",
      ],
      '이 서비스들은 연결할 때 접속 정보(인터넷 주소 등)를 각자의 정책에 따라 처리해요.',
    ],
  },
  {
    title: '의견과 문의',
    body: [
      [
        '의견 보내기(구글 폼)에는 적어 주신 내용만 남아요. 이름과 연락처는 적지 않으셔도 돼요.',
        '이메일로 문의하시면 답장을 위해 보내신 주소와 내용을 받아요. 답을 드린 뒤 1년 안에 지워요.',
      ],
    ],
  },
  {
    title: '저장한 것 지우는 법',
    body: [
      [
        '저장한 곳은 장소 화면에서 [저장됨]을 다시 누르면 빠져요.',
        "다녀온 곳은 장소 화면의 [날짜 변경]에서 '다녀온 기록 지우기'를 누르세요.",
        '모두 지우려면 쓰시는 인터넷 앱(크롬·삼성 인터넷·사파리) 설정에서 인터넷 사용 기록과 사이트 데이터를 지우세요. 아이폰 홈 화면에 둔 앱은 아이콘을 지우면 기록도 지워져요.',
        '지운 기록은 되돌릴 수 없어요.',
      ],
    ],
  },
];

const block = (b: string | string[]) =>
  typeof b === 'string' ? h('p', { class: 'pv-body', text: b }) : h('ul', { class: 'pv-list' }, ...b.map((t) => h('li', { text: t })));

export function createPrivacy(d: PrivacyDeps): { el: HTMLElement; show(section: 'personal'): void } {
  const back = h('button', { type: 'button', class: 'pv-back', 'aria-label': '뒤로', text: '‹ 뒤로' });
  back.addEventListener('click', () => d.back());
  const mail = d.email
    ? [h('p', { class: 'pv-mail', text: d.email }), h('a', { class: 'btn line', href: `mailto:${d.email}`, text: '메일 쓰기' })]
    : [h('p', { class: 'pv-mail pending', text: '문의 이메일을 준비하고 있어요.' })];
  const personal = h(
    'section',
    { class: 'pv-zone-sec', id: 'pv-personal', 'aria-labelledby': 'pv-personal-h' },
    h('h2', { class: 'pv-zone', id: 'pv-personal-h', text: '개인정보' }),
    h('p', { class: 'pv-lead', text: LEAD }),
    ...PERSONAL.map((s) => h('section', { class: 'pv-sec' }, h('h3', { class: 'pv-h', text: s.title }), ...s.body.map(block))),
    h('section', { class: 'pv-contact' }, h('h3', { text: '문의' }), h('p', { class: 'pv-desc', text: '궁금한 점은 이메일로 보내 주세요.' }), ...mail),
  );
  const el = h(
    'section',
    { class: 'privacy', 'aria-labelledby': 'pv-title' },
    back,
    h('h1', { class: 'pv-title', id: 'pv-title', text: '이용 안내와 개인정보' }),
    h(
      'section',
      { class: 'pv-zone-sec', id: 'pv-info', 'aria-labelledby': 'pv-info-h' },
      h('h2', { class: 'pv-zone', id: 'pv-info-h', text: '이 앱의 정보는' }),
      block(INFO),
    ),
    h('div', { class: 'pv-band', 'aria-hidden': 'true' }),
    personal,
    h('p', { class: 'pv-date', text: SINCE ? `운영: 이맘때 풍경 · ${SINCE}부터 적용해요.` : '운영: 이맘때 풍경' }),
  );
  el.hidden = true;
  return { el, show: () => personal.scrollIntoView({ block: 'start' }) };
}
