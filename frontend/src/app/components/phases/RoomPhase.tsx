import { useState } from "react";
import { RoomData } from "@/app/types/battle";
import { TeamEntryManager } from "../TeamEntryManager";
import SAMPLE_TEAMS from "@/data/SampleTeams";
import { Pokemon } from "@/app/utils/JsonParser";

interface Props {
  roomData: RoomData;
  socketId: string | undefined;
  onLeave: () => void;
  onSubmitTeam: (teamStr: string) => void;
  onToggleReady: () => void;
  onStartSelection: () => void;
}

export default function RoomPhase({
  roomData,
  socketId,
  onLeave,
  onSubmitTeam,
  onToggleReady,
  onStartSelection,
}: Props) {
  const [teamString, setTeamString] = useState("");
  const [customTeam, setCustomTeam] = useState<Pokemon[] | null>(null);

  const isHost = roomData.host === socketId;
  const allReady = roomData.players.length === 2 && roomData.players.every((p) => p.ready);
  const myData = roomData.players.find((p) => p.id === socketId);

  const handleReadyClick = () => {
    if (!myData?.ready) {
      if (!teamString.trim()) {
        alert("파티 데이터를 먼저 업로드하거나 샘플 파티를 선택해주세요.");
        return;
      }
      onSubmitTeam(teamString);
      setTimeout(() => onToggleReady(), 100); // 파티 데이터 전송 직후 준비 상태 전환
    } else {
      onToggleReady();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 w-full max-w-4xl shadow-2xl">
        <div className="flex justify-between items-end mb-6 border-b border-gray-700 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400 tracking-wide">
              Room: {roomData.id.split("-")[0].toUpperCase()}
            </h1>
            <p className="text-gray-400 text-sm mt-2">
              포맷: {roomData.settings.format}v{roomData.settings.format}
            </p>
          </div>
          <button
            onClick={onLeave}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold text-sm transition"
          >
            방 나가기
          </button>
        </div>

        {/* 플레이어 상태 표시창 */}
        <div className="flex gap-4 mb-6">
          {roomData.players.map((p) => (
            <div
              key={p.id}
              className="flex-1 bg-gray-900 p-5 rounded border border-gray-600 flex justify-between items-center shadow-inner"
            >
              <span className="font-bold text-lg">
                {p.id === roomData.host ? "👑 방장" : "👤 참가자"} {p.id === socketId ? "(나)" : ""}
              </span>
              <span
                className={`px-4 py-1.5 rounded text-sm font-bold ${p.ready ? "bg-green-600 text-white shadow-[0_0_10px_rgba(22,163,74,0.5)]" : "bg-gray-700 text-gray-400"}`}
              >
                {p.ready ? "준비 완료" : "대기 중"}
              </span>
            </div>
          ))}
          {roomData.players.length < 2 && (
            <div className="flex-1 bg-gray-900 p-5 rounded border border-gray-600 border-dashed flex justify-center items-center text-gray-500 font-bold">
              상대를 기다리는 중...
            </div>
          )}
        </div>

        {/* 파티 업로드 및 설정 영역 */}
        <div className="mb-6">
          {!customTeam ? (
            <TeamEntryManager
              onTeamConfirm={(team) => {
                setTeamString(team.map((p) => p.PSformat).join("\n\n"));
                setCustomTeam(team);
              }}
            />
          ) : (
            <div className="bg-gray-900 p-4 border border-blue-500 rounded-lg flex justify-between items-center mb-4 animate-fadeIn">
              <div className="flex gap-2 flex-wrap">
                {customTeam.map((p, idx) => (
                  <span key={idx} className="bg-blue-900 px-3 py-1 rounded-full text-sm font-semibold">
                    {p.nickname || p.species_kor}
                  </span>
                ))}
              </div>
              <button
                onClick={() => {
                  setCustomTeam(null);
                  setTeamString("");
                }}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm transition"
              >
                다시 업로드
              </button>
            </div>
          )}

          {!customTeam && (
            <>
              <textarea
                value={teamString}
                onChange={(e) => setTeamString(e.target.value)}
                className="w-full h-32 bg-black text-green-400 p-4 rounded font-mono mt-2 border border-gray-700 focus:outline-none focus:border-yellow-400"
                placeholder="PS 포맷 텍스트 입력..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setTeamString(SAMPLE_TEAMS.team1)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm transition"
                >
                  샘플 1 불러오기
                </button>
                <button
                  onClick={() => setTeamString(SAMPLE_TEAMS.team2)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm transition"
                >
                  샘플 2 불러오기
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-4 mt-8 border-t border-gray-700 pt-6">
          <button
            onClick={handleReadyClick}
            disabled={!myData?.ready && !teamString.trim()}
            className={`flex-1 font-bold py-4 rounded text-xl transition shadow-lg ${myData?.ready ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"} ${!myData?.ready && !teamString.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {myData?.ready ? "준비 취소" : "준비 완료"}
          </button>

          {isHost && (
            <button
              onClick={onStartSelection}
              disabled={!allReady}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 font-bold py-4 rounded text-xl transition shadow-lg"
            >
              게임 시작
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
