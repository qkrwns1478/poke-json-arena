"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

import parseBattleLog from "@/app/utils/BattleLogParser";
import { RoomData, AvailableRoom, PokemonStatus, OppPokemon, MoveData, RoomSettings } from "@/app/types/battle";
import ChatInterface from "./ChatInterface";
import LobbyPhase from "./phases/LobbyPhase";
import RoomPhase from "./phases/RoomPhase";
import SelectionPhase from "./phases/SelectionPhase";
import BattlePhase from "./phases/BattlePhase";

export default function GameManager() {
  const [phase, setPhase] = useState<"lobby" | "room" | "selection" | "battle">("lobby");

  // Revert State
  const [revertRequest, setRevertRequest] = useState<boolean>(false);
  const [isWaitingRevert, setIsWaitingRevert] = useState<boolean>(false);
  const [revertToast, setRevertToast] = useState<string | null>(null);

  // Room State
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const roomDataRef = useRef<RoomData | null>(null);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);

  // Selection State
  const [myFullTeam, setMyFullTeam] = useState<string[]>([]);
  const [oppFullTeam, setOppFullTeam] = useState<string[]>([]);
  const [mySelection, setMySelection] = useState<number[]>([]);

  // Battle State
  const [logs, setLogs] = useState<string[]>([]);
  const [myTeam, setMyTeam] = useState<PokemonStatus[]>([]);
  const [activeMoves, setActiveMoves] = useState<MoveData[]>([]);
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

  const mySideIdRef = useRef<string>("");

  const socket = useRef<Socket | null>(null);

  useEffect(() => {
    socket.current = io(process.env.NEXT_PUBLIC_SOCKET_URL);

    socket.current.on("room-update", (data: RoomData) => {
      setRoomData(data);
      roomDataRef.current = data;

      setPhase((prevPhase) => {
        if (data.status === "room") {
          if (prevPhase === "battle") {
            setTimeout(() => setWinner((prev) => prev || "Disconnect"), 0);
            return "battle";
          }
          if (prevPhase === "selection") {
            setMySelection([]);
            resetBattleState();
            return "room";
          }
          return "room";
        }
        return prevPhase;
      });
    });

    socket.current.on("room-list-update", (rooms: AvailableRoom[]) => setAvailableRooms(rooms));

    socket.current.on("selection-start", (data: { myTeam: string[]; oppTeam: string[] }) => {
      setMyFullTeam(data.myTeam);
      setOppFullTeam(data.oppTeam);
      setPhase("selection");
    });

    socket.current.on("match-found", (data: { sideId: string }) => {
      if (data && data.sideId) {
        mySideIdRef.current = data.sideId;
      }
      setPhase("battle");
    });

    socket.current.on("log", (message: string) => {
      if (!message.includes("[시스템]")) setLogs((prev) => [...prev, message]);
      else console.log(message);
    });

    socket.current.on("battle-log", (chunk: string) => {
      const lines = chunk.split("\n");
      const newLogs: string[] = [];

      const getIdentName = (identStr: string) => identStr.substring(identStr.indexOf(":") + 1).trim();

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith("|win|")) setWinner(trimmed.split("|")[2]);
        else if (trimmed === "|tie") setWinner("Draw");

        if (trimmed.startsWith("|-weather|")) {
          const w = trimmed.split("|")[2];
          setWeather((prev) => (w === "none" ? null : w !== "upkeep" ? w : prev));
        } else if (trimmed.startsWith("|-fieldstart|")) {
          setFieldConditions((prev) => [...new Set([...prev, trimmed.split("|")[2].replace("move: ", "")])]);
        } else if (trimmed.startsWith("|-fieldend|")) {
          setFieldConditions((prev) => prev.filter((c) => c !== trimmed.split("|")[2].replace("move: ", "")));
        } else if (trimmed.startsWith("|-sidestart|")) {
          const p = trimmed.split("|");
          if (mySideIdRef.current && p[2].split(":")[0] === mySideIdRef.current)
            setMySideConditions((prev) => [...new Set([...prev, p[3].replace("move: ", "")])]);
          else setOppSideConditions((prev) => [...new Set([...prev, p[3].replace("move: ", "")])]);
        } else if (trimmed.startsWith("|-sideend|")) {
          const p = trimmed.split("|");
          if (mySideIdRef.current && p[2].split(":")[0] === mySideIdRef.current)
            setMySideConditions((prev) => prev.filter((c) => c !== p[3].replace("move: ", "")));
          else setOppSideConditions((prev) => prev.filter((c) => c !== p[3].replace("move: ", "")));
        }

        if (trimmed.startsWith("|request|")) {
          try {
            const requestJson = JSON.parse(trimmed.slice(9));
            if (requestJson?.side) {
              mySideIdRef.current = requestJson.side.id;
              if (requestJson.side.pokemon) {
                setMyTeam((prev) =>
                  requestJson.side.pokemon.map((newPkmn: any) => {
                    const newName = getIdentName(newPkmn.ident || "");
                    const existing = prev.find((p) => {
                      const prevName = getIdentName(p.ident || "");
                      return prevName.startsWith(newName) || newName.startsWith(prevName);
                    });

                    return {
                      ...newPkmn,
                      boosts: existing?.boosts || {},
                      multipliers: existing?.multipliers || {},
                    };
                  }),
                );
              }
            }
            if (requestJson?.active?.[0]) {
              setActiveMoves(requestJson.active[0].moves || []);
              setCanMegaEvo(!!requestJson.active[0].canMegaEvo && (roomDataRef.current?.settings?.allowMega ?? true));
              if (requestJson.active[0].canZMove && (roomDataRef.current?.settings?.allowZMove ?? true)) {
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
        } else if (trimmed.startsWith("|switch|") || trimmed.startsWith("|drag|") || trimmed.startsWith("|replace|")) {
          const [, , ident, details, condition] = trimmed.split("|");
          const name = details.split(",")[0].trim();
          const logIdentName = getIdentName(ident);

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              // 1. 상대 현재 포켓몬 강제 덮어쓰기 보장
              setOppActive((prev) => ({
                ...prev,
                ident,
                name,
                details,
                condition,
                revealed: true,
                fainted: condition.includes("fnt"),
              }));

              // 2. 상대 파티(Roster)에 강제 추가 보장
              setOppTeam((prev) => {
                const newTeam = [...prev];
                const idx = newTeam.findIndex((p) => getIdentName(p.ident || "") === logIdentName || p.name === name);

                if (idx >= 0) {
                  // 기존 포켓몬 갱신
                  newTeam[idx] = { ...newTeam[idx], ident, condition, fainted: condition.includes("fnt"), boosts: {} };
                } else {
                  // length 검사를 제거하여 튕기는 현상 없이 무조건 추가되도록 보장
                  newTeam.push({
                    ident,
                    name,
                    details,
                    condition,
                    revealed: true,
                    fainted: condition.includes("fnt"),
                    boosts: {},
                  });
                }
                return newTeam;
              });
            } else {
              setMyTeam((prev) =>
                prev.map((p) => {
                  const reqName = getIdentName(p.ident);
                  const isActive = logIdentName.startsWith(reqName) || reqName.startsWith(logIdentName);
                  return {
                    ...p,
                    active: isActive,
                    condition: isActive ? condition : p.condition,
                    boosts: isActive ? {} : p.boosts,
                  };
                }),
              );
            }
          }
        } else if (trimmed.startsWith("|-mega|")) {
          if (
            mySideIdRef.current &&
            trimmed.split("|")[2].startsWith(mySideIdRef.current) &&
            !roomDataRef.current?.settings?.noLimit
          )
            setHasUsedMega(true);
        } else if (trimmed.startsWith("|-zpower|") || trimmed.startsWith("|-zburst|")) {
          if (
            mySideIdRef.current &&
            trimmed.split("|")[2].startsWith(mySideIdRef.current) &&
            !roomDataRef.current?.settings?.noLimit
          )
            setHasUsedZMove(true);
        } else if (trimmed.startsWith("|detailschange|") || trimmed.startsWith("|-formechange|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const details = parts[3];
          const name = details.split(",")[0].trim();
          const logIdentName = getIdentName(ident);

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              setOppActive((prev) => {
                if (!prev) return prev;
                const prevIdentName = getIdentName(prev.ident);
                return logIdentName.startsWith(prevIdentName) || prevIdentName.startsWith(logIdentName)
                  ? { ...prev, ident, details, name }
                  : prev;
              });
              setOppTeam((prev) =>
                prev.map((p) => {
                  const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
                  return logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)
                    ? { ...p, ident, details, name }
                    : p;
                })
              );
            } else {
              setMyTeam((prev) =>
                prev.map((p) => {
                  const reqName = getIdentName(p.ident);
                  return logIdentName.startsWith(reqName) || reqName.startsWith(logIdentName)
                    ? { ...p, ident, details }
                    : p;
                })
              );
            }
          }
        } else if (
          trimmed.startsWith("|-damage|") ||
          trimmed.startsWith("|-heal|") ||
          trimmed.startsWith("|-sethp|") ||
          trimmed.startsWith("|faint|")
        ) {
          const parts = trimmed.split("|");
          const cmd = parts[1];
          const ident = parts[2];
          const condition = cmd === "faint" ? "0 fnt" : parts[3];
          const isFaint = cmd === "faint" || (condition?.includes("fnt") ?? false);
          const logIdentName = getIdentName(ident);

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              setOppActive((prev) => {
                if (!prev) return prev;
                const prevIdentName = getIdentName(prev.ident);
                return logIdentName.startsWith(prevIdentName) || prevIdentName.startsWith(logIdentName)
                  ? { ...prev, condition, fainted: isFaint }
                  : prev;
              });
              setOppTeam((prev) =>
                prev.map((p) => {
                  const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
                  return logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)
                    ? { ...p, condition, fainted: isFaint }
                    : p;
                }),
              );
            } else {
              setMyTeam((prev) =>
                prev.map((p) => {
                  const reqName = getIdentName(p.ident);
                  return logIdentName.startsWith(reqName) || reqName.startsWith(logIdentName) ? { ...p, condition } : p;
                }),
              );
            }
          }
        } else if (trimmed.startsWith("|-status|") || trimmed.startsWith("|-curestatus|")) {
          const parts = trimmed.split("|");
          const cmd = parts[1];
          const ident = parts[2];
          const statusStr = cmd === "-status" ? parts[3] : "";
          const logIdentName = getIdentName(ident);

          const updateCondition = (oldCond: string) => {
            if (!oldCond) return oldCond;
            const hpPart = oldCond.split(" ")[0];
            return statusStr ? `${hpPart} ${statusStr}` : hpPart;
          };

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              setOppActive((prev) => {
                if (!prev) return prev;
                const prevIdentName = getIdentName(prev.ident);
                return logIdentName.startsWith(prevIdentName) || prevIdentName.startsWith(logIdentName)
                  ? { ...prev, condition: updateCondition(prev.condition) }
                  : prev;
              });
              setOppTeam((prev) =>
                prev.map((p) => {
                  const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
                  return logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)
                    ? { ...p, condition: updateCondition(p.condition) }
                    : p;
                }),
              );
            } else {
              setMyTeam((prev) =>
                prev.map((p) => {
                  const reqName = getIdentName(p.ident);
                  return logIdentName.startsWith(reqName) || reqName.startsWith(logIdentName)
                    ? { ...p, condition: updateCondition(p.condition) }
                    : p;
                }),
              );
            }
          }
        } else if (trimmed.startsWith("|-boost|") || trimmed.startsWith("|-unboost|")) {
          const parts = trimmed.split("|");
          const cmd = parts[1]; // "-boost" 또는 "-unboost"
          const ident = parts[2];
          const stat = parts[3]; // atk, def, spa, spd, spe, evasion, accuracy
          const amount = parseInt(parts[4], 10) * (cmd === "-unboost" ? -1 : 1);
          const logIdentName = getIdentName(ident);

          const applyBoost = (prevTeam: any[]) =>
            prevTeam.map((p) => {
              const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
              if (logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)) {
                const currentBoosts = p.boosts || {};
                const currentStatBoost = currentBoosts[stat] || 0;
                return { ...p, boosts: { ...currentBoosts, [stat]: currentStatBoost + amount } };
              }
              return p;
            });

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) setOppTeam(applyBoost);
            else setMyTeam(applyBoost);
          }
        } else if (trimmed.startsWith("|-clearallboost|")) {
          // 흑안개 등 필드 전체 랭크업 초기화
          setMyTeam((prev) => prev.map((p) => ({ ...p, boosts: {} })));
          setOppTeam((prev) => prev.map((p) => ({ ...p, boosts: {} })));
        } else if (
          trimmed.startsWith("|-clearboost|") ||
          trimmed.startsWith("|-clearnegativeboost|") ||
          trimmed.startsWith("|-clearpositiveboost|")
        ) {
          const parts = trimmed.split("|");
          const cmd = parts[1];
          const ident = parts[2];
          const logIdentName = getIdentName(ident);

          const clearBoosts = (prevTeam: any[]) =>
            prevTeam.map((p) => {
              const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
              if (logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)) {
                if (cmd === "-clearboost") {
                  return { ...p, boosts: {} }; // 모든 랭크 초기화
                } else if (cmd === "-clearnegativeboost") {
                  const newBoosts: Record<string, number> = { ...p.boosts };
                  for (const key in newBoosts) {
                    if (newBoosts[key] < 0) newBoosts[key] = 0; // 하락한 랭크만 0으로
                  }
                  return { ...p, boosts: newBoosts };
                } else if (cmd === "-clearpositiveboost") {
                  const newBoosts: Record<string, number> = { ...p.boosts };
                  for (const key in newBoosts) {
                    if (newBoosts[key] > 0) newBoosts[key] = 0; // 상승한 랭크만 0으로
                  }
                  return { ...p, boosts: newBoosts };
                }
              }
              return p;
            });

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) setOppTeam(clearBoosts);
            else setMyTeam(clearBoosts);
          }
        }

        // 고대활성, 쿼크차지 등 능력치 배율 증가 시작
        else if (trimmed.startsWith("|-start|") || trimmed.startsWith("|-activate|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const effect = (parts[3] || "").toLowerCase();
          const logIdentName = getIdentName(ident);

          if (effect.includes("protosynthesis") || effect.includes("quarkdrive")) {
            // 효과 텍스트나 파라미터에서 스탯(atk, def, spa, spd, spe) 추출
            const statMatch =
              effect.match(/(atk|def|spa|spd|spe)/) || (parts[4] || "").toLowerCase().match(/(atk|def|spa|spd|spe)/);

            if (statMatch) {
              const stat = statMatch[1];
              const val = stat === "spe" ? 1.5 : 1.3;

              const applyMultiplier = (prevTeam: any[]) =>
                prevTeam.map((p) => {
                  const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
                  if (logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)) {
                    return { ...p, multipliers: { ...p.multipliers, [stat]: val } };
                  }
                  return p;
                });

              if (mySideIdRef.current) {
                if (!ident.startsWith(mySideIdRef.current)) setOppTeam(applyMultiplier);
                else setMyTeam(applyMultiplier);
              }
            }
          }
        }

        // 능력치 배율 증가 종료
        else if (trimmed.startsWith("|-end|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const effect = (parts[3] || "").toLowerCase();
          const logIdentName = getIdentName(ident);

          if (effect.includes("protosynthesis") || effect.includes("quarkdrive")) {
            const clearMultiplier = (prevTeam: any[]) =>
              prevTeam.map((p) => {
                const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
                if (logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)) {
                  return { ...p, multipliers: {} };
                }
                return p;
              });

            if (mySideIdRef.current) {
              if (!ident.startsWith(mySideIdRef.current)) setOppTeam(clearMultiplier);
              else setMyTeam(clearMultiplier);
            }
          }
        }

        // 곡예 (Unburden) 등 도구 소모 특성
        else if (trimmed.startsWith("|-enditem|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const logIdentName = getIdentName(ident);

          const applyUnburden = (prevTeam: any[]) =>
            prevTeam.map((p) => {
              const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
              if (logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)) {
                // baseAbility가 없을 경우 details(이름, 성별 등)나 ability로 풀스캔
                const ability = (p.baseAbility || p.ability || p.details || "").toLowerCase();
                if (ability.includes("unburden") || ability.includes("곡예")) {
                  return { ...p, multipliers: { ...p.multipliers, spe: 2 } };
                }
              }
              return p;
            });

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) setOppTeam(applyUnburden);
            else setMyTeam(applyUnburden);
          }
        }

        if (!trimmed.startsWith("|request|")) {
          const finalBattleLog = parseBattleLog(trimmed);
          if (finalBattleLog) newLogs.push(finalBattleLog);
        }
      });

      if (newLogs.length > 0) setLogs((prev) => [...prev, ...newLogs]);
    });

    socket.current.on("revert-requested", () => {
      setRevertRequest(true);
    });

    socket.current.on("revert-declined", () => {
      setIsWaitingRevert(false);
      setRevertToast("상대방이 되돌리기를 거절했습니다.");
    });

    socket.current.on("revert-accepted", () => {
      setIsWaitingRevert(false);
      setRevertToast(null);
      resetBattleState();
      setLogs(["[시스템] 되돌리기가 수락되었습니다. 데이터를 동기화합니다..."]);
    });

    return () => {
      if (socket.current) socket.current.disconnect();
    };
  }, []);

  // Actions
  const createRoom = (settings: RoomSettings) => socket.current && socket.current.emit("create-room", settings);
  const joinRoom = (roomId: string) => socket.current && socket.current.emit("join-room", roomId);
  const requestRoomList = () => socket.current && socket.current.emit("request-room-list");
  const leaveRoom = () => {
    socket.current && socket.current.emit("leave-room");
    setPhase("lobby");
    setRoomData(null);
    roomDataRef.current = null;
    setMySelection([]);
    resetBattleState();
  };

  const submitTeam = (teamString: string, callback?: () => void) => {
    if (teamString.trim()) {
      socket.current?.emit("set-team", teamString, (response: any) => {
        if (response?.success && callback) {
          callback();
        }
      });
    } else {
      alert("파티를 입력해주세요.");
    }
  };
  const toggleReady = () => socket.current && socket.current.emit("toggle-ready");
  const startSelection = () => socket.current && socket.current.emit("start-selection");
  const submitSelection = (selection: number[]) => socket.current && socket.current.emit("submit-selection", selection);

  const sendAction = (type: "move" | "switch", index: number) => {
    if (!socket.current || !socket.current.connected || winner) return;
    let cmd = `${type} ${index}`;
    if (type === "move") {
      if (isMegaChecked) cmd += " mega";
      if (isZMoveChecked) cmd += " zmove";
    }
    socket.current.emit("action", cmd);
    setSelectedAction({ type, index });
  };

  const resetBattleState = () => {
    setWinner(null);
    setLogs([]);
    setMyTeam([]);
    setActiveMoves([]);
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

  const requestRevert = () => {
    setIsWaitingRevert(true);
    socket.current?.emit("request-revert");
  };

  const respondRevert = (accept: boolean) => {
    setRevertRequest(false);
    socket.current?.emit("respond-revert", accept);
  };

  // Render Router
  return (
    <>
      {phase === "lobby" && (
        <LobbyPhase
          availableRooms={availableRooms}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onRefresh={requestRoomList}
        />
      )}

      {phase === "room" && roomData && (
        <RoomPhase
          roomData={roomData}
          socketId={socket.current ? socket.current.id : ""}
          onLeave={leaveRoom}
          onSubmitTeam={submitTeam}
          onToggleReady={toggleReady}
          onStartSelection={startSelection}
        />
      )}

      {phase === "selection" && roomData && (
        <SelectionPhase
          roomData={roomData}
          myFullTeam={myFullTeam}
          oppFullTeam={oppFullTeam}
          mySelection={mySelection}
          setMySelection={setMySelection}
          onSubmitSelection={submitSelection}
        />
      )}

      {phase === "battle" && (
        <BattlePhase
          roomData={roomData}
          myTeam={myTeam}
          oppTeam={oppTeam}
          oppActive={oppActive}
          logs={logs}
          winner={winner}
          weather={weather}
          fieldConditions={fieldConditions}
          mySideConditions={mySideConditions}
          oppSideConditions={oppSideConditions}
          activeMoves={activeMoves}
          canMegaEvo={canMegaEvo}
          canZMove={canZMove}
          zMoves={zMoves}
          isMegaChecked={isMegaChecked}
          setIsMegaChecked={setIsMegaChecked}
          isZMoveChecked={isZMoveChecked}
          setIsZMoveChecked={setIsZMoveChecked}
          hasUsedMega={hasUsedMega}
          hasUsedZMove={hasUsedZMove}
          selectedAction={selectedAction}
          sendAction={sendAction}
          onLeave={leaveRoom}
          requestRevert={requestRevert}
          revertRequest={revertRequest}
          respondRevert={respondRevert}
          isWaitingRevert={isWaitingRevert}
          revertToast={revertToast}
          clearRevertToast={() => setRevertToast(null)}
        />
      )}

      <ChatInterface
        phase={phase}
        roomData={roomData}
        myFullTeam={myFullTeam}
        oppFullTeam={oppFullTeam}
        mySelection={mySelection}
        myTeam={myTeam}
        oppTeam={oppTeam}
        oppActive={oppActive}
        activeMoves={activeMoves}
        usedMega={hasUsedMega}
        usedZMove={hasUsedZMove}
      />
    </>
  );
}
