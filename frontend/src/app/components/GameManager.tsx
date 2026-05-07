"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

import parseBattleLog from "@/app/utils/BattleLogParser";
import { initCustomPokemonData } from "@/app/utils/PokemonFactory";
import { RoomData, AvailableRoom, PokemonStatus, OppPokemon, MoveData, RoomSettings } from "@/app/types/battle";
import ChatInterface from "./ChatInterface";
import LobbyPhase from "./phases/LobbyPhase";
import RoomPhase from "./phases/RoomPhase";
import SelectionPhase from "./phases/SelectionPhase";
import BattlePhase from "./phases/BattlePhase";

export default function GameManager() {
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

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

  // Doubles State
  const [oppActives, setOppActives] = useState<OppPokemon[]>([]);
  const [activeMovesBySlot, setActiveMovesBySlot] = useState<MoveData[][]>([[], []]);
  const [doublesActions, setDoublesActionsState] = useState<(string | null)[]>([null, null]);
  const doublesActionsRef = useRef<(string | null)[]>([null, null]);
  const [doublesSelectedActions, setDoublesSelectedActions] = useState<({ type: string; index: number } | null)[]>([null, null]);
  const [focusedSlot, setFocusedSlot] = useState<number>(0);
  const [forceSwitch, setForceSwitchState] = useState<boolean[]>([]);
  const forceSwitchRef = useRef<boolean[]>([]);
  const [activeSlotCount, setActiveSlotCountState] = useState<number>(1);
  const activeSlotCountRef = useRef<number>(1);
  const [canMegaEvoBySlot, setCanMegaEvoBySlot] = useState<boolean[]>([false, false]);
  const [canZMoveBySlot, setCanZMoveBySlot] = useState<boolean[]>([false, false]);
  const [zMovesBySlot, setZMovesBySlot] = useState<({ move: string; target?: string }[] | null)[]>([null, null]);
  const [isMegaCheckedBySlot, setIsMegaCheckedBySlot] = useState<boolean[]>([false, false]);
  const [isZMoveCheckedBySlot, setIsZMoveCheckedBySlot] = useState<boolean[]>([false, false]);

  const mySideIdRef = useRef<string>("");
  const pendingFormChangesRef = useRef<Record<string, string>>({});

  const socket = useRef<Socket | null>(null);

  // Doubles sync helpers
  const setDoublesActions = (actions: (string | null)[]) => {
    doublesActionsRef.current = actions;
    setDoublesActionsState(actions);
  };
  const setForceSwitch = (fs: boolean[]) => {
    forceSwitchRef.current = fs;
    setForceSwitchState(fs);
  };
  const setActiveSlotCount = (n: number) => {
    activeSlotCountRef.current = n;
    setActiveSlotCountState(n);
  };
  const getSlotIndex = (ident: string) => {
    const sideId = ident.split(":")[0];
    return sideId[sideId.length - 1] === "b" ? 1 : 0;
  };

  useEffect(() => {
    const fetchCustomData = async () => {
      try {
        const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
        const res = await fetch(`${serverUrl}/api/custom-pokemon`);
        const data = await res.json();
        initCustomPokemonData(data);
      } catch (error) {
        console.error("커스텀 포켓몬 데이터를 불러오는데 실패했습니다.", error);
      } finally {
        setIsDataLoaded(true);
      }
    };

    fetchCustomData();
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;

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

      // 같은 청크에서 form change / transform이 |request|보다 앞에 오지만 myTeam이 빈 경우를 대비해
      // 청크 전체를 미리 스캔해 내 측 form change를 기록해둠 (따라큐 탈 특성 등)
      // |-transform|은 Imposter(탈 특성)·변신 기술 모두에서 발생하는 이벤트임 (|detailschange|가 아님)
      const chunkFormChanges: Record<string, string> = {};
      const chunkOppSwitchDetails: Record<string, string> = {};
      for (const line of lines) {
        const t = line.trim();
        if (!mySideIdRef.current) continue;

        // 상대 교체 정보 수집 (|-transform| 시 상대 세부 정보 조회용)
        if (t.startsWith("|switch|") || t.startsWith("|drag|") || t.startsWith("|replace|")) {
          const pts = t.split("|");
          const chIdent = pts[2];
          const chDetails = pts[3];
          if (chIdent && chDetails && !chIdent.startsWith(mySideIdRef.current)) {
            chunkOppSwitchDetails[getIdentName(chIdent)] = chDetails;
          }
        }

        // |detailschange| / |-formechange| (메가진화, 폼 체인지 등)
        if (t.startsWith("|detailschange|") || t.startsWith("|-formechange|")) {
          const pts = t.split("|");
          const chIdent = pts[2];
          const chDetails = pts[3];
          if (chIdent && chDetails && chIdent.startsWith(mySideIdRef.current)) {
            chunkFormChanges[getIdentName(chIdent)] = chDetails;
          }
        }

        // |-transform| (탈 특성·변신 기술) — 내 포켓몬이 변신한 경우
        if (t.startsWith("|-transform|")) {
          const pts = t.split("|");
          const chTransformer = pts[2]; // "p1a: Ditto"
          const chTarget = pts[3];      // "p2a: Charizard"
          if (chTransformer && chTarget && chTransformer.startsWith(mySideIdRef.current)) {
            const myName = getIdentName(chTransformer);    // "Ditto"
            const targetName = getIdentName(chTarget);     // "Charizard"
            // 같은 청크에 상대 switch가 있으면 성별 포함 details 사용, 없으면 이름만 사용
            chunkFormChanges[myName] = chunkOppSwitchDetails[targetName] || targetName;
          }
        }
      }

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
                      details: newPkmn.active
                        ? (chunkFormChanges[newName] || pendingFormChangesRef.current[newName] || existing?.details || newPkmn.details)
                        : newPkmn.details,
                      boosts: existing?.boosts || {},
                      multipliers: existing?.multipliers || {},
                    };
                  }),
                );
              }
            }

            const activeArr: any[] = requestJson?.active || [];
            const fs: boolean[] = requestJson?.forceSwitch || [];
            const slotCount = activeArr.length > 0 ? activeArr.length : fs.length > 0 ? fs.length : 1;

            setActiveSlotCount(slotCount);
            setForceSwitch(fs);

            if (slotCount > 1) {
              // 더블배틀
              const isSlotFainted = (i: number) =>
                requestJson.side.pokemon?.[i]?.condition?.includes("fnt") ?? false;

              const newMovesBySlot = activeArr.map((a: any, i: number) => {
                if (!a || isSlotFainted(i)) return [];
                return a.moves || [];
              });
              setActiveMovesBySlot(newMovesBySlot);
              setActiveMoves(newMovesBySlot[0] || []);

              const newMegaBySlot = activeArr.map((a: any, i: number) =>
                !isSlotFainted(i) && !!a?.canMegaEvo && (roomDataRef.current?.settings?.allowMega ?? true)
              );
              setCanMegaEvoBySlot(newMegaBySlot);
              setCanMegaEvo(newMegaBySlot[0] || false);

              const newZBySlot = activeArr.map((a: any, i: number) => {
                if (isSlotFainted(i)) return null;
                if (a?.canZMove && (roomDataRef.current?.settings?.allowZMove ?? true)) return a.canZMove;
                return null;
              });
              setZMovesBySlot(newZBySlot);
              setCanZMoveBySlot(newZBySlot.map((z: any) => z !== null));
              setCanZMove(newZBySlot[0] !== null);
              setZMoves(newZBySlot[0]);
            } else {
              // 싱글배틀
              if (activeArr[0]) {
                setActiveMoves(activeArr[0].moves || []);
                setCanMegaEvo(!!activeArr[0].canMegaEvo && (roomDataRef.current?.settings?.allowMega ?? true));
                if (activeArr[0].canZMove && (roomDataRef.current?.settings?.allowZMove ?? true)) {
                  setCanZMove(true);
                  setZMoves(activeArr[0].canZMove);
                } else {
                  setCanZMove(false);
                  setZMoves(null);
                }
                if (roomDataRef.current?.settings?.format === 4) {
                  setActiveMovesBySlot([activeArr[0].moves || [], []]);
                  setCanMegaEvoBySlot([
                    !!activeArr[0].canMegaEvo && (roomDataRef.current?.settings?.allowMega ?? true),
                    false,
                  ]);
                  const z0 = activeArr[0].canZMove && (roomDataRef.current?.settings?.allowZMove ?? true)
                    ? activeArr[0].canZMove : null;
                  setZMovesBySlot([z0, null]);
                  setCanZMoveBySlot([z0 !== null, false]);
                }
              } else if (fs.length === 0) {
                setActiveMoves([]);
                setCanMegaEvo(false);
                setCanZMove(false);
                setZMoves(null);
                if (roomDataRef.current?.settings?.format === 4) {
                  setActiveMovesBySlot([[], []]);
                  setCanMegaEvoBySlot([false, false]);
                  setZMovesBySlot([null, null]);
                  setCanZMoveBySlot([false, false]);
                }
              }
            }

            if (!requestJson.wait) {
              setSelectedAction(null);
              setIsMegaChecked(false);
              setIsZMoveChecked(false);
              if (roomDataRef.current?.settings?.format === 4) {
                setDoublesActions([null, null]);
                setDoublesSelectedActions([null, null]);
                setIsMegaCheckedBySlot([false, false]);
                setIsZMoveCheckedBySlot([false, false]);

                const currentMovesBySlot = activeArr.map((a: any, i: number) => {
                  if (!a || requestJson.side.pokemon?.[i]?.condition?.includes("fnt")) return [];
                  return a.moves || [];
                });
                const firstInputSlot = fs.length > 0
                  ? fs.findIndex((v) => v)
                  : currentMovesBySlot.findIndex((m) => m && m.length > 0);
                  
                setFocusedSlot(firstInputSlot >= 0 ? firstInputSlot : 0);
              }
            }
          } catch (e) {
            console.error("Parse error", e);
          }
        } else if (trimmed.startsWith("|switch|") || trimmed.startsWith("|drag|") || trimmed.startsWith("|replace|")) {
          const [, , ident, details, condition] = trimmed.split("|");
          const name = details.split(",")[0].trim();
          const logIdentName = getIdentName(ident);
          const slotIndex = getSlotIndex(ident);

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              const pkmnData = { ident, name, details, condition, revealed: true, fainted: condition.includes("fnt"), boosts: {} };

              setOppActive(pkmnData);
              setOppActives((prev) => {
                const next = [...prev];
                while (next.length <= slotIndex) next.push(null as any);
                next[slotIndex] = pkmnData;
                return next;
              });
              setOppTeam((prev) => {
                const newTeam = [...prev];
                const idx = newTeam.findIndex((p) => getIdentName(p.ident || "") === logIdentName || p.name === name);

                if (idx >= 0) {
                  newTeam[idx] = { ...newTeam[idx], ident, condition, fainted: condition.includes("fnt"), boosts: {} };
                } else {
                  newTeam.push({ ident, name, details, condition, revealed: true, fainted: condition.includes("fnt"), boosts: {} });
                }
                return newTeam;
              });
            } else {
              const isDoubles = roomDataRef.current?.settings?.format === 4;
              if (isDoubles) {
                setMyTeam((prev) =>
                  prev.map((p) => {
                    const reqName = getIdentName(p.ident);
                    const isThis = logIdentName.startsWith(reqName) || reqName.startsWith(logIdentName);
                    return isThis ? { ...p, condition, boosts: {} } : p;
                  }),
                );
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
        } else if (trimmed.startsWith("|-transform|")) {
          if (mySideIdRef.current) {
            const parts = trimmed.split("|");
            const transformerIdent = parts[2];
            const targetIdent = parts[3];
            if (transformerIdent && targetIdent && transformerIdent.startsWith(mySideIdRef.current)) {
              const myName = getIdentName(transformerIdent);
              const transformedDetails = chunkFormChanges[myName] || getIdentName(targetIdent);
              pendingFormChangesRef.current[myName] = transformedDetails;
              setMyTeam((prev) =>
                prev.map((p) => {
                  const reqName = getIdentName(p.ident);
                  return myName.startsWith(reqName) || reqName.startsWith(myName)
                    ? { ...p, details: transformedDetails }
                    : p;
                })
              );
            }
          }
        } else if (trimmed.startsWith("|detailschange|") || trimmed.startsWith("|-formechange|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const details = parts[3];
          const name = details.split(",")[0].trim();
          const logIdentName = getIdentName(ident);

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              const matchFn = (p: OppPokemon | null) => {
                if (!p) return false;
                const n = getIdentName(p.ident);
                return logIdentName.startsWith(n) || n.startsWith(logIdentName);
              };
              setOppActive((prev) => (matchFn(prev) ? { ...prev!, ident, details, name } : prev));
              setOppActives((prev) => prev.map((p) => (matchFn(p) ? { ...p!, ident, details, name } : p)));
              setOppTeam((prev) =>
                prev.map((p) => {
                  const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
                  return logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)
                    ? { ...p, ident, details, name }
                    : p;
                })
              );
            } else {
              pendingFormChangesRef.current[logIdentName] = details;
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
              const matchOpp = (p: OppPokemon | null) => {
                if (!p) return false;
                const n = getIdentName(p.ident);
                return logIdentName.startsWith(n) || n.startsWith(logIdentName);
              };
              setOppActive((prev) => (matchOpp(prev) ? { ...prev!, condition, fainted: isFaint } : prev));
              setOppActives((prev) => prev.map((p) => (matchOpp(p) ? { ...p!, condition, fainted: isFaint } : p)));
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
            const matchOppByIdent = (p: OppPokemon | null) => {
              if (!p) return false;
              const n = getIdentName(p.ident);
              return logIdentName.startsWith(n) || n.startsWith(logIdentName);
            };
            if (!ident.startsWith(mySideIdRef.current)) {
              setOppActive((prev) => (matchOppByIdent(prev) ? { ...prev!, condition: updateCondition(prev!.condition) } : prev));
              setOppActives((prev) => prev.map((p) => (matchOppByIdent(p) ? { ...p!, condition: updateCondition(p!.condition) } : p)));
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
          const cmd = parts[1];
          const ident = parts[2];
          const stat = parts[3];
          const amount = parseInt(parts[4], 10) * (cmd === "-unboost" ? -1 : 1);
          const logIdentName = getIdentName(ident);

          const applyBoost = (prevTeam: any[]) =>
            prevTeam.map((p) => {
              if (!p) return p;
              const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
              if (logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)) {
                const currentBoosts = p.boosts || {};
                const currentStatBoost = currentBoosts[stat] || 0;
                return { ...p, boosts: { ...currentBoosts, [stat]: currentStatBoost + amount } };
              }
              return p;
            });

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              setOppTeam(applyBoost);
              setOppActives(applyBoost);
            } else setMyTeam(applyBoost);
          }
        } else if (trimmed.startsWith("|-clearallboost|")) {
          setMyTeam((prev) => prev.map((p) => ({ ...p, boosts: {} })));
          setOppTeam((prev) => prev.map((p) => ({ ...p, boosts: {} })));
          setOppActives((prev) => prev.map((p) => (p ? { ...p, boosts: {} } : p)));
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
                  return { ...p, boosts: {} };
                } else if (cmd === "-clearnegativeboost") {
                  const newBoosts: Record<string, number> = { ...p.boosts };
                  for (const key in newBoosts) {
                    if (newBoosts[key] < 0) newBoosts[key] = 0;
                  }
                  return { ...p, boosts: newBoosts };
                } else if (cmd === "-clearpositiveboost") {
                  const newBoosts: Record<string, number> = { ...p.boosts };
                  for (const key in newBoosts) {
                    if (newBoosts[key] > 0) newBoosts[key] = 0;
                  }
                  return { ...p, boosts: newBoosts };
                }
              }
              return p;
            });

          if (mySideIdRef.current) {
            if (!ident.startsWith(mySideIdRef.current)) {
              setOppTeam(clearBoosts);
              setOppActives(clearBoosts);
            } else setMyTeam(clearBoosts);
          }
        } else if (trimmed.startsWith("|-start|") || trimmed.startsWith("|-activate|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const effect = (parts[3] || "").toLowerCase();
          const logIdentName = getIdentName(ident);

          if (effect.includes("protosynthesis") || effect.includes("quarkdrive")) {
            const statMatch =
              effect.match(/(atk|def|spa|spd|spe)/) || (parts[4] || "").toLowerCase().match(/(atk|def|spa|spd|spe)/);

            if (statMatch) {
              const stat = statMatch[1];
              const val = stat === "spe" ? 1.5 : 1.3;

              const applyMultiplier = (prevTeam: any[]) =>
                prevTeam.map((p) => {
                  if (!p) return p;
                  const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
                  if (logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)) {
                    return { ...p, multipliers: { ...p.multipliers, [stat]: val } };
                  }
                  return p;
                });

              if (mySideIdRef.current) {
                if (!ident.startsWith(mySideIdRef.current)) {
                  setOppTeam(applyMultiplier);
                  setOppActives(applyMultiplier);
                } else setMyTeam(applyMultiplier);
              }
            }
          }
        } else if (trimmed.startsWith("|-end|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const effect = (parts[3] || "").toLowerCase();
          const logIdentName = getIdentName(ident);

          if (effect.includes("protosynthesis") || effect.includes("quarkdrive")) {
            const clearMultiplier = (prevTeam: any[]) =>
              prevTeam.map((p) => {
                if (!p) return p;
                const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
                if (logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)) {
                  return { ...p, multipliers: {} };
                }
                return p;
              });

            if (mySideIdRef.current) {
              if (!ident.startsWith(mySideIdRef.current)) {
                setOppTeam(clearMultiplier);
                setOppActives(clearMultiplier);
              } else setMyTeam(clearMultiplier);
            }
          }
        } else if (trimmed.startsWith("|-enditem|")) {
          const parts = trimmed.split("|");
          const ident = parts[2];
          const logIdentName = getIdentName(ident);

          const applyUnburden = (prevTeam: any[]) =>
            prevTeam.map((p) => {
              const pIdentName = p.ident ? getIdentName(p.ident) : p.name;
              if (logIdentName.startsWith(pIdentName) || pIdentName.startsWith(logIdentName)) {
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
  }, [isDataLoaded]);

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
    pendingFormChangesRef.current = {};
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
    // Doubles 상태 초기화
    setOppActives([]);
    setActiveMovesBySlot([[], []]);
    setDoublesActions([null, null]);
    setDoublesSelectedActions([null, null]);
    setFocusedSlot(0);
    setForceSwitch([]);
    setActiveSlotCount(1);
    setCanMegaEvoBySlot([false, false]);
    setCanZMoveBySlot([false, false]);
    setZMovesBySlot([null, null]);
    setIsMegaCheckedBySlot([false, false]);
    setIsZMoveCheckedBySlot([false, false]);
  };

  const sendDoubleAction = (slot: number, cmd: string) => {
    if (!socket.current || !socket.current.connected || winner) return;

    const newActions = [...doublesActionsRef.current];
    newActions[slot] = cmd;
    doublesActionsRef.current = newActions;
    setDoublesActionsState([...newActions]);

    const parts = cmd.split(" ");
    setDoublesSelectedActions((prev) => {
      const next = [...prev];
      next[slot] = { type: parts[0], index: parseInt(parts[1]) || 0 };
      return next;
    });

    const fs = forceSwitchRef.current;
    
    const inputSlots: number[] = fs.length > 0 
      ? fs.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
      : activeMovesBySlot.map((moves, i) => (moves && moves.length > 0) ? i : -1).filter((i) => i >= 0);

    const availableSwitches = myTeam.slice(2).filter(
      (p) => p.condition !== "0 fnt" && !p.condition.includes("fnt")
    ).length;

    const requiredInputCount = fs.length > 0 
      ? Math.min(inputSlots.length, availableSwitches) 
      : inputSlots.length;

    const filledCount = inputSlots.filter((i) => newActions[i] !== null).length;
    const allFilled = filledCount >= requiredInputCount;

    if (allFilled) {
      const slotCount = activeSlotCountRef.current;
      const combinedCmd = Array.from({ length: slotCount }).map((_, i) => {
        if (fs.length > 0 && !fs[i]) return "pass";
        return newActions[i] || "pass";
      }).join(", ");
      
      socket.current.emit("action", combinedCmd);
      doublesActionsRef.current = [null, null];
      setDoublesActionsState([null, null]);
    } else {
      const nextSlot = inputSlots.find((i) => newActions[i] === null);
      if (nextSlot !== undefined) setFocusedSlot(nextSlot);
    }
  };

  const setIsMegaCheckedForSlot = (slot: number, v: boolean) =>
    setIsMegaCheckedBySlot((prev) => prev.map((x, i) => (i === slot ? v : x)));

  const setIsZMoveCheckedForSlot = (slot: number, v: boolean) =>
    setIsZMoveCheckedBySlot((prev) => prev.map((x, i) => (i === slot ? v : x)));

  const requestRevert = () => {
    setIsWaitingRevert(true);
    socket.current?.emit("request-revert");
  };

  const respondRevert = (accept: boolean) => {
    setRevertRequest(false);
    socket.current?.emit("respond-revert", accept);
  };

  if (!isDataLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white font-semibold">
        <p>데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

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
          isDoubles={roomData?.settings?.format === 4}
          oppActives={oppActives}
          activeMovesBySlot={activeMovesBySlot}
          doublesActions={doublesActions}
          doublesSelectedActions={doublesSelectedActions}
          focusedSlot={focusedSlot}
          setFocusedSlot={setFocusedSlot}
          forceSwitch={forceSwitch}
          canMegaEvoBySlot={canMegaEvoBySlot}
          canZMoveBySlot={canZMoveBySlot}
          zMovesBySlot={zMovesBySlot}
          isMegaCheckedBySlot={isMegaCheckedBySlot}
          isZMoveCheckedBySlot={isZMoveCheckedBySlot}
          setIsMegaCheckedForSlot={setIsMegaCheckedForSlot}
          setIsZMoveCheckedForSlot={setIsZMoveCheckedForSlot}
          sendDoubleAction={sendDoubleAction}
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
