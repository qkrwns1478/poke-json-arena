'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

let socket: Socket;

interface PokemonStatus {
  ident: string;
  details: string;
  condition: string;
  active: boolean;
}

interface MoveData {
  move: string;
  id: string;
  disabled?: boolean;
}

const SAMPLE_TEAMS = {
  team1: `Pikachu @ Light Ball\nAbility: Static\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Thunderbolt\n- Quick Attack\n- Iron Tail\n- Volt Tackle\n\nCharizard @ Heavy-Duty Boots\nAbility: Blaze\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Flamethrower\n- Air Slash\n- Dragon Pulse\n- Roost`,
  team2: `Gengar @ Life Orb\nAbility: Cursed Body\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Shadow Ball\n- Sludge Bomb\n- Focus Blast\n- Destiny Bond\n\nSnorlax @ Leftovers\nAbility: Thick Fat\nEVs: 252 HP / 4 Atk / 252 SpD\nCareful Nature\n- Body Slam\n- Earthquake\n- Rest\n- Sleep Talk`
};

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

export default function BattlePage() {
  const [userId, setUserId] = useState<string>('');
  const [phase, setPhase] = useState<'lobby' | 'waiting' | 'battle'>('lobby');
  const [teamString, setTeamString] = useState<string>(SAMPLE_TEAMS.team1);

  const [logs, setLogs] = useState<string[]>([]);
  const [myTeam, setMyTeam] = useState<PokemonStatus[]>([]);
  const [activeMoves, setActiveMoves] = useState<MoveData[]>([]);
  const [isTeamPreview, setIsTeamPreview] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = uuidv4();
    setUserId(id);
    socket = io('http://localhost:3001');

    socket.on('match-found', () => setPhase('battle'));

    socket.on('log', (message: string) => {
      if (!message.includes('[시스템]')) {
        setLogs((prev) => [...prev, message]);
      }
    });

    socket.on('battle-log', (chunk: string) => {
      const lines = chunk.split('\n');
      const newLogs: string[] = [];

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('|win|')) {
          setWinner(trimmed.split('|')[2]);
        } else if (trimmed === '|tie') {
          setWinner('Draw');
        }

        if (trimmed.startsWith('|teampreview')) {
          setIsTeamPreview(true);
        } else if (trimmed.startsWith('|start') || trimmed.startsWith('|turn|')) {
          setIsTeamPreview(false);
        }

        if (trimmed.startsWith('|request|')) {
          try {
            const requestJson = JSON.parse(trimmed.slice(9));
            if (requestJson && requestJson.side && requestJson.side.pokemon) {
              setMyTeam(requestJson.side.pokemon);
            }
            if (requestJson && requestJson.active && requestJson.active[0] && requestJson.active[0].moves) {
              setActiveMoves(requestJson.active[0].moves);
            } else {
              setActiveMoves([]);
            }
          } catch (e) {
            console.error("Parse error", e);
          }
        } else {
          const humanReadableLog = parseBattleLog(trimmed);
          if (humanReadableLog) {
            newLogs.push(humanReadableLog);
          }
        }
      });

      if (newLogs.length > 0) {
        setLogs((prev) => [...prev, ...newLogs]);
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const searchMatch = () => {
    if (!teamString.trim()) return alert('팀 데이터를 입력해주세요!');
    socket.emit('search-match', teamString);
    setPhase('waiting');
  };

  const sendAction = (type: 'move' | 'switch' | 'team', index: number) => {
    if (!socket || winner) return; 
    socket.emit('action', `${type} ${index}`);
  };

  const returnToLobby = () => {
    setPhase('lobby');
    setWinner(null);
    setLogs([]);
    setMyTeam([]);
    setActiveMoves([]);
    setIsTeamPreview(false);
  };

  const activePokemon = myTeam.find(p => p.active);

  if (phase === 'lobby' || phase === 'waiting') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 w-full max-w-2xl">
          <h1 className="text-3xl font-bold mb-6 text-center text-yellow-400">Poke JSON Arena</h1>
          <div className="mb-4">
            <h2 className="text-xl font-bold mb-2">Team Builder</h2>
            <textarea 
              value={teamString}
              onChange={(e) => setTeamString(e.target.value)}
              className="w-full h-64 bg-black text-green-400 p-4 rounded font-mono text-sm border border-gray-600 focus:outline-none focus:border-yellow-400"
              disabled={phase === 'waiting'}
            />
          </div>
          <div className="flex gap-4 mb-8">
            <button onClick={() => setTeamString(SAMPLE_TEAMS.team1)} disabled={phase === 'waiting'} className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded font-bold transition">팀 1 (피카츄, 리자몽)</button>
            <button onClick={() => setTeamString(SAMPLE_TEAMS.team2)} disabled={phase === 'waiting'} className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded font-bold transition">팀 2 (팬텀, 잠만보)</button>
          </div>
          {phase === 'lobby' ? (
            <button onClick={searchMatch} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded text-xl transition">Find Match (Battle!)</button>
          ) : (
            <div className="w-full bg-yellow-600 text-white font-bold py-4 rounded text-xl text-center animate-pulse">상대를 찾는 중...</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col md:flex-row gap-8">
      
      <div className="flex-1 flex flex-col h-[80vh] min-h-0 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded p-4 shrink-0">
          <h2 className="text-xl font-bold mb-2">My Active Pokémon</h2>
          {activePokemon ? (
            <div className="flex items-center gap-4 bg-black p-4 rounded border border-gray-600">
              <div className="text-lg font-bold text-yellow-400">{activePokemon.details.split(',')[0]}</div>
              <div className="text-2xl font-mono">HP: {activePokemon.condition}</div>
            </div>
          ) : (
            <div className="text-yellow-400 font-bold animate-pulse">
              {isTeamPreview ? "선봉으로 출전할 포켓몬을 선택하세요!" : "대기 중..."}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col border border-gray-700 rounded bg-gray-800 p-4 min-h-0">
          <h2 className="text-lg font-bold mb-2 shrink-0">Battle Log</h2>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm font-sans bg-black p-4 rounded whitespace-pre-wrap">
            {logs.map((log, i) => (
              <div key={i} className={`
                ${log.startsWith('===') ? 'text-yellow-400 font-bold mt-4 mb-2' : ''}
                ${log.includes('효과가 굉장했다') ? 'text-red-400 font-bold' : ''}
                ${log.includes('쓰러졌다') ? 'text-gray-500 line-through' : 'text-gray-200'}
              `}>
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      <div className="w-full md:w-80 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
        {winner ? (
          <div className="bg-gray-800 p-6 rounded border border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] text-center flex flex-col gap-6 mt-auto mb-auto">
            <h3 className="text-3xl font-bold text-yellow-400">
              {winner === 'Draw' ? '무승부!' : `${winner} 승리!`}
            </h3>
            <p className="text-gray-300 text-sm">마지막 로그를 확인하고 로비로 돌아가세요.</p>
            <button 
              onClick={returnToLobby} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded text-xl transition shadow-lg"
            >
              로비로 돌아가기
            </button>
          </div>
        ) : isTeamPreview ? (
          <div className="bg-gray-800 p-4 rounded border border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
            <h3 className="text-xl font-bold mb-4 text-yellow-400 text-center">선봉장 선택</h3>
            <div className="flex flex-col gap-2">
              {myTeam.map((pokemon, idx) => (
                <button 
                  key={idx} 
                  onClick={() => sendAction('team', idx + 1)}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded font-bold transition flex justify-between"
                >
                  <span>{pokemon.details.split(',')[0]}</span>
                  <span className="text-sm opacity-80">선봉 출전</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <h3 className="text-lg font-bold mb-2">Moves</h3>
              <div className="grid grid-cols-2 gap-2">
                {activeMoves.length > 0 ? (
                  activeMoves.map((moveObj, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => sendAction('move', idx + 1)}
                      disabled={moveObj.disabled}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white p-2 rounded font-bold transition text-sm"
                    >
                      {moveObj.move}
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 text-center text-gray-500">기술 대기 중...</div>
                )}
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <h3 className="text-lg font-bold mb-2">Team (Switch)</h3>
              <div className="flex flex-col gap-2">
                {myTeam.map((pokemon, idx) => {
                  const name = pokemon.details.split(',')[0];
                  const isDead = pokemon.condition === '0 fnt';
                  return (
                    <button 
                      key={idx} 
                      onClick={() => sendAction('switch', idx + 1)} 
                      disabled={pokemon.active || isDead}
                      className={`p-2 rounded font-bold transition flex justify-between ${pokemon.active ? 'bg-green-600 text-white' : isDead ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                      <span>{name}</span>
                      <span>{pokemon.condition}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}