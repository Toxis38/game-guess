const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Load games
const games = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'games.json'), 'utf8')
);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory sessions (for simplicity)
const sessions = new Map();

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[ё]/g, 'е')
    .replace(/[^a-zа-я0-9]/gi, '')
    .trim();
}

function isMatch(guess, game) {
  const nGuess = normalize(guess);
  if (!nGuess) return false;

  const nName = normalize(game.name);

  // Exact name
  if (nName === nGuess) return true;

  // Aliases exact
  for (const alias of game.aliases || []) {
    if (normalize(alias) === nGuess) return true;
  }

  // Partial match (guess is significant part of name/alias)
  if (nGuess.length >= 4) {
    if (nName.includes(nGuess) || nGuess.includes(nName)) return true;
    for (const alias of game.aliases || []) {
      const nAlias = normalize(alias);
      if (nAlias.includes(nGuess) || nGuess.includes(nAlias)) return true;
    }
  }

  // Short common abbreviations
  if (nGuess.length >= 3) {
    if (nName.startsWith(nGuess) || nGuess.startsWith(nName.slice(0, 6))) return true;
  }

  return false;
}

function createSession() {
  const game = games[Math.floor(Math.random() * games.length)];
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessions.set(id, {
    game,
    hintIndex: 0,
    score: 0,
    finished: false,
    correct: false,
  });
  return id;
}

// API: start new game
app.post('/api/new', (req, res) => {
  const id = createSession();
  const session = sessions.get(id);
  res.json({
    sessionId: id,
    hint: session.game.hints[0],
    hintNumber: 1,
    totalHints: 3,
    message: 'Угадай игру по первой подсказке!',
  });
});

// API: guess
app.post('/api/guess', (req, res) => {
  const { sessionId, guess } = req.body;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({ error: 'Сессия не найдена. Начни новую игру.' });
  }

  const session = sessions.get(sessionId);
  if (session.finished) {
    return res.json({
      finished: true,
      correct: session.correct,
      score: session.score,
      answer: session.game.name,
      message: session.correct
        ? `Ты уже угадал! Очки: ${session.score}`
        : `Игра окончена. Правильный ответ: ${session.game.name}`,
    });
  }

  const matched = isMatch(guess, session.game);

  if (matched) {
    const points = [100, 80, 50][session.hintIndex] || 0;
    session.score = points;
    session.finished = true;
    session.correct = true;
    return res.json({
      correct: true,
      finished: true,
      score: points,
      answer: session.game.name,
      message: `Правильно! Это «${session.game.name}». Ты набрал ${points} баллов!`,
    });
  }

  // Wrong guess
  session.hintIndex += 1;

  if (session.hintIndex >= 3) {
    session.finished = true;
    session.correct = false;
    session.score = 0;
    return res.json({
      correct: false,
      finished: true,
      score: 0,
      answer: session.game.name,
      message: `Поражение! Правильный ответ: «${session.game.name}».`,
      hint: null,
    });
  }

  // Give next hint
  res.json({
    correct: false,
    finished: false,
    hint: session.game.hints[session.hintIndex],
    hintNumber: session.hintIndex + 1,
    totalHints: 3,
    message: `Неверно. Вот подсказка №${session.hintIndex + 1}:`,
  });
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, games: games.length });
});

app.listen(PORT, () => {
  console.log(`Game Guess server running on http://localhost:${PORT}`);
  console.log(`Loaded ${games.length} games`);
});
