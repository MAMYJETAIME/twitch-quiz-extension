const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, "data");
const QUIZ_FILE = path.join(DATA_DIR, "quizzes.json");
const STATE_FILE = path.join(DATA_DIR, "state.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(QUIZ_FILE)) {
  fs.writeFileSync(QUIZ_FILE, "[]", "utf8");
}

if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        status: "idle",
        quizName: "",
        questions: [],
        index: 0,
        timerEnd: null,
        pausedTimeLeft: 0,
        acceptingAnswers: false,
        players: {},
        answeredPlayers: [],
        currentQuestion: null
      },
      null,
      2
    ),
    "utf8"
  );
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function getState() {
  return readJson(STATE_FILE);
}

function saveState(state) {
  writeJson(STATE_FILE, state);
}

function getQuizzes() {
  return readJson(QUIZ_FILE);
}

function saveQuizzes(quizzes) {
  writeJson(QUIZ_FILE, quizzes);
}

function sanitizeQuiz(quiz) {
  return {
    name: String(quiz.name || "").trim(),
    questions: Array.isArray(quiz.questions)
      ? quiz.questions.map((q) => ({
          text: String(q.text || "").trim(),
          answers: Array.isArray(q.answers)
            ? q.answers.map((a) => String(a || "").trim()).filter(Boolean)
            : [],
          correct: String(q.correct || "").trim(),
          timer: Number(q.timer || 30),
          reward: Number(q.reward || 0),
          media: {
            type: q.media && q.media.type ? String(q.media.type) : "image",
            url: q.media && q.media.url ? String(q.media.url) : ""
          }
        }))
      : []
  };
}

function startCurrentQuestion(state) {
  const question = state.questions[state.index] || null;

  state.currentQuestion = question;
  state.answeredPlayers = [];

  if (question) {
    state.acceptingAnswers = true;
    state.timerEnd = Date.now() + Number(question.timer || 30) * 1000;
    state.pausedTimeLeft = 0;
  } else {
    state.acceptingAnswers = false;
    state.timerEnd = null;
    state.pausedTimeLeft = 0;
  }

  return state;
}

function buildLeaderboard(state) {
  return Object.keys(state.players || {})
    .map((name) => ({
      pseudo: name,
      score: Number(state.players[name].score || 0)
    }))
    .sort((a, b) => b.score - a.score);
}

function updateTimerIfNeeded() {
  const state = getState();

  if (
    state.status === "playing" &&
    state.acceptingAnswers &&
    state.timerEnd &&
    Date.now() >= state.timerEnd
  ) {
    state.acceptingAnswers = false;
    state.timerEnd = null;
    state.pausedTimeLeft = 0;

    // IMPORTANT :
    // On reste sur la question.
    // On ne passe PAS à paused.
    // On ne passe PAS à la question suivante.
    saveState(state);
  }
}

setInterval(updateTimerIfNeeded, 500);

app.get("/api/getQuizzes", (req, res) => {
  res.json(getQuizzes());
});

app.post("/api/saveQuiz", (req, res) => {
  try {
    const incomingQuiz = sanitizeQuiz(req.body);

    if (!incomingQuiz.name) {
      return res.status(400).json({ error: "Quiz name required" });
    }

    const quizzes = getQuizzes();
    const filtered = quizzes.filter((q) => q.name !== incomingQuiz.name);
    filtered.push(incomingQuiz);
    saveQuizzes(filtered);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "saveQuiz failed" });
  }
});

app.post("/api/deleteQuiz", (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const quizzes = getQuizzes().filter((q) => q.name !== name);
    saveQuizzes(quizzes);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "deleteQuiz failed" });
  }
});

app.post("/api/selectQuiz", (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const quizzes = getQuizzes();
    const quiz = quizzes.find((q) => q.name === name);

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    const state = {
      status: "idle",
      quizName: quiz.name,
      questions: quiz.questions || [],
      index: 0,
      timerEnd: null,
      pausedTimeLeft: 0,
      acceptingAnswers: false,
      players: {},
      answeredPlayers: [],
      currentQuestion: null
    };

    saveState(state);
    res.json({ ok: true, state });
  } catch (e) {
    res.status(500).json({ error: "selectQuiz failed" });
  }
});

app.post("/api/start", (req, res) => {
  try {
    const state = getState();

    if (!Array.isArray(state.questions) || !state.questions.length) {
      return res.status(400).json({ error: "No questions in selected quiz" });
    }

    state.status = "playing";
    state.index = 0;
    state.players = state.players || {};
    startCurrentQuestion(state);

    saveState(state);
    res.json({ ok: true, state });
  } catch (e) {
    res.status(500).json({ error: "start failed" });
  }
});

app.post("/api/next", (req, res) => {
  try {
    const state = getState();

    if (!Array.isArray(state.questions) || !state.questions.length) {
      return res.status(400).json({ error: "No questions in selected quiz" });
    }

    state.index += 1;

    if (state.index >= state.questions.length) {
      state.status = "ended";
      state.currentQuestion = null;
      state.timerEnd = null;
      state.pausedTimeLeft = 0;
      state.acceptingAnswers = false;
      state.answeredPlayers = [];
      saveState(state);
      return res.json({ ok: true, state });
    }

    state.status = "playing";
    startCurrentQuestion(state);

    saveState(state);
    res.json({ ok: true, state });
  } catch (e) {
    res.status(500).json({ error: "next failed" });
  }
});

app.post("/api/pause", (req, res) => {
  try {
    const state = getState();

    if (state.status !== "playing") {
      return res.json({ ok: true, state });
    }

    if (state.acceptingAnswers && state.timerEnd) {
      state.pausedTimeLeft = Math.max(0, state.timerEnd - Date.now());
    } else {
      state.pausedTimeLeft = 0;
    }

    state.status = "paused";
    state.timerEnd = null;
    state.acceptingAnswers = false;

    saveState(state);
    res.json({ ok: true, state });
  } catch (e) {
    res.status(500).json({ error: "pause failed" });
  }
});

app.post("/api/resume", (req, res) => {
  try {
    const state = getState();

    if (state.status !== "paused") {
      return res.json({ ok: true, state });
    }

    state.status = "playing";

    if (state.currentQuestion && Number(state.pausedTimeLeft || 0) > 0) {
      state.timerEnd = Date.now() + Number(state.pausedTimeLeft || 0);
      state.acceptingAnswers = true;
    } else {
      state.timerEnd = null;
      state.acceptingAnswers = false;
    }

    saveState(state);
    res.json({ ok: true, state });
  } catch (e) {
    res.status(500).json({ error: "resume failed" });
  }
});

app.post("/api/end", (req, res) => {
  try {
    const state = getState();
    state.status = "ended";
    state.currentQuestion = null;
    state.timerEnd = null;
    state.pausedTimeLeft = 0;
    state.acceptingAnswers = false;
    state.answeredPlayers = [];
    saveState(state);
    res.json({ ok: true, state });
  } catch (e) {
    res.status(500).json({ error: "end failed" });
  }
});

app.post("/api/answer", (req, res) => {
  try {
    const state = getState();
    const pseudo = String(req.body.pseudo || "").trim();
    const answer = String(req.body.answer || "").trim();

    if (!pseudo || !answer) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    if (state.status !== "playing") {
      return res.json({ ok: false, error: "Quiz not playing" });
    }

    if (!state.acceptingAnswers) {
      return res.json({ ok: false, error: "Time over" });
    }

    if (!state.currentQuestion) {
      return res.json({ ok: false, error: "No active question" });
    }

    if (!Array.isArray(state.answeredPlayers)) {
      state.answeredPlayers = [];
    }

    if (state.answeredPlayers.includes(pseudo)) {
      return res.json({ ok: false, error: "Already answered" });
    }

    state.answeredPlayers.push(pseudo);

    if (!state.players[pseudo]) {
      state.players[pseudo] = { score: 0 };
    }

    if (answer === state.currentQuestion.correct) {
      state.players[pseudo].score += Number(state.currentQuestion.reward || 0);
    }

    saveState(state);

    // IMPORTANT :
    // on ne renvoie PAS si c'est vrai ou faux
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "answer failed" });
  }
});

app.get("/api/state", (req, res) => {
  try {
    const state = getState();
    res.json({
      ...state,
      leaderboard: buildLeaderboard(state)
    });
  } catch (e) {
    res.status(500).json({ error: "state failed" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});