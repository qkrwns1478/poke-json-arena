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
    if (isSubmitted) return; // 이미 제출했으면 조작 불가
    setMySelection((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : prev.length < reqCount ? [...prev, idx] : prev,
    );
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    onSubmitSelection(mySelection);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center justify-center">
      <h2 className="text-3xl font-bold mb-8 text-yellow-400 drop-shadow-md">출전 포켓몬 선택 ({reqCount}마리)</h2>
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl">
        <div className="flex-1 bg-gray-800 p-6 rounded-lg border border-red-500 shadow-xl relative">
          <div className="absolute top-0 right-0 bg-red-600 text-xs px-3 py-1 font-bold rounded-bl-lg">OPPONENT</div>
          <h3 className="text-xl font-bold mb-6 text-red-400">상대방 파티</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {oppFullTeam.map((p, idx) => (
              <div key={idx} className="p-4 border border-gray-700 bg-gray-900 rounded flex flex-col items-center">
                <div className={`sprite-${p.toLowerCase().replace(" ", "-")} transform scale-125 mb-2`} />
                <span className="font-bold text-sm text-gray-300">{trEngToKor(p)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-gray-800 p-6 rounded-lg border border-blue-500 shadow-xl relative">
          <div className="absolute top-0 right-0 bg-blue-600 text-xs px-3 py-1 font-bold rounded-bl-lg">MY TEAM</div>
          <h3 className="text-xl font-bold mb-6 text-blue-400">나의 파티 (1번 = 선봉)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {myFullTeam.map((p, idx) => {
              const selIdx = mySelection.indexOf(idx);
              return (
                <div
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  className={`p-4 border rounded cursor-pointer relative flex flex-col items-center ${selIdx >= 0 ? "border-yellow-400 bg-yellow-900/30" : "border-gray-700 bg-gray-900"} ${isSubmitted ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className={`sprite-${p.toLowerCase().replace(" ", "-")} transform scale-125 mb-2`} />
                  <span className={`font-bold text-sm ${selIdx >= 0 ? "text-yellow-400" : "text-gray-300"}`}>
                    {trEngToKor(p)}
                  </span>
                  {selIdx >= 0 && (
                    <div className="absolute -top-2 -right-2 bg-yellow-500 text-black w-7 h-7 rounded-full flex items-center justify-center font-black">
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
        className="mt-10 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-400 px-12 py-4 rounded-full font-bold text-xl transition"
      >
        {isSubmitted
          ? "상대방 대기 중..."
          : mySelection.length === reqCount
            ? "선택 완료"
            : `${mySelection.length} / ${reqCount} 마리 선택됨`}
      </button>
    </div>
  );
}
