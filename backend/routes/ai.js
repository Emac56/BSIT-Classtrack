// routes/ai.js — AI Proxy Route using Google Gemini (FREE)
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');

router.post('/chat', requireAuth, async (req, res) => {
  const { messages, system } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ success: false, message: 'Invalid messages format.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, message: 'AI service not configured. Add GEMINI_API_KEY in Railway environment variables.' });
  }

  try {
    // Build Gemini contents array from history
    const contents = messages.slice(-20).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        success: false,
        message: err.error?.message || 'Gemini API error.'
      });
    }

    const data  = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '(No response)';

    res.json({ success: true, reply });

  } catch (e) {
    console.error('AI proxy error:', e.message);
    res.status(500).json({ success: false, message: 'AI request failed: ' + e.message });
  }
});

module.exports = router;
