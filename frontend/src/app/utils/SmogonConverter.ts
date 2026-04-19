import type { GenerationNum } from "@smogon/calc";
import { Pokemon } from "@/app/utils/JsonParser";
import { trKorToEng } from "@/app/utils/Translator";
import { createPokemon } from "@/app/utils/PokemonFactory";

export const convertToSmogonFormat = (gen: GenerationNum, pokemon: Pokemon) => {

  const gender = pokemon.gender === "수컷" ? "M" : pokemon.gender === "암컷" ? "F" : "N";

  const ivs = {
    hp: pokemon.IVs.HP,
    atk: pokemon.IVs.ATK,
    def: pokemon.IVs.DEF,
    spa: pokemon.IVs.SpA,
    spd: pokemon.IVs.SpD,
    spe: pokemon.IVs.SPE,
  };

  const evs = {
    hp: pokemon.EVs.HP,
    atk: pokemon.EVs.ATK,
    def: pokemon.EVs.DEF,
    spa: pokemon.EVs.SpA,
    spd: pokemon.EVs.SpD,
    spe: pokemon.EVs.SPE,
  };

  const item_eng = pokemon.item ? trKorToEng(pokemon.item, "ITEMS") : undefined;
  const ability_eng = pokemon.ability ? trKorToEng(pokemon.ability, "ABILITY") : undefined;
  const nature_eng = pokemon.nature ? trKorToEng(pokemon.nature, "NATURE") : "Serious";

  return createPokemon(gen, pokemon.species_eng, {
    level: pokemon.level,
    gender: gender,
    ability: ability_eng,
    item: item_eng,
    nature: nature_eng,
    ivs: ivs,
    evs: evs,
  });
};

/* === 사용 예시 === 

import { Generations, calculate, Move } from "@smogon/calc";
import { convertToSmogonFormat } from "@/app/utils/SmogonConverter";

const gen9 = Generations.get(9);

const attacker = convertToSmogonFormat(gen9, myTeam[0]);
const defender = convertToSmogonFormat(gen9, oppTeam[0]);

const moveNameEng = trKorToEng("지진", "MOVES"); 
const attackMove = new Move(gen9, moveNameEng);

const result = calculate(gen9, attacker, defender, attackMove);

console.log(result.desc());

*/
