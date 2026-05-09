import { Pokemon, Generations, GenerationNum } from "@smogon/calc";

interface CustomPokemonEntry {
  types?: unknown;
  baseStats?: unknown;
  weightkg?: number;
  abilities?: Record<string, string>;
  name?: string;
}

let customPokemonData: Record<string, CustomPokemonEntry> = {};

export function initCustomPokemonData(fetchedData: Record<string, CustomPokemonEntry>) {
  customPokemonData = fetchedData;
}

type GenerationType = ReturnType<typeof Generations.get>;
type PokemonOptions = NonNullable<ConstructorParameters<typeof Pokemon>[2]>;

export function createPokemon(genId: GenerationType | GenerationNum, name: string, options: PokemonOptions = {}) {
  const gen = typeof genId === 'number' ? Generations.get(genId) : genId;
  const lowerName = name.toLowerCase();

  const customData = customPokemonData[lowerName];

  if (customData) {
    const customOverrides = {
      types: customData.types,
      baseStats: customData.baseStats,
      weightkg: customData.weightkg,
      ...(options as { overrides?: Record<string, unknown> }).overrides,
    } as PokemonOptions['overrides'];

    const ability = (options as { ability?: string }).ability || customData.abilities?.["0"];

    return new Pokemon(gen, "Arceus", {
      ...options,
      name: customData.name as PokemonOptions['name'],
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
