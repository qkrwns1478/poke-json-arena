### 문제점

- 기존 `BattleSimulator` 컴포넌트가 모든 로직과 상태를 혼자 다 처리하는 비대화된 컴포넌트가 되어 버렸다. 다음과 같은 문제가 발생했다.
  - 소켓 생명주기 꼬임: 로비에서 쓰이는 상태, 배틀에서 쓰이는 상태가 한 컴포넌트에 몰려 있다 보니, React의 렌더링 과정에서 소켓 이벤트가 중복으로 등록되거나 예기치 않게 끊기는 버그가 발생하기 매우 쉽다.
  - 상태(State)의 과부하: 파일 하나에 useState가 20개 넘게 있다. 로비 화면에 있는데도 뒤에서는 배틀 관련 상태들이 평가되고 있어 흐름을 추적하기가 불가능에 가깝다.
  - 유지보수 불가: UI와 비즈니스 로직(소켓 통신)이 전혀 분리되지 않아 버튼 하나를 수정하려고 해도 전체 소켓 로직을 건드리게 된다.

### 해결방안

- 소켓 연결 및 전역 상태 관리"를 담당하는 부모 컴포넌트와 "각 화면의 UI"를 담당하는 자식 컴포넌트로 완전히 쪼개는 방식으로 리팩토링을 진행했다.

```
frontend/src/app/
 ├── types/
 │    └── battle.ts
 ├── components/
 │    ├── GameManager.tsx
 │    └── phases/
 │         ├── LobbyPhase.tsx
 │         ├── RoomPhase.tsx
 │         ├── SelectionPhase.tsx
 │         └── BattlePhase.tsx
 └── page.tsx
```

- GameManager: socket.io 인스턴스를 하나만 유지하고, 현재 유저가 어느 Phase에 있는지(lobby, room, selection, battle)만 결정한다.
- 각 Phase 컴포넌트: GameManager로부터 socket 객체와 필요한 상태만 props로 넘겨받아 해당 화면에 필요한 동작만 수행한다.