import { Generations, calculate, Move, Pokemon as SmogonPokemon } from "@smogon/calc";
import { toID } from "@smogon/calc";
import postposition from "cox-postposition";
import { createPokemon } from "./PokemonFactory";
import { trKorToEng, trEngToKor } from "./Translator";
import { PokemonStatus, OppPokemon, MoveData } from "../types/battle";

const GEN = Generations.get(9);

// 조사 헬퍼 — postposition.pick(word, 기본형) 으로 조사만 반환하므로 직접 연결
const p은는 = (w: string) => `${w}${postposition.pick(w, "는")}`;
const p이가 = (w: string) => `${w}${postposition.pick(w, "가")}`;
const p을를 = (w: string) => `${w}${postposition.pick(w, "를")}`;
const p으로 = (w: string) => `${w}${postposition.pick(w, "로")}`;

// 텍스트 내 영문 포켓몬·기술·특성 이름을 한국어로 변환
function translateNamesInText(text: string): string {
  return text.replace(/[A-Za-z][A-Za-z\-']+/g, (match) => {
    const byPokemon  = trEngToKor(match, "POKEMON");
    if (byPokemon  !== match) return byPokemon;
    const byMove     = trEngToKor(match, "MOVES");
    if (byMove     !== match) return byMove;
    const byAbility  = trEngToKor(match, "ABILITY");
    if (byAbility  !== match) return byAbility;
    return match;
  });
}

// details 문자열 ("Garchomp, L50, M") 에서 레벨 파싱
function parseLevelFromDetails(details: string): number {
  const m = details.match(/\bL(\d+)\b/);
  return m ? parseInt(m[1]) : 50;
}

const TYPE_KOR: Record<string, string> = {
  Normal: "노말",   Fire:     "불꽃",  Water:    "물",    Electric: "전기",
  Grass:  "풀",     Ice:      "얼음",  Fighting: "격투",  Poison:   "독",
  Ground: "땅",     Flying:   "비행",  Psychic:  "에스퍼", Bug:     "벌레",
  Rock:   "바위",   Ghost:    "고스트", Dragon:  "드래곤", Dark:    "악",
  Steel:  "강철",   Fairy:    "페어리",
};

const TYPE_REP_MOVES: Record<string, string> = {
  Normal:   "Body Slam",    Fire:     "Flamethrower", Water:    "Surf",
  Electric: "Thunderbolt",  Grass:    "Energy Ball",  Ice:      "Ice Beam",
  Fighting: "Close Combat", Poison:   "Sludge Bomb",  Ground:   "Earthquake",
  Flying:   "Brave Bird",   Psychic:  "Psychic",      Bug:      "Bug Buzz",
  Rock:     "Stone Edge",   Ghost:    "Shadow Ball",  Dragon:   "Dragon Pulse",
  Dark:     "Dark Pulse",   Steel:    "Iron Head",    Fairy:    "Moonblast",
};

// 상태 기술의 전술적 유틸리티 점수 (공격 피해% 와 비교하기 위한 상대 점수)
const STATUS_MOVE_UTILITY: Record<string, number> = {
  "Shell Smash": 60, "Dragon Dance": 55, "Quiver Dance": 55,
  "Swords Dance": 50, "Nasty Plot": 50,
  "Stealth Rock": 45, "Sleep Powder": 45, "Spore": 45,
  "Calm Mind": 42, "Thunder Wave": 40, "Agility": 40,
  "Toxic Spikes": 38, "Will-O-Wisp": 38, "Toxic": 38, "Encore": 38,
  "Bulk Up": 36, "Spikes": 36, "Taunt": 35, "Trick": 35,
  "Recover": 35, "Roost": 35, "Soft-Boiled": 35, "Moonlight": 33,
  "Light Screen": 33, "Reflect": 33, "Aurora Veil": 38,
  "Leech Seed": 33, "Heal Bell": 33, "Aromatherapy": 33,
  "Rapid Spin": 30, "Defog": 30, "Haze": 30,
  "Substitute": 30, "Rest": 28,
};
const STATUS_UTILITY_DEFAULT = 28;

// 상태 기술의 한국어 이유 생성
function statusMoveReason(moveEng: string, moveNameKor: string, oppKor: string): string {
  if (["Swords Dance", "Nasty Plot", "Dragon Dance", "Quiver Dance", "Shell Smash", "Calm Mind", "Bulk Up", "Agility"].includes(moveEng)) {
    return `${p으로(moveNameKor)} 스탯을 올려 이후 공격력을 극대화하세요.`;
  }
  if (["Stealth Rock", "Spikes", "Toxic Spikes"].includes(moveEng)) {
    return `${p을를(moveNameKor)} 깔아 상대 교체 시 지속 피해를 줄 수 있습니다.`;
  }
  if (["Thunder Wave", "Glare", "Stun Spore"].includes(moveEng)) {
    return `${p으로(moveNameKor)} 상대 ${oppKor}에게 마비를 걸어 행동을 방해하세요.`;
  }
  if (moveEng === "Will-O-Wisp") {
    return `${p으로(moveNameKor)} 상대 ${oppKor}에게 화상을 입혀 물리 공격력을 절반으로 낮추세요.`;
  }
  if (["Toxic", "Poison Powder"].includes(moveEng)) {
    return `${p으로(moveNameKor)} 상대 ${oppKor}에게 맹독을 걸어 지속 피해를 주세요.`;
  }
  if (["Sleep Powder", "Spore", "Hypnosis", "Lovely Kiss", "Sing"].includes(moveEng)) {
    return `${p으로(moveNameKor)} 상대 ${oppKor}을(를) 잠재워 행동 불능 상태로 만드세요.`;
  }
  if (["Recover", "Roost", "Soft-Boiled", "Moonlight", "Rest", "Slack Off"].includes(moveEng)) {
    return `${p으로(moveNameKor)} 체력을 회복하는 것이 좋습니다.`;
  }
  if (["Taunt"].includes(moveEng)) {
    return `${p으로(moveNameKor)} 상대 ${oppKor}의 변화 기술 사용을 막으세요.`;
  }
  if (["Leech Seed"].includes(moveEng)) {
    return `${p을를(moveNameKor)} 심어 매 턴 체력을 흡수하세요.`;
  }
  return `${p은는(moveNameKor)} 현재 상황에서 유효한 전술적 선택입니다.`;
}

export interface BattleRecommendation {
  action_type: "move" | "switch";
  parameter: string;
  reason: string;
}

interface MoveEval {
  moveName: string;
  moveEng: string;
  minPct: number;
  maxPct: number;
  avgPct: number;
  isZero: boolean;   // 피해 기술인데 데미지 0 (타입 면역 등)
  isStatus: boolean; // 변화 기술 (피해 계산 대상 아님)
}

interface SwitchEval {
  pokemonName: string;
  pokemonKor: string;
  incomingPct: number;
  outgoingPct: number;
  netScore: number;
  isImmune: boolean;
  immuneTypes: string[];
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
    const poke = createPokemon(GEN, name, options);
    poke.maxHP(); // stats 초기화 검증
    return poke;
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
    const result = calculate(GEN, attacker, defender, new Move(GEN, moveEng));
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
  myLevel: number,
  myAbility: string | undefined,
  myItem: string | undefined,
  oppName: string,
  oppLevel: number,
  moves: MoveData[]
): MoveEval[] {
  const abilityEng = myAbility ? (trKorToEng(myAbility, "ABILITY") || myAbility) : undefined;
  const itemEng    = myItem    ? (trKorToEng(myItem,    "ITEMS")    || myItem)    : undefined;

  const attacker = safeCreatePokemon(myActiveName, { level: myLevel, ability: abilityEng, item: itemEng });
  const defender = safeCreatePokemon(oppName,      { level: oppLevel });
  if (!attacker || !defender) return [];

  return moves.filter(m => !m.disabled).map(m => {
    const moveEng = trKorToEng(m.move, "MOVES") || m.move;
    try {
      // 상태 기술 여부 먼저 확인
      const moveData = GEN.moves.get(toID(moveEng));
      if (moveData?.category === "Status") {
        const utility = STATUS_MOVE_UTILITY[moveEng] ?? STATUS_UTILITY_DEFAULT;
        return { moveName: m.move, moveEng, minPct: utility, maxPct: utility, avgPct: utility, isZero: false, isStatus: true };
      }

      const result = calculate(GEN, attacker, defender, new Move(GEN, moveEng));
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
      return {
        moveName: m.move,
        moveEng,
        minPct: defHp > 0 ? (Math.min(...arr) / defHp) * 100 : 0,
        maxPct: defHp > 0 ? (Math.max(...arr) / defHp) * 100 : 0,
        avgPct: defHp > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length / defHp) * 100 : 0,
        isZero: Math.max(...arr) === 0,
        isStatus: false,
      };
    } catch {
      return { moveName: m.move, moveEng, minPct: 0, maxPct: 0, avgPct: 0, isZero: true, isStatus: false };
    }
  });
}

function evaluateSwitches(bench: PokemonStatus[], oppName: string, oppLevel: number): SwitchEval[] {
  const oppTypes  = getSpeciesTypes(oppName);
  const oppSmogon = safeCreatePokemon(oppName, { level: oppLevel });

  return bench.filter(p => parseCurrentHp(p.condition) > 0).map(p => {
    const pokeName   = p.details.split(",")[0].trim();
    const pokeLevel  = parseLevelFromDetails(p.details);
    const pokeKor    = trEngToKor(pokeName, "POKEMON") || pokeName;
    const abilityEng = p.baseAbility ? (trKorToEng(p.baseAbility, "ABILITY") || p.baseAbility) : undefined;
    const itemEng    = p.item        ? (trKorToEng(p.item,         "ITEMS")   || p.item)        : undefined;

    const benchSmogon = safeCreatePokemon(pokeName, { level: pokeLevel, ability: abilityEng, item: itemEng });
    const benchTypes  = getSpeciesTypes(pokeName);

    let maxIncoming = 0;
    const immuneTypes: string[] = [];
    let allZero = oppTypes.length > 0;

    if (oppSmogon && benchSmogon) {
      for (const oppType of oppTypes) {
        const rep = TYPE_REP_MOVES[oppType];
        if (!rep) continue;
        const dmg = calcDmgPct(oppSmogon, benchSmogon, rep);
        if (dmg.max > 0) {
          allZero = false;
          if (dmg.avg > maxIncoming) maxIncoming = dmg.avg;
        } else {
          immuneTypes.push(oppType);
        }
      }

      let maxOutgoing = 0;
      for (const benchType of benchTypes) {
        const rep = TYPE_REP_MOVES[benchType];
        if (!rep) continue;
        const dmg = calcDmgPct(benchSmogon, oppSmogon, rep);
        if (dmg.avg > maxOutgoing) maxOutgoing = dmg.avg;
      }

      return {
        pokemonName: pokeName,
        pokemonKor:  pokeKor,
        incomingPct: maxIncoming,
        outgoingPct: maxOutgoing,
        netScore:    maxOutgoing - maxIncoming,
        isImmune:    allZero,
        immuneTypes,
      };
    }

    return { pokemonName: pokeName, pokemonKor: pokeKor, incomingPct: 0, outgoingPct: 0, netScore: 0, isImmune: false, immuneTypes: [] };
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
    return { action_type: "move", parameter: activeMoves[0]?.id ?? "", reason: "활성 포켓몬 정보를 확인할 수 없습니다." };
  }

  const myActiveName  = myActive.details.split(",")[0].trim();
  const myActiveLevel = parseLevelFromDetails(myActive.details);
  const myActiveKor   = trEngToKor(myActiveName, "POKEMON") || myActiveName;
  const oppName       = oppActive.name;
  const oppLevel      = parseLevelFromDetails(oppActive.details);
  const oppKor        = trEngToKor(oppName, "POKEMON") || oppName;
  const oppTypes      = getSpeciesTypes(oppName);
  const myBench       = myTeam.filter(p => !p.active);

  const myHpPct = (() => {
    const cur = parseCurrentHp(myActive.condition);
    const max = parseMaxHp(myActive.condition);
    return max > 0 ? (cur / max) * 100 : 100;
  })();

  // 1. 기술 평가
  const moveEvals    = evaluateMoves(myActiveName, myActiveLevel, myActive.baseAbility, myActive.item, oppName, oppLevel, activeMoves);
  // isZero: 피해 기술인데 데미지 0 (타입 면역 등) — 상태 기술(isStatus)은 isZero가 false이므로 validMoves에 포함됨
  const validMoves   = moveEvals.filter(m => !m.isZero).sort((a, b) => b.avgPct - a.avgPct);
  const zeroMoves    = moveEvals.filter(m => m.isZero && !m.isStatus); // 진짜 무효 기술만
  const bestMove     = validMoves[0];

  // 2. 교체 후보 평가
  const switchEvals = evaluateSwitches(myBench, oppName, oppLevel).sort((a, b) => b.netScore - a.netScore);
  const bestSwitch  = switchEvals[0];

  // 3. 내 포켓몬이 받는 예상 피해
  const abilityEng     = myActive.baseAbility ? (trKorToEng(myActive.baseAbility, "ABILITY") || myActive.baseAbility) : undefined;
  const itemEng        = myActive.item        ? (trKorToEng(myActive.item,         "ITEMS")   || myActive.item)        : undefined;
  const myActiveSmogon = safeCreatePokemon(myActiveName, { level: myActiveLevel, ability: abilityEng, item: itemEng });
  const oppSmogon      = safeCreatePokemon(oppName, { level: oppLevel });

  let maxIncomingToActive = 0;
  if (myActiveSmogon && oppSmogon) {
    for (const oppType of oppTypes) {
      const rep = TYPE_REP_MOVES[oppType];
      if (!rep) continue;
      const dmg = calcDmgPct(oppSmogon, myActiveSmogon, rep);
      if (dmg.avg > maxIncomingToActive) maxIncomingToActive = dmg.avg;
    }
  }

  const isInDanger = maxIncomingToActive >= myHpPct * 0.9;

  // 4. 교체 권장 판단
  let shouldSwitch = false;
  let switchReason = "";

  if (bestSwitch) {
    const oppTypesKor  = oppTypes.map(t => TYPE_KOR[t] || t).join("/");
    // 상태 기술은 "공격 압박" 기준이 아니므로 교체 판단 시 순수 공격 기술 점수로 비교
    const bestDamagingScore = (validMoves.find(m => !m.isStatus) ?? bestMove)?.avgPct ?? 0;
    const bestMoveScore = bestDamagingScore;

    // Case A: 현재 포켓몬이 위기 + 교체 후보가 상대 STAB 면역
    if (isInDanger && bestSwitch.isImmune) {
      shouldSwitch = true;
      const immuneKor = bestSwitch.immuneTypes.map(t => TYPE_KOR[t] || t).join("/");
      switchReason =
        `상대 ${p은는(oppKor)} ${oppTypesKor} 타입 공격이 현재 ${myActiveKor}에게 치명적입니다` +
        ` (예상 피해 ${maxIncomingToActive.toFixed(0)}%, 현재 체력 ${myHpPct.toFixed(0)}%). ` +
        `${p은는(bestSwitch.pokemonKor)} ${immuneKor} 타입 공격에 면역이므로 안전하게 교체할 수 있습니다.`;
    }

    // Case B: 최선 기술이 25% 미만이고 교체 후보의 타입 상성이 훨씬 유리
    if (!shouldSwitch && bestMoveScore < 25 && bestSwitch.netScore > 20 && bestSwitch.incomingPct < 50) {
      shouldSwitch = true;
      switchReason =
        `현재 ${myActiveKor}의 가장 강력한 기술이 상대 ${oppKor}에게 평균 ${bestMoveScore.toFixed(0)}%의 피해밖에 주지 못합니다. ` +
        `${p이가(bestSwitch.pokemonKor)} 타입 상성상 훨씬 유리합니다` +
        ` (기대 공격력 ${bestSwitch.outgoingPct.toFixed(0)}%, 받는 피해 ${bestSwitch.incomingPct.toFixed(0)}%).`;
    }

    // Case C: 교체 후보가 상대 STAB 면역 + 강력한 역공 가능
    if (!shouldSwitch && bestSwitch.isImmune && bestSwitch.outgoingPct > 40) {
      shouldSwitch = true;
      const immuneKor = bestSwitch.immuneTypes.map(t => TYPE_KOR[t] || t).join("/");
      switchReason =
        `${p은는(bestSwitch.pokemonKor)} 상대 ${oppKor}의 ${immuneKor} 타입 공격을 완전히 무효화하면서` +
        ` 강력한 역공(최대 ${bestSwitch.outgoingPct.toFixed(0)}%)이 가능합니다.`;
    }
  }

  if (shouldSwitch && bestSwitch) {
    return { action_type: "switch", parameter: bestSwitch.pokemonName, reason: switchReason };
  }

  // 5. 유효 기술이 없는 경우 — 상태 기술도 모두 없거나 모두 isZero
  if (!bestMove) {
    if (bestSwitch && bestSwitch.netScore > 0) {
      return {
        action_type: "switch",
        parameter: bestSwitch.pokemonName,
        reason:
          `현재 ${myActiveKor}의 공격 기술이 상대 ${p을를(oppKor)} 모두 무효화합니다. ` +
          `${p으로(bestSwitch.pokemonKor)} 교체하는 것이 좋습니다` +
          ` (기대 공격력 ${bestSwitch.outgoingPct.toFixed(0)}%).`,
      };
    }
    // 교체도 불리한 상황: 덜 나쁜 기술이라도 명확히 안내
    const leastBad = moveEvals[0];
    const leastBadKor = leastBad ? translateNamesInText(leastBad.moveName) : "";
    return {
      action_type: "move",
      parameter: leastBad?.moveEng || activeMoves[0]?.id || "",
      reason:
        `현재 ${myActiveKor}의 모든 기술이 상대 ${oppKor}에게 유효하지 않습니다.` +
        (leastBadKor ? ` 불가피하게 ${p을를(leastBadKor)} 사용하거나 교체를 고려하세요.` : ""),
    };
  }

  // 6. 최선의 기술 추천
  const moveNameKor = translateNamesInText(bestMove.moveName);
  let reason = "";

  if (bestMove.isStatus) {
    // 상태 기술이 베스트인 경우
    reason = statusMoveReason(bestMove.moveEng, moveNameKor, oppKor);
    // 근소한 차이로 공격 기술도 있다면 병기
    const bestDamaging = validMoves.find(m => !m.isStatus);
    if (bestDamaging && bestDamaging.avgPct >= bestMove.avgPct * 0.8) {
      const dmgNameKor = translateNamesInText(bestDamaging.moveName);
      reason += ` 또는 ${p이가(dmgNameKor)} ${bestDamaging.minPct.toFixed(0)}~${bestDamaging.maxPct.toFixed(0)}%의 피해도 노릴 수 있습니다.`;
    }
  } else if (bestMove.maxPct >= 100) {
    reason =
      `${p으로(moveNameKor)} 상대 ${p을를(oppKor)} 한 방에 쓰러뜨릴 수 있습니다!` +
      ` (${bestMove.minPct.toFixed(0)}~${bestMove.maxPct.toFixed(0)}%)`;
  } else if (bestMove.maxPct >= 50) {
    reason =
      `${p이가(moveNameKor)} 상대 ${oppKor}에게` +
      ` ${bestMove.minPct.toFixed(0)}~${bestMove.maxPct.toFixed(0)}%의 큰 피해를 입힐 수 있습니다.`;
  } else {
    reason =
      `현재 사용 가능한 기술 중 ${p이가(moveNameKor)} 가장 효과적입니다` +
      ` (${bestMove.minPct.toFixed(0)}~${bestMove.maxPct.toFixed(0)}%).`;
  }

  if (!bestMove.isStatus && validMoves.length > 1) {
    const second = validMoves.find((m, i) => i > 0 && !m.isStatus) ?? validMoves[1];
    const diff = bestMove.avgPct - second.avgPct;
    if (diff > 10) {
      reason += ` 2순위 기술(${translateNamesInText(second.moveName)})보다 기대 피해가 ${diff.toFixed(0)}%p 높습니다.`;
    }
  }

  // 타입 면역으로 무효인 공격 기술만 경고 (상태 기술 제외)
  if (zeroMoves.length > 0) {
    const zeroNamesKor = zeroMoves.map(m => translateNamesInText(m.moveName));
    reason += ` (${zeroNamesKor.map(n => p은는(n)).join(", ")} 타입 불일치·특성으로 무효)`;
  }

  return { action_type: "move", parameter: bestMove.moveEng, reason };
}
