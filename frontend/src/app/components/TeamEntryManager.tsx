import React, { useState } from "react";
import { Pokemon, parsePokemonTeam } from "../utils/JsonParser";

interface Props {
  onTeamConfirm: (selectedTeam: Pokemon[]) => void;
}

export const TeamEntryManager = ({ onTeamConfirm }: Props) => {
  const [rawTeam, setRawTeam] = useState<Pokemon[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // 1. 파일 업로드 및 파싱
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const parsed = parsePokemonTeam(json);
        setRawTeam(parsed);
        // 6마리 이하라면 자동 선택, 이상이면 사용자 선택 유도
        setSelectedIndices(parsed.length <= 6 ? parsed.map((_, i) => i) : []);
      } catch (err) {
        alert("JSON 파일 형식이 올바르지 않습니다.");
      }
    };
    reader.readAsText(file);
  };

  // 2. 포켓몬 선택 토글
  const toggleSelect = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      if (selectedIndices.length >= 6) {
        alert("최대 6마리까지만 선택할 수 있습니다.");
        return;
      }
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-900 text-white">
      <h2 className="text-xl font-bold mb-4">팀 업로드 및 엔트리 설정</h2>

      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="mb-4 block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
      />

      {rawTeam.length > 0 && (
        <>
          <p className="mb-2 text-sm text-blue-400">
            {rawTeam.length > 6
              ? `출전할 포켓몬을 선택해주세요 (현재: ${selectedIndices.length}/6)`
              : "팀 정보가 확인되었습니다."}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {rawTeam.map((p, idx) => (
              <div
                key={idx}
                onClick={() => toggleSelect(idx)}
                className={`p-3 border rounded cursor-pointer transition ${
                  selectedIndices.includes(idx) ? "border-blue-500 bg-blue-900/30" : "border-gray-700 bg-gray-800"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold">{p.nickname || p.species_kor}</span>
                    <span className="text-xs text-gray-400 ml-2">({p.species_kor})</span>
                  </div>
                  <div className="text-xs px-2 py-1 rounded bg-gray-700">{p.gender}</div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  타입: {p.types.join(", ")} | 특성: {p.ability}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                  {Object.entries(p.final_stats).map(([stat, val]) => (
                    <div key={stat}>
                      {stat}: {val}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            disabled={selectedIndices.length === 0 || (rawTeam.length >= 6 && selectedIndices.length !== 6)}
            onClick={() => onTeamConfirm(rawTeam.filter((_, i) => selectedIndices.includes(i)))}
            className="w-full py-3 bg-green-600 hover:bg-green-700 rounded font-bold disabled:bg-gray-600"
          >
            {selectedIndices.length}마리로 배틀 시작하기
          </button>
        </>
      )}
    </div>
  );
};
