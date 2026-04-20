import { useEffect, useRef } from "react";
import { RoomData, PokemonStatus, OppPokemon, MoveData } from "@/app/types/battle";
import { getSCKorean } from "@/app/utils/StatusCondition";
import { trEngToKor, trEngToKeb } from "@/app/utils/Translator";
import "@/assets/sprites/spritesheet-2H5N5RW5.css";

// --- Helpers ---
const getStatusColor = (s: string) => {
  switch (s) {
    case "brn":
      return "bg-rose-500/20 text-rose-400 border-rose-500/30";
    case "par":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "psn":
    case "tox":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "slp":
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    case "frz":
      return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
};

const StatBadge = ({ boost = 0, multiplier = 1 }: { boost?: number; multiplier?: number }) => {
  return (
    <div className="flex items-center gap-1">
      {boost === 0 ? (
        <span className="px-2 py-0.5 text-xs rounded bg-slate-800/50 text-slate-400 border border-slate-700/50 font-medium">
          ±0
        </span>
      ) : (
        <span
          className={`px-2 py-0.5 text-xs rounded font-bold ${
            boost > 0
              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
          }`}
        >
          {boost > 0 ? `+${boost}` : boost}
        </span>
      )}
      {multiplier !== 1 && (
        <span className="px-2 py-0.5 text-xs rounded font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
          x{multiplier}
        </span>
      )}
    </div>
  );
};

const HpBar = ({ condition }: { condition: string }) => {
  if (!condition || condition.includes("fnt") || condition === "0")
    return (
      <div className="w-full mt-2">
        <div className="h-2 w-full bg-slate-800 rounded-full border border-slate-700/50 overflow-hidden" />
        <div className="flex items-center justify-between mt-1 min-h-[20px]">
          <span />
          <span className="text-xs font-bold tracking-widest text-slate-500">FAINTED</span>
        </div>
      </div>
    );

  const statusMatch = condition.match(/\b(brn|par|psn|tox|slp|frz)\b/);
  const status = statusMatch ? statusMatch[1] : null;

  const hpMatch = condition.match(/([\d.]+)\/(\d+)/);
  if (!hpMatch) return null;

  const current = parseFloat(hpMatch[1]);
  const max = parseInt(hpMatch[2], 10);
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  const color =
    percent > 50
      ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
      : percent > 20
        ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
        : "bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.5)]";

  const isPercent = max === 100;

  return (
    <div className="w-full mt-2">
      <div className="h-2 w-full bg-slate-800 rounded-full border border-slate-700/50">
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 min-h-[20px]">
        {status ? (
          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getStatusColor(status)}`}>
            {getSCKorean(status)}
          </span>
        ) : (
          <span />
        )}
        <span className="text-xs font-mono font-medium text-slate-300">
          {isPercent ? `${Math.ceil(current)}%` : `${Math.ceil(current)} / ${max}`}
        </span>
      </div>
    </div>
  );
};

const toSpriteKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// --- Component ---
interface Props {
  roomData: RoomData | null;
  myTeam: PokemonStatus[];
  oppTeam: OppPokemon[];
  oppActive: OppPokemon | null;
  logs: string[];
  winner: string | null;
  weather: string | null;
  fieldConditions: string[];
  mySideConditions: string[];
  oppSideConditions: string[];
  activeMoves: MoveData[];
  canMegaEvo: boolean;
  canZMove: boolean;
  zMoves: { move: string; target?: string }[] | null;
  isMegaChecked: boolean;
  setIsMegaChecked: (v: boolean) => void;
  isZMoveChecked: boolean;
  setIsZMoveChecked: (v: boolean) => void;
  hasUsedMega: boolean;
  hasUsedZMove: boolean;
  selectedAction: { type: string; index: number } | null;
  sendAction: (type: "move" | "switch", index: number) => void;
  onLeave: () => void;
  requestRevert: () => void;
  revertRequest: boolean;
  respondRevert: (accept: boolean) => void;
}

export default function BattlePhase(props: Props) {
  const {
    roomData,
    myTeam,
    oppTeam,
    oppActive,
    logs,
    winner,
    weather,
    fieldConditions,
    mySideConditions,
    oppSideConditions,
    activeMoves,
    canMegaEvo,
    canZMove,
    zMoves,
    isMegaChecked,
    setIsMegaChecked,
    isZMoveChecked,
    setIsZMoveChecked,
    hasUsedMega,
    hasUsedZMove,
    selectedAction,
    sendAction,
    onLeave,
    requestRevert,
    revertRequest,
    respondRevert,
  } = props;
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), [logs]);

  const activePokemon = myTeam.find((p) => p.active);

  return (
    <>
      {/* 상대방이 되돌리기를 요청했을 때 뜨는 모달 */}
      {revertRequest && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 p-8 rounded-2xl border border-blue-500/30 shadow-2xl max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-slate-100 mb-4">되돌리기 요청</h3>
            <p className="text-slate-300 text-sm mb-8">
              상대방이 이전 턴으로 되돌리기를 요청했습니다.
              <br />
              수락하시겠습니까?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => respondRevert(true)}
                className="flex-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 font-bold py-3 rounded-xl transition-all"
              >
                YES
              </button>
              <button
                onClick={() => respondRevert(false)}
                className="flex-1 bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30 font-bold py-3 rounded-xl transition-all"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="min-h-screen p-6 md:p-8 flex flex-col xl:flex-row gap-6 max-w-[1600px] mx-auto">
        {/* 좌측 패널: 전장 & 로그 */}
        <div className="flex-1 flex flex-col h-auto xl:h-[85vh] min-h-0 gap-4">
          {/* 날씨 & 필드 */}
          {(weather || fieldConditions.length > 0) && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {weather && (
                <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-bold tracking-wide rounded-lg">
                  WEATHER: {weather.toUpperCase()}
                </span>
              )}
              {fieldConditions.map((fc, i) => (
                <span
                  key={i}
                  className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold tracking-wide rounded-lg"
                >
                  FIELD: {fc.toUpperCase()}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4 shrink-0">
            {/* 상대 포켓몬 카드 */}
            <div className="flex-1 bg-slate-800/40 backdrop-blur-md p-6 rounded-2xl border border-rose-500/20 shadow-lg relative">
              <div className="text-xs text-rose-400 mb-3 font-black tracking-widest">OPPONENT</div>
              {oppActive ? (
                <div className="flex items-center gap-5">
                  <div className={`sprite-${toSpriteKey(oppActive.name)} scale-125 opacity-90`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold text-slate-100 tracking-tight">{trEngToKor(oppActive.name)}</div>
                    <HpBar condition={oppActive.condition} />
                    {oppSideConditions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {oppSideConditions.map((c, i) => (
                          <span
                            key={i}
                            className="text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-300 px-2 py-0.5 rounded"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-base font-medium h-[90px] flex items-center justify-center border border-slate-700/50 border-dashed rounded-xl">
                  대기 중...
                </div>
              )}
            </div>

            {/* 내 포켓몬 카드 */}
            <div className="flex-1 bg-slate-800/40 backdrop-blur-md p-6 rounded-2xl border border-blue-500/20 shadow-lg relative">
              <div className="text-xs text-blue-400 mb-3 font-black tracking-widest">MY ACTIVE</div>
              {activePokemon ? (
                <div className="flex items-center gap-5">
                  <div
                    className={`sprite-${toSpriteKey(activePokemon.details.split(",")[0])} scale-125 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold text-slate-100 tracking-tight">
                      {trEngToKor(activePokemon.details.split(",")[0])}
                    </div>
                    <HpBar condition={activePokemon.condition} />
                    {mySideConditions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {mySideConditions.map((c, i) => (
                          <span
                            key={i}
                            className="text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2 py-0.5 rounded"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-base font-medium h-[90px] flex items-center justify-center border border-slate-700/50 border-dashed rounded-xl">
                  대기 중...
                </div>
              )}
            </div>
          </div>

          {/* 배틀 로그 */}
          <div className="flex-1 flex flex-col bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 min-h-[250px] shadow-lg">
            <h2 className="text-base font-bold text-slate-200 mb-4 tracking-wide flex items-center gap-2 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> 배틀 로그
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 text-sm md:text-base rounded-xl custom-scrollbar pr-3 leading-relaxed">
              {logs.map((log, i) => {
                let logStyle = "text-slate-300";
                if (log.startsWith("===")) logStyle = "text-slate-400 font-bold mt-5 mb-2 text-sm tracking-wider";
                else if (log.includes("효과가 굉장했다")) logStyle = "text-rose-400 font-medium";
                else if (log.includes("효과가 별로인")) logStyle = "text-slate-500";
                else if (log.includes("쓰러졌다")) logStyle = "text-slate-600 line-through decoration-slate-600";
                else if (log.includes("급소에 맞았다")) logStyle = "text-amber-400 font-bold";

                return (
                  <div key={i} className={logStyle}>
                    {log}
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* 우측 패널: 컨트롤 & 스탯 */}
        <div className="w-full xl:w-[420px] flex flex-col gap-5 overflow-y-auto max-h-[85vh] custom-scrollbar pr-2 shrink-0">
          {/* 상대방 파티 트래커 */}
          <div className="bg-slate-800/40 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 shadow-lg">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-bold tracking-widest text-slate-400">OPPONENT ROSTER</h3>
              <span className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded text-slate-400 font-mono">
                {oppTeam.length}/{roomData?.settings?.format}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: roomData?.settings?.format || 6 }).map((_, i) => {
                const pkmn = oppTeam[i];
                if (!pkmn)
                  return (
                    <div
                      key={i}
                      className="bg-slate-900/50 border border-slate-800 h-14 rounded-xl flex items-center justify-center"
                    >
                      <span className="text-slate-700 text-xl font-black">?</span>
                    </div>
                  );
                return (
                  <div
                    key={i}
                    className={`bg-slate-900/40 border border-slate-700/50 h-14 rounded-xl flex items-center justify-center transition-all ${pkmn.fainted ? "opacity-30 grayscale" : ""}`}
                  >
                    <div className={`sprite-${toSpriteKey(pkmn.name)} scale-75 opacity-90`} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 내 포켓몬 스탯 정보 */}
          {activePokemon && (
            <div className="bg-slate-800/40 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 shadow-lg">
              <h3 className="text-sm font-bold tracking-widest text-slate-400 mb-5">ACTIVE STATS</h3>
              <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700/30 text-sm space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
                  <span className="text-slate-500">지닌 물건</span>
                  <div className="flex items-center gap-2">
                    {activePokemon.item ? (
                      <>
                        <span
                          className={`inline-block sprite-${trEngToKeb(activePokemon.item)} scale-75 -my-2 origin-right`}
                        />
                        <span className="font-semibold text-slate-200">{trEngToKor(activePokemon.item, "ITEMS")}</span>
                      </>
                    ) : (
                      <span className="font-semibold text-slate-600">-</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
                  <span className="text-slate-500">특성</span>
                  <span className="font-semibold text-slate-200">
                    {activePokemon.baseAbility ? trEngToKor(activePokemon.baseAbility, "ABILITY") : "-"}
                  </span>
                </div>
                {activePokemon.stats && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 font-mono text-sm">
                    {[
                      {
                        label: "Atk",
                        val: activePokemon.stats.atk,
                        boost: activePokemon.boosts?.atk,
                        mul: activePokemon.multipliers?.atk,
                      },
                      {
                        label: "SpA",
                        val: activePokemon.stats.spa,
                        boost: activePokemon.boosts?.spa,
                        mul: activePokemon.multipliers?.spa,
                      },
                      {
                        label: "Def",
                        val: activePokemon.stats.def,
                        boost: activePokemon.boosts?.def,
                        mul: activePokemon.multipliers?.def,
                      },
                      {
                        label: "SpD",
                        val: activePokemon.stats.spd,
                        boost: activePokemon.boosts?.spd,
                        mul: activePokemon.multipliers?.spd,
                      },
                      {
                        label: "Spe",
                        val: activePokemon.stats.spe,
                        boost: activePokemon.boosts?.spe,
                        mul: activePokemon.multipliers?.spe,
                        isFull: true,
                      },
                    ].map((stat, idx) => (
                      <div
                        key={idx}
                        className={`flex justify-between items-center ${stat.isFull ? "col-span-2 pt-3 border-t border-slate-800/80" : ""}`}
                      >
                        <span className="text-slate-500">{stat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 text-base">{stat.val}</span>
                          {(stat.boost || stat.mul) && <StatBadge boost={stat.boost} multiplier={stat.mul} />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 승패 결과 창 */}
          {winner ? (
            <div className="bg-slate-800/80 backdrop-blur-xl p-8 rounded-2xl border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] text-center flex flex-col gap-6 mt-auto">
              <h3 className="text-2xl font-black text-slate-100 tracking-tight">
                {winner === "Draw" ? "무승부" : winner === "Disconnect" ? "상대방 연결 끊김" : `${winner} 승리!`}
              </h3>
              <button
                onClick={onLeave}
                className="bg-white text-slate-900 text-lg font-bold py-4 rounded-xl shadow-lg hover:bg-slate-200 transition-colors"
              >
                로비로 돌아가기
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5 mt-auto">
              {/* 기술 (Moves) 컨테이너 */}
              <div className="bg-slate-800/40 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-sm font-bold tracking-widest text-slate-400">MOVES</h3>
                  <div className="flex gap-2">
                    {roomData?.settings?.allowRevert && (
                      <button
                        type="button"
                        onClick={requestRevert}
                        disabled={!!selectedAction}
                        className="text-xs flex items-center gap-1.5 font-bold px-3 py-2 rounded-lg transition-all border bg-slate-900/50 text-sky-400 border-sky-500/30 hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        REVERT
                      </button>
                    )}
                    {canMegaEvo && (!hasUsedMega || roomData?.settings?.noLimit) && !hasUsedZMove && (
                      <button
                        type="button"
                        disabled={!!selectedAction}
                        onClick={() => setIsMegaChecked(!isMegaChecked)}
                        className={`text-xs flex items-center gap-1.5 font-bold px-3 py-2 rounded-lg transition-all border ${
                          isMegaChecked
                            ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                            : "bg-slate-900/50 text-slate-400 border-slate-700/50 hover:text-slate-200"
                        }`}
                      >
                        <span className="sprite-icon-mega" />
                        메가진화
                      </button>
                    )}
                    {canZMove && (!hasUsedZMove || roomData?.settings?.noLimit) && !hasUsedMega && (
                      <button
                        type="button"
                        disabled={!!selectedAction}
                        onClick={() => setIsZMoveChecked(!isZMoveChecked)}
                        className={`text-xs flex items-center gap-1.5 font-bold px-3 py-2 rounded-lg transition-all border ${
                          isZMoveChecked
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                            : "bg-slate-900/50 text-slate-400 border-slate-700/50 hover:text-slate-200"
                        }`}
                      >
                        <span className="sprite-icon-zmove" />
                        Z기술
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {activeMoves.length > 0 ? (
                    activeMoves.map((m, idx) => {
                      const isSelected = selectedAction?.type === "move" && selectedAction?.index === idx + 1;
                      const isZ = isZMoveChecked && !!zMoves?.[idx];
                      const disabled = m.disabled || !!selectedAction || (isZMoveChecked && !isZ);

                      return (
                        <button
                          key={idx}
                          onClick={() => sendAction("move", idx + 1)}
                          disabled={disabled}
                          className={`p-4 rounded-xl font-bold text-sm md:text-base tracking-wide shadow-sm flex justify-center items-center relative transition-all duration-200 border
                          ${
                            isSelected
                              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                              : isZ
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                : "bg-slate-700/40 border-slate-600/50 text-slate-200 hover:bg-slate-700/70 hover:border-slate-500"
                          }
                          ${disabled ? "opacity-40 grayscale cursor-not-allowed hover:bg-slate-700/40 hover:border-slate-600/50" : ""}`}
                        >
                          <span className={isSelected ? "opacity-0" : "opacity-100 transition-opacity"}>
                            {trEngToKor(isZ ? zMoves[idx].move : m.move, "MOVES")}
                          </span>
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center font-black animate-pulse">
                              WAITING
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="col-span-2 text-center text-slate-500 text-sm font-mono bg-slate-900/30 p-4 rounded-xl border border-slate-700/30">
                      Waiting for instructions...
                    </div>
                  )}
                </div>
              </div>

              {/* 교체 (Switch) 컨테이너 */}
              <div className="bg-slate-800/40 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50">
                <h3 className="text-sm font-bold tracking-widest text-slate-400 mb-5">SWITCH POKÉMON</h3>
                <div className="flex flex-col gap-3">
                  {myTeam.map((p, idx) => {
                    const name = p.details.split(",")[0];
                    const isDead = p.condition === "0 fnt";
                    const isSelected = selectedAction?.type === "switch" && selectedAction?.index === idx + 1;

                    return (
                      <button
                        key={idx}
                        onClick={() => sendAction("switch", idx + 1)}
                        disabled={p.active || isDead || !!selectedAction}
                        className={`p-3 rounded-xl flex flex-col justify-center border relative transition-all duration-200 
                        ${
                          isSelected
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                            : p.active
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                              : isDead
                                ? "bg-slate-900/40 border-slate-800 text-slate-600 opacity-50"
                                : "bg-slate-800/60 border-slate-700 hover:bg-slate-700 text-slate-200 hover:border-slate-500"
                        } 
                        ${selectedAction && !isSelected ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex justify-between items-center w-full px-2">
                          <div className="flex gap-3 items-center">
                            <span
                              className={`inline-block sprite-${toSpriteKey(name)} scale-75 -my-2 origin-left opacity-90`}
                            ></span>
                            <span className="text-sm md:text-base font-bold tracking-wide">{trEngToKor(name)}</span>
                          </div>
                          {p.active && (
                            <span className="text-[10px] font-black tracking-widest text-blue-400">ACTIVE</span>
                          )}
                        </div>
                        <div className="w-full px-2 pt-1 pb-1">
                          <HpBar condition={p.condition} />
                        </div>
                        {isSelected && (
                          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center font-black text-emerald-400 text-lg tracking-widest">
                            WAITING
                          </div>
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
    </>
  );
}
