import { calculate, Pokemon, Move, Field, Generations } from "@smogon/calc";

interface PokemonStats {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}
interface PokemonStatus {
  ident: string;
  details: string;
  condition: string;
  active: boolean;
  stats?: PokemonStats;
  item?: string;
  baseAbility?: string;
}
interface OppPokemon {
  ident: string;
  name: string;
  details: string;
  condition: string;
  revealed: boolean;
  fainted: boolean;
}
interface MoveData {
  move: string;
  id: string;
  disabled?: boolean;
}

const gen = Generations.get(9);

// 데미지 결과에서 최댓값 또는 평균값을 안전하게 추출하는 유틸 함수
function getDamageValue(damage: number | number[] | number[][], type: 'max' | 'avg' = 'avg'): number {
  if (typeof damage === 'number') {
    return damage; // 고정 데미지
  }
  
  if (Array.isArray(damage)) {
    if (damage.length === 0) return 0;
    
    // 이중 배열(연속기 등)인 경우 첫 번째 타격 배열 추출
    const rolls = Array.isArray(damage[0]) ? (damage[0] as unknown as number[]) : (damage as number[]);
    
    if (type === 'max') {
      return rolls[rolls.length - 1]; // 최대 난수 (Max Roll)
    } else {
      return rolls[Math.floor(rolls.length / 2)]; // 중간 난수 (Average Roll)
    }
  }
  
  return 0;
}

// HP 파싱 유틸 ("100/100 psn" -> { current: 100, max: 100, status: 'psn' })
function parseCondition(condition: string) {
  if (!condition || condition === "0 fnt") return { current: 0, max: 100, status: "" };
  const hpMatch = condition.match(/(\d+)\/(\d+)/);
  const statusMatch = condition.match(/\b(brn|par|psn|tox|slp|frz)\b/);

  if (hpMatch) {
    return {
      current: parseInt(hpMatch[1]),
      max: parseInt(hpMatch[2]),
      status: statusMatch ? statusMatch[1] : "",
    };
  }
  // 퍼센트 폼 (ex: "45/100")
  const pctMatch = condition.match(/(\d+)\/100/);
  return {
    current: pctMatch ? parseInt(pctMatch[1]) : 100,
    max: 100,
    status: statusMatch ? statusMatch[1] : "",
  };
}

// 상대방의 예상 자속(STAB) 주력기 추출 (적의 기술을 모를 때 위협 평가용)
const TYPE_TO_MOVE: Record<string, string> = {
  Normal: "Double-Edge",
  Fire: "Flamethrower",
  Water: "Hydro Pump",
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
  Steel: "Flash Cannon",
  Fairy: "Moonblast",
};

export function getBattleRecommendation(
  myTeam: PokemonStatus[],
  activeMoves: MoveData[],
  oppTeam: OppPokemon[],
  oppActive: OppPokemon | null
) {
  if (!oppActive || !oppActive.name) return { action: "WAIT", reason: "상대 포켓몬을 기다리는 중입니다." };
  
  const oppHp = parseCondition(oppActive.condition);
  if (oppActive.fainted || oppHp.current <= 0) {
    return { action: "WAIT", reason: `상대 ${oppActive.name}(이)가 쓰러졌습니다. 다음 포켓몬을 기다리는 중...` };
  }

  const myActive = myTeam.find(p => p.active);
  if (!myActive || myActive.condition === "0 fnt") return { action: "WAIT", reason: "출전할 포켓몬을 선택하세요." };

  const field = new Field();

  const myName = myActive.details.split(",")[0].trim();
  const myHp = parseCondition(myActive.condition);
  
  let myPoke: Pokemon;
  let oppPoke: Pokemon;

  try {
    myPoke = new Pokemon(gen, myName, {
      item: myActive.item,
      ability: myActive.baseAbility,
      ivs: { atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { atk: 252, def: 4, spa: 252, spd: 4, spe: 252 },
    });
    myPoke.originalCurHP = myHp.current;

    oppPoke = new Pokemon(gen, oppActive.name, {
      ivs: { atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { atk: 252, def: 4, spa: 252, spd: 4, spe: 252 },
    });
    oppPoke.originalCurHP = oppHp.current;
  } catch (error) {
    console.warn("포켓몬 데이터를 불러오는 중 오류 발생:", myName, oppActive.name);
    return { action: "WAIT", reason: `[시스템] ${oppActive.name} 또는 ${myName}의 세부 폼 데이터를 계산기가 인식하지 못해 대기 중입니다.` };
  }

  let maxEnemyDamageRatio = 0;
  let predictedEnemyMove = "";
  
  for (const type of oppPoke.types) {
    if (!type) continue;
    const testMoveName = TYPE_TO_MOVE[type] || "Tackle";
    try {
      const calcRes = calculate(gen, oppPoke, myPoke, new Move(gen, testMoveName), field);
      const maxDamage = getDamageValue(calcRes.damage, 'max'); // 이전에 만든 유틸 함수 사용
      const damageRatio = maxDamage / myPoke.stats.hp;
      if (damageRatio > maxEnemyDamageRatio) {
        maxEnemyDamageRatio = damageRatio;
        predictedEnemyMove = testMoveName;
      }
    } catch (e) { /* ignore */ }
  }

  const isOhkoThreatened = (maxEnemyDamageRatio * myPoke.stats.hp) >= myHp.current;
  const amIFaster = (myActive.stats?.spe || myPoke.stats.spe) > oppPoke.stats.spe;

  let bestMove = { id: "", name: "", damageRatio: 0, reason: "" };
  
  for (const moveData of activeMoves) {
    if (moveData.disabled) continue;
    try {
      const move = new Move(gen, moveData.id);
      const calcRes = calculate(gen, myPoke, oppPoke, move, field);
      
      const expectedDamage = getDamageValue(calcRes.damage, 'avg');
      const damageRatio = expectedDamage / oppPoke.stats.hp;

      if (damageRatio > bestMove.damageRatio) {
        bestMove = {
          id: moveData.id,
          name: moveData.move,
          damageRatio,
          reason: `예상 대미지 ${Math.round(damageRatio * 100)}% (${calcRes.desc()})`
        };
      }
    } catch (e) { }
  }

  let opponentWillSwitch = false;
  let predictedSwitchTarget: OppPokemon | null = null;
  
  if (bestMove.damageRatio >= (oppHp.current / 100) && amIFaster) {
    const revealedBench = oppTeam.filter(p => p.ident !== oppActive.ident && !p.fainted && p.revealed);
    for (const benchPoke of revealedBench) {
      try {
        const dummyBenchPoke = new Pokemon(gen, benchPoke.name);
        const calcRes = calculate(gen, myPoke, dummyBenchPoke, new Move(gen, bestMove.id), field);
        const damageToBench = getDamageValue(calcRes.damage, 'avg') / dummyBenchPoke.stats.hp;
        
        if (damageToBench <= 0.5) {
          opponentWillSwitch = true;
          predictedSwitchTarget = benchPoke;
          break;
        }
      } catch (e) { /* 벤치 포켓몬 생성 실패 무시 */ }
    }
  }

  if (isOhkoThreatened && !amIFaster) {
    let bestSwitch = null;
    let minDamageRatio = 1.0;

    const aliveBench = myTeam.filter(p => !p.active && p.condition !== "0 fnt");
    for (const bench of aliveBench) {
      const benchName = bench.details.split(",")[0].trim();
      try {
        const benchPoke = new Pokemon(gen, benchName, { ability: bench.baseAbility });
        const switchInCalc = calculate(gen, oppPoke, benchPoke, new Move(gen, predictedEnemyMove), field);
        const switchInDamageRatio = getDamageValue(switchInCalc.damage, 'max') / benchPoke.stats.hp;
        
        if (switchInDamageRatio < minDamageRatio) {
          minDamageRatio = switchInDamageRatio;
          bestSwitch = bench;
        }
      } catch (e) { /* 내 벤치 포켓몬 생성 실패 무시 */ }
    }

    if (bestSwitch && minDamageRatio < 1.0) {
      const bName = bestSwitch.details.split(",")[0].trim();
      return {
        action: "SWITCH",
        target: bName,
        reason: `[위험] 상대 ${oppActive.name}가 더 빠르고 기절할 위험이 큽니다. 대미지를 줄일 수 있는 ${bName}(으)로 교체하세요.`
      };
    }
  }

  if (opponentWillSwitch && predictedSwitchTarget) {
    let predictionMove = bestMove;
    for (const moveData of activeMoves) {
      if (moveData.disabled) continue;
      try {
        const move = new Move(gen, moveData.id);
        const dummyBenchPoke = new Pokemon(gen, predictedSwitchTarget.name);
        const calcRes = calculate(gen, myPoke, dummyBenchPoke, move, field);
        const damageRatio = getDamageValue(calcRes.damage, 'avg') / dummyBenchPoke.stats.hp;
        
        if (damageRatio > predictionMove.damageRatio) {
          predictionMove = { id: moveData.id, name: moveData.move, damageRatio, reason: "" };
        }
      } catch (e) { }
    }
    
    return {
      action: "MOVE",
      target: predictionMove.name,
      reason: `상대 ${oppActive.name}가 땅 타입 등에 약해 ${predictedSwitchTarget.name}(으)로 교체할 가능성이 큽니다. 예측 샷으로 [${predictionMove.name}]을(를) 추천합니다.`
    };
  }

  if (bestMove.damageRatio === 0) {
    const bestBench = myTeam.filter(p => !p.active && p.condition !== "0 fnt")[0];
    const targetName = bestBench ? bestBench.details.split(",")[0].trim() : "없음";
    return { 
      action: "SWITCH", 
      target: targetName,
      reason: `현재 기술 중 ${oppActive.name}에게 유효한 타격을 줄 수 있는 기술이 없습니다. ${targetName}(으)로의 교체를 추천합니다.` 
    };
  }

  return {
    action: "MOVE",
    target: bestMove.name,
    reason: `[${bestMove.name}] 사용 시 ${bestMove.reason}`
  };
}
