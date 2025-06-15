const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    const { question, memos } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question is required.' });
    }

    const apiKey = process.env.CHUTES_API_KEY;

    if (!apiKey) {
        console.error('AI API key (CHUTES_API_KEY) is not set in environment variables.');
        return res.status(500).json({ error: 'AI service is not configured by the administrator (API key missing).' });
    }

    // Constructing the prompt for OpenAI
    let memoContext = "The user has provided the following memos for context (if any):\n";
    if (memos && memos.length > 0) {
        memos.forEach((memo, index) => {
            memoContext += `Memo ${index + 1} (Title: ${memo.title || 'Untitled'}):\n${memo.content}\n\n`;
        });
    } else {
        memoContext += "No memos provided.\n";
    }
    memoContext += "\nPlease consider these memos when answering the user's question.";

    const messages = [
        {
            role: "system",
            content: `You are a helpful AI assistant integrated into a memo application. Your goal is to answer the user's questions based on the content of their memos. If the question doesn't seem related to the memos, try to answer it generally but politely state if you couldn't find relevant information in the memos. Be concise. ${memoContext}`
        },
        {
            role: "user",
            content: question
        }
    ];

    try {
        // MODIFIED URL and variable name
        const apiResponse = await fetch('https://llm.chutes.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-ai/DeepSeek-V3-0324', // Model name remains as per previous step
                messages: messages,
                max_tokens: 200,
                temperature: 0.7,
            })
        });

        // MODIFIED variable name for clarity
        if (!apiResponse.ok) {
            const errorData = await apiResponse.json().catch(() => ({}));
            // Log message can be generic now
            console.error('AI API Error (llm.chutes.ai):', apiResponse.status, errorData);
            const errorMessage = errorData.error && errorData.error.message ? errorData.error.message : 'Failed to get a response from AI service.';
            return res.status(apiResponse.status).json({ error: `AI service error: ${errorMessage}` });
        }

        // MODIFIED variable name
        const data = await apiResponse.json();

        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            res.status(200).json({ answer: data.choices[0].message.content.trim() });
        } else {
            // Log message can be generic
            console.error('AI API response (llm.chutes.ai) did not contain expected data structure:', data);
            res.status(500).json({ error: 'AI service returned an unexpected response.' });
        }

    } catch (error) {
        // Log message can be generic
        console.error('Error calling AI service (llm.chutes.ai):', error);
        res.status(500).json({ error: 'An unexpected error occurred while contacting the AI service.' });
    }
};
