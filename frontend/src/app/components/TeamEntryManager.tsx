import React from "react";
import { Pokemon, parsePokemonTeam } from "../utils/JsonParser";
import "@/assets/sprites/spritesheet-2H5N5RW5.css";

interface Props {
  customTeam: Pokemon[] | null;
  onTeamConfirm: (selectedTeam: Pokemon[]) => void;
  onClear: () => void;
}

export const TeamEntryManager = ({ customTeam, onTeamConfirm, onClear }: Props) => {
  // 1. 파일 업로드 및 파싱
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const parsed = parsePokemonTeam(json);
        onTeamConfirm(parsed); // 업로드 완료 즉시 상위 컴포넌트에 파티 전달
      } catch (err) {
        console.error("[TeamEntryManager] JSON parse failed:", err);
        alert("JSON 파일 형식이 올바르지 않습니다.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="p-5 border border-gray-700 rounded-lg bg-gray-900 text-white shadow-inner mb-4">
      <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
        <h2 className="text-xl font-bold text-blue-400">내 파티 데이터 업로드</h2>
        {/* 파티가 로드되었을 때만 초기화 버튼 표시 */}
        {customTeam && (
          <button
            onClick={onClear}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm transition font-bold shadow-sm"
          >
            초기화
          </button>
        )}
      </div>

      {!customTeam ? (
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
        />
      ) : (
        <div className="animate-fadeIn">
          <p className="mb-3 text-sm text-yellow-400 font-semibold bg-yellow-900/30 p-2 rounded border border-yellow-700/50">
            팀 정보가 성공적으로 적용되었습니다. 하단의 [준비 완료]를 눌러주세요.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
            {customTeam.map((p, idx) => (
              <div
                key={idx}
                className="p-3 border border-gray-700 bg-gray-800 rounded transition flex flex-col justify-between hover:border-gray-500 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    {p.nickname ? (
                      <>
                        <span className="font-bold text-gray-100">{p.nickname}</span>
                        <span className="text-xs text-gray-400 ml-1">({p.species_kor})</span>
                      </>
                    ) : (
                      <span className="font-bold text-gray-100">{p.species_kor}</span>
                    )}
                    <span
                      className={`ml-1 font-bold ${p.gender && (p.gender === "수컷" ? "text-blue-400" : "text-red-400")}`}
                    >
                      {p.gender === "수컷" ? "♂" : p.gender === "암컷" ? "♀" : ""}
                    </span>
                  </div>
                  <div
                    className={`sprite-${p.species_eng.toLowerCase().replace(" ", "-")} scale-75 transform origin-top-right`}
                  ></div>
                </div>

                <div className="text-xs text-gray-400 mt-1 border-t border-gray-700 pt-1">
                  <span className="text-gray-300">타입:</span> {p.types.join(", ")} <br />
                  <span className="text-gray-300">특성:</span> {p.ability}
                </div>

                <div className="mt-2 grid grid-cols-3 gap-x-1 gap-y-0.5 text-[10px] font-mono bg-black/30 p-1.5 rounded">
                  {Object.entries(p.final_stats).map(([stat, val]) => {
                    let statColor = "text-gray-300";
                    if (stat === "HP") statColor = "text-green-400";
                    if (stat === "Atk") statColor = "text-red-400";
                    if (stat === "Def") statColor = "text-orange-400";
                    if (stat === "SpA") statColor = "text-blue-400";
                    if (stat === "SpD") statColor = "text-yellow-400";
                    if (stat === "Spe") statColor = "text-pink-400";

                    return (
                      <div key={stat} className="flex justify-between">
                        <span className={statColor}>{stat}</span> <span>{val}</span>
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
