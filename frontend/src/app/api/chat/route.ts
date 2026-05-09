import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export async function POST(req: Request) {
  try {
    const { messages, phase } = await req.json();
    if (!Array.isArray(messages) || (phase !== "selection" && phase !== "battle")) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }

    let systemPrompt = `당신은 포켓몬 배틀을 도와주는 AI 어시스턴트입니다. 
반드시 아래의 순수 JSON 형식으로만 응답하세요.

[필수 규칙: 고유명사 영어 사용]
포켓몬 이름, 기술명, 타입(예: Psychic, Dark, Grass), 특성, 아이템 등 모든 고유명사는 절대 한국어로 번역하지 말고 **반드시 영어 원문 그대로** 작성하세요.
이유(reason)를 설명하는 서술어와 기본 문장만 한국어로 작성하세요. 
(예시: "Gholdengo의 Steel/Ghost 타입은 상대의 공격을 방어하기 좋습니다.")\n`;

    if (phase === "selection") {
      systemPrompt += `
[Selection Phase 응답 규칙]
- 조합(엔트리) 추천인 경우: recommendation에 여러 마리의 영문 이름을 쉼표로 구분하여 작성합니다.
- 선봉 추천인 경우: recommendation에 단 1마리의 영문 이름만 작성합니다.

응답 형식:
{
  "recommendation": "포켓몬 영문 이름들 (예: Landorus-Therian, Ogerpon, Gholdengo)",
  "reason": "해당 포켓몬을 추천하는 구체적인 타입 상성 및 전략적 이유 (한국어+영어 혼용)"
}`;
    } else if (phase === "battle") {
      systemPrompt += `
응답 형식:
{
  "action_type": "move" 또는 "switch",
  "parameter": "사용할 영문 기술명 또는 교체할 영문 포켓몬명 (예: Earthquake 또는 Dragonite)",
  "reason": "해당 행동을 추천하는 논리적인 이유 (한국어+영어 혼용)"
}`;
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      model: 'openai/gpt-oss-120b',
      response_format: { type: "json_object" },
    });

    const reply = chatCompletion.choices[0]?.message?.content || "{}";

    let parsedReply: unknown;
    try {
      parsedReply = JSON.parse(reply);
    } catch {
      console.error("Groq JSON parse error. Raw reply:", reply);
      return NextResponse.json(
        { error: "모델 응답을 JSON으로 해석하지 못했습니다." },
        { status: 502 }
      );
    }

    return NextResponse.json({ result: parsedReply });
  } catch (error) {
    console.error("Groq API Error:", error);
    return NextResponse.json(
      { error: "요청을 처리하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
