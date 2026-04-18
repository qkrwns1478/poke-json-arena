import React from "react";
import { Pokemon, parsePokemonTeam } from "../utils/JsonParser";

interface Props {
  onTeamConfirm: (selectedTeam: Pokemon[]) => void;
}

export const TeamEntryManager = ({ onTeamConfirm }: Props) => {
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
        alert("JSON 파일 형식이 올바르지 않습니다.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-5 border border-gray-700 rounded-lg bg-gray-900 text-white shadow-inner mb-4">
      <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
        <h2 className="text-xl font-bold text-blue-400">내 파티 데이터 (JSON) 업로드</h2>
      </div>

      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
      />
    </div>
  );
};
