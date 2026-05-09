import { useState } from "react";
import { RoomData } from "@/app/types/battle";
import { TeamEntryManager } from "../TeamEntryManager";
import { Pokemon } from "@/app/utils/JsonParser";
import SAMPLE_TEAMS from "@/data/SampleTeams";

interface Props {
  roomData: RoomData;
  socketId: string | undefined;
  onLeave: () => void;
  onSubmitTeam: (teamStr: string, callback?: () => void) => void;
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
      onSubmitTeam(teamString, onToggleReady);
    } else {
      onToggleReady();
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 글래스모피즘 메인 컨테이너 */}
      <div className="bg-slate-800/40 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 w-full max-w-4xl shadow-2xl z-10">
        {/* 헤더 영역 */}
        <div className="flex justify-between items-start mb-8 border-b border-slate-700/50 pb-5">
          <div>
            <h1 className="text-3xl font-black text-slate-100 tracking-tighter">
              ROOM <span className="text-slate-400">#{roomData.id.split("-")[0].toUpperCase()}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 font-medium tracking-wide">
              {roomData.settings.format} vs {roomData.settings.format} 싱글 배틀
            </p>
          </div>
          <button
            onClick={onLeave}
            className="text-xs font-semibold text-rose-400/80 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 px-4 py-2 rounded-xl border border-transparent hover:border-rose-500/30 transition-all"
          >
            방 나가기
          </button>
        </div>

        {/* 플레이어 상태 표시창 */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {roomData.players.map((p) => (
            <div
              key={p.id}
              className="flex-1 bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50 flex justify-between items-center transition-colors"
            >
              <div className="flex items-center gap-2">
                {p.id === roomData.host ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    HOST
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/50">
                    GUEST
                  </span>
                )}
                <span className="font-bold text-slate-200">{p.id === socketId ? "나" : "상대방"}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* 준비 상태 LED 인디케이터 */}
                <span className={`relative flex h-2.5 w-2.5`}>
                  {p.ready && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${p.ready ? "bg-emerald-500" : "bg-slate-600"}`}
                  ></span>
                </span>
                <span
                  className={`text-sm font-semibold tracking-wide ${p.ready ? "text-emerald-400" : "text-slate-500"}`}
                >
                  {p.ready ? "준비 완료" : "대기 중"}
                </span>
              </div>
            </div>
          ))}

          {/* 상대방 대기 중 슬롯 */}
          {roomData.players.length < 2 && (
            <div className="flex-1 bg-slate-900/20 p-5 rounded-2xl border border-slate-700/30 border-dashed flex justify-center items-center">
              <span className="text-slate-500 font-medium text-sm animate-pulse">상대방을 기다리는 중...</span>
            </div>
          )}
        </div>

        {/* 파티 업로드 관리자 */}
        <TeamEntryManager
          customTeam={customTeam}
          onTeamConfirm={(team) => {
            setTeamString(team.map((p) => p.PSformat).join("\n\n"));
            setCustomTeam(team);
          }}
          onClear={() => {
            setCustomTeam(null);
            setTeamString("");
          }}
        />

        {/* 수동 입력 및 샘플 파티 (업로드 안 했을 때만 보임) */}
        {!customTeam && (
          <div className="animate-fadeIn mb-8">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs text-slate-400 font-medium">또는 Pokemon Showdown 포맷 텍스트 입력</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setTeamString(SAMPLE_TEAMS.team1)}
                  className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700/50"
                >
                  샘플 파티 1
                </button>
                <button
                  onClick={() => setTeamString(SAMPLE_TEAMS.team2)}
                  className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700/50"
                >
                  샘플 파티 2
                </button>
              </div>
            </div>
            <textarea
              value={teamString}
              onChange={(e) => setTeamString(e.target.value)}
              className="w-full h-32 bg-slate-900/50 text-slate-300 p-4 rounded-xl font-mono text-xs border border-slate-700/50 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 custom-scrollbar resize-none placeholder:text-slate-600"
              placeholder="여기에 PS 텍스트를 붙여넣으세요..."
            />
          </div>
        )}

        {/* 하단 액션 버튼 */}
        <div className="flex gap-4 mt-8 border-t border-slate-700/50 pt-8">
          <button
            onClick={handleReadyClick}
            disabled={!myData?.ready && !teamString.trim()}
            className={`flex-1 font-bold py-4 rounded-2xl text-base transition-all duration-200 
              ${
                myData?.ready
                  ? "bg-slate-700 hover:bg-slate-600 text-slate-200"
                  : "bg-slate-100 hover:bg-white text-slate-900"
              } 
              ${!myData?.ready && !teamString.trim() ? "opacity-30 cursor-not-allowed" : "shadow-lg"}
            `}
          >
            {myData?.ready ? "준비 취소" : "준비 완료"}
          </button>

          {isHost && (
            <button
              onClick={onStartSelection}
              disabled={!allReady}
              className={`flex-1 font-bold py-4 rounded-2xl text-base transition-all duration-200
                ${
                  allReady
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)]"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                }
              `}
            >
              게임 시작
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
