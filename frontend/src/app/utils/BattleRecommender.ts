import { Generations, calculate, Move, Pokemon as SmogonPokemon } from "@smogon/calc";
import { toID } from "@smogon/calc";
import { createPokemon } from "./PokemonFactory";
import { trKorToEng, trEngToKor } from "./Translator";
import { josa은는, josa이가, josa을를, josa으로 } from "./Josa";
import { PokemonStatus, OppPokemon, MoveData } from "../types/battle";

// 영문 이름을 포함할 수 있는 텍스트에서 포켓몬/기술 이름을 한국어로 변환
function translateNamesInText(text: string): string {
  return text.replace(/[A-Za-z][A-Za-z\-']+/g, (match) => {
    const byPokemon = trEngToKor(match, "POKEMON");
    if (byPokemon !== match) return byPokemon;
    const byMove = trEngToKor(match, "MOVES");
    if (byMove !== match) return byMove;
    const byAbility = trEngToKor(match, "ABILITY");
    if (byAbility !== match) return byAbility;
    return match;
  });
}

const GEN = Generations.get(9);

const TYPE_KOR: Record<string, string> = {
  Normal: "노말", Fire: "불꽃", Water: "물", Electric: "전기",
  Grass: "풀", Ice: "얼음", Fighting: "격투", Poison: "독",
  Ground: "땅", Flying: "비행", Psychic: "에스퍼", Bug: "벌레",
  Rock: "바위", Ghost: "고스트", Dragon: "드래곤", Dark: "악",
  Steel: "강철", Fairy: "페어리",
};

// 각 타입을 대표하는 고위력 기술 (타입 상성 시뮬레이션용)
const TYPE_REP_MOVES: Record<string, { name: string; category: "Physical" | "Special" }> = {
  Normal:   { name: "Body Slam",    category: "Physical" },
  Fire:     { name: "Flamethrower", category: "Special"  },
  Water:    { name: "Surf",         category: "Special"  },
  Electric: { name: "Thunderbolt",  category: "Special"  },
  Grass:    { name: "Energy Ball",  category: "Special"  },
  Ice:      { name: "Ice Beam",     category: "Special"  },
  Fighting: { name: "Close Combat", category: "Physical" },
  Poison:   { name: "Sludge Bomb",  category: "Special"  },
  Ground:   { name: "Earthquake",   category: "Physical" },
  Flying:   { name: "Brave Bird",   category: "Physical" },
  Psychic:  { name: "Psychic",      category: "Special"  },
  Bug:      { name: "Bug Buzz",     category: "Special"  },
  Rock:     { name: "Stone Edge",   category: "Physical" },
  Ghost:    { name: "Shadow Ball",  category: "Special"  },
  Dragon:   { name: "Dragon Pulse", category: "Special"  },
  Dark:     { name: "Dark Pulse",   category: "Special"  },
  Steel:    { name: "Iron Head",    category: "Physical" },
  Fairy:    { name: "Moonblast",    category: "Special"  },
};

export interface BattleRecommendation {
  action_type: "move" | "switch";
  parameter: string;  // 영문 기술명 또는 포켓몬명
  reason: string;     // 한국어 이유
}

interface MoveEval {
  moveName: string;  // 원본 이름 (한국어일 수 있음)
  moveEng: string;   // 영문 이름
  minPct: number;
  maxPct: number;
  avgPct: number;
  isZero: boolean;
  smogonDesc: string;
}

interface SwitchEval {
  pokemonName: string;  // 영문
  pokemonKor: string;   // 한국어
  incomingPct: number;  // 상대 STAB 대표기 → 이 포켓몬의 최대 피해%
  outgoingPct: number;  // 이 포켓몬 STAB 대표기 → 상대의 최대 피해%
  netScore: number;     // outgoing - incoming (높을수록 유리)
  isImmune: boolean;    // 상대 STAB 전부 무효
  immuneTypes: string[]; // 무효화하는 타입들
}

function parseCurrentHp(condition: string): number {
  if (condition === "fnt" || condition === "0 fnt") return 0;
  const m = condition.match(/^(\d+)\/\d+/);
  return m ? parseInt(m[1]) : 100;
}

function parseMaxHp(condition: string): number {
  const m = condition.match(/\d+\/(\d+)/);
  return m ? parseInt(m[1]) : 100;
}

function getSpeciesTypes(name: string): string[] {
  try {
    const species = GEN.species.get(toID(name));
    if (species) return [...species.types];
  } catch {}
  return [];
}

function safeCreatePokemon(name: string, options: Record<string, unknown> = {}): SmogonPokemon | null {
  try {
    const p = createPokemon(GEN, name, options);
    // stats가 정상적으로 초기화되었는지 확인
    p.maxHP();
    return p;
  } catch {
    return null;
  }
}

function calcDmgPct(
  attacker: SmogonPokemon,
  defender: SmogonPokemon,
  moveEng: string
): { min: number; max: number; avg: number } {
  try {
    const move = new Move(GEN, moveEng);
    const result = calculate(GEN, attacker, defender, move);
    const raw = result.damage;

    let arr: number[];
    if (typeof raw === "number") {
      arr = [raw];
    } else if (Array.isArray(raw)) {
      arr = Array.isArray(raw[0]) ? (raw as number[][]).flat() : (raw as number[]);
    } else {
      arr = [0];
    }

    const defHp = defender.maxHP();
    if (defHp === 0) return { min: 0, max: 0, avg: 0 };

    return {
      min: (Math.min(...arr) / defHp) * 100,
      max: (Math.max(...arr) / defHp) * 100,
      avg: (arr.reduce((a, b) => a + b, 0) / arr.length / defHp) * 100,
    };
  } catch {
    return { min: 0, max: 0, avg: 0 };
  }
}

function evaluateMoves(
  myActiveName: string,
  myAbility: string | undefined,
  myItem: string | undefined,
  oppName: string,
  moves: MoveData[]
): MoveEval[] {
  // 특성·지닌물건 이름이 한국어일 경우 영문으로 변환
  const abilityEng = myAbility ? (trKorToEng(myAbility, "ABILITY") || myAbility) : undefined;
  const itemEng    = myItem    ? (trKorToEng(myItem, "ITEMS")    || myItem)    : undefined;

  const attacker = safeCreatePokemon(myActiveName, { level: 50, ability: abilityEng, item: itemEng });
  const defender = safeCreatePokemon(oppName, { level: 50 });

  if (!attacker || !defender) return [];

  return moves
    .filter(m => !m.disabled)
    .map(m => {
      const moveEng = trKorToEng(m.move, "MOVES") || m.move;
      try {
        const smogonMove = new Move(GEN, moveEng);
        const result = calculate(GEN, attacker, defender, smogonMove);
        const raw = result.damage;

        let arr: number[];
        if (typeof raw === "number") {
          arr = [raw];
        } else if (Array.isArray(raw)) {
          arr = Array.isArray(raw[0]) ? (raw as number[][]).flat() : (raw as number[]);
        } else {
          arr = [0];
        }

        const defHp = defender.maxHP();
        const minPct = defHp > 0 ? (Math.min(...arr) / defHp) * 100 : 0;
        const maxPct = defHp > 0 ? (Math.max(...arr) / defHp) * 100 : 0;
        const avgPct = defHp > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length / defHp) * 100 : 0;

        return {
          moveName: m.move,
          moveEng,
          minPct,
          maxPct,
          avgPct,
          isZero: Math.max(...arr) === 0,
          smogonDesc: result.desc(),
        };
      } catch {
        return { moveName: m.move, moveEng, minPct: 0, maxPct: 0, avgPct: 0, isZero: true, smogonDesc: "" };
      }
    });
}

function evaluateSwitches(bench: PokemonStatus[], oppName: string): SwitchEval[] {
  const oppTypes  = getSpeciesTypes(oppName);
  const oppSmogon = safeCreatePokemon(oppName, { level: 50 });

  return bench
    .filter(p => parseCurrentHp(p.condition) > 0)
    .map(p => {
      const pokeName   = p.details.split(",")[0].trim();
      const pokeKor    = trEngToKor(pokeName, "POKEMON") || pokeName;
      const abilityEng = p.baseAbility ? (trKorToEng(p.baseAbility, "ABILITY") || p.baseAbility) : undefined;
      const itemEng    = p.item        ? (trKorToEng(p.item, "ITEMS")          || p.item)         : undefined;

      const benchSmogon = safeCreatePokemon(pokeName, { level: 50, ability: abilityEng, item: itemEng });
      const benchTypes  = getSpeciesTypes(pokeName);

      // 상대 STAB 대표기 → 교체 후보에게 가는 피해
      let maxIncoming = 0;
      const immuneTypes: string[] = [];
      let allZero = oppTypes.length > 0;

      if (oppSmogon && benchSmogon) {
        for (const oppType of oppTypes) {
          const rep = TYPE_REP_MOVES[oppType];
          if (!rep) continue;
          const dmg = calcDmgPct(oppSmogon, benchSmogon, rep.name);
          if (dmg.max > 0) {
            allZero = false;
            if (dmg.avg > maxIncoming) maxIncoming = dmg.avg;
          } else {
            immuneTypes.push(oppType);
          }
        }
      }

      // 교체 후보 STAB 대표기 → 상대에게 가는 피해
      let maxOutgoing = 0;
      if (benchSmogon && oppSmogon) {
        for (const benchType of benchTypes) {
          const rep = TYPE_REP_MOVES[benchType];
          if (!rep) continue;
          const dmg = calcDmgPct(benchSmogon, oppSmogon, rep.name);
          if (dmg.avg > maxOutgoing) maxOutgoing = dmg.avg;
        }
      }

      return {
        pokemonName: pokeName,
        pokemonKor: pokeKor,
        incomingPct: maxIncoming,
        outgoingPct: maxOutgoing,
        netScore: maxOutgoing - maxIncoming,
        isImmune: allZero,
        immuneTypes,
      };
    });
}

// ─── 메인 추천 함수 ────────────────────────────────────────────────────────────

export function recommendBattleAction(
  myTeam: PokemonStatus[],
  oppActive: OppPokemon,
  activeMoves: MoveData[]
): BattleRecommendation {
  const myActive = myTeam.find(p => p.active);

  if (!myActive) {
    return {
      action_type: "move",
      parameter: activeMoves[0]?.id ?? "",
      reason: "활성 포켓몬 정보를 확인할 수 없습니다.",
    };
  }

  const myActiveName = myActive.details.split(",")[0].trim();
  const myActiveKor  = trEngToKor(myActiveName, "POKEMON") || myActiveName;
  const oppName      = oppActive.name;
  const oppKor       = trEngToKor(oppName, "POKEMON") || oppName;
  const oppTypes     = getSpeciesTypes(oppName);
  const myBench      = myTeam.filter(p => !p.active);

  const myHpPct = (() => {
    const cur = parseCurrentHp(myActive.condition);
    const max = parseMaxHp(myActive.condition);
    return max > 0 ? (cur / max) * 100 : 100;
  })();

  // ── 1. 기술 평가 ────────────────────────────────────────────────────────────
  const moveEvals  = evaluateMoves(myActiveName, myActive.baseAbility, myActive.item, oppName, activeMoves);
  const validMoves = moveEvals.filter(m => !m.isZero).sort((a, b) => b.avgPct - a.avgPct);
  const zeroMoves  = moveEvals.filter(m => m.isZero);
  const bestMove   = validMoves[0];

  // ── 2. 교체 후보 평가 ────────────────────────────────────────────────────────
  const switchEvals = evaluateSwitches(myBench, oppName).sort((a, b) => b.netScore - a.netScore);
  const bestSwitch  = switchEvals[0];

  // ── 3. 내 현재 포켓몬이 받는 예상 피해 ──────────────────────────────────────
  const abilityEng = myActive.baseAbility ? (trKorToEng(myActive.baseAbility, "ABILITY") || myActive.baseAbility) : undefined;
  const itemEng    = myActive.item        ? (trKorToEng(myActive.item,    "ITEMS")    || myActive.item)        : undefined;
  const myActiveSmogon = safeCreatePokemon(myActiveName, { level: 50, ability: abilityEng, item: itemEng });
  const oppSmogon      = safeCreatePokemon(oppName, { level: 50 });

  let maxIncomingToActive = 0;

  if (myActiveSmogon && oppSmogon) {
    for (const oppType of oppTypes) {
      const rep = TYPE_REP_MOVES[oppType];
      if (!rep) continue;
      const dmg = calcDmgPct(oppSmogon, myActiveSmogon, rep.name);
      if (dmg.avg > maxIncomingToActive) maxIncomingToActive = dmg.avg;
    }
  }

  const isInDanger = maxIncomingToActive >= myHpPct * 0.9;

  // ── 4. 교체 권장 판단 ────────────────────────────────────────────────────────
  let shouldSwitch = false;
  let switchReason = "";

  if (bestSwitch) {
    const oppTypesKor = oppTypes.map(t => TYPE_KOR[t] || t).join("/");
    const bestMoveScore = bestMove?.avgPct ?? 0;

    // Case A: 현재 포켓몬이 위기 + 교체 후보가 상대 STAB 면역
    if (isInDanger && bestSwitch.isImmune) {
      shouldSwitch = true;
      const immuneKor = bestSwitch.immuneTypes.map(t => TYPE_KOR[t] || t).join("/");
      switchReason =
        `상대 ${josa은는(oppKor)} ${oppTypesKor} 타입 공격이 현재 ${myActiveKor}에게 치명적입니다` +
        ` (예상 피해 ${maxIncomingToActive.toFixed(0)}%, 현재 체력 ${myHpPct.toFixed(0)}%). ` +
        `${josa은는(bestSwitch.pokemonKor)} ${immuneKor} 타입 공격에 면역이므로 안전하게 교체할 수 있습니다.`;
    }

    // Case B: 현재 최선의 기술이 25% 미만이고 교체 후보의 타입 상성이 훨씬 유리
    if (!shouldSwitch && bestMoveScore < 25 && bestSwitch.netScore > 20 && bestSwitch.incomingPct < 50) {
      shouldSwitch = true;
      switchReason =
        `현재 ${myActiveKor}의 가장 강력한 기술이 상대 ${oppKor}에게 평균 ${bestMoveScore.toFixed(0)}%의 피해밖에 주지 못합니다. ` +
        `${josa이가(bestSwitch.pokemonKor)} 타입 상성상 훨씬 유리합니다` +
        ` (기대 공격력 ${bestSwitch.outgoingPct.toFixed(0)}%, 받는 피해 ${bestSwitch.incomingPct.toFixed(0)}%).`;
    }

    // Case C: 교체 후보가 상대 STAB 면역 + 강력한 역공 가능
    if (!shouldSwitch && bestSwitch.isImmune && bestSwitch.outgoingPct > 40) {
      shouldSwitch = true;
      const immuneKor = bestSwitch.immuneTypes.map(t => TYPE_KOR[t] || t).join("/");
      switchReason =
        `${josa은는(bestSwitch.pokemonKor)} 상대 ${oppKor}의 ${immuneKor} 타입 공격을 완전히 무효화하면서` +
        ` 강력한 역공(최대 ${bestSwitch.outgoingPct.toFixed(0)}%)이 가능합니다.`;
    }
  }

  if (shouldSwitch && bestSwitch) {
    return { action_type: "switch", parameter: bestSwitch.pokemonName, reason: switchReason };
  }

  // ── 5. 유효 기술이 없는 경우 교체 재검토 ────────────────────────────────────
  if (!bestMove) {
    if (bestSwitch && bestSwitch.netScore > 0) {
      return {
        action_type: "switch",
        parameter: bestSwitch.pokemonName,
        reason:
          `현재 ${myActiveKor}의 모든 기술이 상대 ${josa을를(oppKor)} 효과가 없습니다. ` +
          `${josa으로(bestSwitch.pokemonKor)} 교체하는 것이 좋습니다` +
          ` (기대 공격력 ${bestSwitch.outgoingPct.toFixed(0)}%).`,
      };
    }

    const fallback = moveEvals[0];
    return {
      action_type: "move",
      parameter: fallback?.moveEng || activeMoves[0]?.id || "",
      reason: `상대 ${josa을를(oppKor)} 현재 기술들이 모두 무효화됩니다. 상황에 따라 유연하게 대응하세요.`,
    };
  }

  // ── 6. 최선의 기술 추천 ──────────────────────────────────────────────────────
  const moveNameKor = translateNamesInText(bestMove.moveName);
  let reason = "";

  if (bestMove.maxPct >= 100) {
    reason =
      `${josa으로(moveNameKor)} 상대 ${josa을를(oppKor)} 한 방에 쓰러뜨릴 수 있습니다!` +
      ` (${bestMove.minPct.toFixed(0)}~${bestMove.maxPct.toFixed(0)}%)`;
  } else if (bestMove.maxPct >= 50) {
    reason =
      `${josa이가(moveNameKor)} 상대 ${oppKor}에게` +
      ` ${bestMove.minPct.toFixed(0)}~${bestMove.maxPct.toFixed(0)}%의 큰 피해를 입힐 수 있습니다.`;
  } else {
    reason =
      `현재 사용 가능한 기술 중 ${josa이가(moveNameKor)} 가장 효과적입니다` +
      ` (${bestMove.minPct.toFixed(0)}~${bestMove.maxPct.toFixed(0)}%).`;
  }

  // 2순위와 격차가 클 때 비교 언급
  if (validMoves.length > 1) {
    const second = validMoves[1];
    const diff = bestMove.avgPct - second.avgPct;
    if (diff > 10) {
      const secondNameKor = translateNamesInText(second.moveName);
      reason += ` 2순위 기술(${secondNameKor})보다 기대 피해가 ${diff.toFixed(0)}%p 높습니다.`;
    }
  }

  // 무효 기술 경고
  if (zeroMoves.length > 0) {
    const zeroNamesKor = zeroMoves.map(m => translateNamesInText(m.moveName));
    reason += ` (${zeroNamesKor.map(n => josa은는(n)).join(", ")} 타입 불일치·특성으로 무효)`;
  }

  return { action_type: "move", parameter: bestMove.moveEng, reason };
}
