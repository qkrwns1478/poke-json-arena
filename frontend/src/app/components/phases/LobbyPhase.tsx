import { useState } from "react";
import { AvailableRoom, RoomSettings } from "@/app/types/battle";
import { Plus, RefreshCw, Info } from "lucide-react";
import "@/assets/sprites/spritesheet-2H5N5RW5.css";

interface Props {
  availableRooms: AvailableRoom[];
  onCreateRoom: (settings: RoomSettings) => void;
  onJoinRoom: (roomId: string) => void;
  onRefresh: () => void;
}

const ToggleSwitch = ({
  checked,
  onChange,
  activeColor = "bg-blue-500",
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  activeColor?: string;
}) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <div className="w-11 h-6 bg-slate-700/50 peer-focus:outline-none rounded-full peer transition-colors peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all shadow-inner"></div>
    <div
      className={`absolute inset-0 rounded-full transition-opacity opacity-0 peer-checked:opacity-100 ${activeColor} -z-10`}
      style={{ top: 0, left: 0, width: "2.75rem", height: "1.5rem" }}
    ></div>
  </label>
);

export default function LobbyPhase({ availableRooms, onCreateRoom, onJoinRoom, onRefresh }: Props) {
  const [createSettings, setCreateSettings] = useState<RoomSettings>({
    format: 6,
    allowMega: true,
    allowZMove: true,
    noLimit: false,
    allowRevert: false,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-800/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="z-10 text-center mb-14">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-100 drop-shadow-sm">
          POKÉ JSON ARENA
        </h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl z-10">
        {/* 방 만들기 카드 */}
        <div className="flex-1 bg-slate-800/40 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col gap-8 transition-all hover:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">새로운 배틀 생성</h2>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
              <span className="text-slate-300 font-medium text-sm">배틀 포맷</span>
              <select
                className="bg-slate-900/50 text-slate-200 px-4 py-2 rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer text-sm font-medium"
                value={createSettings.format}
                onChange={(e) => setCreateSettings({ ...createSettings, format: Number(e.target.value) })}
              >
                <option value={3}>3v3 싱글</option>
                <option value={6}>6v6 싱글</option>
              </select>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="sprite-icon-mega" />
                <span className="text-slate-300 font-medium text-sm">메가진화 허용</span>
              </div>
              <ToggleSwitch
                checked={createSettings.allowMega}
                onChange={(c) => setCreateSettings({ ...createSettings, allowMega: c })}
                activeColor="bg-blue-500"
              />
            </div>

            <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="sprite-icon-zmove" />
                <span className="text-slate-300 font-medium text-sm">Z기술 허용</span>
              </div>
              <ToggleSwitch
                checked={createSettings.allowZMove}
                onChange={(c) => setCreateSettings({ ...createSettings, allowZMove: c })}
                activeColor="bg-blue-500"
              />
            </div>

            <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-1.5 relative group">
                <span className="text-slate-300 font-medium text-sm">기믹 제한 해제</span>
                <Info className="w-3.5 h-3.5 text-slate-800 cursor-help transition-colors group-hover:text-slate-400" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 z-20 pointer-events-none">
                  <div className="text-[12px] leading-relaxed text-slate-300 space-y-2">
                    <p>
                      <strong className="text-blue-400">OFF:</strong> 메가진화와 Z기술을 합쳐서{" "}
                      <span className="text-slate-100 font-semibold">총 1번</span>만 사용 가능 (기본값)
                    </p>
                    <p>
                      <strong className="text-emerald-400">ON:</strong> 메가진화와 Z기술을{" "}
                      <span className="text-slate-100 font-semibold">각각 1번씩</span> 사용 가능
                    </p>
                  </div>
                  <div className="absolute top-full left-4 -mt-px border-[6px] border-transparent border-t-slate-700"></div>
                </div>
              </div>
              <ToggleSwitch
                checked={createSettings.noLimit}
                onChange={(c) => setCreateSettings({ ...createSettings, noLimit: c })}
                activeColor="bg-blue-500"
              />
            </div>

            <div className="flex justify-between items-center py-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-medium text-sm">되돌리기 허용</span>
              </div>
              <ToggleSwitch
                checked={createSettings.allowRevert}
                onChange={(c) => setCreateSettings({ ...createSettings, allowRevert: c })}
                activeColor="bg-blue-500"
              />
            </div>
          </div>

          <button
            onClick={() => onCreateRoom(createSettings)}
            className="mt-auto group w-full bg-slate-100 hover:bg-white text-slate-900 font-bold py-4 rounded-2xl transition-all duration-200 flex justify-center items-center gap-2"
          >
            방 생성하기
            <Plus className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* 방 참가 카드 */}
        <div className="flex-1 bg-slate-800/40 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col gap-6 transition-all hover:bg-slate-800/50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 tracking-tight">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                활성화된 배틀
              </h2>
            </div>
            <button
              onClick={handleRefresh}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-700/50 transition-colors focus:outline-none"
              title="새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-slate-100" : ""}`} />
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-3 mt-2 overflow-y-auto max-h-[380px] custom-scrollbar pr-2">
            {availableRooms.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <p className="font-medium">대기 중인 방이 없습니다.</p>
              </div>
            ) : (
              availableRooms.map((room) => (
                <div
                  key={room.id}
                  className="group bg-slate-900/40 p-4 rounded-2xl border border-slate-700/30 flex justify-between items-center transition-all hover:border-slate-500/50 hover:bg-slate-800/80"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200 tracking-tight text-lg">
                      #{room.id.split("-")[0].toUpperCase()}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-medium tracking-wide">
                      <span className="bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                        {room.settings.format}v{room.settings.format}
                      </span>
                      {room.settings.allowMega && <span>MEGA</span>}
                      {room.settings.allowZMove && <span>Z-MOVE</span>}
                      {room.settings.noLimit && <span>NO-LIMIT</span>}
                      {room.settings.allowRevert && <span>REVERT</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => onJoinRoom(room.id)}
                    className="bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-semibold py-2 px-5 rounded-xl text-sm transition-all duration-200"
                  >
                    입장
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
