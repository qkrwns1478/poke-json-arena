const ENGLISH_CONSONANT_ENDINGS = new Set([
  "b", "c", "d", "f", "g", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "x", "z",
]);

function lastChar(word: string): string {
  return word ? word[word.length - 1] : "";
}

function hasBatchim(word: string): boolean {
  const ch = lastChar(word);
  const code = ch.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) {
    return (code - 0xAC00) % 28 !== 0;
  }
  // 영문: 모음으로 끝나면 받침 없음, 자음으로 끝나면 받침 있음으로 처리
  return ENGLISH_CONSONANT_ENDINGS.has(ch.toLowerCase());
}

function getBatchimIndex(word: string): number {
  const ch = lastChar(word);
  const code = ch.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28;
  return 0;
}

/** 단어 + 은/는 */
export function josa은는(word: string): string {
  return word + (hasBatchim(word) ? "은" : "는");
}

/** 단어 + 이/가 */
export function josa이가(word: string): string {
  return word + (hasBatchim(word) ? "이" : "가");
}

/** 단어 + 을/를 */
export function josa을를(word: string): string {
  return word + (hasBatchim(word) ? "을" : "를");
}

/** 단어 + 으로/로 (ㄹ받침이면 '로') */
export function josa으로(word: string): string {
  if (!hasBatchim(word)) return word + "로";
  if (getBatchimIndex(word) === 8) return word + "로"; // ㄹ 받침
  return word + "으로";
}

/** 단어 + 과/와 */
export function josa과와(word: string): string {
  return word + (hasBatchim(word) ? "과" : "와");
}

/** 단어 + 아/야 (호칭) */
export function josa아야(word: string): string {
  return word + (hasBatchim(word) ? "아" : "야");
}

/**
 * 텍스트에서 영문 토큰을 찾아 번역 후 조사까지 교체
 * translators: [mode, josaFn] 쌍의 배열. 각 영문 단어를 순서대로 시도.
 */
export function translateAndApplyJosa(
  text: string,
  translatorFn: (word: string) => string
): string {
  // 영문 단어(+하이픈 허용) 패턴을 찾아 번역
  return text.replace(/[A-Za-z][A-Za-z\-']*/g, (match) => {
    const translated = translatorFn(match);
    return translated !== match ? translated : match;
  });
}
