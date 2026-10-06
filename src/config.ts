/**
 * 바꿀 수 있는 주소 한 곳(출시 준비, D46·D45 — design-guide 12장)
 * 사용자가 정해 주면 여기만 고칩니다. 비밀이 아니라 공개되는 값이에요.
 */

/** 의견 보내기 구글 폼(첫 화면·저장한 곳 카드, 10/6 사용자). 비어 있으면 버튼을 누를 때 '의견 보내기는 곧 열려요' */
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

/** 개인정보 안내의 문의 이메일(사용자가 정함). 비어 있으면 '준비 중' */
export const CONTACT_EMAIL = '';
