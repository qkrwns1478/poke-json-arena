import { useState } from "react";
import { AvailableRoom, RoomSettings } from "@/app/types/battle";

interface Props {
  availableRooms: AvailableRoom[];
  onCreateRoom: (settings: RoomSettings) => void;
  onJoinRoom: (roomId: string) => void;
  onRefresh: () => void;
}

export default function LobbyPhase({ availableRooms, onCreateRoom, onJoinRoom, onRefresh }: Props) {
  const [createSettings, setCreateSettings] = useState<RoomSettings>({
    format: 6,
    allowMega: true,
    allowZMove: true,
    noLimit: false,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-8 text-center text-yellow-400 drop-shadow-md">Poke JSON Arena</h1>
      <div className="flex gap-8 w-full max-w-4xl">
        <div className="flex-1 bg-gray-800 p-8 rounded-lg border border-gray-700 shadow-xl flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-blue-400 border-b border-gray-700 pb-2">방 만들기</h2>
          <div className="flex flex-col gap-3 mt-2">
            <label className="flex justify-between items-center bg-gray-900 p-3 rounded">
              <span>배틀 포맷</span>
              <select
                className="bg-gray-700 text-white p-1 rounded"
                value={createSettings.format}
                onChange={(e) => setCreateSettings({ ...createSettings, format: Number(e.target.value) })}
              >
                <option value={3}>3v3 싱글</option>
                <option value={6}>6v6 싱글</option>
              </select>
            </label>
            <label className="flex justify-between items-center bg-gray-900 p-3 rounded cursor-pointer">
              <span>메가진화 허용</span>
              <input
                type="checkbox"
                className="w-5 h-5 accent-blue-500"
                checked={createSettings.allowMega}
                onChange={(e) => setCreateSettings({ ...createSettings, allowMega: e.target.checked })}
              />
            </label>
            <label className="flex justify-between items-center bg-gray-900 p-3 rounded cursor-pointer">
              <span>Z기술 허용</span>
              <input
                type="checkbox"
                className="w-5 h-5 accent-orange-500"
                checked={createSettings.allowZMove}
                onChange={(e) => setCreateSettings({ ...createSettings, allowZMove: e.target.checked })}
              />
            </label>
            <label className="flex justify-between items-center bg-gray-900 p-3 rounded cursor-pointer">
              <span>횟수 제한 해제</span>
              <input
                type="checkbox"
                className="w-5 h-5 accent-red-500"
                checked={createSettings.noLimit}
                onChange={(e) => setCreateSettings({ ...createSettings, noLimit: e.target.checked })}
              />
            </label>
          </div>
          <button
            onClick={() => onCreateRoom(createSettings)}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition"
          >
            방 생성
          </button>
        </div>
        <div className="flex-1 bg-gray-800 p-8 rounded-lg border border-gray-700 shadow-xl flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-gray-700 pb-2">
            <h2 className="text-2xl font-bold text-green-400">방 참가</h2>
            <button
              type="button"
              className="text-sm text-gray-400 cursor-pointer hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400"
              onClick={onRefresh}
            >
              ↻ 새로고침
            </button>
          </div>
          <div className="flex-1 flex flex-col gap-3 mt-2 overflow-y-auto max-h-64 custom-scrollbar pr-2">
            {availableRooms.length === 0 ? (
              <div className="text-center text-gray-500 py-8 bg-gray-900 rounded border border-gray-700 border-dashed">
                참가 가능한 방이 없습니다.
              </div>
            ) : (
              availableRooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-gray-900 p-3 rounded border border-gray-600 flex justify-between items-center shadow-md hover:border-green-500 transition"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-yellow-400 tracking-wider">Room: {room.id.split("-")[0].toUpperCase()}</span>
                    <span className="text-xs text-gray-400 mt-1">
                      {room.settings.format}v{room.settings.format} | 메가{room.settings.allowMega ? "O" : "X"} | Z기술{room.settings.allowZMove ? "O" : "X"}
                    </span>
                  </div>
                  <button
                    onClick={() => onJoinRoom(room.id)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm transition shadow ml-2"
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
