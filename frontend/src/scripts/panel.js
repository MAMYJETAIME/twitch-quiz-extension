window.PanelApp = (function () {
  var intervalId = null;

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = `
      <div class="page admin-page">
        <div class="admin-layout">
          <div class="card">
            <h1>Admin Quiz Twitch</h1>
            <div class="form-row">
              <input id="quizName" type="text" placeholder="Nom du quiz" />
              <button id="createQuizBtn">Créer / Mettre à jour</button>
            </div>

            <div id="questionsContainer"></div>

            <div class="form-row">
              <button id="addQuestionBtn">+ Ajouter une question</button>
            </div>
          </div>

          <div class="card">
            <h2>Quiz sauvegardés</h2>
            <div id="quizList"></div>
          </div>

          <div class="card">
            <h2>Contrôle live</h2>
            <div class="controls-grid">
              <button id="startBtn">Start</button>
              <button id="nextBtn">Next</button>
              <button id="pauseBtn">Pause</button>
              <button id="resumeBtn">Resume</button>
              <button id="endBtn">End</button>
            </div>
            <div id="liveState"></div>
          </div>

          <div class="card">
            <h2>Classement live</h2>
            <div id="leaderboard"></div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    addQuestionBlock();
    loadQuizzes();
    refreshLiveState();
    startPolling();
  }

  function bindEvents() {
    document.getElementById('addQuestionBtn').addEventListener('click', addQuestionBlock);
    document.getElementById('createQuizBtn').addEventListener('click', saveQuiz);
    document.getElementById('startBtn').addEventListener('click', function () {
      window.Api.start().then(refreshLiveState);
    });
    document.getElementById('nextBtn').addEventListener('click', function () {
      window.Api.next().then(refreshLiveState);
    });
    document.getElementById('pauseBtn').addEventListener('click', function () {
      window.Api.pause().then(refreshLiveState);
    });
    document.getElementById('resumeBtn').addEventListener('click', function () {
      window.Api.resume().then(refreshLiveState);
    });
    document.getElementById('endBtn').addEventListener('click', function () {
      window.Api.end().then(refreshLiveState);
    });
  }

  function addQuestionBlock() {
    var container = document.getElementById('questionsContainer');
    var count = container.querySelectorAll('.question-block').length + 1;

    var block = document.createElement('div');
    block.className = 'question-block';
    block.innerHTML = `
      <h3>Question ${count}</h3>
      <input type="text" class="q-text" placeholder="Texte de la question" />
      <input type="text" class="q-a1" placeholder="Réponse A" />
      <input type="text" class="q-a2" placeholder="Réponse B" />
      <input type="text" class="q-a3" placeholder="Réponse C" />
      <input type="text" class="q-a4" placeholder="Réponse D" />
      <input type="text" class="q-correct" placeholder="Bonne réponse exacte" />
      <input type="number" class="q-timer" placeholder="Timer (sec)" value="30" />
      <input type="number" class="q-reward" placeholder="Reward (MAMYCOINS)" value="10" />
      <input type="text" class="q-media-url" placeholder="URL image/video (optionnel)" />
      <button class="danger remove-question-btn">Supprimer cette question</button>
    `;

    container.appendChild(block);

    block.querySelector('.remove-question-btn').addEventListener('click', function () {
      block.remove();
    });
  }

  function collectQuiz() {
    var name = document.getElementById('quizName').value.trim();
    var blocks = document.querySelectorAll('.question-block');
    var questions = [];

    blocks.forEach(function (block) {
      var qText = block.querySelector('.q-text').value.trim();
      var a1 = block.querySelector('.q-a1').value.trim();
      var a2 = block.querySelector('.q-a2').value.trim();
      var a3 = block.querySelector('.q-a3').value.trim();
      var a4 = block.querySelector('.q-a4').value.trim();
      var correct = block.querySelector('.q-correct').value.trim();
      var timer = parseInt(block.querySelector('.q-timer').value, 10) || 30;
      var reward = parseInt(block.querySelector('.q-reward').value, 10) || 10;
      var mediaUrl = block.querySelector('.q-media-url').value.trim();

      if (qText && a1 && a2 && a3 && a4 && correct) {
        questions.push({
          text: qText,
          answers: [a1, a2, a3, a4],
          correct: correct,
          timer: timer,
          reward: reward,
          media: {
            type: mediaUrl ? 'image' : '',
            url: mediaUrl
          }
        });
      }
    });

    return {
      name: name,
      questions: questions
    };
  }

  function saveQuiz() {
    var quiz = collectQuiz();

    if (!quiz.name) {
      alert('Nom du quiz requis');
      return;
    }

    if (!quiz.questions.length) {
      alert('Ajoute au moins une question');
      return;
    }

    window.Api.saveQuiz(quiz).then(function () {
      loadQuizzes();
      alert('Quiz sauvegardé');
    });
  }

  function loadQuizzes() {
    window.Api.getQuizzes().then(function (quizzes) {
      var html = '';

      quizzes.forEach(function (quiz) {
        html += `
          <div class="quiz-item">
            <div>
              <strong>${window.Utils.escapeHtml(quiz.name)}</strong><br>
              <small>${quiz.questions.length} question(s)</small>
            </div>
            <div class="quiz-actions">
              <button class="select-quiz-btn" data-name="${window.Utils.escapeHtml(quiz.name)}">Sélectionner</button>
              <button class="danger delete-quiz-btn" data-name="${window.Utils.escapeHtml(quiz.name)}">Supprimer</button>
            </div>
          </div>
        `;
      });

      document.getElementById('quizList').innerHTML = html || '<p>Aucun quiz</p>';

      document.querySelectorAll('.select-quiz-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = this.getAttribute('data-name');
          window.Api.selectQuiz(name).then(refreshLiveState);
        });
      });

      document.querySelectorAll('.delete-quiz-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = this.getAttribute('data-name');
          window.Api.deleteQuiz(name).then(loadQuizzes);
        });
      });
    });
  }

  function refreshLiveState() {
    window.Api.getState().then(function (state) {
      window.AppState.currentState = state;

      var timer = window.Utils.remainingSeconds(state.timerEnd);

      document.getElementById('liveState').innerHTML = `
        <p><strong>Quiz:</strong> ${window.Utils.escapeHtml(state.quizName || 'Aucun')}</p>
        <p><strong>Status:</strong> ${window.Utils.escapeHtml(state.status || 'idle')}</p>
        <p><strong>Question index:</strong> ${state.index}</p>
        <p><strong>Timer:</strong> ${timer}s</p>
      `;

      var lbHtml = '';
      (state.leaderboard || []).forEach(function (player, index) {
        lbHtml += `
          <div class="leaderboard-row">
            <span>#${index + 1} ${window.Utils.escapeHtml(player.pseudo)}</span>
            <strong>${player.score} MAMYCOINS</strong>
          </div>
        `;
      });

      document.getElementById('leaderboard').innerHTML = lbHtml || '<p>Aucun joueur</p>';
    });
  }

  function startPolling() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(refreshLiveState, 2000);
  }

  return {
    init: render
  };
})();