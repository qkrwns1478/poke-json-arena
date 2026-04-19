import { Generations, calculate, Move, Pokemon as SmogonPokemon } from "@smogon/calc";
import { toID } from "@smogon/calc";
import postposition from "cox-postposition";
import { createPokemon } from "./PokemonFactory";
import { trKorToEng, trEngToKor } from "./Translator";
import { PokemonStatus, OppPokemon, MoveData } from "../types/battle";

const GEN = Generations.get(9);

// --- 조사 및 번역 헬퍼 ---
const p은는 = (w: string) => `${w}${postposition.pick(w, "는")}`;
const p이가 = (w: string) => `${w}${postposition.pick(w, "가")}`;
const p을를 = (w: string) => `${w}${postposition.pick(w, "를")}`;
const p으로 = (w: string) => `${w}${postposition.pick(w, "로")}`;

// 이름의 앞뒤 공백을 제거하고 안전하게 번역(실패 시 원본 반환)
function getPokeKor(name: string): string {
  const clean = name.trim();
  return trEngToKor(clean, "POKEMON") || clean;
}

function getMoveKor(move: string): string {
  const clean = move.trim();
  return trEngToKor(clean, "MOVES") || clean;
}

function parseCurrentHpPct(condition: string): number {
  if (condition === "fnt" || condition === "0 fnt") return 0;
  const m = condition.match(/^(\d+)\/(\d+)/);
  if (m) {
    return (parseInt(m[1]) / parseInt(m[2])) * 100;
  }
  return 100;
}

function parseLevel(details: string): number {
  const m = details.match(/\bL(\d+)\b/);
  return m ? parseInt(m[1]) : 50;
}

// 스모곤 포켓몬 객체 생성
function buildSmogonPokemon(name: string, level: number, abilityKor?: string, itemKor?: string): SmogonPokemon | null {
  try {
    const abilityEng = abilityKor ? trKorToEng(abilityKor, "ABILITY") || abilityKor : undefined;
    const itemEng = itemKor ? trKorToEng(itemKor, "ITEMS") || itemKor : undefined;
    const nameEng = trKorToEng(name.trim(), "POKEMON") || name.trim();
    return createPokemon(GEN, nameEng, {
      level,
      ability: abilityEng,
      item: itemEng,
    });
  } catch {
    return null;
  }
}

const TYPE_REP_MOVES: Record<string, string> = {
  Normal: "Body Slam",
  Fire: "Flamethrower",
  Water: "Surf",
  Electric: "Thunderbolt",
  Grass: "Energy Ball",
  Ice: "Ice Beam",
  Fighting: "Close Combat",
  Poison: "Sludge Bomb",
  Ground: "Earthquake",
  Flying: "Brave Bird",
  Psychic: "Psychic",
  Bug: "Bug Buzz",
  Rock: "Stone Edge",
  Ghost: "Shadow Ball",
  Dragon: "Dragon Pulse",
  Dark: "Dark Pulse",
  Steel: "Iron Head",
  Fairy: "Moonblast",
};

export interface BattleRecommendation {
  action_type: "move" | "switch";
  parameter: string;
  reason: string;
  sub_recommendation?: string;
}

interface MoveEval {
  moveData: MoveData;
  smogonMove: Move;
  minPct: number;
  maxPct: number;
  avgPct: number;
  isZero: boolean;
  isStatus: boolean;
  priority: number;
  drawbackScore: number;
  isGuaranteedKO: boolean;
}

interface SwitchEval {
  pokemon: PokemonStatus;
  incomingMaxPct: number;
  outgoingAvgPct: number;
  isImmune: boolean;
  speed: number;
}

function calculateDrawbackScore(moveEng: string): number {
  let score = 0;
  const moveData = GEN.moves.get(toID(moveEng)) as any;
  if (!moveData) return 0;

  if (typeof moveData.accuracy === "number" && moveData.accuracy < 100) {
    score += (100 - moveData.accuracy) * 2;
  }
  if (moveData.recoil) score += 30;
  if (moveData.hasCrashDamage) score += 40;
  if (moveData.mindBlownRecoil) score += 50;

  if (moveData.self?.boosts) {
    const drops = Object.values(moveData.self.boosts)
      .filter((v: any) => v < 0)
      .reduce((a: any, b: any) => a + b, 0) as number;
    score += Math.abs(drops) * 15;
  }

  if (moveData.flags?.recharge || moveData.flags?.charge) score += 50;
  return score;
}

function evaluateMove(
  attacker: SmogonPokemon,
  defender: SmogonPokemon,
  moveInfo: MoveData,
  defenderHpPct: number,
): MoveEval {
  const moveEng = trKorToEng(moveInfo.move, "MOVES") || moveInfo.move;

  try {
    const smogonMove = new Move(GEN, moveEng);
    const priority = GEN.moves.get(toID(moveEng))?.priority || 0;

    if (smogonMove.category === "Status") {
      return {
        moveData: moveInfo,
        smogonMove,
        minPct: 0,
        maxPct: 0,
        avgPct: 0,
        isZero: false,
        isStatus: true,
        priority,
        drawbackScore: 0,
        isGuaranteedKO: false,
      };
    }

    const result = calculate(GEN, attacker, defender, smogonMove);
    const raw = result.damage;
    const arr: number[] =
      typeof raw === "number"
        ? [raw]
        : Array.isArray(raw)
          ? Array.isArray(raw[0])
            ? (raw as number[][]).flat()
            : (raw as number[])
          : [0];

    const defHp = defender.maxHP();
    const minPct = defHp > 0 ? (Math.min(...arr) / defHp) * 100 : 0;
    const maxPct = defHp > 0 ? (Math.max(...arr) / defHp) * 100 : 0;
    const avgPct = defHp > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length / defHp) * 100 : 0;
    const isZero = maxPct === 0;

    return {
      moveData: moveInfo,
      smogonMove,
      minPct,
      maxPct,
      avgPct,
      isZero,
      isStatus: false,
      priority,
      drawbackScore: calculateDrawbackScore(moveEng),
      isGuaranteedKO: minPct >= defenderHpPct && !isZero,
    };
  } catch {
    return {
      moveData: moveInfo,
      smogonMove: new Move(GEN, moveEng),
      minPct: 0,
      maxPct: 0,
      avgPct: 0,
      isZero: true,
      isStatus: false,
      priority: 0,
      drawbackScore: 999,
      isGuaranteedKO: false,
    };
  }
}

function estimateOpponentMaxDamage(oppSmogon: SmogonPokemon, mySmogon: SmogonPokemon): number {
  let maxDmg = 0;
  for (const type of oppSmogon.types) {
    const repMove = TYPE_REP_MOVES[type];
    if (!repMove) continue;
    try {
      const dmgResult = calculate(GEN, oppSmogon, mySmogon, new Move(GEN, repMove));
      const arr =
        typeof dmgResult.damage === "number"
          ? [dmgResult.damage]
          : Array.isArray(dmgResult.damage)
            ? (dmgResult.damage as number[]).flat()
            : [0];
      const avg = (Math.max(...arr) / mySmogon.maxHP()) * 100;
      if (avg > maxDmg) maxDmg = avg;
    } catch {}
  }
  return maxDmg;
}

export function recommendBattleAction(
  myTeam: PokemonStatus[],
  oppActive: OppPokemon,
  activeMoves: MoveData[],
  oppTeam: OppPokemon[] = [],
): BattleRecommendation {
  const myActive = myTeam.find((p) => p.active);

  if (!myActive || !oppActive) {
    return {
      action_type: "move",
      parameter: activeMoves[0]?.move ?? "",
      reason: "활성 포켓몬 정보를 확인할 수 없습니다.",
    };
  }

  const myName = myActive.details.split(",")[0].trim();
  const myKor = getPokeKor(myName);
  const myHpPct = parseCurrentHpPct(myActive.condition);
  const myLevel = parseLevel(myActive.details);
  const mySmogon = buildSmogonPokemon(myName, myLevel, myActive.baseAbility, myActive.item);

  const oppName = oppActive.name.trim();
  const oppKor = getPokeKor(oppName);
  const oppHpPct = parseCurrentHpPct(oppActive.condition);
  const oppLevel = parseLevel(oppActive.details);
  const oppSmogon = buildSmogonPokemon(oppName, oppLevel);

  if (!mySmogon || !oppSmogon) {
    return {
      action_type: "move",
      parameter: activeMoves[0]?.move ?? "",
      reason: "계산을 위한 포켓몬 데이터를 불러올 수 없습니다.",
    };
  }

  const mySpeed = mySmogon.stats.spe;
  const oppSpeed = oppSmogon.stats.spe;
  const amIFaster = mySpeed > oppSpeed;

  const evaluatedMoves = activeMoves
    .map((m) => evaluateMove(mySmogon, oppSmogon, m, oppHpPct))
    .filter((m) => !m.isZero && !m.moveData.disabled);

  const incomingMaxPct = estimateOpponentMaxDamage(oppSmogon, mySmogon);
  const amIDead = incomingMaxPct >= myHpPct;

  const myBench = myTeam.filter((p) => !p.active && parseCurrentHpPct(p.condition) > 0);
  const benchEvals: SwitchEval[] = myBench
    .map((benchPoke) => {
      const bName = benchPoke.details.split(",")[0].trim();
      const bLevel = parseLevel(benchPoke.details);
      const bSmogon = buildSmogonPokemon(bName, bLevel, benchPoke.baseAbility, benchPoke.item);
      if (!bSmogon) return { pokemon: benchPoke, incomingMaxPct: 100, outgoingAvgPct: 0, isImmune: false, speed: 0 };

      const incoming = estimateOpponentMaxDamage(oppSmogon, bSmogon);
      const outgoing = estimateOpponentMaxDamage(bSmogon, oppSmogon);
      return {
        pokemon: benchPoke,
        incomingMaxPct: incoming,
        outgoingAvgPct: outgoing,
        isImmune: incoming === 0,
        speed: bSmogon.stats.spe,
      };
    })
    .sort((a, b) => a.incomingMaxPct - b.incomingMaxPct);

  const bestSwitch = benchEvals[0];

  const myMaxAvgDamage = Math.max(...evaluatedMoves.filter((m) => !m.isStatus).map((m) => m.avgPct), 0);
  let subRecommendation = "";

  if (incomingMaxPct < 20 && myMaxAvgDamage > 80 && oppTeam.length > 1) {
    const bestDmgMove = evaluatedMoves.reduce((a, b) => (a.avgPct > b.avgPct ? a : b), evaluatedMoves[0]);
    if (bestDmgMove) {
      const likelySwitchIn = oppTeam.find(
        (p) => p.name !== oppActive.name && !p.fainted && buildSmogonPokemon(p.name, 50)?.types.some((t) => true),
      );
      if (likelySwitchIn) {
        const switchInKor = getPokeKor(likelySwitchIn.name);
        subRecommendation = `💡 (상대 교체 예측): 상대 ${p은는(oppKor)} 불리한 대면이므로 ${switchInKor}(으)로 교체할 가능성이 높습니다. 이를 예측하여 기술을 선택하는 것도 고려해보세요.`;
      }
    }
  }

  if (amIDead && !amIFaster) {
    const priorityKOs = evaluatedMoves.filter((m) => m.priority > 0 && m.isGuaranteedKO);
    if (priorityKOs.length > 0) {
      const bestPriority = priorityKOs.sort((a, b) => a.drawbackScore - b.drawbackScore)[0];
      const mName = bestPriority.smogonMove.name;
      const mKor = getMoveKor(mName);
      return {
        action_type: "move",
        parameter: mName, // 원래 포맷(띄어쓰기 포함 영어명) 복구
        reason: `현재 ${p은는(myKor)} 상대보다 느려 다음 턴에 공격을 맞고 기절할 확률이 높습니다. 하지만 선공기인 ${p을를(mKor)} 사용하면 상대를 먼저 쓰러뜨릴 수 있습니다!`,
        sub_recommendation: subRecommendation,
      };
    }

    if (bestSwitch && bestSwitch.incomingMaxPct < 50) {
      const bName = bestSwitch.pokemon.details.split(",")[0].trim();
      const bKor = getPokeKor(bName);
      return {
        action_type: "switch",
        parameter: bName, // 원래 포맷(영어 포켓몬명) 복구
        reason: `현재 ${p은는(myKor)} 상대보다 느리고 다음 공격에 기절할 위기입니다. 상대의 공격을${bestSwitch.isImmune ? " 완전히 무효화하며" : " 안전하게 받아내며"} 유리한 대면을 만들 수 있는 ${p으로(bKor)} 교체하는 것이 좋습니다.`,
        sub_recommendation: subRecommendation,
      };
    }

    const priorityMoves = evaluatedMoves.filter((m) => m.priority > 0).sort((a, b) => b.avgPct - a.avgPct);
    if (priorityMoves.length > 0) {
      const mName = priorityMoves[0].smogonMove.name;
      const mKor = getMoveKor(mName);
      return {
        action_type: "move",
        parameter: mName,
        reason: `교체가 여의치 않고 기절할 위기이므로, 기절하기 전에 선공기인 ${p으로(mKor)} 최대한 데미지를 누적시키는 것을 추천합니다.`,
        sub_recommendation: subRecommendation,
      };
    }
  }

  const koMoves = evaluatedMoves.filter((m) => m.isGuaranteedKO);
  if (koMoves.length > 0) {
    koMoves.sort((a, b) => a.drawbackScore - b.drawbackScore);
    const safeKillMove = koMoves[0];
    const mName = safeKillMove.smogonMove.name;
    const mKor = getMoveKor(mName);

    let reasonText = ``;
    if (safeKillMove.drawbackScore === 0) {
      reasonText = `${p으로(mKor)} 상대 ${p을를(oppKor)} 디메리트 없이 확실하게 쓰러뜨릴 수 있습니다.`;
    } else {
      reasonText = `${p으로(mKor)} 상대 ${p을를(oppKor)} 쓰러뜨릴 수 있습니다. (반동 또는 명중률 리스크가 가장 적은 기술)`;
    }

    const pKo = koMoves.find((m) => m.priority > 0);
    if (!amIFaster && pKo && pKo.smogonMove.name !== safeKillMove.smogonMove.name) {
      const pkName = pKo.smogonMove.name;
      const pkKor = getMoveKor(pkName);
      reasonText = `상대보다 속도가 느려 위험할 수 있으니, 확정 선제 공격기인 ${p을를(pkKor)} 사용하는 것이 가장 안전합니다.`;
      return { action_type: "move", parameter: pkName, reason: reasonText, sub_recommendation: subRecommendation };
    }

    return { action_type: "move", parameter: mName, reason: reasonText, sub_recommendation: subRecommendation };
  }

  const damagingMoves = evaluatedMoves
    .filter((m) => !m.isStatus)
    .sort((a, b) => {
      if (Math.abs(b.avgPct - a.avgPct) < 10) return a.drawbackScore - b.drawbackScore;
      return b.avgPct - a.avgPct;
    });

  if (damagingMoves.length > 0) {
    const bestMove = damagingMoves[0];
    const mName = bestMove.smogonMove.name;
    const mKor = getMoveKor(mName);
    let reasonText = `현재 상황에서 데미지 기대치(${bestMove.minPct.toFixed(0)}~${bestMove.maxPct.toFixed(0)}%) 대비 리스크가 적은 ${p이가(mKor)} 가장 효율적입니다.`;

    if (activeMoves.length - evaluatedMoves.length > 0) {
      reasonText += ` (상대의 타입/특성으로 데미지가 0이 되는 기술은 자동 제외되었습니다.)`;
    }

    return { action_type: "move", parameter: mName, reason: reasonText, sub_recommendation: subRecommendation };
  }

  if (bestSwitch) {
    const bName = bestSwitch.pokemon.details.split(",")[0].trim();
    const bKor = getPokeKor(bName);
    return {
      action_type: "switch",
      parameter: bName,
      reason: `현재 ${p은는(myKor)} 상대 ${oppKor}에게 유효한 타격을 줄 수 없습니다. 데미지를 적게 받는 ${p으로(bKor)} 교체하는 것을 강력히 권장합니다.`,
      sub_recommendation: subRecommendation,
    };
  }

  const statusMoves = evaluatedMoves.filter((m) => m.isStatus);
  if (statusMoves.length > 0) {
    const mName = statusMoves[0].smogonMove.name;
    const mKor = getMoveKor(mName);
    return {
      action_type: "move",
      parameter: mName,
      reason: `공격 기술이 모두 무효화됩니다. 불가피하게 변화기인 ${p을를(mKor)} 사용하세요.`,
      sub_recommendation: subRecommendation,
    };
  }

  return {
    action_type: "move",
    parameter: activeMoves[0]?.move ?? "",
    reason: "추천할 수 있는 유효한 행동이 없습니다.",
  };
}
