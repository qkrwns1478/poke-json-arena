import POKEMON_ENG from "@/data/PokemonEnglish";
import POKEMON_KOR from "@/data/PokemonKorean";
import MOVES_ENG from "@/data/MovesEnglish";
import MOVES_KOR from "@/data/MovesKorean";

const translator = (str: string, is_pokemon: boolean = true): string => {
  let res: string = str;
  let idx: number;
  if (is_pokemon) {
    idx = POKEMON_ENG.indexOf(str);
    if (idx != -1) res = POKEMON_KOR[idx];
  } else {
    idx = MOVES_ENG.indexOf(str);
    if (idx != -1) res = MOVES_KOR[idx];
  }
  // console.log("[LOG] Translator: " + str + " " + res + " " + idx);
  return res;
};

export default translator;