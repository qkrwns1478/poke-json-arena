// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { BattleStreams, Teams } from '@pkmn/sim';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let waitingPlayer = null; 
const playerGameMap = new Map(); 

io.on('connection', (socket) => {
  
  socket.on('search-match', (teamString) => {
    let packedTeam = '';
    try {
      const parsedTeam = Teams.import(teamString);
      if (!parsedTeam || parsedTeam.length === 0) {
        socket.emit('log', '[오류] 올바른 팀 형식이 아닙니다.');
        return;
      }
      packedTeam = Teams.pack(parsedTeam);
    } catch (e) {
      socket.emit('log', '[오류] 팀 데이터를 파싱하는 중 문제가 발생했습니다.');
      return;
    }

    if (!waitingPlayer) {
      waitingPlayer = { socket, team: packedTeam };
      socket.emit('log', '대기열에 등록되었습니다. 상대를 기다리는 중...');
    } else {
      const p1 = waitingPlayer.socket;
      const p1Team = waitingPlayer.team;
      const p2 = socket;
      const p2Team = packedTeam;
      waitingPlayer = null;

      const stream = new BattleStreams.BattleStream();
      const streams = BattleStreams.getPlayerStreams(stream);
      
      const game = { streams, p1Id: p1.id, p2Id: p2.id };
      playerGameMap.set(p1.id, game);
      playerGameMap.set(p2.id, game);

      p1.emit('match-found');
      p2.emit('match-found');
      
      p1.emit('log', '매칭 성공! Player 1으로 배틀을 시작합니다.');
      p2.emit('log', '매칭 성공! Player 2로 배틀을 시작합니다.');

      (async () => {
        for await (const chunk of streams.p1) {
          if (chunk.trim()) p1.emit('battle-log', chunk);
        }
      })();

      (async () => {
        for await (const chunk of streams.p2) {
          if (chunk.trim()) p2.emit('battle-log', chunk);
        }
      })();

      streams.omniscient.write(`>start {"formatid":"gen9customgame"}`);
      streams.omniscient.write(`>player p1 {"name":"Player 1","team":"${p1Team}"}`);
      streams.omniscient.write(`>player p2 {"name":"Player 2","team":"${p2Team}"}`);
    }
  });

  socket.on('action', (actionString) => {
    const game = playerGameMap.get(socket.id);
    if (!game) return;

    if (socket.id === game.p1Id) {
      game.streams.p1.write(actionString);
      socket.emit('log', `[시스템] 입력 완료: ${actionString}`);
    } else if (socket.id === game.p2Id) {
      game.streams.p2.write(actionString);
      socket.emit('log', `[시스템] 입력 완료: ${actionString}`);
    }
  });

  socket.on('disconnect', () => {
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) waitingPlayer = null;
    playerGameMap.delete(socket.id);
  });
});

server.listen(3001, () => {
  console.log('Battle Server running on port 3001');
});