import express from "express";
import http from "http";
import { Server } from "socket.io";
import { BattleStreams, Teams, Dex } from "@pkmn/sim";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const customPath = path.resolve(__dirname, "../frontend/src/data/custom.json");
const customData = JSON.parse(fs.readFileSync(customPath, "utf8"));

for (const [id, data] of Object.entries(customData)) {
  Dex.data.Pokedex[id] = data;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new Map();
const playerRoomMap = new Map();

const generateRoomId = () => crypto.randomUUID();

function getRoomDTO(room) {
  return {
    id: room.id,
    host: room.host,
    settings: room.settings,
    status: room.status,
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      ready: p.ready,
      hasTeam: !!p.parsedTeam,
    })),
  };
}

// 참가 가능한 방 목록 반환
function getJoinableRooms() {
  const list = [];
  for (const room of rooms.values()) {
    if (room.status === "room" && Object.keys(room.players).length < 2) {
      list.push({
        id: room.id,
        settings: room.settings,
        playersCount: Object.keys(room.players).length,
      });
    }
  }
  return list;
}

// 로비에 있는 유저들에게 방 목록 갱신
function broadcastRoomList() {
  io.emit("room-list-update", getJoinableRooms());
}

io.on("connection", (socket) => {
  // 처음 연결 시 현재 열려 있는 방 목록 전송
  socket.emit("room-list-update", getJoinableRooms());

  // 수동 새로고침 요청
  socket.on("request-room-list", () => {
    socket.emit("room-list-update", getJoinableRooms());
  });

  // 1. 방 만들기
  socket.on("create-room", (settings) => {
    const sanitized = {
      format: settings?.format === 6 ? 6 : 3,
      allowMega: !!settings?.allowMega,
      allowZMove: !!settings?.allowZMove,
      noLimit: !!settings?.noLimit,
      allowRevert: !!settings?.allowRevert,
    };
    const roomId = generateRoomId();
    const room = {
      id: roomId,
      host: socket.id,
      settings: sanitized,
      players: {
        [socket.id]: { id: socket.id, ready: false, teamString: null, parsedTeam: null, selectedTeamIndices: null },
      },
      status: "room",
      game: null,
    };
    rooms.set(roomId, room);
    playerRoomMap.set(socket.id, roomId);
    socket.join(roomId);
    socket.emit("log", `[시스템] ${roomId} 방을 생성했습니다.`);
    io.to(roomId).emit("room-update", getRoomDTO(room));
    broadcastRoomList(); // 방 목록 갱신
  });

  // 2. 방 참가
  socket.on("join-room", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("log", "[시스템] 방을 찾을 수 없습니다.");
    if (Object.keys(room.players).length >= 2) return socket.emit("log", "[시스템] 방이 꽉 찼습니다.");
    if (room.status !== "room") return socket.emit("log", "[시스템] 이미 게임이 진행 중인 방입니다.");

    room.players[socket.id] = {
      id: socket.id,
      ready: false,
      teamString: null,
      parsedTeam: null,
      selectedTeamIndices: null,
    };
    playerRoomMap.set(socket.id, roomId);
    socket.join(roomId);
    socket.emit("log", `[시스템] ${roomId} 방에 참가했습니다.`);
    io.to(roomId).emit("room-update", getRoomDTO(room));
    broadcastRoomList(); // 방 목록 갱신
  });

  // 3. 방 나가기
  const handleLeaveRoom = (socketId) => {
    const roomId = playerRoomMap.get(socketId);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    // 맵에서 지우기 전에 소켓 룸에서 명시적으로 퇴장시킴
    const socketInstance = io.sockets.sockets.get(socketId);
    if (socketInstance) socketInstance.leave(roomId);

    delete room.players[socketId];
    playerRoomMap.delete(socketId);

    if (Object.keys(room.players).length === 0) {
      rooms.delete(roomId);
    } else {
      if (room.host === socketId) room.host = Object.keys(room.players)[0]; // 방장 양도

      if (room.status !== "room") {
        room.game?.streams?.omniscient?.writeEnd?.();
        room.status = "room";
        room.game = null;

        // 남은 플레이어의 준비 상태 및 선택 데이터 초기화
        const remainingPlayerId = Object.keys(room.players)[0];
        if (room.players[remainingPlayerId]) {
          room.players[remainingPlayerId].ready = false;
          room.players[remainingPlayerId].selectedTeamIndices = null;
        }

        io.to(roomId).emit("log", `[시스템] 상대방이 나가서 게임이 중단되었습니다.`);
      } else {
        io.to(roomId).emit("log", `[시스템] 상대방이 방을 나갔습니다.`);
      }

      io.to(roomId).emit("room-update", getRoomDTO(room));
    }
    broadcastRoomList(); // 방 목록 갱신
  };

  socket.on("leave-room", () => {
    handleLeaveRoom(socket.id);
  });

  socket.on("disconnect", () => {
    handleLeaveRoom(socket.id);
  });

  // 4. 팀 설정 (엔트리 등록)
  socket.on("set-team", (teamString, callback) => {
    const roomId = playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || !room.players[socket.id]) return;

    if (room.status !== "room") {
      socket.emit("log", "[시스템] 대기방에서만 파티를 등록할 수 있습니다.");
      return;
    }

    try {
      const parsedTeam = Teams.import(teamString);
      if (!parsedTeam || parsedTeam.length === 0) {
        socket.emit("log", "[오류] 올바른 팀 형식이 아닙니다.");
        return;
      }

      room.players[socket.id].teamString = teamString;
      room.players[socket.id].parsedTeam = parsedTeam;
      socket.emit("log", "[시스템] 파티가 등록되었습니다.");
      io.to(roomId).emit("room-update", getRoomDTO(room));

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (e) {
      socket.emit("log", "[오류] 팀 데이터를 파싱하는 중 문제가 발생했습니다.");
    }
  });

  // 5. 준비 완료 토글
  socket.on("toggle-ready", () => {
    const roomId = playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || !room.players[socket.id]) return;
    if (room.status !== "room") return socket.emit("log", "[시스템] 대기방에서만 파티를 등록할 수 있습니다.");
    const player = room.players[socket.id];
    if (!player.parsedTeam) return socket.emit("log", "[시스템] 파티를 먼저 등록해주세요.");
    player.ready = !player.ready;
    io.to(roomId).emit("room-update", getRoomDTO(room));
  });

  // 6. 선봉 선택 단계 시작 (방장 전용)
  socket.on("start-selection", () => {
    const roomId = playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || !room.players[socket.id]) return;
    if (room.status !== "room") return socket.emit("log", "[시스템] 대기방에서만 파티를 등록할 수 있습니다.");

    const pKeys = Object.keys(room.players);
    if (pKeys.length !== 2) return socket.emit("log", "[시스템] 2명의 플레이어가 필요합니다.");
    if (!room.players[pKeys[0]].ready || !room.players[pKeys[1]].ready)
      return socket.emit("log", "[시스템] 모든 플레이어가 준비되지 않았습니다.");
    const fmt = room.settings.format;
    if (room.players[pKeys[0]].parsedTeam.length < fmt || room.players[pKeys[1]].parsedTeam.length < fmt) {
      return socket.emit("log", "[시스템] 팀이 포맷보다 작습니다.");
    }

    room.status = "selection";
    const p1Id = pKeys[0],
      p2Id = pKeys[1];

    io.to(p1Id).emit("selection-start", {
      myTeam: room.players[p1Id].parsedTeam.map((p) => p.species),
      oppTeam: room.players[p2Id].parsedTeam.map((p) => p.species),
    });
    io.to(p2Id).emit("selection-start", {
      myTeam: room.players[p2Id].parsedTeam.map((p) => p.species),
      oppTeam: room.players[p1Id].parsedTeam.map((p) => p.species),
    });
    io.to(roomId).emit("room-update", getRoomDTO(room));
    broadcastRoomList();
  });

  // 7. 출전 포켓몬 선택 완료
  socket.on("submit-selection", (indices) => {
    const roomId = playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.status !== "selection") return;

    const player = room.players[socket.id];
    const teamLen = player?.parsedTeam?.length ?? 0;
    const req = room.settings.format;
    if (
      !Array.isArray(indices) ||
      indices.length !== req ||
      new Set(indices).size !== indices.length ||
      indices.some((i) => !Number.isInteger(i) || i < 0 || i >= teamLen)
    ) {
      return socket.emit("log", "[오류] 잘못된 선택 데이터입니다.");
    }

    player.selectedTeamIndices = indices;
    socket.emit("log", "[시스템] 출전 포켓몬 선택을 완료했습니다. 상대를 기다리는 중...");

    const pKeys = Object.keys(room.players);
    const p1 = room.players[pKeys[0]];
    const p2 = room.players[pKeys[1]];

    // 둘 다 선택을 마쳤다면 배틀 시작
    if (p1.selectedTeamIndices && p2.selectedTeamIndices) {
      startGame(room);
    }
  });

  // 8. 액션 수행
  socket.on("action", (actionString) => {
    const roomId = playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || !room.game || room.game.isDestroyed) return;

    if (socket.id === room.game.p1Id) {
      room.game.inputLog.push({ id: socket.id, cmd: actionString });
      room.game.streams.p1.write(actionString);
      socket.emit("log", `[시스템] 입력 완료: ${actionString}`);
    } else if (socket.id === room.game.p2Id) {
      room.game.inputLog.push({ id: socket.id, cmd: actionString });
      room.game.streams.p2.write(actionString);
      socket.emit("log", `[시스템] 입력 완료: ${actionString}`);
    }
  });

  // --- 되돌리기 기능 관련 소켓 이벤트 ---
  socket.on("request-revert", () => {
    const roomId = playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.status !== "battle" || !room.game || !room.settings.allowRevert) return;

    const opponentId = room.game.p1Id === socket.id ? room.game.p2Id : room.game.p1Id;
    io.to(opponentId).emit("revert-requested");
  });

  socket.on("respond-revert", (accept) => {
    const roomId = playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.status !== "battle" || !room.game) return;

    const opponentId = room.game.p1Id === socket.id ? room.game.p2Id : room.game.p1Id;

    if (!accept) {
      io.to(opponentId).emit("revert-declined");
      return;
    }

    io.to(roomId).emit("revert-accepted");

    // 이전 턴 행동 취소 (양쪽의 마지막 입력 하나씩 제거)
    let p1Removed = false,
      p2Removed = false;
    for (let i = room.game.inputLog.length - 1; i >= 0; i--) {
      if (!p1Removed && room.game.inputLog[i].id === room.game.p1Id) {
        room.game.inputLog.splice(i, 1);
        p1Removed = true;
      } else if (!p2Removed && room.game.inputLog[i].id === room.game.p2Id) {
        room.game.inputLog.splice(i, 1);
        p2Removed = true;
      }
      if (p1Removed && p2Removed) break;
    }

    // 기존 게임 인스턴스의 스트림 구독을 완전히 끊기 위해 execId 증가
    room.game.execId = (room.game.execId || 0) + 1;

    // 프론트엔드의 React 상태가 초기화될 시간을 주기 위해 약간의 지연 후 배틀 재시작
    setTimeout(() => {
      startSimGame(room, true);
    }, 300);
  });
});

function startGame(room) {
  room.status = "battle";
  io.to(room.id).emit("room-update", getRoomDTO(room));

  const pKeys = Object.keys(room.players);
  room.game = {
    streams: null,
    p1Id: pKeys[0],
    p2Id: pKeys[1],
    seed: [
      Math.floor(Math.random() * 65536),
      Math.floor(Math.random() * 65536),
      Math.floor(Math.random() * 65536),
      Math.floor(Math.random() * 65536),
    ], // 고정 시드
    inputLog: [],
    execId: 1, // 실행 인스턴스 ID 부여
  };

  io.to(room.game.p1Id).emit("match-found", { sideId: "p1" });
  io.to(room.game.p2Id).emit("match-found", { sideId: "p2" });
  io.to(room.id).emit("log", "[시스템] 배틀을 시작합니다!");

  startSimGame(room, false);
}

function startSimGame(room, isReplay) {
  io.to(room.game.p1Id).emit("match-found", { sideId: "p1" });
  io.to(room.game.p2Id).emit("match-found", { sideId: "p2" });

  const p1Data = room.players[room.game.p1Id];
  const p2Data = room.players[room.game.p2Id];

  const p1SubTeam = p1Data.selectedTeamIndices.map((i) => p1Data.parsedTeam[i]);
  const p2SubTeam = p2Data.selectedTeamIndices.map((i) => p2Data.parsedTeam[i]);

  const p1Packed = Teams.pack(p1SubTeam);
  const p2Packed = Teams.pack(p2SubTeam);

  const stream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(stream);
  room.game.streams = streams;

  const currentExecId = room.game.execId;

  (async () => {
    for await (const chunk of streams.p1) {
      if (room.game.execId !== currentExecId) break;
      if (chunk.trim()) io.to(room.game.p1Id).emit("battle-log", chunk);
    }
  })();

  (async () => {
    for await (const chunk of streams.p2) {
      if (room.game.execId !== currentExecId) break;
      if (chunk.trim()) io.to(room.game.p2Id).emit("battle-log", chunk);
    }
  })();

  streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: "gen9customgame@@@!teampreview", seed: room.game.seed })}`,
  );
  streams.omniscient.write(`>player p1 ${JSON.stringify({ name: "Player 1", team: p1Packed })}`);
  streams.omniscient.write(`>player p2 ${JSON.stringify({ name: "Player 2", team: p2Packed })}`);

  if (isReplay) {
    for (const input of room.game.inputLog) {
      if (input.id === room.game.p1Id) streams.p1.write(input.cmd);
      if (input.id === room.game.p2Id) streams.p2.write(input.cmd);
    }
  }
}

server.listen(3001, () => {
  console.log("Battle Server running on port 3001");
});
