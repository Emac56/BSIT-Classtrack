// routes/ai.js — AI Proxy using Groq (FREE - 500K tokens/day)
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');

router.post('/chat', requireAuth, async (req, res) => {
  const { messages, system } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ success: false, message: 'Invalid messages format.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, message: 'AI service not configured. Add GROQ_API_KEY in Railway environment variables.' });
  }

  try {
    const allMessages = [];
    if (system) allMessages.push({ role: 'system', content: system });
    allMessages.push(...messages.slice(-20));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 800,
        messages: allMessages
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        success: false,
        message: err.error?.message || 'Groq API error.'
      });
    }

    const data  = await response.json();
    const reply = data.choices?.[0]?.message?.content || '(No response)';

    res.json({ success: true, reply });

  } catch (e) {
    console.error('AI proxy error:', e.message);
    res.status(500).json({ success: false, message: 'AI request failed: ' + e.message });
  }
});

module.exports = router;
                                 
