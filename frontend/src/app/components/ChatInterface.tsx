"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Loader2, MessageSquare, X } from "lucide-react";
import { trEngToKor } from "@/app/utils/Translator";
import { RoomData, PokemonStatus, OppPokemon, MoveData } from "@/app/types/battle";
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
  usedMega?: boolean;
  usedZMove?: boolean;
}

export default function ChatInterface({
  phase,
  roomData,
  myFullTeam,
  oppFullTeam,
  mySelection,
  myTeam,
  oppTeam,
  oppActive,
  activeMoves,
  usedMega = false,
  usedZMove = false,
}: ChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

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
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "네트워크 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  };

  const buildEntryContext = () => {
    return `규칙: ${roomData?.settings?.format}마리 선택
상대 전체 파티: ${oppFullTeam?.join(", ")}
내 전체 파티: ${myFullTeam?.join(", ")}
요청: 상대 파티를 상대하기 가장 좋은 조합 ${roomData?.settings?.format}마리를 내 파티에서 골라주세요.`;
  };

  const buildLeadContext = () => {
    // 유저가 이미 선택한 포켓몬이 있는지 확인
    const selectedPokemon = mySelection && myFullTeam ? mySelection.map((idx) => myFullTeam[idx]) : [];

    const availablePool = selectedPokemon.length > 0 ? selectedPokemon.join(", ") : myFullTeam?.join(", ");

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
      const rec = recommendBattleAction(myTeam, oppActive, activeMoves, oppTeam || [], {
        canMegaEvo: roomData?.settings?.allowMega ?? false,
        canZMove: roomData?.settings?.allowZMove ?? false,
        usedMega: usedMega,
        usedZMove: usedZMove,
        isNoLimit: roomData?.settings?.noLimit ?? false,
      });

      const category = rec.action_type === "move" ? "MOVES" : "POKEMON";
      const translatedParam = trEngToKor(rec.parameter, category);

      const actionPrefix = rec.action_type === "move" ? "기술" : "교체";
      const megaZTag = rec.useMega ? " 💫(메가진화)" : rec.useZMove ? " 🌟(Z기술)" : "";

      const displayMsg = `💡 추천 행동: [${actionPrefix}] ${translatedParam}${megaZTag}\n📝 이유: ${rec.reason}`;

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
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-slate-900/90 backdrop-blur-2xl text-slate-200 w-[360px] sm:w-[420px] h-[520px] rounded-3xl shadow-2xl flex flex-col mb-4 overflow-hidden border border-slate-700/50 origin-bottom-right animate-in fade-in zoom-in-95 duration-200">
          {/* 헤더 */}
          <header className="bg-slate-800/50 border-b border-slate-700/50 p-4 flex justify-between items-center">
            <h3 className="font-bold text-sm tracking-wide text-slate-100 flex items-center gap-2.5">
              <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
                <Bot size={16} />
              </span>
              AI ASSISTANT
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </header>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <Bot size={32} className="mb-3 opacity-20" />
                <p>전략적 분석이 필요하신가요?</p>
                <p className="mt-1 opacity-70">하단의 버튼을 눌러 추천을 받아보세요.</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-slate-100 text-slate-900 rounded-tr-sm font-medium"
                      : "bg-slate-800/80 border border-slate-700/50 text-slate-300 rounded-tl-sm shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center text-slate-400 text-xs gap-2 bg-slate-800/40 w-fit px-4 py-2.5 rounded-2xl rounded-tl-sm border border-slate-700/30">
                <Loader2 size={14} className="animate-spin text-blue-400" />
                <span>데이터 분석 중...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 액션 버튼 영역 (이모지 제거, 미니멀리즘 적용) */}
          <div className="p-4 bg-slate-800/30 border-t border-slate-700/50 backdrop-blur-md">
            <div className="flex gap-2 flex-wrap">
              {phase === "selection" && (
                <>
                  <button
                    onClick={() => handleRequest("엔트리 조합 추천해줘", buildEntryContext())}
                    className="text-[11px] font-semibold bg-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-700 border border-slate-600/50 px-4 py-2 rounded-xl transition-all"
                  >
                    조합 추천받기
                  </button>
                  <button
                    onClick={() => handleRequest("선봉 추천해줘", buildLeadContext())}
                    className="text-[11px] font-semibold bg-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-700 border border-slate-600/50 px-4 py-2 rounded-xl transition-all"
                  >
                    선봉 추천받기
                  </button>
                </>
              )}
              {phase === "battle" && (
                <button
                  onClick={handleBattleRecommend}
                  className="text-[11px] font-semibold bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 border border-blue-500/30 px-4 py-2 rounded-xl transition-all w-full text-center"
                >
                  최적의 다음 행동 분석
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAB (플로팅 액션 버튼) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 border 
          ${
            isOpen
              ? "bg-slate-800 text-slate-400 border-slate-700 rotate-90 scale-90"
              : "bg-slate-800/80 backdrop-blur-md text-slate-200 border-slate-600 hover:bg-slate-700 hover:border-slate-500 hover:-translate-y-1"
          }
        `}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>
    </div>
  );
}
