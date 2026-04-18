import POKEMON_ENG from "@/data/PokemonEnglish";
import POKEMON_KOR from "@/data/PokemonKorean";
import MOVES_ENG from "@/data/MovesEnglish";
import MOVES_KOR from "@/data/MovesKorean";
import ABILITY_ENG from "@/data/AbilityEnglish";
import ABILITY_KOR from "@/data/AbilityKorean";
import ITEMS_ENG from "@/data/ItemsEnglish";
import ITEMS_KOR from "@/data/ItemsKorean";
import ITEMS_KEBAB from "@/data/ItemsKebab";
import NATURE_ENG from "@/data/NatureEnglish";
import NATURE_KOR from "@/data/NatureKorean";

const getEngList = (mode: string): string[] => {
  switch (mode) {
    case "POKEMON":
      return POKEMON_ENG;
    case "MOVES":
      return MOVES_ENG;
    case "ABILITY":
      return ABILITY_ENG;
    case "ITEMS":
      return ITEMS_ENG;
    case "NATURE":
      return NATURE_ENG;
    default:
      return [];
  }
};

const getKorList = (mode: string): string[] => {
  switch (mode) {
    case "POKEMON":
      return POKEMON_KOR;
    case "MOVES":
      return MOVES_KOR;
    case "ABILITY":
      return ABILITY_KOR;
    case "ITEMS":
      return ITEMS_KOR;
    case "NATURE":
      return NATURE_KOR;
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
  const idx = ITEMS_ENG.indexOf(str);
  return idx !== -1 ? ITEMS_KEBAB[idx] : str;
}
