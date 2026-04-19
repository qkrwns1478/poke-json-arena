export function applyCustomPokedex(Dex) {

  Dex.data.Pokedex["aldina"] = {
    num: 3384,
    name: "Aldina",
    types: ["Ghost"],
    baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: { 0: "Levitate", H: "Levitate" },
    weightkg: 3,
  };

  Dex.data.Pokedex["almaria"] = {
    num: 3385,
    name: "Almaria",
    types: ["Ghost"],
    baseStats: { hp: 100, atk: 125, def: 100, spa: 125, spd: 100, spe: 125 },
    abilities: { 0: "Levitate", H: "Levitate" },
    weightkg: 36.2,
  };

  Dex.data.Pokedex["mimikyumane"] = {
    num: 7778,
    name: "Mimikyu-Mane",
    types: ["Ghost", "Fairy"],
    baseStats: { hp: 55, atk: 55, def: 55, spa: 135, spd: 135, spe: 135 },
    abilities: { 0: "Disguise", H: "Disguise" },
    weightkg: 0.7,
  };

}
