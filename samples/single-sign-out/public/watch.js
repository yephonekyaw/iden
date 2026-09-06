/**
 * Notice when the session ends without this page doing anything.
 *
 * A back-channel logout is a conversation between IDEN and this application's
 * server; the open browser is not part of it. Without this poll the window
 * looks signed in until somebody reloads — and watching a window you are not
 * touching sign itself out is the entire demo.
 */
(function watch() {
  var live = document.getElementById("live");
  var stopped = false;

  function tick() {
    if (stopped) return;
    fetch("/api/session", { credentials: "same-origin" })
      .then(function (response) {
        return response.json();
      })
      .then(function (state) {
        if (state.signedIn) return;
        stopped = true;
        if (live) {
          live.textContent = state.endedBy ? "ended by " + state.endedBy : "ended";
          live.className = "badge badge--ended";
        }
        // Straight to the server so it can say who ended it, rather than
        // repainting a guess here.
        window.location.replace("/");
      })
      .catch(function () {
        // The server is gone or restarting. Say nothing and try again.
      });
  }

  setInterval(tick, 1500);
})();
