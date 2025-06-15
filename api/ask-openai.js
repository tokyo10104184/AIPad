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
        console.error('OpenAI API key (CHUTES_API_KEY) is not set in environment variables.');
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
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', // Or a newer/preferred model
                messages: messages,
                max_tokens: 200, // Adjust as needed
                temperature: 0.7, // Adjust as needed
            })
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json().catch(() => ({})); // Try to parse error, default to empty obj
            console.error('OpenAI API Error:', openaiResponse.status, errorData);
            const errorMessage = errorData.error && errorData.error.message ? errorData.error.message : 'Failed to get a response from AI service.';
            return res.status(openaiResponse.status).json({ error: `AI service error: ${errorMessage}` });
        }

        const data = await openaiResponse.json();

        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            res.status(200).json({ answer: data.choices[0].message.content.trim() });
        } else {
            console.error('OpenAI API response did not contain expected data structure:', data);
            res.status(500).json({ error: 'AI service returned an unexpected response.' });
        }

    } catch (error) {
        console.error('Error calling OpenAI service:', error);
        res.status(500).json({ error: 'An unexpected error occurred while contacting the AI service.' });
    }
};
