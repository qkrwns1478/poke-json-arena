import * as DICT from "@/data/dict";

const getEngList = (mode: string): string[] => {
  switch (mode) {
    case "POKEMON":
      return DICT.POKEMON_ENG;
    case "MOVES":
      return DICT.MOVES_ENG;
    case "ABILITY":
      return DICT.ABILITY_ENG;
    case "ITEMS":
      return DICT.ITEMS_ENG;
    case "NATURE":
      return DICT.NATURE_ENG;
    default:
      return [];
  }
};

const getKorList = (mode: string): string[] => {
  switch (mode) {
    case "POKEMON":
      return DICT.POKEMON_KOR;
    case "MOVES":
      return DICT.MOVES_KOR;
    case "ABILITY":
      return DICT.ABILITY_KOR;
    case "ITEMS":
      return DICT.ITEMS_KOR;
    case "NATURE":
      return DICT.NATURE_KOR;
    default:
      return [];
  }
};

export const trEngToKor = (str: string, mode: string = "POKEMON"): string => {
  const eng = getEngList(mode);
  const kor = getKorList(mode);
  const idx = eng.indexOf(str);
  const res = idx !== -1 ? kor[idx] : str;
  return res;
};

export const trKorToEng = (str: string, mode: string = "POKEMON"): string => {
  const eng = getEngList(mode);
  const kor = getKorList(mode);
  const idx = kor.indexOf(str);
  const res = idx !== -1 ? eng[idx] : str;
  return res;
};

export function trEngToKeb(str: string) {
  const idx = DICT.ITEMS_ENG.indexOf(str);
  return idx !== -1 ? DICT.ITEMS_KEBAB[idx] : str;
}
