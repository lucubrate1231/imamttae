/**
 * 바꿀 수 있는 주소 한 곳(출시 준비, D46·D45 — design-guide 12장)
 * 사용자가 정해 주면 여기만 고칩니다. 비밀이 아니라 공개되는 값이에요.
 */

/** 의견 보내기 구글 폼(첫 화면·저장한 곳 카드, 10/6 사용자). 비어 있으면 세 자리 모두 감춤(기획 10/6) */
export const FEEDBACK_FORM_URL = 'https://forms.gle/4viSoD1yHn9D8ixS7';

/**
 * 장면 상세 '이곳 정보가 달라졌나요?' — 같은 폼의 '미리 채운 링크' 바탕 주소와 '장소 이름' 칸 번호(10/6 사용자).
 * 앱이 ?usp=pp_url&<칸 번호>=<장면 이름(주소용 글자)>을 붙여 엶. 둘 중 하나라도 비면 카드와 같은 폼만
 */
export const FEEDBACK_PREFILL_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdjAaqo5JiEP8dDK-ofc0fQ93cNBI55SPXwAw-GRPK3zBiFOA/viewform';
export const FEEDBACK_PLACE_FIELD = 'entry.1390967997';

/**
 * 참고(앱에는 넣지 않음): 초대 2주 뒤 설문 https://forms.gle/xLAHEaFbiRqxS8kX7
 * — 버튼 없이 카톡·밴드로만 보냄(10/6 사용자)
 */

/**
 * 개인정보 안내의 문의 이메일 — 앱 전용 구글 계정(D48, 10/6). 앱 화면에 공개되는 앱 연락처라 공개 저장소에 둬도 됨
 * ('개인 이름·연락처 금지' 규칙과 별개). 구글 폼도 이 계정으로 만듦. 비어 있으면 '준비 중'
 */
export const CONTACT_EMAIL = 'imamttae.sight@gmail.com';

/**
 * 앱 주소(D64, 10/8 프프 — Spaceship에서 산 도메인). 베타 https://imamttae.site/ · 미리보기 https://imamttae.site/next/
 * 옛 주소 lucubrate1231.github.io/imamttae/…는 GitHub이 새 주소로 넘겨 줌. 넘기기 전·도중에도 앱이 멈추지 않게 둘 다 '앱 주소'로 봄
 */
export const SITE_HOST = 'imamttae.site';
export const SITE_ORIGIN = `https://${SITE_HOST}`;
export const OLD_HOST = 'lucubrate1231.github.io';
export const APP_HOSTS: readonly string[] = [SITE_HOST, OLD_HOST];
