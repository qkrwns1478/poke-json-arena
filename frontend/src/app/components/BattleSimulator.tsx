"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

import { TeamEntryManager } from "./TeamEntryManager";
import { Pokemon } from "@/app/utils/JsonParser";
import parseBattleLog from "@/app/utils/BattleLogParser";
import { scTranslator, getSCKorean } from "@/app/utils/StatusCondition";
import { trEngToKor, trEngToKeb } from "@/app/utils/Translator";
import SAMPLE_TEAMS from "@/data/SampleTeams";
import "@/assets/sprites/spritesheet-2H5N5RW5.css";

let socket: Socket;

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
interface BattleSimulatorProps {
  playerTeam?: Pokemon[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "brn":
      return "bg-red-500";
    case "par":
      return "bg-yellow-500 text-black";
    case "psn":
    case "tox":
      return "bg-purple-500";
    case "slp":
      return "bg-gray-400";
    case "frz":
      return "bg-blue-300 text-black";
    default:
      return "bg-gray-500";
  }
};

const HpBar = ({ condition }: { condition: string }) => {
  if (!condition || condition === "0 fnt")
    return (
      <div className="w-full mt-1">
        <div className="h-2.5 w-full bg-gray-700 rounded-full overflow-hidden border border-gray-900"></div>
        <div className="text-xs text-right mt-1 font-mono text-gray-500">0 / 0</div>
      </div>
    );
  const statusMatch = condition.match(/\b(brn|par|psn|tox|slp|frz)\b/);
  const status = statusMatch ? statusMatch[1] : null;
  const hpMatch = condition.match(/(\d+)\/(\d+)/);
  if (!hpMatch) {
    const pctMatch = condition.match(/(\d+)\/100/);
    if (pctMatch) {
      const p = parseInt(pctMatch[1]);
      const color = p > 50 ? "bg-green-500" : p > 20 ? "bg-yellow-500" : "bg-red-500";
      return (
        <div className="w-full mt-1">
          <div className="h-2.5 w-full bg-gray-700 rounded-full overflow-hidden border border-gray-900">
            <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${p}%` }}></div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <div>
              {status && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-white ${getStatusColor(status)}`}
                >
                  {getSCKorean(status)}
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-gray-300">{p}%</div>
          </div>
        </div>
      );
    }
    return null;
  }
  const current = parseInt(hpMatch[1]),
    max = parseInt(hpMatch[2]);
  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  const color = percent > 50 ? "bg-green-500" : percent > 20 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full mt-1">
      <div className="h-2.5 w-full bg-gray-700 rounded-full overflow-hidden border border-gray-900">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${percent}%` }}></div>
      </div>
      <div className="flex justify-between items-center mt-1">
        <div>
          {status && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-white ${getStatusColor(status)}`}
            >
              {getSCKorean(status)}
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-gray-300">
          {current} / {max}
        </div>
      </div>
    </div>
  );
};

export default function BattleSimulator({ playerTeam }: BattleSimulatorProps) {
  const [userId, setUserId] = useState<string>("");
  const [phase, setPhase] = useState<"lobby" | "waiting" | "battle">("lobby");
  const [teamString, setTeamString] = useState<string>("");
  const [customTeam, setCustomTeam] = useState<Pokemon[] | null>(null);

  const [logs, setLogs] = useState<string[]>([]);
  const [myTeam, setMyTeam] = useState<PokemonStatus[]>([]);
  const [activeMoves, setActiveMoves] = useState<MoveData[]>([]);
  const [isTeamPreview, setIsTeamPreview] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null);

  const [oppTeam, setOppTeam] = useState<OppPokemon[]>([]);
  const [oppActive, setOppActive] = useState<OppPokemon | null>(null);

  const [weather, setWeather] = useState<string | null>(null);
  const [fieldConditions, setFieldConditions] = useState<string[]>([]);
  const [mySideConditions, setMySideConditions] = useState<string[]>([]);
  const [oppSideConditions, setOppSideConditions] = useState<string[]>([]);

  const [selectedAction, setSelectedAction] = useState<{ type: string; index: number } | null>(null);

  const [canMegaEvo, setCanMegaEvo] = useState(false);
  const [canZMove, setCanZMove] = useState(false);
  const [zMoves, setZMoves] = useState<{ move: string; target?: string }[] | null>(null);

  const [isMegaChecked, setIsMegaChecked] = useState(false);
  const [isZMoveChecked, setIsZMoveChecked] = useState(false);

  const [hasUsedMega, setHasUsedMega] = useState(false);
  const [hasUsedZMove, setHasUsedZMove] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const mySideIdRef = useRef<string>("");

  useEffect(() => {
    const id = uuidv4();
    setUserId(id);
    socket = io("http://localhost:3001");

    socket.on("match-found", () => setPhase("battle"));

    socket.on("log", (message: string) => {
      if (!message.includes("[시스템]")) setLogs((prev) => [...prev, message]);
    });

    socket.on("battle-log", (chunk: string) => {
      const lines = chunk.split("\n");
      const newLogs: string[] = [];

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith("|win|")) setWinner(trimmed.split("|")[2]);
        else if (trimmed === "|tie") setWinner("Draw");

        if (trimmed.startsWith("|teampreview")) {
          setIsTeamPreview(true);
        } else if (trimmed.startsWith("|start") || trimmed.startsWith("|turn|")) {
          setIsTeamPreview(false);
        }

        if (trimmed.startsWith("|-weather|")) {
          const w = trimmed.split("|")[2];
          if (w === "none") setWeather(null);
          else if (w !== "upkeep") setWeather(w);
        } else if (trimmed.startsWith("|-fieldstart|")) {
          const f = trimmed.split("|")[2].replace("move: ", "");
          setFieldConditions((prev) => [...new Set([...prev, f])]);
        } else if (trimmed.startsWith("|-fieldend|")) {
          const f = trimmed.split("|")[2].replace("move: ", "");
          setFieldConditions((prev) => prev.filter((c) => c !== f));
        } else if (trimmed.startsWith("|-sidestart|")) {
          const p = trimmed.split("|");
          const side = p[2].split(":")[0];
          const condition = p[3].replace("move: ", "");
          if (mySideIdRef.current && side === mySideIdRef.current)
            setMySideConditions((prev) => [...new Set([...prev, condition])]);
          else setOppSideConditions((prev) => [...new Set([...prev, condition])]);
        } else if (trimmed.startsWith("|-sideend|")) {
          const p = trimmed.split("|");
          const side = p[2].split(":")[0];
          const condition = p[3].replace("move: ", "");
          if (mySideIdRef.current && side === mySideIdRef.current)
            setMySideConditions((prev) => prev.filter((c) => c !== condition));
          else setOppSideConditions((prev) => prev.filter((c) => c !== condition));
        }

        if (trimmed.startsWith("|request|")) {
          try {
            const requestJson = JSON.parse(trimmed.slice(9));
            if (requestJson && requestJson.side) {
              mySideIdRef.current = requestJson.side.id;
              if (requestJson.side.pokemon) setMyTeam(requestJson.side.pokemon);
            }
            if (requestJson && requestJson.active && requestJson.active[0]) {
              setActiveMoves(requestJson.active[0].moves || []);
              setCanMegaEvo(!!requestJson.active[0].canMegaEvo);

              if (requestJson.active[0].canZMove) {
                setCanZMove(true);
                setZMoves(requestJson.active[0].canZMove);
              } else {
                setCanZMove(false);
                setZMoves(null);
              }
            } else {
              setActiveMoves([]);
              setCanMegaEvo(false);
              setCanZMove(false);
              setZMoves(null);
            }

            if (!requestJson.wait) {
              setSelectedAction(null);
              setIsMegaChecked(false);
              setIsZMoveChecked(false);
            }
          } catch (e) {
            console.error("Parse error", e);
          }
        } else if (trimmed.startsWith("|switch|") || trimmed.startsWith("|drag|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const details = parts[3];
          const condition = parts[4];
          const name = details.split(",")[0];
          const isFainted = condition === "0 fnt";
          if (mySideIdRef.current && !ident.startsWith(mySideIdRef.current)) {
            setOppActive({ ident, name, details, condition, revealed: true, fainted: isFainted });
            setOppTeam((prev) => {
              const newTeam = [...prev];
              const existingIdx = newTeam.findIndex((p) => p.name === name);
              if (existingIdx >= 0) newTeam[existingIdx] = { ...newTeam[existingIdx], condition, fainted: isFainted };
              else if (newTeam.length < 6)
                newTeam.push({ ident, name, details, condition, revealed: true, fainted: isFainted });
              return newTeam;
            });
          }
        } else if (trimmed.startsWith("|detailschange|") || trimmed.startsWith("|-formechange|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const details = parts[3];
          const name = details.split(",")[0];

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              setOppActive((prev) => (prev && prev.ident === ident ? { ...prev, details, name } : prev));
              setOppTeam((prev) => {
                const newTeam = [...prev];
                const existingIdx = newTeam.findIndex((p) => p.ident === ident);
                if (existingIdx >= 0) newTeam[existingIdx] = { ...newTeam[existingIdx], details, name };
                return newTeam;
              });
            } else {
              setMyTeam((prev) =>
                prev.map((p) => {
                  const reqName = p.ident.substring(p.ident.indexOf(":") + 1).trim();
                  const logName = ident.substring(ident.indexOf(":") + 1).trim();
                  if (logName.startsWith(reqName) || reqName.startsWith(logName)) {
                    return { ...p, details };
                  }
                  return p;
                }),
              );
            }
          }
        } else if (trimmed.startsWith("|-mega|")) {
          const ident = trimmed.split("|")[2];
          if (mySideIdRef.current && ident.startsWith(mySideIdRef.current)) {
            setHasUsedMega(true);
          }
        } else if (trimmed.startsWith("|-zpower|") || trimmed.startsWith("|-zburst|")) {
          const ident = trimmed.split("|")[2];
          if (mySideIdRef.current && ident.startsWith(mySideIdRef.current)) {
            setHasUsedZMove(true);
          }
        } else if (trimmed.startsWith("|-damage|") || trimmed.startsWith("|-heal|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const condition = parts[3];
          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              setOppActive((prev) => (prev && prev.ident === ident ? { ...prev, condition } : prev));
              setOppTeam((prev) => {
                const newTeam = [...prev];
                const existingIdx = newTeam.findIndex((p) => p.ident === ident);
                if (existingIdx >= 0)
                  newTeam[existingIdx] = { ...newTeam[existingIdx], condition, fainted: condition === "0 fnt" };
                return newTeam;
              });
            } else {
              setMyTeam((prev) =>
                prev.map((p) => {
                  const reqName = p.ident.substring(p.ident.indexOf(":") + 1).trim();
                  const logName = ident.substring(ident.indexOf(":") + 1).trim();
                  const isMatch = logName.startsWith(reqName) || reqName.startsWith(logName);
                  return isMatch ? { ...p, condition } : p;
                }),
              );
            }
          }
        } else if (trimmed.startsWith("|faint|")) {
          const ident = trimmed.split("|")[2];
          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              setOppActive((prev) =>
                prev && prev.ident === ident ? { ...prev, condition: "0 fnt", fainted: true } : prev,
              );
              setOppTeam((prev) => {
                const newTeam = [...prev];
                const existingIdx = newTeam.findIndex((p) => p.ident === ident);
                if (existingIdx >= 0)
                  newTeam[existingIdx] = { ...newTeam[existingIdx], condition: "0 fnt", fainted: true };
                return newTeam;
              });
            } else {
              setMyTeam((prev) =>
                prev.map((p) => {
                  const reqName = p.ident.substring(p.ident.indexOf(":") + 1).trim();
                  const logName = ident.substring(ident.indexOf(":") + 1).trim();
                  const isMatch = logName.startsWith(reqName) || reqName.startsWith(logName);
                  return isMatch ? { ...p, condition: "0 fnt" } : p;
                }),
              );
            }
          }
        }

        if (!trimmed.startsWith("|request|")) {
          const finalBattleLog = parseBattleLog(trimmed);
          if (finalBattleLog) newLogs.push(finalBattleLog);
        }
      });

      if (newLogs.length > 0) setLogs((prev) => [...prev, ...newLogs]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), [logs]);

  const searchMatch = () => {
    if (!teamString.trim()) return alert("팀 데이터를 입력해주세요!");
    socket.emit("search-match", teamString);
    setPhase("waiting");
  };

  const sendAction = (type: "move" | "switch" | "team", index: number) => {
    if (!socket || winner) return;

    let actionCommand = `${type} ${index}`;
    if (type === "move") {
      if (isMegaChecked) actionCommand += " mega";
      if (isZMoveChecked) actionCommand += " zmove";
    }

    socket.emit("action", actionCommand);
    setSelectedAction({ type, index });
  };

  const returnToLobby = () => {
    setPhase("lobby");
    setWinner(null);
    setLogs([]);
    setMyTeam([]);
    setActiveMoves([]);
    setIsTeamPreview(false);
    setOppTeam([]);
    setOppActive(null);
    mySideIdRef.current = "";
    setWeather(null);
    setFieldConditions([]);
    setMySideConditions([]);
    setOppSideConditions([]);
    setSelectedAction(null);
    setCanMegaEvo(false);
    setCanZMove(false);
    setZMoves(null);
    setIsMegaChecked(false);
    setIsZMoveChecked(false);
    setHasUsedMega(false);
    setHasUsedZMove(false);
  };

  const activePokemon = myTeam.find((p) => p.active);

  if (phase === "lobby" || phase === "waiting") {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 w-full max-w-4xl">
          <h1 className="text-3xl font-bold mb-6 text-center text-yellow-400">Poke JSON Arena</h1>

          {phase === "lobby" && (
            <div className="mb-6">
              {!customTeam ? (
                <TeamEntryManager
                  onTeamConfirm={(selectedTeam) => {
                    const customTeamString = selectedTeam.map((p) => p.PSformat).join("\n\n");
                    setTeamString(customTeamString);
                    setCustomTeam(selectedTeam);
                  }}
                />
              ) : (
                <div className="bg-gray-800 p-4 border border-blue-500 rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-blue-400">✔️ 현재 출전 대기 중인 커스텀 팀</h3>
                    <button
                      onClick={() => {
                        setCustomTeam(null);
                        setTeamString("");
                      }}
                      className="text-sm bg-red-600 hover:bg-red-700 px-3 py-1 rounded transition text-white"
                    >
                      팀 해제 / 다시 업로드
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {customTeam.map((p, idx) => (
                      <span
                        key={idx}
                        className="bg-blue-900 text-blue-200 px-3 py-1 rounded-full text-sm font-semibold"
                      >
                        {p.nickname || p.species_kor}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <h2 className="text-xl font-bold mb-2">팀 빌더</h2>
            <textarea
              value={teamString}
              onChange={(e) => setTeamString(e.target.value)}
              className="w-full h-64 bg-black text-green-400 p-4 rounded font-mono text-sm border border-gray-600 focus:outline-none focus:border-yellow-400"
              disabled={phase === "waiting"}
            />
          </div>
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setTeamString(SAMPLE_TEAMS.team1)}
              disabled={phase === "waiting"}
              className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded font-bold transition"
            >
              샘플 팀 1 불러오기
            </button>
            <button
              onClick={() => setTeamString(SAMPLE_TEAMS.team2)}
              disabled={phase === "waiting"}
              className="flex-1 bg-gray-700 hover:bg-gray-600 p-3 rounded font-bold transition"
            >
              샘플 팀 2 불러오기
            </button>
          </div>
          {phase === "lobby" ? (
            <button
              onClick={searchMatch}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded text-xl transition"
            >
              게임 시작
            </button>
          ) : (
            <div className="w-full bg-yellow-600 text-white font-bold py-4 rounded text-xl text-center animate-pulse">
              상대를 찾는 중...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col md:flex-row gap-8">
      <div className="flex-1 flex flex-col h-[80vh] min-h-0 gap-4">
        {(weather || fieldConditions.length > 0) && (
          <div className="flex gap-3 bg-gray-800 p-2 border border-gray-700 rounded shadow-md shrink-0">
            {weather && (
              <span className="px-3 py-1 bg-yellow-600/30 text-yellow-300 font-semibold text-sm rounded border border-yellow-600/50">
                ☀️ {weather}
              </span>
            )}
            {fieldConditions.map((fc, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-green-600/30 text-green-300 font-semibold text-sm rounded border border-green-600/50"
              >
                🌿 {fc}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 shrink-0">
          <div className="flex-1 bg-gray-800 p-4 border border-gray-700 rounded relative shadow-lg">
            <div className="text-xs text-red-400 mb-2 font-bold tracking-wider flex justify-between">
              <span>OPPONENT</span>
            </div>
            {!isTeamPreview && oppActive ? (
              <div className="flex items-center gap-4 bg-gray-900 p-3 rounded border border-gray-700">
                <div className={`sprite-${oppActive.name.toLowerCase().replace(" ", "-")}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-200">{trEngToKor(oppActive.name)}</div>
                  <HpBar condition={oppActive.condition} />
                  {oppSideConditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {oppSideConditions.map((c, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-red-900/50 border border-red-500 text-red-200 px-1.5 py-0.5 rounded"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-gray-500 italic h-[76px] flex items-center justify-center bg-gray-900 rounded border border-gray-700">
                {isTeamPreview ? "선봉 대기 중..." : "대기 중..."}
              </div>
            )}
          </div>

          <div className="flex-1 bg-gray-800 p-4 border border-gray-700 rounded relative shadow-lg">
            <div className="text-xs text-blue-400 mb-2 font-bold tracking-wider">MY ACTIVE</div>
            {!isTeamPreview && activePokemon ? (
              <div className="flex items-center gap-4 bg-gray-900 p-3 rounded border border-blue-900/50">
                <div className={`sprite-${activePokemon.details.split(",")[0].toLowerCase().replace(" ", "-")}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-yellow-400">{trEngToKor(activePokemon.details.split(",")[0])}</div>
                  <HpBar condition={activePokemon.condition} />
                  {mySideConditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mySideConditions.map((c, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-blue-900/50 border border-blue-500 text-blue-200 px-1.5 py-0.5 rounded"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-yellow-400 font-bold animate-pulse h-[76px] flex items-center justify-center bg-gray-900 rounded border border-gray-700">
                {isTeamPreview ? "선봉으로 출전할 포켓몬을 선택하세요!" : "대기 중..."}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col border border-gray-700 rounded bg-gray-800 p-4 min-h-0 shadow-lg">
          <h2 className="text-lg font-bold mb-2 shrink-0">배틀 로그</h2>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm font-sans bg-black p-4 rounded whitespace-pre-wrap">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`
                ${log.startsWith("===") ? "text-yellow-400 font-bold mt-4 mb-2" : ""}
                ${log.includes("효과가 굉장했다") ? "text-red-400 font-bold" : ""}
                ${log.includes("쓰러졌다") ? "text-gray-500 line-through" : "text-gray-200"}
              `}
              >
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      <div className="w-full md:w-[22rem] flex flex-col gap-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
        <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-lg shrink-0">
          <h3 className="text-[15px] font-bold mb-3 text-red-400 flex justify-between items-center">
            상대방 파티
            <span className="text-xs text-gray-500 font-normal">발견됨: {oppTeam.length}/6</span>
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const pkmn = oppTeam[i];
              if (!pkmn)
                return (
                  <div
                    key={i}
                    className="bg-gray-900 border border-gray-700 h-14 rounded flex items-center justify-center font-bold text-gray-600 shadow-inner"
                  >
                    <div className="sprite-unknown scale-75 transform"></div>
                  </div>
                );
              const nameLower = pkmn.name.toLowerCase().replace(" ", "-");
              return (
                <div
                  key={i}
                  className={`bg-gray-900 border border-gray-700 h-14 rounded flex items-center justify-center shadow-inner relative overflow-hidden ${pkmn.fainted ? "grayscale opacity-40" : ""}`}
                >
                  <div className={`sprite-${nameLower} scale-75 transform`}></div>
                </div>
              );
            })}
          </div>
        </div>

        {!isTeamPreview && activePokemon && (
          <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-lg shrink-0">
            <h3 className="text-[15px] font-bold mb-3 text-blue-400">내 포켓몬 정보</h3>
            <div className="bg-gray-900 p-3 rounded border border-gray-700 text-sm space-y-2">
              <div className="flex justify-between items-center pb-1 border-b border-gray-800">
                <span className="text-gray-400">지닌 물건</span>
                <div className="flex items-center gap-1.5">
                  {activePokemon.item ? (
                    <>
                      <span className={`inline-block sprite-${trEngToKeb(activePokemon.item)} scale-75 origin-left`} />
                      <span className="font-bold text-yellow-100">{trEngToKor(activePokemon.item, "ITEMS")}</span>
                    </>
                  ) : (
                    <span className="font-bold text-yellow-100">-</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center pb-1 border-b border-gray-800">
                <span className="text-gray-400">특성</span>
                <span className="font-bold text-green-300">
                  {activePokemon.baseAbility ? trEngToKor(activePokemon.baseAbility, "ABILITY") : "-"}
                </span>
              </div>
              {activePokemon.stats && (
                <div className="pt-1">
                  <div className="text-gray-500 mb-1 text-[11px] tracking-wide">실능치 (상태/랭크 미적용)</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-red-400/80">A</span> <span>{activePokemon.stats.atk}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400/80">C</span> <span>{activePokemon.stats.spa}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-400/80">B</span> <span>{activePokemon.stats.def}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-400/80">D</span> <span>{activePokemon.stats.spd}</span>
                    </div>
                    <div className="flex justify-between col-span-2 border-t border-gray-800 mt-0.5 pt-0.5">
                      <span className="text-pink-400/80">S</span> <span>{activePokemon.stats.spe}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {winner ? (
          <div className="bg-gray-800 p-6 rounded border border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] text-center flex flex-col gap-6 mt-auto">
            <h3 className="text-3xl font-bold text-yellow-400">{winner === "Draw" ? "무승부!" : `${winner} 승리!`}</h3>
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
              {myTeam.map((pokemon, idx) => {
                const isSelected = selectedAction?.type === "team" && selectedAction?.index === idx + 1;
                return (
                  <button
                    key={idx}
                    onClick={() => sendAction("team", idx + 1)}
                    disabled={!!selectedAction}
                    className={`p-3 rounded font-bold transition flex justify-between
                      ${isSelected ? "bg-yellow-600 text-white ring-2 ring-white" : "bg-purple-600 hover:bg-purple-700 text-white"}
                      ${selectedAction && !isSelected ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    <span>{trEngToKor(pokemon.details.split(",")[0])}</span>
                    <span className="text-sm opacity-80">{isSelected ? "선택됨..." : "선봉 출전"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[15px] font-bold text-yellow-400">기술</h3>
                <div className="flex gap-2">
                  {canMegaEvo && !hasUsedMega && !hasUsedZMove && (
                    <label
                      className={`text-xs flex items-center gap-1 cursor-pointer px-2 py-1 rounded transition ${isMegaChecked ? "bg-purple-600 text-white font-bold ring-1 ring-purple-400" : "bg-gray-700 hover:bg-gray-600"}`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isMegaChecked}
                        onChange={(e) => setIsMegaChecked(e.target.checked)}
                        disabled={!!selectedAction}
                      />
                      <span className="sprite-icon-mega" />메가진화
                    </label>
                  )}
                  {canZMove && !hasUsedMega && !hasUsedZMove && (
                    <label
                      className={`text-xs flex items-center gap-1 cursor-pointer px-2 py-1 rounded transition ${isZMoveChecked ? "bg-orange-500 text-white font-bold ring-1 ring-orange-300" : "bg-gray-700 hover:bg-gray-600"}`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isZMoveChecked}
                        onChange={(e) => setIsZMoveChecked(e.target.checked)}
                        disabled={!!selectedAction}
                      />
                      <span className="sprite-icon-zmove" />Z기술
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {activeMoves.length > 0 ? (
                  activeMoves.map((moveObj, idx) => {
                    const isSelected = selectedAction?.type === "move" && selectedAction?.index === idx + 1;

                    const zMoveOption = zMoves ? zMoves[idx] : null;
                    const isZMoveAvailableForThisSlot = !!zMoveOption;

                    const isDisabled =
                      moveObj.disabled || !!selectedAction || (isZMoveChecked && !isZMoveAvailableForThisSlot);

                    let displayName = trEngToKor(moveObj.move, "MOVES");
                    let btnBgClass = isSelected
                      ? "bg-yellow-600 text-white ring-2 ring-white"
                      : "bg-red-600 hover:bg-red-700 text-white";

                    if (isZMoveChecked && isZMoveAvailableForThisSlot) {
                      displayName = trEngToKor(zMoveOption.move, "MOVES");
                      if (!isSelected) {
                        btnBgClass =
                          "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_10px_rgba(249,115,22,0.5)] border border-orange-300";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => sendAction("move", idx + 1)}
                        disabled={isDisabled}
                        className={`p-3 rounded font-bold transition text-sm shadow-md flex justify-center items-center relative
                          ${btnBgClass}
                          ${isDisabled || (selectedAction && !isSelected) ? "opacity-50 cursor-not-allowed !bg-gray-600 border-none shadow-none" : ""}
                        `}
                      >
                        <span className={isSelected ? "opacity-30" : ""}>{displayName}</span>
                        {isSelected && (
                          <span className="absolute inset-0 flex items-center justify-center font-black drop-shadow-md">
                            대기 중
                          </span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center text-gray-500 bg-gray-900 p-3 rounded border border-gray-700 italic">
                    기술 대기 중...
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded border border-gray-700 flex-1">
              <h3 className="text-[15px] font-bold mb-3 text-green-400">교체</h3>
              <div className="flex flex-col gap-2">
                {myTeam.map((pokemon, idx) => {
                  const name = pokemon.details.split(",")[0];
                  const nameLowerCase = name.toLowerCase().replace(" ", "-");
                  const isDead = pokemon.condition === "0 fnt";
                  const isSelected = selectedAction?.type === "switch" && selectedAction?.index === idx + 1;

                  return (
                    <button
                      key={idx}
                      onClick={() => sendAction("switch", idx + 1)}
                      disabled={pokemon.active || isDead || !!selectedAction}
                      className={`p-2 rounded font-bold transition flex flex-col justify-center border shadow-sm relative overflow-hidden
                        ${
                          isSelected
                            ? "bg-yellow-600 border-yellow-400 text-white ring-2 ring-white"
                            : pokemon.active
                              ? "bg-green-700/50 border-green-500 text-white cursor-default"
                              : isDead
                                ? "bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed opacity-60"
                                : "bg-blue-600/80 border-blue-500 hover:bg-blue-600 text-white"
                        }
                        ${selectedAction && !isSelected ? "opacity-50 cursor-not-allowed" : ""}
                      `}
                    >
                      <div className={`flex justify-between items-center w-full ${isSelected ? "opacity-30" : ""}`}>
                        <div className="flex gap-2 items-center">
                          <span className={`inline-block sprite-${nameLowerCase} scale-75 origin-left`}></span>
                          <span className="text-sm">{trEngToKor(name)}</span>
                        </div>
                        <span className="text-xs font-mono">{scTranslator(pokemon.condition)}</span>
                      </div>
                      <div className={`w-full px-1 ${isSelected ? "opacity-30" : ""}`}>
                        <HpBar condition={pokemon.condition} />
                      </div>
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center font-black drop-shadow-md z-10 text-lg">
                          대기 중
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
