const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    // MODIFIED: Expect currentQuestion and conversationHistory
    const { currentQuestion, conversationHistory, memos } = req.body;

    if (!currentQuestion) {
        return res.status(400).json({ error: 'Current question is required.' });
    }

    const apiKey = process.env.CHUTES_API_KEY;
    if (!apiKey) {
        console.error('AI API key (CHUTES_API_KEY) is not set in environment variables.');
        return res.status(500).json({ error: 'AI service is not configured by the administrator (API key missing).' });
    }

    let memoContext = "The user has provided the following memos for context (if any):\n";
    if (memos && memos.length > 0) {
        memos.forEach((memo, index) => {
            memoContext += `Memo ${index + 1} (Title: ${memo.title || 'Untitled'}):\n${memo.content}\n\n`;
        });
    } else {
        memoContext += "No memos provided.\n";
    }
    memoContext += "\nPlease consider these memos AND the preceding conversation when answering the user's current question.";

    const systemMessage = {
        role: "system",
        content: `You are a helpful AI assistant integrated into a memo application. Your goal is to answer the user's questions based on the content of their memos and the ongoing conversation. If the question doesn't seem related to the memos or conversation, try to answer it generally but politely state if you couldn't find relevant information. Be concise. ${memoContext}`
    };

    // Construct messages for OpenAI
    let messagesForOpenAI = [systemMessage];
    if (Array.isArray(conversationHistory)) {
        messagesForOpenAI = messagesForOpenAI.concat(conversationHistory);
    }
    messagesForOpenAI.push({ role: "user", content: currentQuestion });


    try {
        const apiResponse = await fetch('https://llm.chutes.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-ai/DeepSeek-V3-0324',
                messages: messagesForOpenAI, // MODIFIED
                max_tokens: 250, // Slightly increased max_tokens for conversation
                temperature: 0.7,
            })
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json().catch(() => ({}));
            console.error('AI API Error (llm.chutes.ai):', apiResponse.status, errorData);
            const errorMessage = errorData.error && errorData.error.message ? errorData.error.message : 'Failed to get a response from AI service.';
            return res.status(apiResponse.status).json({ error: `AI service error: ${errorMessage}` });
        }

        const data = await apiResponse.json();
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            res.status(200).json({ answer: data.choices[0].message.content.trim() });
        } else {
            console.error('AI API response (llm.chutes.ai) did not contain expected data structure:', data);
            res.status(500).json({ error: 'AI service returned an unexpected response.' });
        }
    } catch (error) {
        console.error('Error calling AI service (llm.chutes.ai):', error);
        res.status(500).json({ error: 'An unexpected error occurred while contacting the AI service.' });
    }
};
