import postposition from 'cox-postposition';
import { trEngToKor } from "./Translator";

const parseBattleLog = (line: string): string | null => {
  const parts = line.split('|');
  if (parts.length < 2) return null;

  const command = parts[1];
  let josa;

  switch (command) {
    case 'turn':
      return `\n=== 턴 ${parts[2]} ===`;
    case 'switch':
    case 'drag':
      const pkmn = trEngToKor(parts[2].split(': ')[1]);
      josa = postposition.pick(pkmn, '가');
      return `▶ [교체] ${pkmn}${josa} 필드에 나왔다!`;
    case 'move':
      const attacker = trEngToKor(parts[2].split(': ')[1]);
      const move = trEngToKor(parts[3], "MOVES");
      return `⚔️ ${attacker}의 ${move}!`;
    case '-damage':
      const target = trEngToKor(parts[2].split(': ')[1]);
      return `  ↳ ${target}의 체력이 깎였다!`;
    case '-heal':
      const healTarget = trEngToKor(parts[2].split(': ')[1]);
      return `  ↳ ${healTarget}의 체력이 회복되었다.`;
    case 'faint':
      const fainted = trEngToKor(parts[2].split(': ')[1]);
      josa = postposition.pick(fainted, '는');
      return `💀 ${fainted}${josa} 쓰러졌다...`;
    case '-supereffective':
      return `  💥 효과가 굉장했다!`;
    case '-resisted':
      return `  🛡️ 효과가 별로인 것 같다...`;
    case '-crit':
      return `  🎯 급소에 맞았다!`;
    case '-miss':
      return `  💨 그러나 공격은 빗나갔다!`;
    case 'cant':
      const cantPkmn = trEngToKor(parts[2].split(': ')[1]);
      josa = postposition.pick(cantPkmn, '는');
      return `  ❌ ${cantPkmn}${josa} 기술을 쓸 수 없다!`;
    case 'win':
      return `\n🏆 ${parts[2]} 승리!`;
    case 'tie':
      return `\n🤝 무승부!`;
    case '-weather':
      if (parts[2] === 'none' || parts[2] === 'upkeep') return null;
      return `☁️ 날씨가 [${parts[2]}] 상태가 되었다!`;
    case '-fieldstart':
      return `🌿 필드에 [${parts[2].replace('move: ', '')}] 전개되었다!`;
    case '-fieldend':
      return `🌿 [${parts[2].replace('move: ', '')}] 상태가 해제되었다.`;
    case '-sidestart':
      return `🧱 ${parts[2].split(':')[0] === 'p1' ? 'P1' : 'P2'} 진영에 [${parts[3].replace('move: ', '')}] 적용!`;
    case '-sideend':
      return `🧱 ${parts[2].split(':')[0] === 'p1' ? 'P1' : 'P2'} 진영의 [${parts[3].replace('move: ', '')}] 해제!`;
    case '-mega':
      const megaPkmn = trEngToKor(parts[2].split(': ')[1]);
      josa = postposition.pick(megaPkmn, '가');
      return `🌟 ${megaPkmn}${josa} 메가진화했다!`;
    case '-zpower':
      const zPkmn = trEngToKor(parts[2].split(': ')[1]);
      josa = postposition.pick(zPkmn, '가');
      return `🔥 ${zPkmn}${josa} Z파워를 몸에 감쌌다!`;
      
    default:
      return null;
  }
};

export default parseBattleLog;