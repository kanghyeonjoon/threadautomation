const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateContent({ persona, category, keywords, recentSummary, nickname }) {
    const systemPrompt = `
- 구조 지침: 반드시 3개의 파트(1/3, 2/3, 3/3)로 나누어 작성하라. 
- 내용 철학: '노력보다는 시스템', '더하기보다는 빼기', '속도보다는 구조'의 가치를 전달하라.
- 어휘 수준: 어려운 전문 용어는 배제하고 '중학생도 즉시 이해할 수 있는' 아주 쉬운 일상 단어만 사용하라.
- 문장 제한: 한 줄의 길이는 공백 포함 '15~25자' 사이로 매우 짧고 리드미컬하게 끊어서 작성하라.
- 기호 제한: 마침표(.)와 콜론(:) 절대 사용 금지. 대괄호([])나 소괄호(())도 절대 포함하지 마라.
- 출력 형식: [파트 1] \n (내용) \n 1/3 \n\n [파트 2] ... 형식으로 오직 본문만 출력하라.
`;

    const angles = [
        "강력한 동기부여와 행동 중심",
        "우아한 해결책과 시스템적 사고",
        "날카로운 현실 비판과 대안 제시",
        "따뜻한 공감과 성장을 위한 조언",
        "데이터와 효율 중심의 압도적 성과"
    ];
    const randomAngle = angles[Math.floor(Math.random() * angles.length)];

    const userPrompt = `
- 주제 카테고리: ${category}
- 작성 관점: ${randomAngle}
- 참고 키워드: ${keywords.join(', ')}
- 최근 발행 내용 요약 (절대 중복되지 않게):
${recentSummary}
- 현재 시각 Factor: ${Date.now()}
- 현재 유저: ${nickname}

위 정보를 바탕으로 스레드에 처음 올라오는 신선한 통찰을 담은 글을 하나 작성해줘. 
내용은 이전에 쓴 것들과 완전히 다른 각도에서 접근해야 해. 
오직 본문만 출력해.
`;

    const msg = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.9,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
    });

    return msg.content[0].text.trim();
}

module.exports = { generateContent };
