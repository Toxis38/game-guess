let sessionId = null;
let currentMode = 'normal';

const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');

const btnNormal = document.getElementById('btn-normal');
const btnHard = document.getElementById('btn-hard');
const btnGuess = document.getElementById('btn-guess');
const btnAgain = document.getElementById('btn-again');
const btnMenu = document.getElementById('btn-menu');
const btnReset = document.getElementById('btn-reset');
const guessInput = document.getElementById('guess-input');
const hintsList = document.getElementById('hints-list');
const hintNum = document.getElementById('hint-num');
const feedback = document.getElementById('feedback');
const statsLine = document.getElementById('stats-line');

const resultIcon = document.getElementById('result-icon');
const resultTitle = document.getElementById('result-title');
const resultScore = document.getElementById('result-score');
const resultAnswer = document.getElementById('result-answer');

function show(screen) {
  startScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  screen.classList.remove('hidden');
}

function renderHints(hints) {
  hintsList.innerHTML = '';
  hints.forEach((text, i) => {
    const div = document.createElement('div');
    div.className = 'hint-item' + (i === hints.length - 1 ? ' newest' : '');
    div.textContent = text;
    hintsList.appendChild(div);
  });
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    statsLine.textContent = `Всего игр: ${data.total} · Отгадано: ${data.solved} · Обычных осталось: ${data.normalRemaining} · Хард: ${data.hardRemaining}`;
  } catch (e) {
    statsLine.textContent = '';
  }
}

async function startGame(mode) {
  currentMode = mode || currentMode;
  feedback.textContent = '';
  guessInput.value = '';
  try {
    const res = await fetch('/api/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: currentMode }),
    });
    const data = await res.json();

    if (data.error) {
      alert(data.message);
      return;
    }

    sessionId = data.sessionId;
    renderHints(data.hints);
    hintNum.textContent = data.hintNumber;
    show(gameScreen);
    guessInput.focus();
    loadStats();
  } catch (e) {
    alert('Ошибка соединения с сервером');
  }
}

async function submitGuess() {
  const guess = guessInput.value.trim();
  if (!guess) return;

  btnGuess.disabled = true;
  try {
    const res = await fetch('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, guess }),
    });
    const data = await res.json();

    if (data.error) {
      feedback.textContent = data.error;
      return;
    }

    if (data.finished) {
      if (data.correct) {
        resultIcon.textContent = '🎉';
        resultTitle.textContent = 'Победа!';
        resultScore.textContent = `+${data.score} баллов`;
        resultAnswer.textContent = `Это «${data.answer}»`;
      } else {
        resultIcon.textContent = '💀';
        resultTitle.textContent = 'Поражение';
        resultScore.textContent = '0 баллов';
        resultAnswer.textContent = `Правильный ответ: «${data.answer}»`;
      }
      show(resultScreen);
      loadStats();
    } else {
      feedback.textContent = data.message;
      renderHints(data.hints);
      hintNum.textContent = data.hintNumber;
      guessInput.value = '';
      guessInput.focus();
    }
  } catch (e) {
    feedback.textContent = 'Ошибка сети';
  } finally {
    btnGuess.disabled = false;
  }
}

async function resetProgress() {
  if (!confirm('Сбросить весь прогресс? Все отгаданные игры снова появятся.')) return;
  try {
    await fetch('/api/reset', { method: 'POST' });
    loadStats();
    alert('Прогресс сброшен');
  } catch (e) {
    alert('Ошибка');
  }
}

btnNormal.addEventListener('click', () => startGame('normal'));
btnHard.addEventListener('click', () => startGame('hard'));
btnAgain.addEventListener('click', () => startGame(currentMode));
btnMenu.addEventListener('click', () => {
  show(startScreen);
  loadStats();
});
btnGuess.addEventListener('click', submitGuess);
btnReset.addEventListener('click', resetProgress);

guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitGuess();
});

loadStats();
