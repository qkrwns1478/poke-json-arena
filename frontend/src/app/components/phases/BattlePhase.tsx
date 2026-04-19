import { useEffect, useRef } from "react";
import { RoomData, PokemonStatus, OppPokemon, MoveData } from "@/app/types/battle";
import { getSCKorean } from "@/app/utils/StatusCondition";
import { trEngToKor, trEngToKeb } from "@/app/utils/Translator";
import "@/assets/sprites/spritesheet-2H5N5RW5.css";

// --- Helpers ---
const getStatusColor = (s: string) => {
  switch (s) {
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
  if (!condition || condition.includes("fnt") || condition === "0")
    return (
      <div className="w-full mt-1">
        <div className="h-2.5 w-full bg-gray-700 rounded-full border border-gray-900"></div>
        <div className="flex items-center justify-between mt-1 min-h-[20px]">
          <span />
          <div className="text-xs font-mono text-red-500 font-bold">기절</div>
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
  const color = percent > 50 ? "bg-green-500" : percent > 20 ? "bg-yellow-500" : "bg-red-500";

  const isPercent = max === 100;

  return (
    <div className="w-full mt-1">
      <div className="h-2.5 w-full bg-gray-700 rounded-full overflow-hidden border border-gray-900">
        <div className={`h-full transition-all duration-500 ease-out ${color}`} style={{ width: `${percent}%` }}></div>
      </div>
      <div className="flex items-center justify-between mt-1 min-h-[20px]">
        {status ? (
          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-white ${getStatusColor(status)}`}>
            {getSCKorean(status)}
          </span>
        ) : (
          <span />
        )}
        <div className="text-xs font-mono text-gray-300">
          {isPercent ? `${Math.ceil(current)}%` : `${Math.ceil(current)} / ${max}`}
        </div>
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
  } = props;
  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), [logs]);

  const activePokemon = myTeam.find((p) => p.active);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col md:flex-row gap-8">
      <div className="flex-1 flex flex-col h-[80vh] min-h-0 gap-4">
        {/* 날씨 & 필드 */}
        {(weather || fieldConditions.length > 0) && (
          <div className="flex gap-3 bg-gray-800 p-2 border border-gray-700 rounded shadow-md shrink-0">
            {weather && (
              <span className="px-3 py-1 bg-yellow-600/30 text-yellow-300 font-semibold text-sm rounded">
                ☀️ {weather}
              </span>
            )}
            {fieldConditions.map((fc, i) => (
              <span key={i} className="px-3 py-1 bg-green-600/30 text-green-300 font-semibold text-sm rounded">
                🌿 {fc}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 shrink-0">
          {/* 상대 포켓몬 */}
          <div className="flex-1 bg-gray-800 p-4 border border-gray-700 rounded shadow-lg">
            <div className="text-xs text-red-400 mb-2 font-bold tracking-wider">OPPONENT</div>
            {oppActive ? (
              <div className="flex items-center gap-4 bg-gray-900 p-3 rounded border border-gray-700">
                <div className={`sprite-${toSpriteKey(oppActive.name)}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-200">{trEngToKor(oppActive.name)}</div>
                  <HpBar condition={oppActive.condition} />
                  {oppSideConditions.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {oppSideConditions.map((c, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-red-900/50 border border-red-500 text-red-200 px-1 py-0.5 rounded"
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
                대기 중...
              </div>
            )}
          </div>

          {/* 내 포켓몬 */}
          <div className="flex-1 bg-gray-800 p-4 border border-gray-700 rounded shadow-lg">
            <div className="text-xs text-blue-400 mb-2 font-bold tracking-wider">MY ACTIVE</div>
            {activePokemon ? (
              <div className="flex items-center gap-4 bg-gray-900 p-3 rounded border border-blue-900/50">
                <div className={`sprite-${toSpriteKey(activePokemon.details.split(",")[0])}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-yellow-400">{trEngToKor(activePokemon.details.split(",")[0])}</div>
                  <HpBar condition={activePokemon.condition} />
                  {mySideConditions.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {mySideConditions.map((c, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-blue-900/50 border border-blue-500 text-blue-200 px-1 py-0.5 rounded"
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
                대기 중...
              </div>
            )}
          </div>
        </div>

        {/* 로그 */}
        <div className="flex-1 flex flex-col border border-gray-700 rounded bg-gray-800 p-4 min-h-0 shadow-lg">
          <h2 className="text-lg font-bold mb-2 shrink-0">배틀 로그</h2>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm bg-black p-4 rounded whitespace-pre-wrap">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`${log.startsWith("===") ? "text-yellow-400 font-bold mt-4 mb-2" : log.includes("효과가 굉장했다") ? "text-red-400 font-bold" : log.includes("쓰러졌다") ? "text-gray-500 line-through" : "text-gray-200"}`}
              >
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      <div className="w-full md:w-[22rem] flex flex-col gap-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
        {/* 상대방 Roster Tracker */}
        <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-lg shrink-0">
          <h3 className="text-[15px] font-bold mb-3 text-red-400 flex justify-between items-center">
            상대방 파티{" "}
            <span className="text-xs text-gray-500 font-normal">
              {oppTeam.length}/{roomData?.settings?.format}
            </span>
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: roomData?.settings?.format || 6 }).map((_, i) => {
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
              const nameLower = toSpriteKey(pkmn.name);
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

        {/* 내 포켓몬 상세 정보 */}
        {activePokemon && (
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
            <h3 className="text-3xl font-bold text-yellow-400">
              {winner === "Draw" ? "무승부!" : winner === "Disconnect" ? "상대방 연결 끊김!" : `${winner} 승리!`}
            </h3>
            <button
              onClick={onLeave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded text-xl shadow-lg transition"
            >
              로비로 돌아가기
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 기술 목록 */}
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-yellow-400">기술</h3>
                <div className="flex gap-2">
                  {canMegaEvo && (!hasUsedMega || roomData?.settings?.noLimit) && !hasUsedZMove && (
                    <button
                      type="button"
                      aria-pressed={isMegaChecked}
                      disabled={!!selectedAction}
                      onClick={() => setIsMegaChecked(!isMegaChecked)}
                      className={`text-xs flex items-center gap-1 cursor-pointer px-2 py-1 rounded transition ${isMegaChecked ? "bg-purple-600 text-white font-bold" : "bg-gray-700"}`}
                    >
                      <span className="sprite-icon-mega" />
                      메가진화
                    </button>
                  )}
                  {canZMove && (!hasUsedZMove || roomData?.settings?.noLimit) && !hasUsedMega && (
                    <button
                      type="button"
                      aria-pressed={isZMoveChecked}
                      disabled={!!selectedAction}
                      onClick={() => setIsZMoveChecked(!isZMoveChecked)}
                      className={`text-xs flex items-center gap-1 cursor-pointer px-2 py-1 rounded transition ${isZMoveChecked ? "bg-orange-500 text-white font-bold" : "bg-gray-700"}`}
                    >
                      <span className="sprite-icon-zmove" />
                      Z기술
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
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
                        className={`p-3 rounded font-bold text-sm shadow flex justify-center relative
                          ${isSelected ? "bg-yellow-600 text-white ring-2" : isZ ? "bg-orange-500 text-white" : "bg-red-600 hover:bg-red-700 text-white transition"}
                          ${disabled ? "opacity-50 bg-gray-600! cursor-not-allowed" : ""}`}
                      >
                        <span className={isSelected ? "opacity-30" : ""}>
                          {trEngToKor(isZ ? zMoves[idx].move : m.move, "MOVES")}
                        </span>
                        {isSelected && (
                          <span className="absolute inset-0 flex items-center justify-center font-black">대기 중</span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center text-gray-500 bg-gray-900 p-3 rounded border border-gray-700 italic">
                    명령 대기 중...
                  </div>
                )}
              </div>
            </div>

            {/* 교체 목록 */}
            <div className="bg-gray-800 p-4 rounded border border-gray-700 flex-1">
              <h3 className="font-bold mb-3 text-green-400">교체</h3>
              <div className="flex flex-col gap-2">
                {myTeam.map((p, idx) => {
                  const name = p.details.split(",")[0];
                  const isDead = p.condition === "0 fnt";
                  const isSelected = selectedAction?.type === "switch" && selectedAction?.index === idx + 1;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendAction("switch", idx + 1)}
                      disabled={p.active || isDead || !!selectedAction}
                      className={`p-2 rounded font-bold flex flex-col justify-center border relative transition ${isSelected ? "bg-yellow-600 border-yellow-400 text-white ring-2" : p.active ? "bg-green-700/50 border-green-500 text-white" : isDead ? "bg-gray-800 border-gray-700 text-gray-500 opacity-60" : "bg-blue-600/80 border-blue-500 hover:bg-blue-600 text-white"} ${selectedAction && !isSelected ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <div className="flex gap-2 items-center">
                          <span className={`inline-block sprite-${toSpriteKey(name)} scale-75 origin-left`}></span>
                          <span className="text-sm">{trEngToKor(name)}</span>
                        </div>
                      </div>
                      <div className="w-full px-1">
                        <HpBar condition={p.condition} />
                      </div>
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center font-black text-lg bg-black/40 drop-shadow-md">
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
