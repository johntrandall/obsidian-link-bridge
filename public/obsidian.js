// Obsidian link bridge: turns https://<your host>/obsidian#<params> into an obsidian:// link.
//
// The parameters live in the URL fragment (after #). Browsers never send the fragment to the
// server, so the host sees only "GET /obsidian" and no vault or note name ever reaches a log.
//
// Only "open a note" parameters are accepted. Advanced URI can also run commands and write
// files (commandid, data, mode, ...); once a user ticks the browser's "Always allow" for this site,
// any link to this page opens Obsidian without asking. So anything outside the allowlist is
// refused instead of forwarded.

(function (root) {
  'use strict';

  // Advanced URI plugin (opens in a new tab with openmode=tab). Chosen when filepath= is present.
  var ADVANCED_URI_KEYS = ['vault', 'filepath', 'openmode', 'viewmode', 'heading', 'block', 'line'];
  // Obsidian's built-in obsidian://open. Chosen when file= or path= is present.
  var OPEN_KEYS = ['vault', 'file', 'path', 'paneType'];

  // Parse "a=1&b=x%2Fy" without URLSearchParams' "+ means space" rule: a literal + in a
  // note name must stay a +.
  function parseFragment(fragment) {
    var text = String(fragment || '').replace(/^#/, '');
    var params = [];
    if (!text) return params;
    text.split('&').forEach(function (pair) {
      if (!pair) return;
      var at = pair.indexOf('=');
      var key = at < 0 ? pair : pair.slice(0, at);
      var value = at < 0 ? '' : pair.slice(at + 1);
      params.push([decodeURIComponent(key), decodeURIComponent(value)]);
    });
    return params;
  }

  // Returns {uri, action, vault, target} or {error}.
  function buildObsidianUri(fragment) {
    var params;
    try {
      params = parseFragment(fragment);
    } catch (e) {
      return { error: 'The link is not valid URL encoding.' };
    }
    if (params.length === 0) return { error: 'This link carries no note to open.' };

    var keys = params.map(function (p) { return p[0]; });
    var has = function (k) { return keys.indexOf(k) >= 0; };
    var action, allowed, target;
    if (has('filepath')) {
      action = 'advanced-uri'; allowed = ADVANCED_URI_KEYS;
    } else if (has('file') || has('path')) {
      action = 'open'; allowed = OPEN_KEYS;
    } else {
      return { error: 'The link names no note (it needs filepath=, file= or path=).' };
    }

    var seen = Object.create(null);
    var rejected = [];
    for (var i = 0; i < params.length; i++) {
      var k = params[i][0];
      if (allowed.indexOf(k) < 0) rejected.push(k);
      if (k in seen) return { error: 'The link repeats the parameter "' + k + '".' };
      seen[k] = params[i][1];
    }
    if (rejected.length) {
      return { error: 'This bridge only opens notes. It refused: ' + rejected.join(', ') + '.' };
    }

    target = seen.filepath || seen.file || seen.path;
    if (!target) return { error: 'The link names no note (filepath=, file= or path= is empty).' };
    var query = params.map(function (p) {
      return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]);
    }).join('&');
    return { uri: 'obsidian://' + action + '?' + query, action: action, vault: seen.vault || '', target: target };
  }

  root.buildObsidianUri = buildObsidianUri;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildObsidianUri: buildObsidianUri };
    return;
  }

  function render() {
    var result = buildObsidianUri(root.location.hash);
    var status = document.getElementById('status');
    var where = document.getElementById('where');
    var button = document.getElementById('open');
    if (result.error) {
      status.textContent = result.error;
      where.textContent = '';
      button.hidden = true;
      return;
    }
    status.textContent = 'Opening in Obsidian…';
    where.textContent = (result.vault ? result.vault + ' · ' : '') + result.target;
    button.href = result.uri;
    button.hidden = false;
    root.location.href = result.uri;
  }

  document.addEventListener('DOMContentLoaded', render);
  root.addEventListener('hashchange', render);
})(typeof window !== 'undefined' ? window : globalThis);
