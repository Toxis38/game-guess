const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const SOLVED_PATH = path.join(__dirname, 'data', 'solved.json');

const games = [
  ...JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'games-part1.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'games-part2.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'games-part3.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'games-part4.json'), 'utf8')),
];

function loadSolved() {
  try {
    if (fs.existsSync(SOLVED_PATH)) {
      return new Set(JSON.parse(fs.readFileSync(SOLVED_PATH, 'utf8')));
    }
  } catch (e) {
    console.error('Failed to load solved:', e.message);
  }
  return new Set();
}

function saveSolved(solvedSet) {
  try {
    fs.writeFileSync(SOLVED_PATH, JSON.stringify([...solvedSet], null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save solved:', e.message);
  }
}

let solvedGames = loadSolved();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
  if (nName === nGuess) return true;

  for (const alias of game.aliases || []) {
    if (normalize(alias) === nGuess) return true;
  }

  if (nGuess.length >= 4) {
    if (nName.includes(nGuess) || nGuess.includes(nName)) return true;
    for (const alias of game.aliases || []) {
      const nAlias = normalize(alias);
      if (nAlias.includes(nGuess) || nGuess.includes(nAlias)) return true;
    }
  }

  if (nGuess.length >= 3) {
    if (nName.startsWith(nGuess)) return true;
  }

  return false;
}

function getAvailableGames(mode) {
  const isHard = mode === 'hard';
  return games.filter((g) => {
    if (solvedGames.has(g.name)) return false;
    if (isHard) return !!g.hard;
    return !g.hard;
  });
}

function createSession(mode = 'normal') {
  const available = getAvailableGames(mode);
  if (available.length === 0) {
    return null;
  }
  const game = available[Math.floor(Math.random() * available.length)];
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessions.set(id, {
    game,
    hintIndex: 0,
    score: 0,
    finished: false,
    correct: false,
    mode,
  });
  return id;
}

app.post('/api/new', (req, res) => {
  const mode = (req.body && req.body.mode) === 'hard' ? 'hard' : 'normal';
  const id = createSession(mode);

  if (!id) {
    return res.json({
      error: true,
      message:
        mode === 'hard'
          ? 'Все сложные игры уже отгаданы! Попробуй обычный режим или сбрось прогресс.'
          : 'Все обычные игры уже отгаданы! Попробуй режим Хард или сбрось прогресс.',
    });
  }

  const session = sessions.get(id);
  res.json({
    sessionId: id,
    hints: [session.game.hints[0]],
    hintNumber: 1,
    totalHints: 3,
    mode,
    remaining: getAvailableGames(mode).length,
    message: 'Угадай игру по первой подсказке!',
  });
});

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

    solvedGames.add(session.game.name);
    saveSolved(solvedGames);

    return res.json({
      correct: true,
      finished: true,
      score: points,
      answer: session.game.name,
      message: `Правильно! Это «${session.game.name}». +${points} баллов!`,
      remaining: getAvailableGames(session.mode).length,
    });
  }

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
      hints: session.game.hints,
    });
  }

  const revealed = session.game.hints.slice(0, session.hintIndex + 1);
  res.json({
    correct: false,
    finished: false,
    hints: revealed,
    hintNumber: session.hintIndex + 1,
    totalHints: 3,
    message: `Неверно. Подсказка №${session.hintIndex + 1}:`,
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    total: games.length,
    solved: solvedGames.size,
    normalRemaining: getAvailableGames('normal').length,
    hardRemaining: getAvailableGames('hard').length,
  });
});

app.post('/api/reset', (req, res) => {
  solvedGames = new Set();
  saveSolved(solvedGames);
  res.json({ ok: true, message: 'Прогресс сброшен. Все игры снова доступны.' });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    games: games.length,
    solved: solvedGames.size,
  });
});

app.listen(PORT, () => {
  console.log(`Game Guess server on http://localhost:${PORT}`);
  console.log(`Games: ${games.length} | Solved: ${solvedGames.size}`);
});
