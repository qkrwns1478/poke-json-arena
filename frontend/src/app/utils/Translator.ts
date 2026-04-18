import POKEMON_ENG from "@/data/PokemonEnglish";
import POKEMON_KOR from "@/data/PokemonKorean";
import MOVES_ENG from "@/data/MovesEnglish";
import MOVES_KOR from "@/data/MovesKorean";
import ABILITY_ENG from "@/data/AbilityEnglish";
import ABILITY_KOR from "@/data/AbilityKorean";
import ITEMS_ENG from "@/data/ItemsEnglish";
import ITEMS_KOR from "@/data/ItemsKorean";
import ITEMS_KEBAB from "@/data/ItemsKebab";

export const trEngToKor = (str: string, mode: string = "POKEMON"): string => {
  const eng: string[] = mode === "POKEMON" ? POKEMON_ENG : mode === "MOVES" ? MOVES_ENG : mode === "ABILITY" ? ABILITY_ENG : ITEMS_ENG;
  const kor: string[] = mode === "POKEMON" ? POKEMON_KOR : mode === "MOVES" ? MOVES_KOR : mode === "ABILITY" ? ABILITY_KOR : ITEMS_KOR;

  const idx: number = eng.indexOf(str);
  const res = idx !== -1 ? kor[idx] : str;
  return res;
};

export function trEngToKeb(str: string) {
  const idx = ITEMS_ENG.indexOf(str);
  return idx !== -1 ? ITEMS_KEBAB[idx] : str;
}
