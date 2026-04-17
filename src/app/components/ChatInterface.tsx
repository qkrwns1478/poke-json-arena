"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User, Bot, Loader2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지가 추가될 때마다 스크롤을 맨 아래로 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 전체 대화 기록을 보냅니다.
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.result }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: "네트워크 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white text-gray-800 font-sans">
      {/* 헤더 */}
      <header className="flex items-center justify-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-xl font-semibold">Groq AI Chat</h1>
      </header>

      {/* 대화 영역 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
            <Bot size={48} className="text-gray-300" />
            <p className="text-lg">무엇을 도와드릴까요?</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, index) => (
              <div key={index} className="flex gap-4">
                {/* 프로필 아이콘 */}
                <div className="flex-shrink-0 mt-1">
                  {msg.role === "user" ? (
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                      <User size={18} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                      <Bot size={18} />
                    </div>
                  )}
                </div>
                
                {/* 메시지 내용 */}
                <div className="flex-1 space-y-2 overflow-hidden">
                  <div className="font-semibold text-sm text-gray-800">
                    {msg.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6 px-4 sm:px-0">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end border border-gray-300 bg-white rounded-2xl shadow-sm focus-within:ring-1 focus-within:ring-gray-300 focus-within:border-gray-400 transition-all"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter를 누르면 전송, Shift+Enter를 누르면 줄바꿈
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="메시지를 입력하세요..."
              className="w-full max-h-48 min-h-[56px] py-4 pl-4 pr-12 resize-none bg-transparent focus:outline-none"
              rows={1}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-3 bottom-3 p-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
          <div className="text-center text-xs text-gray-400 mt-3">
            AI는 실수를 할 수 있습니다. 중요한 정보는 확인하세요.
          </div>
        </div>
      </div>
    </div>
  );
}