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

function getSpeedModifier(stage: number = 0): number {
  if (stage === 0) return 1;
  return stage > 0 ? (stage + 2) / 2 : 2 / (2 - stage);
}

function getEffectiveSpeed(poke: SmogonPokemon, condition: string = "", boosts: Record<string, number> = {}): number {
  let speed = poke.stats.spe * getSpeedModifier(boosts.spe || 0);
  if (condition.includes("par")) speed *= 0.5;
  if (poke.item === "Choice Scarf") speed *= 1.5;
  if (poke.item === "Iron Ball" || poke.item === "Macho Brace") speed *= 0.5;
  return speed;
}

function buildSmogonPokemon(
  name: string,
  level: number,
  abilityKor?: string,
  itemKor?: string,
  boosts?: Record<string, number>,
): SmogonPokemon | null {
  try {
    const abilityEng = abilityKor ? trKorToEng(abilityKor, "ABILITY") || abilityKor : undefined;
    const itemEng = itemKor ? trKorToEng(itemKor, "ITEMS") || itemKor : undefined;
    const nameEng = trKorToEng(name.trim(), "POKEMON") || name.trim();
    return createPokemon(GEN, nameEng, {
      level,
      ability: abilityEng,
      item: itemEng,
      boosts: boosts as any,
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
  useMega?: boolean;
  useZMove?: boolean;
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
  mechanics?: {
    canMegaEvo: boolean;
    canZMove: boolean;
    usedMega: boolean;
    usedZMove: boolean;
    isNoLimit: boolean;
  },
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
  const mySmogon = buildSmogonPokemon(myName, myLevel, myActive.baseAbility, myActive.item, myActive.boosts);

  const oppName = oppActive.name.trim();
  const oppKor = getPokeKor(oppName);
  const oppHpPct = parseCurrentHpPct(oppActive.condition);
  const oppLevel = parseLevel(oppActive.details);
  const oppSmogon = buildSmogonPokemon(oppName, oppLevel, undefined, undefined, oppActive.boosts);

  if (!mySmogon || !oppSmogon) {
    return {
      action_type: "move",
      parameter: activeMoves[0]?.move ?? "",
      reason: "계산을 위한 포켓몬 데이터를 불러올 수 없습니다.",
    };
  }

  const mySpeed = getEffectiveSpeed(mySmogon, myActive.condition, myActive.boosts || {});
  const oppSpeed = getEffectiveSpeed(oppSmogon, oppActive.condition, oppActive.boosts || {});
  const amIFaster = mySpeed > oppSpeed;

  const evaluatedMoves = activeMoves
    .map((m) => evaluateMove(mySmogon, oppSmogon, m, oppHpPct))
    .filter((m) => !m.isZero && !m.moveData.disabled);

  const incomingMaxPct = estimateOpponentMaxDamage(oppSmogon, mySmogon);
  const amIDead = incomingMaxPct >= myHpPct;

  const myMaxAvgDamage = Math.max(...evaluatedMoves.filter((m) => !m.isStatus).map((m) => m.avgPct), 0);
  const myTTK = myMaxAvgDamage > 0 ? Math.ceil(oppHpPct / myMaxAvgDamage) : 999;
  const oppTTK = incomingMaxPct > 0 ? Math.ceil(myHpPct / incomingMaxPct) : 999;
  const isDisadvantage = oppTTK < myTTK || (oppTTK === myTTK && !amIFaster);

  const myBench = myTeam.filter((p) => !p.active && parseCurrentHpPct(p.condition) > 0);
  const benchEvals: SwitchEval[] = myBench
    .map((benchPoke) => {
      const bName = benchPoke.details.split(",")[0].trim();
      const bLevel = parseLevel(benchPoke.details);
      const bSmogon = buildSmogonPokemon(bName, bLevel, benchPoke.baseAbility, benchPoke.item, benchPoke.boosts);
      if (!bSmogon) return { pokemon: benchPoke, incomingMaxPct: 100, outgoingAvgPct: 0, isImmune: false, speed: 0 };

      const incoming = estimateOpponentMaxDamage(oppSmogon, bSmogon);
      const outgoing = estimateOpponentMaxDamage(bSmogon, oppSmogon);
      const bSpeed = getEffectiveSpeed(bSmogon, benchPoke.condition, benchPoke.boosts || {});
      return {
        pokemon: benchPoke,
        incomingMaxPct: incoming,
        outgoingAvgPct: outgoing,
        isImmune: incoming === 0,
        speed: bSpeed,
      };
    })
    .sort((a, b) => a.incomingMaxPct - b.incomingMaxPct);

  const bestSwitch = benchEvals[0];
  let subRecommendation = "";

  // ----------------------------------------------------
  // 메가/Z기술 판단
  // ----------------------------------------------------
  const roomCanMega = mechanics?.canMegaEvo ?? false;
  const roomCanZMove = mechanics?.canZMove ?? false;
  const hasUsedMega = mechanics?.usedMega ?? false;
  const hasUsedZMove = mechanics?.usedZMove ?? false;

  const currentItem = (myActive.item || "").toLowerCase();

  const isMegaStone =
    currentItem.includes("나이트") ||
    (currentItem.endsWith("ite") && !currentItem.includes("eviolite")) ||
    currentItem.endsWith("ite x") ||
    currentItem.endsWith("ite y") ||
    currentItem.includes("구슬") ||
    currentItem.includes("orb");
  const isRayquazaWithAscent =
    (mySmogon.name === "Rayquaza" || mySmogon.name === "레쿠쟈") &&
    activeMoves.some((m) => m.move === "화룡점정" || m.move.toLowerCase() === "dragon ascent");

  const actuallyCanMega = roomCanMega && !hasUsedMega && (isMegaStone || isRayquazaWithAscent);
  const actuallyCanZMove = roomCanZMove && !hasUsedZMove && currentItem.endsWith("z");

  let useMega = false;
  let useZMove = false;
  let mechanicReasoning = "";

  if (actuallyCanZMove && !amIDead) {
    const bestDamaging = evaluatedMoves.reduce((a, b) => (a.avgPct > b.avgPct ? a : b), evaluatedMoves[0]);
    if (bestDamaging) {
      const zMoveEstimatedAvg = bestDamaging.avgPct * 1.5;
      const isNormalKO = bestDamaging.isGuaranteedKO; // 최소 데미지가 100% 이상인 확정 1타
      const isZMoveKO = zMoveEstimatedAvg >= oppHpPct;

      if (!isNormalKO && isZMoveKO) {
        useZMove = true;
        // 최대 데미지가 100% 이상이라면 난수 1타 상황
        if (bestDamaging.maxPct >= oppHpPct) {
          mechanicReasoning = ` (🌟확정 킬 Z기술: 일반 공격은 난수(확률)에 따라 아쉽게 킬이 안 날 수 있지만, Z기술을 쓰면 변수 없이 완벽하게 잡아냅니다!)`;
        } else {
          mechanicReasoning = ` (🌟결정적 Z기술 타이밍: 일반 공격으로는 한 방에 쓰러뜨릴 수 없지만, Z기술을 쓰면 상대를 확실하게 잡아냅니다!)`;
        }
      }
    }
  }

  if (actuallyCanMega && !useZMove) {
    useMega = true;
    mechanicReasoning = ` (💫메가진화 추천)`;
  }

  // 1. 현재 턴에 기절 확정이고 스피드도 느릴 때
  if (amIDead && !amIFaster) {
    const priorityKOs = evaluatedMoves.filter((m) => m.priority > 0 && m.isGuaranteedKO);
    if (priorityKOs.length > 0) {
      const bestPriority = priorityKOs.sort((a, b) => a.drawbackScore - b.drawbackScore)[0];
      const mName = bestPriority.smogonMove.name;
      return {
        action_type: "move",
        parameter: mName,
        reason: `현재 ${p은는(myKor)} 상대보다 느려 다음 턴에 기절합니다. 하지만 선공기인 ${p을를(getMoveKor(mName))} 사용하면 상대를 먼저 쓰러뜨릴 수 있습니다!${mechanicReasoning}`,
        sub_recommendation: subRecommendation,
        useMega,
        useZMove,
      };
    }

    if (bestSwitch && bestSwitch.incomingMaxPct < 50) {
      const bName = bestSwitch.pokemon.details.split(",")[0].trim();
      return {
        action_type: "switch",
        parameter: bName,
        reason: `현재 기절할 위기이므로 데미지를 적게 받는 ${p으로(getPokeKor(bName))} 교체하세요.`,
        sub_recommendation: subRecommendation,
      };
    }

    const priorityMoves = evaluatedMoves.filter((m) => m.priority > 0).sort((a, b) => b.avgPct - a.avgPct);
    if (priorityMoves.length > 0) {
      const mName = priorityMoves[0].smogonMove.name;
      return {
        action_type: "move",
        parameter: mName,
        reason: `교체가 여의치 않으니 기절하기 전에 선공기인 ${p으로(getMoveKor(mName))} 데미지를 누적시키세요.${mechanicReasoning}`,
        sub_recommendation: subRecommendation,
        useMega,
        useZMove,
      };
    }
  }

  // 2. 불리한 대면 딜교환 실패 시
  if (isDisadvantage && !amIDead) {
    const goodSwitch = benchEvals.find((b) => {
      const bTTK = b.outgoingAvgPct > 0 ? Math.ceil(oppHpPct / b.outgoingAvgPct) : 999;
      const bOppTTK = b.incomingMaxPct > 0 ? Math.ceil(100 / b.incomingMaxPct) : 999;
      const bFaster = b.speed > oppSpeed;
      return bTTK < bOppTTK || (bTTK === bOppTTK && bFaster);
    });

    if (useZMove) {
      // 넘어감
    } else if (goodSwitch && goodSwitch.incomingMaxPct < 50) {
      const bName = goodSwitch.pokemon.details.split(",")[0].trim();
      return {
        action_type: "switch",
        parameter: bName,
        reason: `턴을 거듭할수록 불리한 대면입니다. 기점을 잡을 수 있는 ${p으로(getPokeKor(bName))} 교체를 권장합니다.`,
        sub_recommendation: subRecommendation,
      };
    }
  }

  // 3. 확정 KO가 가능한 경우
  const koMoves = evaluatedMoves.filter((m) => m.isGuaranteedKO);
  if (koMoves.length > 0) {
    koMoves.sort((a, b) => a.drawbackScore - b.drawbackScore);
    const safeKillMove = koMoves[0];
    const mName = safeKillMove.smogonMove.name;
    const mKor = getMoveKor(mName);

    let reasonText =
      safeKillMove.drawbackScore === 0
        ? `${p으로(mKor)} 상대를 디메리트 없이 확실하게 쓰러뜨릴 수 있습니다.`
        : `${p으로(mKor)} 상대를 쓰러뜨릴 수 있습니다. (리스크 적은 기술)`;

    const pKo = koMoves.find((m) => m.priority > 0);
    if (!amIFaster && pKo && pKo.smogonMove.name !== safeKillMove.smogonMove.name) {
      reasonText = `속도가 느려 위험할 수 있으니, 확정 선제 공격기인 ${p을를(getMoveKor(pKo.smogonMove.name))} 사용하는 것이 가장 안전합니다.`;
      return {
        action_type: "move",
        parameter: pKo.smogonMove.name,
        reason: reasonText + (useMega ? mechanicReasoning : ""),
        sub_recommendation: subRecommendation,
        useMega,
        useZMove: false,
      };
    }

    return {
      action_type: "move",
      parameter: mName,
      reason: reasonText + (useMega ? mechanicReasoning : ""),
      sub_recommendation: subRecommendation,
      useMega,
      useZMove: false,
    };
  }

  // 4. 일반적인 데미지 딜링
  const damagingMoves = evaluatedMoves
    .filter((m) => !m.isStatus)
    .sort((a, b) => {
      if (Math.abs(b.avgPct - a.avgPct) < 10) return a.drawbackScore - b.drawbackScore;
      return b.avgPct - a.avgPct;
    });

  if (damagingMoves.length > 0) {
    const bestMove = damagingMoves[0];
    const mName = bestMove.smogonMove.name;
    let reasonText = `현재 데미지 기대치(${bestMove.minPct.toFixed(0)}~${bestMove.maxPct.toFixed(0)}%) 대비 리스크가 적은 ${p이가(getMoveKor(mName))} 가장 효율적입니다.`;
    return {
      action_type: "move",
      parameter: mName,
      reason: reasonText + mechanicReasoning,
      sub_recommendation: subRecommendation,
      useMega,
      useZMove,
    };
  }

  // 5. 교체
  if (bestSwitch) {
    const bName = bestSwitch.pokemon.details.split(",")[0].trim();
    return {
      action_type: "switch",
      parameter: bName,
      reason: `현재 유효한 타격을 줄 수 없으니 ${p으로(getPokeKor(bName))} 교체를 권장합니다.`,
      sub_recommendation: subRecommendation,
    };
  }

  // 6. 변화기
  const statusMoves = evaluatedMoves.filter((m) => m.isStatus);
  if (statusMoves.length > 0) {
    const mName = statusMoves[0].smogonMove.name;
    return {
      action_type: "move",
      parameter: mName,
      reason: `공격 기술이 무효화되므로 불가피하게 ${p을를(getMoveKor(mName))} 사용하세요.${useMega ? mechanicReasoning : ""}`,
      sub_recommendation: subRecommendation,
      useMega,
      useZMove: false,
    };
  }

  return {
    action_type: "move",
    parameter: activeMoves[0]?.move ?? "",
    reason: "추천할 수 있는 유효한 행동이 없습니다.",
  };
}
