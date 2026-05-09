import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Client from 'socket.io-client';
import { server } from '../server.js'; 

describe('Socket.io 핵심 기능 테스트 (방 생성)', () => {
  let clientSocket;

  beforeAll(async () => {
    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port;
        clientSocket = new Client(`http://localhost:${port}`);
        clientSocket.on('connect', resolve);
      });
    });
  });

  afterAll(() => {
    if (clientSocket) clientSocket.close();
    if (server) server.close();
  });

  it('create-room 이벤트를 보내면 방이 생성되고 room-update 이벤트를 받아야 합니다.', async () => {
    await new Promise((resolve) => {
      // 1. 서버가 방을 생성한 후 보내주는 'room-update' 이벤트를 대기합니다.
      clientSocket.on('room-update', (room) => {
        // [검증 포인트 1] 방의 기본 구조가 잘 만들어졌는지 확인
        expect(room).toHaveProperty('id');
        expect(room.host).toBe(clientSocket.id); // 방장은 생성한 클라이언트여야 함
        expect(room.status).toBe('room');
        
        // [검증 포인트 2] 전달한 설정값(settings)이 제대로 파싱 및 적용되었는지 확인
        expect(room.settings.format).toBe(66);
        expect(room.settings.allowMega).toBe(true);
        expect(room.settings.allowZMove).toBe(false); // 보내지 않은 값은 false 처리
        
        resolve(); // 모든 검증이 끝나면 테스트 통과
      });

      // 2. 클라이언트에서 방 생성 이벤트를 발송합니다.
      clientSocket.emit('create-room', { 
        format: 66, 
        allowMega: true 
      });
    });
  });
});
