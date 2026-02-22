const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generateContent({ persona, category, keywords, recentSummary, nickname }) {
    const systemPrompt = `
- 페르소나 지침: ${persona}
- 글자 수: Threads 최대 800자 이내
- 해시태그: 절대 사용 금지 (No Hashtags)
- 기호 제한: 마침표(.)와 콜론(:) 절대 사용 금지
- 구조 지침: [대괄호]나 (소괄호)로 된 구조적 레이블(예: [수치 후킹], [문제 상황])을 절대 출력에 포함하지 마라.
- 출력 형식: 오직 사람이 쓴 것 같은 본문 텍스트만 출력하며 인사말이나 설명을 포함하지 마라.
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
