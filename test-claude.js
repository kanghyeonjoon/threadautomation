
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function test() {
    try {
        const msg = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 10,
            messages: [{ role: "user", content: "hi" }]
        });
        console.log("Success:", msg.content[0].text);
    } catch (e) {
        console.log("Error:", e.message);
        if (e.response) console.log("Response:", e.response.data);
    }
}
test();
