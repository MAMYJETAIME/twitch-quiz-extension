window.ViewerApp = (function () {
  var pollId = null;
  var answeredIndex = null;

  function init() {
    renderBase();
    startPolling();
  }

  function renderBase() {
    var app = document.getElementById('app');
    app.innerHTML = `
      <div class="page viewer-page">
        <div class="viewer-card" id="viewerRoot"></div>
      </div>
    `;
    updateView();
  }

  function updateView() {
    var root = document.getElementById('viewerRoot');
    var pseudo = window.AppState.viewerPseudo;
    var state = window.AppState.currentState || { status: 'idle', leaderboard: [] };

    if (!pseudo) {
      root.innerHTML = `
        <h1>Quiz Twitch</h1>
        <p>Entre ton pseudo pour participer</p>
        <input id="pseudoInput" type="text" placeholder="Ton pseudo" />
        <button id="savePseudoBtn">Valider</button>
      `;

      document.getElementById('savePseudoBtn').addEventListener('click', function () {
        var value = document.getElementById('pseudoInput').value.trim();
        if (!value) return;
        window.AppState.viewerPseudo = value;
        localStorage.setItem('viewerPseudo', value);
        updateView();
      });

      return;
    }

    if (state.status === 'idle') {
      root.innerHTML = `
        <h1>Bienvenue ${window.Utils.escapeHtml(pseudo)}</h1>
        <p>En attente du lancement du quiz...</p>
        ${renderLeaderboard(state)}
      `;
      return;
    }

    if (state.status === 'paused') {
      root.innerHTML = `
        <h1>${window.Utils.escapeHtml(state.quizName || 'Quiz')}</h1>
        <p>Quiz en pause</p>
        ${renderLeaderboard(state)}
      `;
      return;
    }

    if (state.status === 'ended') {
      root.innerHTML = `
        <h1>Quiz terminé</h1>
        ${renderLeaderboard(state)}
      `;
      return;
    }

    var question = state.currentQuestion;
    if (!question) {
      root.innerHTML = `
        <h1>Chargement...</h1>
      `;
      return;
    }

    var remaining = window.Utils.remainingSeconds(state.timerEnd);
    var timerPercent = question.timer > 0 ? Math.max(0, (remaining / question.timer) * 100) : 0;

    var answersHtml = '';
    question.answers.forEach(function (answer) {
      answersHtml += `
        <button class="answer-btn" data-answer="${window.Utils.escapeHtml(answer)}">
          ${window.Utils.escapeHtml(answer)}
        </button>
      `;
    });

    var mediaHtml = '';
    if (question.media && question.media.url && question.media.type === 'image') {
      mediaHtml = `<img class="question-media" src="${window.Utils.escapeHtml(question.media.url)}" alt="">`;
    }

    root.innerHTML = `
      <h1>${window.Utils.escapeHtml(state.quizName || 'Quiz')}</h1>
      <div class="timer-bar">
        <div class="timer-fill" style="width:${timerPercent}%"></div>
      </div>
      <div class="timer-text">${remaining}s</div>
      ${mediaHtml}
      <div class="question-text">${window.Utils.escapeHtml(question.text)}</div>
      <div class="answers-grid">${answersHtml}</div>
      ${renderLeaderboard(state)}
    `;

    document.querySelectorAll('.answer-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var answer = this.getAttribute('data-answer');
        sendAnswer(answer, state.index);
      });
    });
  }

  function sendAnswer(answer, index) {
    if (answeredIndex === index) return;
    answeredIndex = index;

    window.Api.answer(window.AppState.viewerPseudo, answer).then(function (res) {
      if (res && res.success) {
        alert(res.correct ? 'Bonne réponse ! +' + (res.score || 0) + ' score total' : 'Mauvaise réponse');
      }
    }).catch(function () {
      answeredIndex = null;
    });
  }

  function renderLeaderboard(state) {
    var html = '<div class="leaderboard-box"><h3>Classement</h3>';

    (state.leaderboard || []).forEach(function (player, index) {
      html += `
        <div class="leaderboard-row">
          <span>#${index + 1} ${window.Utils.escapeHtml(player.pseudo)}</span>
          <strong>${player.score}</strong>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  function fetchState() {
    window.Api.getState().then(function (state) {
      if (!window.AppState.currentState || window.AppState.currentState.index !== state.index) {
        answeredIndex = null;
      }

      window.AppState.currentState = state;
      updateView();
    });
  }

  function startPolling() {
    fetchState();
    if (pollId) clearInterval(pollId);
    pollId = setInterval(fetchState, 2000);
  }

  return {
    init: init
  };
})();