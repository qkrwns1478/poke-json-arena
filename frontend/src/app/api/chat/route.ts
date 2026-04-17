import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export async function POST(req: Request) {
  try {
    // 클라이언트로부터 전체 대화 기록(messages 배열)을 받음
    const { messages } = await req.json();

    const systemPrompt = "당신은 똑똑하고 친절한 AI 어시스턴트입니다. 항상 한국어로 자연스럽게 답변해 주세요.";

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages // 이전 대화 기록을 모두 포함하여 전달
      ],
      model: 'openai/gpt-oss-120b',
    });

    const reply = chatCompletion.choices[0]?.message?.content || "";

    return NextResponse.json({ result: reply });
  } catch (error) {
    console.error("Groq API Error:", error);
    return NextResponse.json(
      { error: "요청을 처리하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
