import { useState } from "react";
import { RoomData } from "@/app/types/battle";
import { trEngToKor } from "@/app/utils/Translator";
import "@/assets/sprites/spritesheet-2H5N5RW5.css";

interface Props {
  roomData: RoomData;
  myFullTeam: string[];
  oppFullTeam: string[];
  mySelection: number[];
  setMySelection: React.Dispatch<React.SetStateAction<number[]>>;
  onSubmitSelection: (sel: number[]) => void;
}

export default function SelectionPhase({
  roomData,
  myFullTeam,
  oppFullTeam,
  mySelection,
  setMySelection,
  onSubmitSelection,
}: Props) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const reqCount = roomData.settings.format;

  const handleSelect = (idx: number) => {
    if (isSubmitted) return;
    setMySelection((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : prev.length < reqCount ? [...prev, idx] : prev,
    );
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    onSubmitSelection(mySelection);
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="z-10 text-center mb-10">
        <h2 className="text-3xl font-black text-slate-100 tracking-tight">엔트리 선택</h2>
        <p className="text-slate-400 font-medium text-sm mt-2 tracking-wide">
          출전할 포켓몬 <span className="text-slate-200 font-bold">{reqCount}마리</span>를 순서대로 선택하세요
          {roomData.settings.format === 4 && (
            <span className="block text-xs text-amber-400 mt-1">⚡ 더블배틀: 1번·2번 포켓몬이 먼저 동시에 출전합니다</span>
          )}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-6xl z-10">
        {/* 상대방 파티 카드 */}
        <div className="flex-1 bg-slate-800/40 backdrop-blur-xl p-8 rounded-3xl border border-rose-500/20 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-end mb-6 border-b border-slate-700/50 pb-4">
            <h3 className="text-lg font-bold text-slate-200">상대방 파티</h3>
            <span className="text-[10px] font-bold tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">
              OPPONENT
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {oppFullTeam.map((p, idx) => (
              <div
                key={idx}
                className="p-4 border border-slate-700/30 bg-slate-900/40 rounded-2xl flex flex-col items-center justify-center h-28 opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-300"
              >
                <div className={`sprite-${p.toLowerCase().replaceAll(" ", "-").replaceAll("’", "")} transform scale-110 mb-3`} />
                <span className="font-semibold text-xs text-slate-400 tracking-wide">{trEngToKor(p)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 나의 파티 카드 */}
        <div className="flex-1 bg-slate-800/40 backdrop-blur-xl p-8 rounded-3xl border border-blue-500/20 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-end mb-6 border-b border-slate-700/50 pb-4">
            <h3 className="text-lg font-bold text-slate-200">
              나의 파티 <span className="text-xs font-normal text-slate-400 ml-2">(1번 = 선봉)</span>
            </h3>
            <span className="text-[10px] font-bold tracking-wider text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
              MY TEAM
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {myFullTeam.map((p, idx) => {
              const selIdx = mySelection.indexOf(idx);
              const isSelected = selIdx >= 0;

              return (
                <div
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  className={`p-4 rounded-2xl cursor-pointer relative flex flex-col items-center justify-center h-28 transition-all duration-200 border 
                    ${
                      isSelected
                        ? "border-emerald-500/50 bg-emerald-900/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-[1.02]"
                        : "border-slate-700/50 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-500/50"
                    } 
                    ${isSubmitted ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`sprite-${p.toLowerCase().replaceAll(" ", "-").replaceAll("’", "")} transform scale-110 mb-3 transition-transform ${isSelected ? "scale-125" : ""}`}
                  />
                  <span
                    className={`font-semibold text-xs tracking-wide ${isSelected ? "text-emerald-400" : "text-slate-300"}`}
                  >
                    {trEngToKor(p)}
                  </span>

                  {/* 선택 순서 인디케이터 */}
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
                      {selIdx + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={mySelection.length !== reqCount || isSubmitted}
        className={`mt-10 px-12 py-4 rounded-2xl font-bold text-base transition-all duration-300 z-10
          ${
            isSubmitted
              ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-wait"
              : mySelection.length === reqCount
                ? "bg-slate-100 hover:bg-white text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                : "bg-slate-800/50 text-slate-500 border border-slate-700/50 cursor-not-allowed"
          }
        `}
      >
        {isSubmitted
          ? "상대방 대기 중..."
          : mySelection.length === reqCount
            ? "엔트리 제출하기"
            : `${mySelection.length} / ${reqCount} 마리 선택됨`}
      </button>
    </div>
  );
}
