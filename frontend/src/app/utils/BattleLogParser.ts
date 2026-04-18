const parseBattleLog = (line: string): string | null => {
  const parts = line.split('|');
  if (parts.length < 2) return null;

  const command = parts[1];

  switch (command) {
    case 'turn':
      return `\n=== 턴 ${parts[2]} ===`;
    case 'switch':
    case 'drag':
      const pkmn = parts[2].split(': ')[1];
      return `▶ [교체] ${pkmn}(이)가 필드에 나왔다!`;
    case 'move':
      const attacker = parts[2].split(': ')[1];
      const move = parts[3];
      return `⚔️ ${attacker}의 ${move}!`;
    case '-damage':
      const target = parts[2].split(': ')[1];
      return `  ↳ ${target}의 체력이 깎였다!`;
    case '-heal':
      const healTarget = parts[2].split(': ')[1];
      return `  ↳ ${healTarget}의 체력이 회복되었다.`;
    case 'faint':
      const fainted = parts[2].split(': ')[1];
      return `💀 ${fainted}(은)는 쓰러졌다...`;
    case '-supereffective':
      return `  💥 효과가 굉장했다!`;
    case '-resisted':
      return `  🛡️ 효과가 별로인 것 같다...`;
    case '-crit':
      return `  🎯 급소에 맞았다!`;
    case '-miss':
      return `  💨 그러나 공격은 빗나갔다!`;
    case 'cant':
      const cantPkmn = parts[2].split(': ')[1];
      return `  ❌ ${cantPkmn}(은)는 기술을 쓸 수 없다!`;
    case 'win':
      return `\n🏆 ${parts[2]} 승리!`;
    case 'tie':
      return `\n🤝 무승부!`;
    default:
      return null;
  }
};

export default parseBattleLog;