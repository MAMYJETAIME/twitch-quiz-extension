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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json();
    });
  }

  return {
    getState: function () {
      return getJson(getBase() + '/api/state');
    },
    getQuizzes: function () {
      return getJson(getBase() + '/api/getQuizzes');
    },
    saveQuiz: function (quiz) {
      return postJson('/api/saveQuiz', quiz);
    },
    deleteQuiz: function (name) {
      return postJson('/api/deleteQuiz', { name: name });
    },
    selectQuiz: function (name) {
      return postJson('/api/selectQuiz', { name: name });
    },
    start: function () {
      return postJson('/api/start');
    },
    next: function () {
      return postJson('/api/next');
    },
    pause: function () {
      return postJson('/api/pause');
    },
    resume: function () {
      return postJson('/api/resume');
    },
    end: function () {
      return postJson('/api/end');
    },
    answer: function (pseudo, answer) {
      return postJson('/api/answer', {
        pseudo: pseudo,
        answer: answer
      });
    }
  };
})();