"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Loader2, MessageCircle, X } from "lucide-react";
import { Generations, calculate, Move, Pokemon as SmogonPokemon } from "@smogon/calc";
import { trKorToEng } from "@/app/utils/Translator";
import { RoomData, PokemonStatus, OppPokemon, MoveData } from "@/app/types/battle";
import { trEngToKor } from "@/app/utils/Translator";
import { recommendBattleAction } from "@/app/utils/BattleRecommender";

type Message = {
  role: "user" | "assistant";
  content: string;
};

interface ChatProps {
  phase: "lobby" | "room" | "selection" | "battle";
  roomData?: RoomData | null;
  myFullTeam?: string[];
  oppFullTeam?: string[];
  mySelection?: number[];
  myTeam?: PokemonStatus[];
  oppTeam?: OppPokemon[];
  oppActive?: OppPokemon | null;
  activeMoves?: MoveData[];
}

export default function ChatInterface({
  phase,
  roomData,
  myFullTeam,
  oppFullTeam,
  mySelection,
  myTeam,
  oppActive,
  activeMoves,
}: ChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const isDamageZero = (moveNameKor: string, attacker: PokemonStatus, defender: OppPokemon): boolean => {
    try {
      const gen = Generations.get(9);

      const attackerName = attacker.details.split(",")[0].trim();
      const defenderName = defender.name.trim();

      const moveEng = trKorToEng(moveNameKor.trim(), "MOVES") || moveNameKor.trim();

      const smogonAttacker = new SmogonPokemon(gen, attackerName);
      const smogonDefender = new SmogonPokemon(gen, defenderName);
      const attackMove = new Move(gen, moveEng);

      const result = calculate(gen, smogonAttacker, smogonDefender, attackMove);

      const damages = result.damage;
      if (typeof damages === "number") {
        return damages === 0;
      }
      return Math.max(...(damages as number[])) === 0;
    } catch (error) {
      console.error("[Smogon Calc Error] 데미지 계산 중 오류 발생:", error);
      return false;
    }
  };

  const handleRequest = async (promptMsg: string, hiddenContext: string, retryCount = 0) => {
    if (loading) return;

    const contextMessages = retryCount > 0 ? messages : [];
    const userMessage: Message = { role: "user", content: promptMsg };
    if (retryCount === 0) setMessages((prev) => [...prev, userMessage]);

    setLoading(true);

    try {
      const payloadMessages = [
        ...contextMessages,
        { role: "user", content: `[현재 게임 정보]\n${hiddenContext}\n\n[요청]\n${promptMsg}` },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages, phase }),
      });

      const data = await res.json();

      if (res.ok) {
        const result = data.result;

        // Battle Phase 무효 데미지 검증
        if (phase === "battle" && result.action_type === "move" && myTeam && oppActive) {
          const myActive = myTeam.find((p) => p.active);

          if (myActive) {
            const zeroDmg = isDamageZero(result.parameter, myActive, oppActive);

            if (zeroDmg && retryCount < 2) {
              console.log(`[AI 재요청] ${result.parameter} 기술은 무효 처리됨. 다시 추천 받습니다.`);
              const retryMsg = `'${result.parameter}' 기술은 상대 포켓몬(${oppActive.name})에게 효과가 없습니다(데미지 0). 타입 상성을 고려해서 다른 행동을 추천해주세요.`;
              return handleRequest(retryMsg, hiddenContext, retryCount + 1);
            }
          }
        }

        let displayMsg = "";
        if (phase === "selection") {
          // 영문 이름들을 한국어로 번역해서 출력 (쉼표 처리)
          const translatedRec = result.recommendation
            .split(",")
            .map((name: string) => trEngToKor(name.trim(), "POKEMON"))
            .join(", ");
            
          displayMsg = `💡 추천: ${translatedRec}\n📝 이유: ${result.reason}`;
        } else if (phase === "battle") {
          // move인지 switch인지에 따라 카테고리를 다르게 번역
          const category = result.action_type === "move" ? "MOVES" : "POKEMON";
          const translatedParam = trEngToKor(result.parameter, category);
          
          displayMsg = `💡 추천 행동: [${result.action_type === "move" ? "기술" : "교체"}] ${translatedParam}\n📝 이유: ${result.reason}`;
        } else {
          displayMsg = result.message || JSON.stringify(result);
        }

        setMessages((prev) => [...prev, { role: "assistant", content: displayMsg }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: "네트워크 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  };

  const buildSelectionContext = () => {
    return `규칙: ${roomData?.settings?.format}마리 선택\n상대 팀: ${oppFullTeam?.join(", ")}\n내 팀: ${myFullTeam?.join(", ")}`;
  };

  const buildEntryContext = () => {
    return `규칙: ${roomData?.settings?.format}마리 선택
상대 전체 파티: ${oppFullTeam?.join(", ")}
내 전체 파티: ${myFullTeam?.join(", ")}
요청: 상대 파티를 상대하기 가장 좋은 조합 ${roomData?.settings?.format}마리를 내 파티에서 골라주세요.`;
  };

  const buildLeadContext = () => {
    // 유저가 이미 선택한 포켓몬이 있는지 확인
    const selectedPokemon = mySelection && myFullTeam 
      ? mySelection.map(idx => myFullTeam[idx]) 
      : [];
      
    const availablePool = selectedPokemon.length > 0 
      ? selectedPokemon.join(", ") 
      : myFullTeam?.join(", ");

    return `규칙: ${roomData?.settings?.format}마리 선택
상대 전체 파티: ${oppFullTeam?.join(", ")}
내 파티 풀(선택 후보): ${availablePool}
요청: 위 후보 중 상대의 예상 선봉을 찌르거나 기점을 잡기 가장 좋은 '첫 번째 출전 포켓몬(선봉)' 딱 1마리만 추천해주세요.`;
  };

  const handleBattleRecommend = () => {
    if (loading || !myTeam || !oppActive || !activeMoves) return;

    const userMessage: Message = { role: "user", content: "다음 행동 추천해줘" };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const rec = recommendBattleAction(myTeam, oppActive, activeMoves);
      const category = rec.action_type === "move" ? "MOVES" : "POKEMON";
      const translatedParam = trEngToKor(rec.parameter, category);
      const displayMsg =
        `💡 추천 행동: [${rec.action_type === "move" ? "기술" : "교체"}] ${translatedParam}\n📝 이유: ${rec.reason}`;
      setMessages((prev) => [...prev, { role: "assistant", content: displayMsg }]);
    } catch (error) {
      console.error("[BattleRecommender] 오류 발생:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "추천 계산 중 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  };

  if (phase === "lobby" || phase === "room") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white text-gray-800 w-[350px] sm:w-[400px] h-[500px] rounded-2xl shadow-2xl flex flex-col mb-4 overflow-hidden border border-gray-200">
          <header className="bg-gray-900 text-white p-4 flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <Bot size={20} /> AI 배틀 어시스턴트
            </h3>
            <button onClick={() => setIsOpen(false)} className="hover:text-gray-300">
              <X size={20} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm mt-4">현재 상황에 맞는 추천을 받아보세요!</div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-white border shadow-sm text-gray-800"}`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex text-gray-400 gap-2">
                <Loader2 size={16} className="animate-spin" /> 분석 중...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex gap-2 flex-wrap mb-2">
              {phase === "selection" && (
                <>
                  <button
                    onClick={() => handleRequest("엔트리 조합 추천해줘", buildEntryContext())}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-200 transition"
                  >
                    📝 조합 추천
                  </button>
                  <button
                    onClick={() => handleRequest("선봉 추천해줘", buildLeadContext())}
                    className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full hover:bg-purple-200 transition"
                  >
                    ⚔️ 선봉 추천
                  </button>
                </>
              )}
              {phase === "battle" && (
                <button
                  onClick={handleBattleRecommend}
                  className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full hover:bg-red-200 transition"
                >
                  🎯 다음 행동 추천
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </button>
    </div>
  );
}
