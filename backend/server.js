const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const QUIZZES_FILE = path.join(DATA_DIR, 'quizzes.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

app.use(cors());
app.use(express.json());

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
  }
}

function readJson(filePath, fallback) {
  try {
    ensureFile(filePath, fallback);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getQuizzes() {
  return readJson(QUIZZES_FILE, []);
}

function saveQuizzes(quizzes) {
  writeJson(QUIZZES_FILE, quizzes);
}

function getState() {
  return readJson(STATE_FILE, {
    status: 'idle',
    quizName: '',
    index: 0,
    timerEnd: null,
    pausedTimeLeft: 0,
    players: {},
    selectedQuiz: null
  });
}

function saveState(state) {
  writeJson(STATE_FILE, state);
}

function getSelectedQuiz() {
  const quizzes = getQuizzes();
  const state = getState();

  if (!state.selectedQuiz) return null;
  return quizzes.find(q => q.name === state.selectedQuiz) || null;
}

function getCurrentQuestion() {
  const quiz = getSelectedQuiz();
  const state = getState();

  if (!quiz) return null;
  if (!quiz.questions || !quiz.questions[state.index]) return null;

  return quiz.questions[state.index];
}

function sanitizeQuestion(question) {
  if (!question) return null;

  return {
    text: question.text || '',
    answers: Array.isArray(question.answers) ? question.answers : [],
    timer: Number(question.timer || 30),
    reward: Number(question.reward || 0),
    media: question.media || { type: '', url: '' }
  };
}

function buildPublicState() {
  const state = getState();
  const quiz = getSelectedQuiz();
  const question = getCurrentQuestion();

  const leaderboard = Object.entries(state.players || {})
    .map(([pseudo, data]) => ({
      pseudo,
      score: data.score || 0
    }))
    .sort((a, b) => b.score - a.score);

  return {
    status: state.status,
    quizName: state.quizName,
    index: state.index,
    timerEnd: state.timerEnd,
    pausedTimeLeft: state.pausedTimeLeft,
    selectedQuiz: state.selectedQuiz,
    currentQuestion: sanitizeQuestion(question),
    leaderboard
  };
}

ensureFile(QUIZZES_FILE, []);
ensureFile(STATE_FILE, {
  status: 'idle',
  quizName: '',
  index: 0,
  timerEnd: null,
  pausedTimeLeft: 0,
  players: {},
  selectedQuiz: null
});

app.get('/api/getQuizzes', (req, res) => {
  const quizzes = getQuizzes();
  res.json(quizzes);
});

app.post('/api/saveQuiz', (req, res) => {
  const incomingQuiz = req.body;

  if (!incomingQuiz || !incomingQuiz.name || !Array.isArray(incomingQuiz.questions)) {
    return res.status(400).json({ error: 'Quiz invalide' });
  }

  const quizzes = getQuizzes();
  const index = quizzes.findIndex(q => q.name === incomingQuiz.name);

  if (index >= 0) {
    quizzes[index] = incomingQuiz;
  } else {
    quizzes.push(incomingQuiz);
  }

  saveQuizzes(quizzes);
  res.json({ success: true, quizzes });
});

app.post('/api/deleteQuiz', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nom du quiz requis' });
  }

  let quizzes = getQuizzes();
  quizzes = quizzes.filter(q => q.name !== name);
  saveQuizzes(quizzes);

  const state = getState();
  if (state.selectedQuiz === name) {
    state.selectedQuiz = null;
    state.quizName = '';
    state.status = 'idle';
    state.index = 0;
    state.timerEnd = null;
    state.pausedTimeLeft = 0;
    state.players = {};
    saveState(state);
  }

  res.json({ success: true, quizzes });
});

app.post('/api/selectQuiz', (req, res) => {
  const { name } = req.body;
  const quizzes = getQuizzes();
  const quiz = quizzes.find(q => q.name === name);

  if (!quiz) {
    return res.status(404).json({ error: 'Quiz introuvable' });
  }

  const state = getState();
  state.selectedQuiz = name;
  state.quizName = name;
  state.index = 0;
  state.status = 'idle';
  state.timerEnd = null;
  state.pausedTimeLeft = 0;
  state.players = {};
  saveState(state);

  res.json({ success: true, state });
});

app.post('/api/start', (req, res) => {
  const state = getState();
  const quiz = getSelectedQuiz();

  if (!quiz) {
    return res.status(400).json({ error: 'Aucun quiz sélectionné' });
  }

  if (!quiz.questions.length) {
    return res.status(400).json({ error: 'Le quiz ne contient aucune question' });
  }

  const question = quiz.questions[state.index];
  state.status = 'playing';
  state.timerEnd = Date.now() + (Number(question.timer || 30) * 1000);
  state.pausedTimeLeft = 0;
  saveState(state);

  res.json({ success: true, state });
});

app.post('/api/next', (req, res) => {
  const state = getState();
  const quiz = getSelectedQuiz();

  if (!quiz) {
    return res.status(400).json({ error: 'Aucun quiz sélectionné' });
  }

  state.index += 1;

  if (state.index >= quiz.questions.length) {
    state.status = 'ended';
    state.timerEnd = null;
    state.pausedTimeLeft = 0;
    saveState(state);
    return res.json({ success: true, state, ended: true });
  }

  const question = quiz.questions[state.index];
  state.status = 'playing';
  state.timerEnd = Date.now() + (Number(question.timer || 30) * 1000);
  state.pausedTimeLeft = 0;
  saveState(state);

  res.json({ success: true, state });
});

app.post('/api/pause', (req, res) => {
  const state = getState();

  if (state.status !== 'playing') {
    return res.status(400).json({ error: 'Le quiz n’est pas en cours' });
  }

  state.pausedTimeLeft = Math.max(0, state.timerEnd - Date.now());
  state.timerEnd = null;
  state.status = 'paused';
  saveState(state);

  res.json({ success: true, state });
});

app.post('/api/resume', (req, res) => {
  const state = getState();

  if (state.status !== 'paused') {
    return res.status(400).json({ error: 'Le quiz n’est pas en pause' });
  }

  state.timerEnd = Date.now() + (state.pausedTimeLeft || 0);
  state.pausedTimeLeft = 0;
  state.status = 'playing';
  saveState(state);

  res.json({ success: true, state });
});

app.post('/api/end', (req, res) => {
  const state = getState();
  state.status = 'ended';
  state.timerEnd = null;
  state.pausedTimeLeft = 0;
  saveState(state);

  res.json({ success: true, state });
});

app.post('/api/answer', (req, res) => {
  const { pseudo, answer } = req.body;
  const state = getState();
  const quiz = getSelectedQuiz();

  if (!pseudo || !answer) {
    return res.status(400).json({ error: 'Pseudo et réponse requis' });
  }

  if (!quiz) {
    return res.status(400).json({ error: 'Aucun quiz actif' });
  }

  if (state.status !== 'playing') {
    return res.status(400).json({ error: 'Le quiz n’est pas en cours' });
  }

  const question = quiz.questions[state.index];
  if (!question) {
    return res.status(400).json({ error: 'Question introuvable' });
  }

  if (!state.players[pseudo]) {
    state.players[pseudo] = {
      score: 0,
      answeredQuestions: []
    };
  }

  const player = state.players[pseudo];

  if (player.answeredQuestions.includes(state.index)) {
    return res.status(400).json({ error: 'Déjà répondu à cette question' });
  }

  player.answeredQuestions.push(state.index);

  if (answer === question.correct) {
    player.score += Number(question.reward || 0);
  }

  saveState(state);

  res.json({
    success: true,
    correct: answer === question.correct,
    score: player.score
  });
});

app.get('/api/state', (req, res) => {
  const state = getState();
  const publicState = buildPublicState();

  if (state.status === 'playing' && state.timerEnd && Date.now() >= state.timerEnd) {
    state.status = 'paused';
    state.pausedTimeLeft = 0;
    state.timerEnd = null;
    saveState(state);

    return res.json(buildPublicState());
  }

  res.json(publicState);
});

app.get('/', (req, res) => {
  res.send('Twitch Quiz Backend OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});