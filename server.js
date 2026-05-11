// server.js
// Tiny rule-based chatbot API for App Lab
// Single file, no external deps. Start with: node server.js

const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const sessions = Object.create(null);

const KB = [
  { patterns: ["hello", "hi", "hey"], reply: "Hey there. How can I help you today?" },
  { patterns: ["how are you", "how r you", "how's it going"], reply: "I'm a little program, but I'm doing fine. What about you?" },
  { patterns: ["name", "who are you"], reply: "I'm a tiny chatbot server you can call from App Lab." },
  { patterns: ["help", "what can you do"], reply: "I can answer simple questions, remember short facts for this session, and echo or rephrase messages." },
  { patterns: ["bye", "goodbye", "see ya"], reply: "Goodbye. Come back anytime." },
  { patterns: ["joke"], reply: "Why did the developer go broke? Because he used up all his cache." }
];

function norm(text) {
  return (text || "").toString().trim().toLowerCase();
}

function genSessionId() {
  return crypto.randomBytes(12).toString("hex");
}

function tryRemember(session, text) {
  const m = text.match(/^remember\s+(.+?)\s+is\s+(.+)$/i);
  if (m) {
    const key = m[1].trim().toLowerCase();
    const val = m[2].trim();
    session.memory = session.memory || {};
    session.memory[key] = val;
    return `Okay, I'll remember that ${key} is ${val} for this session.`;
  }
  return null;
}

function tryRecall(session, text) {
  const m = text.match(/^(what is|what's|who is|who's)\s+(.+)\??$/i);
  if (m) {
    const key = m[2].trim().toLowerCase();
    if (session.memory && session.memory[key]) {
      return `${key} is ${session.memory[key]}.`;
    }
  }
  return null;
}

function kbReply(text) {
  for (const item of KB) {
    for (const p of item.patterns) {
      if (text.includes(p)) return item.reply;
    }
  }
  return null;
}

function fallbackReply(text) {
  if (text.endsWith("?")) return "That's an interesting question. Can you give more details?";
  if (text.length > 120) return "Thanks for the details. I might need a shorter question to help better.";
  return "I heard: \"" + text + "\". Tell me more or ask something else.";
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

async function handleChat(req, res, body) {
  try {
    const data = JSON.parse(body || "{}");
    let { sessionId, message } = data;
    message = (message || "").toString().trim();
    if (!message) return sendJson(res, 400, { error: "message required" });

    if (!sessionId || !sessions[sessionId]) {
      sessionId = genSessionId();
      sessions[sessionId] = { id: sessionId, history: [], memory: {} };
    }
    const session = sessions[sessionId];

    session.history.push({ role: "user", text: message, ts: Date.now() });

    let reply = tryRemember(session, message);
    if (!reply) reply = tryRecall(session, message);
    if (!reply) reply = kbReply(norm(message));
    if (!reply) reply = fallbackReply(message);

    session.history.push({ role: "bot", text: reply, ts: Date.now() });
    if (session.history.length > 40) session.history.splice(0, session.history.length - 40);

    sendJson(res, 200, { sessionId: sessionId, reply: reply });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "server error" });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    for await (const chunk of req) body += chunk;
    return handleChat(req, res, body);
  }

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("tiny-chatbot running");
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log("Chatbot server listening on port", PORT);
});
