(function () {
  window.AppState = {
    apiBase: 'https://twitch-quiz-inem.onrender.com',
    twitch: {
      authorized: false,
      channelId: null,
      userId: null,
      opaqueUserId: null
    },
    viewerPseudo: localStorage.getItem('viewerPseudo') || '',
    currentState: null
  };

  window.Api = (function () {
    function getBase() {
      return window.AppState.apiBase;
    }

    function getJson(url) {
      return fetch(url).then(function (res) {
        return res.json();
      });
    }

    function postJson(path, body) {
      return fetch(getBase() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      }).then(function (res) {
        return res.json();
      });
    }

    return {
      getState: function () { return getJson(getBase() + '/api/state'); },
      getQuizzes: function () { return getJson(getBase() + '/api/getQuizzes'); },
      saveQuiz: function (quiz) { return postJson('/api/saveQuiz', quiz); },
      deleteQuiz: function (name) { return postJson('/api/deleteQuiz', { name: name }); },
      selectQuiz: function (name) { return postJson('/api/selectQuiz', { name: name }); },
      start: function () { return postJson('/api/start'); },
      next: function () { return postJson('/api/next'); },
      pause: function () { return postJson('/api/pause'); },
      resume: function () { return postJson('/api/resume'); },
      end: function () { return postJson('/api/end'); },
      answer: function (pseudo, answer) {
        return postJson('/api/answer', { pseudo: pseudo, answer: answer });
      }
    };
  })();

  window.Utils = (function () {
    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function remainingSeconds(timerEnd) {
      if (!timerEnd) return 0;
      return Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
    }

    function isPanelPage() {
      return window.location.pathname.indexOf('panel.html') !== -1;
    }

    function isViewerPage() {
      return window.location.pathname.indexOf('video_overlay.html') !== -1;
    }

    return {
      escapeHtml: escapeHtml,
      remainingSeconds: remainingSeconds,
      isPanelPage: isPanelPage,
      isViewerPage: isViewerPage
    };
  })();

  window.ViewerApp = (function () {
    var pollId = null;
    var answeredIndex = null;

    function init() {
      renderBase();
      startPolling();
    }

    function renderBase() {
      var app = document.getElementById('app');
      app.innerHTML = `<div class="page viewer-page"><div class="viewer-card" id="viewerRoot"></div></div>`;
      updateView();
    }

    function updateView() {
      var root = document.getElementById('viewerRoot');
      var pseudo = window.AppState.viewerPseudo;
      var state = window.AppState.currentState || { status: 'idle', leaderboard: [] };

      if (!pseudo) {
        root.innerHTML = `
          <h1>Quiz Twitch</h1>
          <p>Entre ton pseudo</p>
          <input id="pseudoInput" type="text" placeholder="Pseudo" />
          <button id="savePseudoBtn">Valider</button>
        `;

        document.getElementById('savePseudoBtn').onclick = function () {
          var val = document.getElementById('pseudoInput').value.trim();
          if (!val) return;
          window.AppState.viewerPseudo = val;
          localStorage.setItem('viewerPseudo', val);
          updateView();
        };
        return;
      }

      if (state.status !== 'playing') {
        root.innerHTML = `<h1>En attente...</h1>`;
        return;
      }

      var q = state.currentQuestion;
      if (!q) return;

      var remaining = window.Utils.remainingSeconds(state.timerEnd);

      var html = `<h2>${q.text}</h2><p>${remaining}s</p>`;

      q.answers.forEach(function (a) {
        html += `<button class="answer-btn">${a}</button>`;
      });

      root.innerHTML = html;

      document.querySelectorAll('.answer-btn').forEach(function (btn) {
        btn.onclick = function () {
          if (answeredIndex === state.index) return;
          answeredIndex = state.index;

          window.Api.answer(window.AppState.viewerPseudo, btn.innerText)
            .then(function (res) {
              alert(res.correct ? "Bonne réponse" : "Faux");
            });
        };
      });
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

    return { init: init };
  })();

  window.Router = (function () {
    function initTwitch() {
      if (window.Twitch && window.Twitch.ext) {
        window.Twitch.ext.onAuthorized(function () {});
      }
    }

    function boot() {
      initTwitch();
      window.ViewerApp.init();
    }

    return { boot: boot };
  })();

  document.addEventListener('DOMContentLoaded', function () {
    window.Router.boot();
  });
})();