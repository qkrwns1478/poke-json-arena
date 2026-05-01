import postposition from "cox-postposition";
import { trEngToKor } from "./Translator";

const statEngToKor = (str: string): string => {
  switch (str) {
    case "atk":
      return "공격";
    case "def":
      return "방어";
    case "spa":
      return "특수공격";
    case "spd":
      return "특수방어";
    case "spe":
      return "스피드";
    case "evasion":
      return "회피율";
    case "accuracy":
      return "명중률";
  }
  return str;
};

const parseBattleLog = (line: string): string | null => {
  const parts = line.split("|");
  if (parts.length < 2) return null;

  const command = parts[1];
  let josa;

  switch (command) {
    case "turn":
      return `\n=== 턴 ${parts[2]} ===`;
    case "switch":
    case "drag":
      const pkmn = trEngToKor(parts[2].split(": ")[1]);
      josa = postposition.pick(pkmn, "가");
      return `▶ [교체] ${pkmn}${josa} 필드에 나왔다!`;
    case "move":
      const attacker = trEngToKor(parts[2].split(": ")[1]);
      const move = trEngToKor(parts[3], "MOVES");
      return `⚔️ ${attacker}의 ${move}!`;
    case "-damage":
      const target = trEngToKor(parts[2].split(": ")[1]);
      return `  ↳ ${target}의 체력이 깎였다!`;
    case "-heal":
      const healTarget = trEngToKor(parts[2].split(": ")[1]);
      return `  ↳ ${healTarget}의 체력이 회복되었다.`;
    case "faint":
      const fainted = trEngToKor(parts[2].split(": ")[1]);
      josa = postposition.pick(fainted, "는");
      return `💀 ${fainted}${josa} 쓰러졌다...`;
    case "-supereffective":
      return `  💥 효과가 굉장했다!`;
    case "-resisted":
      return `  🛡️ 효과가 별로인 것 같다...`;
    case "-crit":
      return `  🎯 급소에 맞았다!`;
    case "-miss":
      return `  💨 그러나 공격은 빗나갔다!`;
    case "cant":
      const cantPkmn = trEngToKor(parts[2].split(": ")[1]);
      josa = postposition.pick(cantPkmn, "는");
      return `  ❌ ${cantPkmn}${josa} 기술을 쓸 수 없다!`;
    case "win":
      return `\n🏆 ${parts[2]} 승리!`;
    case "tie":
      return `\n🤝 무승부!`;
    case "-weather":
      if (parts[2] === "none" || parts[2] === "upkeep") return null;
      return `☁️ 날씨가 [${parts[2]}] 상태가 되었다!`;
    case "-fieldstart":
      return `🌿 필드에 [${parts[2].replace("move: ", "")}] 전개되었다!`;
    case "-fieldend":
      return `🌿 [${parts[2].replace("move: ", "")}] 상태가 해제되었다.`;
    case "-sidestart":
      return `🧱 ${parts[2].split(":")[0] === "p1" ? "P1" : "P2"} 진영에 [${parts[3].replace("move: ", "")}] 적용!`;
    case "-sideend":
      return `🧱 ${parts[2].split(":")[0] === "p1" ? "P1" : "P2"} 진영의 [${parts[3].replace("move: ", "")}] 해제!`;
    case "-mega":
      const megaPkmn = trEngToKor(parts[2].split(": ")[1]);
      josa = postposition.pick(megaPkmn, "가");
      return `🌟 ${megaPkmn}${josa} 메가진화했다!`;
    case "-zpower":
      const zPkmn = trEngToKor(parts[2].split(": ")[1]);
      josa = postposition.pick(zPkmn, "가");
      return `🔥 ${zPkmn}${josa} Z파워를 몸에 감쌌다!`;
    case "-boost":
      const boostPkmn = trEngToKor(parts[2].split(": ")[1]);
      const boostStat = statEngToKor(parts[3]);
      josa = postposition.pick(boostStat, "가");
      return `📈 ${boostPkmn}의 ${boostStat}${josa} 올랐다!`;
    case "-unboost":
      const unboostPkmn = trEngToKor(parts[2].split(": ")[1]);
      const unboostStat = statEngToKor(parts[3]);
      josa = postposition.pick(unboostStat, "가");
      return `📉 ${unboostPkmn}의 ${unboostStat}${josa} 떨어졌다!`;
    case "-clearallboost":
      return `✨ 모든 랭크 변화가 원래대로 돌아갔다!`;
    case "-clearpositiveboost":
      const clearPosPkmn = trEngToKor(parts[2].split(": ")[1]);
      josa = postposition.pick(clearPosPkmn, "의");
      return `📉 ${clearPosPkmn}${josa} 올라간 능력치가 원래대로 돌아갔다!`;
    case "-ability":
      const abilityPkmn = trEngToKor(parts[2].split(": ")[1]);
      const ability = trEngToKor(parts[3], "ABILITY");
      return `✨ ${abilityPkmn}의 ${ability} 특성 발동!`;
    case "-enditem":
      const itemPkmn = trEngToKor(parts[2].split(": ")[1]);
      const item = trEngToKor(parts[3], "ITEMS");
      return `🎒 ${itemPkmn}의 ${item}!`;
    case "-item":
      const getItemPkmn = trEngToKor(parts[2].split(": ")[1]);
      const getItem = trEngToKor(parts[3], "ITEMS");
      const josa1 = postposition.pick(getItemPkmn, "는");
      const josa2 = postposition.pick(getItem, "를");
      return `🎒 ${getItemPkmn}${josa1} ${getItem}${josa2} 가지게 되었다!`;
    case "-activate":
      const actPkmn = trEngToKor(parts[2].split(": ")[1]);
      if (parts[3] && parts[3].includes("ability: Disguise")) {
        josa = postposition.pick(actPkmn, "의");
        return `✨ ${actPkmn}${josa} 탈이 공격을 대신 받았다!`;
      }
      return null;
    case "detailschange":
    case "-formechange":
      const formPkmn = trEngToKor(parts[2].split(": ")[1]);
      const newForm = trEngToKor(parts[3].split(",")[0]);
      josa = postposition.pick(formPkmn, "는");
      return `🔄 ${formPkmn}${josa} ${newForm}(으)로 모습이 바뀌었다!`;
    default:
      return null;
  }
};

export default parseBattleLog;
