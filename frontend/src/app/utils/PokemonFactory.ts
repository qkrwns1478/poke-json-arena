import { Pokemon, Generations, GenerationNum } from "@smogon/calc";
import customPokemonData from "../../../../shared/custom.json";

type CustomPokemonID = keyof typeof customPokemonData;
type GenerationType = ReturnType<typeof Generations.get>;

export function createPokemon(genId: GenerationType | GenerationNum, name: string, options: any = {}) {
  const gen = typeof genId === 'number' ? Generations.get(genId) : genId;
  const lowerName = name.toLowerCase() as CustomPokemonID;
  const customData = customPokemonData[lowerName];

  if (customData) {
    const customOverrides = {
      types: customData.types,
      baseStats: customData.baseStats,
      weightkg: customData.weightkg,
      ...options.overrides,
    };

    const ability = options.ability || customData.abilities["0"];

    return new Pokemon(gen, "Arceus", {
      ...options,
      name: customData.name,
      ability: ability,
      overrides: customOverrides,
    });
  }

  return new Pokemon(gen, name, options);
}

/* === 사용 예시 ===

import { createPokemon } from './utils/PokemonFactory';

const attacker = createPokemon(9, 'MyCustomPokemon', {
  level: 50,
  nature: 'Adamant',
  evs: { atk: 252, spe: 252 }
});

const defender = createPokemon(9, 'Pikachu', {
  level: 50,
  evs: { hp: 252, def: 252 }
});

*/
