import React from "react";
import { Pokemon, parsePokemonTeam } from "../utils/JsonParser";
import { TypeBadge } from "@/app/utils/Types";
import "@/assets/sprites/spritesheet-2H5N5RW5.css";

interface Props {
  customTeam: Pokemon[] | null;
  onTeamConfirm: (selectedTeam: Pokemon[]) => void;
  onClear: () => void;
}

export const TeamEntryManager = ({ customTeam, onTeamConfirm, onClear }: Props) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const parsed = parsePokemonTeam(json);
        onTeamConfirm(parsed);
      } catch (err) {
        console.error("[TeamEntryManager] JSON parse failed:", err);
        alert("JSON 파일 형식이 올바르지 않습니다.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-6 mb-6">
      <div className="flex justify-between items-end mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">파티 데이터</h2>
          {!customTeam && (<p className="text-xs text-slate-400 mt-1">사용할 포켓몬 JSON 데이터를 업로드하세요.</p>)}
        </div>
        {customTeam && (
          <button
            onClick={onClear}
            className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors bg-white/5 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-transparent hover:border-rose-500/30"
          >
            초기화
          </button>
        )}
      </div>

      {!customTeam ? (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-700/50 border-dashed rounded-xl cursor-pointer bg-slate-900/30 hover:bg-slate-800/50 hover:border-slate-500/50 transition-all group">
          <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300">
            클릭하여 JSON 파일 업로드
          </span>
          <span className="text-[10px] text-slate-500 mt-1">.json 파일 형식 지원</span>
          <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
        </label>
      ) : (
        <div className="animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-2">
            {customTeam.map((p, idx) => (
              <div
                key={idx}
                className="p-4 border border-slate-700/50 bg-slate-800/40 rounded-xl transition-colors hover:border-slate-500/50 flex flex-col justify-between group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-100">{p.nickname || p.species_kor}</span>
                      <span
                        className={`text-[10px] font-bold ${p.gender === "수컷" ? "text-blue-400" : p.gender === "암컷" ? "text-rose-400" : ""}`}
                      >
                        {p.gender === "수컷" ? "♂" : p.gender === "암컷" ? "♀" : ""}
                      </span>
                    </div>
                    {p.nickname && <span className="text-[11px] text-slate-400">{p.species_kor}</span>}
                  </div>
                  <div
                    className={`sprite-${p.species_eng.toLowerCase().replace(" ", "-").replaceAll("'", "")} origin-top-right opacity-90 group-hover:opacity-100 transition-opacity`}
                  ></div>
                </div>

                <div className="text-[11px] text-slate-400 mt-2 border-t border-slate-700/50 pt-2 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">타입</span>
                    {p.types.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {p.types.map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">특성</span> <span>{p.ability}</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-1 text-[10px] font-mono bg-slate-900/60 p-2 rounded-lg">
                  {Object.entries(p.final_stats).map(([stat, val]) => {
                    return (
                      <div key={stat} className="flex justify-between items-center">
                        <span className={"text-slate-400"}>{stat}</span>
                        <span className="text-slate-300">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
