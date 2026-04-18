'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

import parseBattleLog from '@/app/utils/BattleLogParser';
import scTranslator from '@/app/utils/StatusCondition';
import translator from '@/app/utils/Translator';
import SAMPLE_TEAMS from '@/data/SampleTeams';
import '@/assets/sprites/spritesheet-2H5N5RW5.css';

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

export default function BattleSimulator() {
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
          const finalBattleLog = parseBattleLog(trimmed);
          if (finalBattleLog) {
            newLogs.push(finalBattleLog);
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
            <button onClick={() => setTeamString(SAMPLE_TEAMS.team1)} disabled={phase === 'waiting'} className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded font-bold transition">Sample Team 1</button>
            <button onClick={() => setTeamString(SAMPLE_TEAMS.team2)} disabled={phase === 'waiting'} className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded font-bold transition">Sample Team 2</button>
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
          {!isTeamPreview && activePokemon ? (
            <div className="flex items-center gap-4 bg-black p-4 rounded border border-gray-600">
              <div className="text-lg font-bold text-yellow-400">{translator(activePokemon.details.split(',')[0])}</div>
              <div className="text-2xl font-mono">HP: {scTranslator(activePokemon.condition)}</div>
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
            <button 
              onClick={returnToLobby} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded text-xl transition shadow-lg"
            >
              로비로 돌아가기
            </button>
          </div>
        ) : isTeamPreview ? (
          <div className="bg-gray-800 p-4 rounded border border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
            <h3 className="text-xl font-bold mb-4 text-yellow-400 text-center">선봉 선택</h3>
            <div className="flex flex-col gap-2">
              {myTeam.map((pokemon, idx) => (
                <button 
                  key={idx} 
                  onClick={() => sendAction('team', idx + 1)}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded font-bold transition flex justify-between"
                >
                  <span>{translator(pokemon.details.split(',')[0])}</span>
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
                      {translator(moveObj.move, false)}
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
                  const nameLowerCase = name.toLowerCase();
                  const isDead = pokemon.condition === '0 fnt';
                  return (
                    <button 
                      key={idx} 
                      onClick={() => sendAction('switch', idx + 1)} 
                      disabled={pokemon.active || isDead}
                      className={`p-2 rounded font-bold transition flex items-center justify-between ${pokemon.active ? 'bg-green-600 text-white' : isDead ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                      <div className="flex gap-2">
                        <span className={`inline-block sprite-${nameLowerCase}`}></span>
                        <span>{translator(name)}</span>
                      </div>
                      <span>{scTranslator(pokemon.condition)}</span>
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