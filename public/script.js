let sessionId = null;

const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');

const btnStart = document.getElementById('btn-start');
const btnGuess = document.getElementById('btn-guess');
const btnAgain = document.getElementById('btn-again');
const guessInput = document.getElementById('guess-input');
const hintText = document.getElementById('hint-text');
const hintNum = document.getElementById('hint-num');
const feedback = document.getElementById('feedback');

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

async function startGame() {
  feedback.textContent = '';
  guessInput.value = '';
  try {
    const res = await fetch('/api/new', { method: 'POST' });
    const data = await res.json();
    sessionId = data.sessionId;
    hintText.textContent = data.hint;
    hintNum.textContent = data.hintNumber;
    show(gameScreen);
    guessInput.focus();
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
    } else {
      // next hint
      feedback.textContent = data.message;
      hintText.textContent = data.hint;
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

btnStart.addEventListener('click', startGame);
btnAgain.addEventListener('click', startGame);
btnGuess.addEventListener('click', submitGuess);

guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitGuess();
});
