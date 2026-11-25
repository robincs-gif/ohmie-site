/* ohmie.io/redeem: a promo code turns on Ohmie Pro.
   The person signs in here (Apple, Google, or email and password; same Supabase project as the app), the page sends the
   code to the redeem-code edge function with their session, and says in one line what happened. No analytics on this page.
   1. Pure functions (tests/redeem.test.mjs runs this file in node and calls them). No DOM, no network.
      next(state, event) is the whole machine: every change of state is one event through it.
      viewOf(state) says what the card shows for one state; render(state) in block 2 only puts that on the page.
   2. The page: runs only in a browser, after supabase-js (pinned in redeem.html) has loaded. Side effects live here
      (Supabase, fetch, storage, the address bar) and only report back as events through dispatch(event).
      On localhost ?stub=<state> renders any state with canned data, no network.

   The link carries the code as ?promo=OHMIE-XXXXXXXXXX (?code= is Supabase's PKCE callback). At boot the code is read,
   kept in localStorage for a day, and dropped from the address bar. Every sign-in round trip also returns to
   /redeem?promo=<code>, so the code survives an email link opened in another browser. Cleared on granted or already. */

var OhmieRedeem = (function () {
  'use strict';

  var APP_STORE = 'https://apps.apple.com/us/app/ohmie-learn-electronics/id6779694265';
  var GENERIC_FAILURE = 'Something went wrong on our side. Try again in a minute.';
  var MESSAGES = {
    invalid: "That code didn't work. Check it and try again.",
    expired: 'That code has expired.',
    used_up: 'That code has been used up.',
    rate_limited: 'Too many tries. Wait an hour and try again.',
    anonymous: 'Confirm your email first, then try again.',
    unconfirmed: 'Confirm your email first, then try again.',
    pending: GENERIC_FAILURE,   // the grant is still on its way; Try again resumes it (the server is idempotent)
    failed: GENERIC_FAILURE
  };
  var NOT_REJECTIONS = { failed: true, pending: true };
  var CODE_REASONS = { invalid: true, expired: true, used_up: true };   // said under the code field, which takes focus
  var AUTH_FAILED = "Sign-in didn't work. Try again.";
  var SIGN_IN_AGAIN = 'Sign in again to use your code.';
  var EXISTING_ACCOUNT = 'You already have an account. Sign in instead.';
  var RETURN_URL = 'https://ohmie.io/redeem';
  var AUTH_URL_PARAMS = ['code', 'error', 'error_code', 'error_description'];   // supabase-js reads these, the page drops them after
  var REDEEM_TIMEOUT_MS = 15000;
  var RATE_COOLDOWN_MS = 60000;
  var CODE_TTL_MS = 24 * 60 * 60 * 1000;

  /* Trim, uppercase, no spaces anywhere: " ohmie- ab12 " is "OHMIE-AB12". */
  function normaliseCode(raw) {
    return String(raw == null ? '' : raw).replace(/\s+/g, '').toUpperCase();
  }

  /* The promo code from a location.search string, or '' when there is none. */
  function promoFromSearch(search) {
    return normaliseCode(new URLSearchParams(search || '').get('promo'));
  }

  /* pathname + search + hash with the named params taken out of the query and the hash. A hash without any of them
     is left as it was. */
  function urlWithout(pathname, search, hash, names) {
    var q = new URLSearchParams(search || '');
    var rawHash = String(hash || '').replace(/^#/, '');
    var h = new URLSearchParams(rawHash);
    var hashHit = false;
    names.forEach(function (n) { q.delete(n); if (h.has(n)) { hashHit = true; h.delete(n); } });
    var qs = q.toString();
    var hs = hashHit ? h.toString() : rawHash;
    return String(pathname || '') + (qs ? '?' + qs : '') + (hs ? '#' + hs : '');
  }

  /* Where a sign-in comes back to, with the code in the link: ohmie.io/redeem, or this page when on localhost. */
  function returnUrl(code, loc) {
    loc = loc || {};
    var local = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
    var base = local ? String(loc.origin || '') + String(loc.pathname || '') : RETURN_URL;
    var c = normaliseCode(code);
    return c ? base + '?promo=' + encodeURIComponent(c) : base;
  }

  /* The kept code as stored text, and back. A record older than ttl, from the future, or not ours reads as ''. */
  function encodeStoredCode(code, now) {
    return JSON.stringify({ code: normaliseCode(code), at: now });
  }
  function decodeStoredCode(raw, now, ttl) {
    var rec;
    try { rec = JSON.parse(raw); } catch (e) { return ''; }
    if (!rec || typeof rec.code !== 'string' || typeof rec.at !== 'number') return '';
    if (now < rec.at || now - rec.at > (ttl == null ? CODE_TTL_MS : ttl)) return '';
    return normaliseCode(rec.code);
  }

  /* The function's raw text as a body, or null when it is not JSON. */
  function parseBody(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  /* A sign-up for an email that already has an account: Supabase answers with a user that has no identities and
     no session (so the address can't be probed), and no email is sent. */
  function isExistingEmailSignUp(data) {
    var user = data && data.user;
    return !!(user && !data.session && Array.isArray(user.identities) && user.identities.length === 0);
  }

  /* A sign-in that came back with an error (an expired confirm link, a cancelled Google screen). */
  function authErrorInUrl(search, hash) {
    var q = new URLSearchParams(search || '');
    var h = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    return !!(q.get('error') || q.get('error_description') || h.get('error') || h.get('error_description'));
  }

  /* "December 24, 2027", or '' for anything that is not a date. timeZone is for tests; the page uses the visitor's. */
  function formatDate(iso, timeZone) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var opts = { year: 'numeric', month: 'long', day: 'numeric' };
    if (timeZone) opts.timeZone = timeZone;
    return d.toLocaleDateString('en-US', opts);
  }

  /* The function's answer is {result, granted_until?, renewing?}. Anything else counts as a failure on our side. */
  function resultOf(body) {
    return body && typeof body.result === 'string' ? body.result : 'failed';
  }

  /* One plain line for a result. ok is true for a grant, and for a code already on the account. */
  function messageFor(result, grantedUntil, timeZone) {
    var date = formatDate(grantedUntil, timeZone);
    if (result === 'granted') {
      return { ok: true, text: date ? "You're in. Ohmie Pro is on until " + date + '.' : "You're in. Ohmie Pro is on." };
    }
    if (result === 'already') {
      return { ok: true, text: 'This code is already on your account.' + (date ? ' Pro is on until ' + date + '.' : '') };
    }
    return { ok: false, text: Object.prototype.hasOwnProperty.call(MESSAGES, result) ? MESSAGES[result] : GENERIC_FAILURE };
  }

  /* A result the server gave on purpose (a bad code, too many tries), as opposed to a failure on our side. */
  function isRejection(result) {
    return !NOT_REJECTIONS[result] && Object.prototype.hasOwnProperty.call(MESSAGES, result);
  }

  /* A Supabase auth error as one plain line. */
  function authErrorMessage(error) {
    var code = (error && error.code) || '';
    var text = String((error && error.message) || '').toLowerCase();
    if (code === 'invalid_credentials' || text.indexOf('invalid login') !== -1) return "That email and password don't match.";
    if (code === 'email_not_confirmed' || text.indexOf('not confirmed') !== -1) return 'Confirm your email first, then try again.';
    if (code === 'user_already_exists' || text.indexOf('already registered') !== -1) return 'That email already has an account. Choose "I have an account".';
    if (code === 'weak_password' || text.indexOf('password should') !== -1) return "That password is too short or too simple. Try a longer one.";
    if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || (error && error.status === 429)) return 'Too many tries. Wait an hour and try again.';
    return "Sign-in didn't work. Try again.";
  }

  /* What the card shows for one state. A state is
       { name: 'resolving' | 'signedOut' | 'awayAtProvider' | 'awaitingEmailConfirm' | 'signedIn' | 'redeeming'
               | 'granted' | 'already' | 'rejected' | 'failed',
         code (normalised, '' for none),
         reason?   (rejected: invalid, expired, used_up, rate_limited, anonymous, unconfirmed; signedIn: needCode),
         email?, until? (iso), renewing?, mode? ('create' | 'signin'), authLine?, busy?, stub? }
     step is the one block on screen; codeLine sits under the code field; line under the action button. */
  function viewOf(s, timeZone) {
    s = s || {};
    var v = {
      step: 'signedIn', showSub: false, codeLine: '', focusCode: false, codeLocked: false,
      code: s.code || '', who: s.email || 'your account', action: 'Redeem', actionOff: false, line: '',
      doneLine: '', renewing: false, mode: s.mode === 'signin' ? 'signin' : 'create', authLine: s.authLine || '',
      busy: !!s.busy
    };
    switch (s.name) {
      case 'resolving':
        v.step = 'resolving'; v.busy = true; break;
      case 'signedOut':
        v.step = 'signedOut'; v.showSub = true; break;
      case 'awayAtProvider':
        v.step = 'signedOut'; v.showSub = true; v.busy = true; break;
      case 'awaitingEmailConfirm':
        v.step = 'awaitingEmailConfirm'; break;
      case 'signedIn':
        if (s.reason === 'needCode') { v.codeLine = 'Type your code first.'; v.focusCode = true; }
        break;
      case 'redeeming':
        v.action = 'Redeeming'; v.actionOff = true; v.codeLocked = true; v.busy = true; break;
      case 'granted':
      case 'already':
        v.step = 'done'; v.codeLocked = true; v.renewing = !!s.renewing;
        v.doneLine = messageFor(s.name, s.until, timeZone).text; break;
      case 'rejected':
        if (CODE_REASONS[s.reason]) { v.codeLine = MESSAGES[s.reason]; v.focusCode = true; }
        else { v.line = messageFor(s.reason).text; v.actionOff = s.reason === 'rate_limited'; }
        break;
      case 'failed':
        v.line = GENERIC_FAILURE; v.action = 'Try again'; break;
      default:
        v.step = 'resolving'; v.busy = true;
    }
    return v;
  }

  /* ?stub=<name> on localhost only: a state with canned data, so every state can be opened and looked at.
     Anywhere else, or for a name not listed, null. */
  var STUB = { email: 'sam@example.com', until: '2027-02-24T12:00:00Z', code: 'OHMIE-7KQ3WX9PRM' };
  var STUBS = {
    resolving: { name: 'resolving' },
    signedOut: { name: 'signedOut' },
    signedOutSignIn: { name: 'signedOut', mode: 'signin' },
    awayAtProvider: { name: 'awayAtProvider' },
    existingAccount: { name: 'signedOut', mode: 'signin', authLine: EXISTING_ACCOUNT },
    authError: { name: 'signedOut', authLine: AUTH_FAILED },
    signInAgain: { name: 'signedOut', authLine: SIGN_IN_AGAIN },
    awaitingEmailConfirm: { name: 'awaitingEmailConfirm' },
    signedIn: { name: 'signedIn' },
    needCode: { name: 'signedIn', reason: 'needCode' },
    redeeming: { name: 'redeeming' },
    granted: { name: 'granted', until: STUB.until },
    grantedRenewing: { name: 'granted', until: STUB.until, renewing: true },
    already: { name: 'already', until: STUB.until },
    invalid: { name: 'rejected', reason: 'invalid' },
    expired: { name: 'rejected', reason: 'expired' },
    used_up: { name: 'rejected', reason: 'used_up' },
    rate_limited: { name: 'rejected', reason: 'rate_limited' },
    failed: { name: 'failed' }
  };
  function stubState(name, hostname) {
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;
    if (!name || !Object.prototype.hasOwnProperty.call(STUBS, name)) return null;
    var s = { email: STUB.email, mode: 'create' };
    var picked = STUBS[name];
    for (var k in picked) s[k] = picked[k];
    return s;
  }


  /* ---------- the machine ---------- */
  var WAITING_FOR_SESSION = { resolving: true, signedOut: true, awayAtProvider: true, awaitingEmailConfirm: true };
  var CAN_REDEEM = { signedIn: true, rejected: true, failed: true };   // the states with a Redeem (or Try again) button
  var TERMINAL = { granted: true, already: true };

  function patch(s, p) {
    var o = {};
    for (var k in s) o[k] = s[k];
    for (var j in p) o[j] = p[j];
    return o;
  }
  function isRateLimited(s) { return s.name === 'rejected' && s.reason === 'rate_limited'; }

  /* What the redeem-code function's answer does: the fields of the next state. */
  function outcomeOf(status, body) {
    if (status === 401) return { name: 'signedOut', reason: '', email: '', busy: false, authLine: SIGN_IN_AGAIN };
    if (status === 429) return { name: 'rejected', reason: 'rate_limited' };
    if (!(status >= 200 && status < 300)) return { name: 'failed', reason: '' };
    var result = resultOf(body);
    if (result === 'granted' || result === 'already') {
      return { name: result, reason: '', until: typeof body.granted_until === 'string' ? body.granted_until : '',
               renewing: body.renewing === true };
    }
    if (isRejection(result)) return { name: 'rejected', reason: result };
    return { name: 'failed', reason: '' };   // pending, an unknown result, a body that is not JSON
  }

  /* The one way the state changes. An event that does not apply to the state returns the same object.
     Events: boot {promo, stored, authError}, stub {state}, noClient, session {user}, mode {mode}, code {code},
     authStart {provider: apple | google | email}, authFailed {line}, signUpReturned {data}, signInReturned,
     providerReturnedWithoutSignIn, wrongEmailTap, redeemTap, response {status, body}, networkError, sessionExpired,
     cooldownOver, signOutTap, signedOut. */
  function next(s, e) {
    s = s || { name: 'resolving', mode: 'create', code: '' };
    e = e || {};
    if (e.type === 'boot') {
      return { name: 'resolving', mode: 'create', code: normaliseCode(e.promo) || normaliseCode(e.stored),
               reason: '', email: '', authLine: e.authError ? AUTH_FAILED : '', busy: false };
    }
    if (e.type === 'stub') return patch(patch({ code: s.code || STUB.code }, e.state), { stub: true });
    if (TERMINAL[s.name]) return s;   // granted and already are the end: no event leaves them
    switch (e.type) {
      case 'noClient':
        return patch(s, { name: 'failed', reason: '', busy: true });   // no sign-in library: every button stays off
      case 'session':
        if (e.user) {
          if (WAITING_FOR_SESSION[s.name]) {
            return patch(s, { name: 'signedIn', reason: '', email: e.user.email || '', authLine: '', busy: false });
          }
          return patch(s, { email: e.user.email || '' });
        }
        if (s.name === 'signedOut' || s.name === 'awayAtProvider' || s.name === 'awaitingEmailConfirm') return s;
        return patch(s, { name: 'signedOut', reason: '', email: '', busy: false });   // keeps authLine and code
      case 'mode':
        if (s.name !== 'signedOut' || s.busy) return s;
        return patch(s, { mode: e.mode === 'signin' ? 'signin' : 'create', authLine: '' });
      case 'code': {
        if (s.name === 'redeeming') return s;
        var p = { code: normaliseCode(e.code) };
        // Editing the code clears the line about the last try. Too many tries stays until cooldownOver.
        var clears = (s.name === 'rejected' && !isRateLimited(s)) || (s.name === 'failed' && !s.busy) ||
                     (s.name === 'signedIn' && s.reason === 'needCode');
        if (clears) { p.name = 'signedIn'; p.reason = ''; }
        return p.code === s.code && !clears ? s : patch(s, p);
      }
      case 'authStart':
        if (s.name !== 'signedOut' || s.busy) return s;
        if (e.provider === 'email') return patch(s, { busy: true, authLine: '' });
        return patch(s, { name: 'awayAtProvider', busy: true, authLine: '' });
      case 'authFailed':
        if (s.name !== 'signedOut' && s.name !== 'awayAtProvider') return s;
        return patch(s, { name: 'signedOut', busy: false, authLine: String(e.line || AUTH_FAILED) });
      case 'signUpReturned':
        if (s.name !== 'signedOut') return s;   // a session already moved it on
        if (isExistingEmailSignUp(e.data)) return patch(s, { busy: false, mode: 'signin', authLine: EXISTING_ACCOUNT });
        if (!(e.data && e.data.session)) return patch(s, { name: 'awaitingEmailConfirm', busy: false, authLine: '' });
        return patch(s, { busy: false });   // with a session, the session event moves to signedIn
      case 'signInReturned':
        if (s.name !== 'signedOut') return s;
        return patch(s, { busy: false });
      case 'providerReturnedWithoutSignIn':   // Back from Apple or Google without signing in: they cancelled, no line
        if (s.name !== 'awayAtProvider') return s;
        return patch(s, { name: 'signedOut', busy: false, authLine: '' });
      case 'wrongEmailTap':   // "Wrong email? Go back": the sign-up form again, the code kept
        if (s.name !== 'awaitingEmailConfirm') return s;
        return patch(s, { name: 'signedOut', mode: 'create', busy: false, authLine: '' });
      case 'redeemTap':
        if (!CAN_REDEEM[s.name] || s.busy || isRateLimited(s)) return s;
        if (!s.code) return patch(s, { name: 'signedIn', reason: 'needCode' });
        return patch(s, { name: 'redeeming', reason: '' });
      case 'response':
        if (s.name !== 'redeeming') return s;
        return patch(s, outcomeOf(e.status, e.body));
      case 'networkError':
        if (s.name !== 'redeeming') return s;
        return patch(s, { name: 'failed', reason: '' });   // a timeout too; retry is safe, the server is idempotent
      case 'sessionExpired':
        if (s.name !== 'redeeming') return s;
        return patch(s, outcomeOf(401));
      case 'cooldownOver':
        return isRateLimited(s) ? patch(s, { name: 'signedIn', reason: '' }) : s;
      case 'signOutTap':
        if (!CAN_REDEEM[s.name] || s.busy) return s;
        return patch(s, { busy: true });
      case 'signedOut':
        return patch(s, { name: 'signedOut', reason: '', email: '', busy: false, authLine: '' });   // the code stays
      default:
        return s;
    }
  }

  return {
    APP_STORE: APP_STORE,
    GENERIC_FAILURE: GENERIC_FAILURE,
    AUTH_URL_PARAMS: AUTH_URL_PARAMS,
    REDEEM_TIMEOUT_MS: REDEEM_TIMEOUT_MS,
    RATE_COOLDOWN_MS: RATE_COOLDOWN_MS,
    CODE_TTL_MS: CODE_TTL_MS,
    normaliseCode: normaliseCode,
    promoFromSearch: promoFromSearch,
    urlWithout: urlWithout,
    returnUrl: returnUrl,
    encodeStoredCode: encodeStoredCode,
    decodeStoredCode: decodeStoredCode,
    parseBody: parseBody,
    isExistingEmailSignUp: isExistingEmailSignUp,
    outcomeOf: outcomeOf,
    next: next,
    authErrorInUrl: authErrorInUrl,
    formatDate: formatDate,
    resultOf: resultOf,
    messageFor: messageFor,
    isRejection: isRejection,
    authErrorMessage: authErrorMessage,
    viewOf: viewOf,
    stubState: stubState,
    STUB_NAMES: Object.keys(STUBS)
  };
})();

/* ---------- 2. the page ---------- */
if (typeof window !== 'undefined' && typeof document !== 'undefined') (function () {
  'use strict';

  var R = OhmieRedeem;
  var SUPABASE_URL = 'https://jhgafhzojobqbiubqhef.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_bBIoQMmJAgk1JX54vbxvgg_fOTtuJQ0';   // the publishable key: public by design
  var FUNCTION_URL = SUPABASE_URL + '/functions/v1/redeem-code';
  var CODE_KEY = 'ohmie.redeem.code';

  var $ = function (id) { return document.getElementById(id); };
  var card = document.querySelector('.redeem-card');
  var steps = document.querySelectorAll('.redeem-step');
  var codeInput = $('code');
  var modeButtons = [$('modeCreate'), $('modeSignIn')];
  var authSubmit = $('authSubmit');
  var password = $('password');
  var redeemButton = $('redeem');
  var client = null;   // stays null in a stub: every handler that would reach the network stops there
  var noop = function () {};

  /* The code kept across sign-in round trips: localStorage, for a day. */
  function saveCode(code) {
    try {
      if (code) localStorage.setItem(CODE_KEY, R.encodeStoredCode(code, Date.now()));
      else localStorage.removeItem(CODE_KEY);
    } catch (e) { /* storage off: the ?promo= in the return link still carries it */ }
  }
  function loadCode() {
    try {
      var code = R.decodeStoredCode(localStorage.getItem(CODE_KEY), Date.now(), R.CODE_TTL_MS);
      if (!code) localStorage.removeItem(CODE_KEY);
      return code;
    } catch (e) { return ''; }
  }

  /* ---- the one state, changed only by dispatch(event) through R.next ---- */
  var state = { name: 'resolving', mode: 'create', code: loadCode() };
  var cooldown = null;

  function dispatch(event) {
    var prev = state;
    state = R.next(prev, event);
    if (state === prev) return false;
    render(state);
    if (!state.stub) {
      // Storage follows the state: kept while the code is in play, cleared once it is on the account.
      if (state.name === 'granted' || state.name === 'already') saveCode('');
      else if (state.code !== prev.code) saveCode(state.code);
      // Too many tries: the button comes back after a minute (the server still counts).
      if (state.name === 'rejected' && state.reason === 'rate_limited' &&
          !(prev.name === 'rejected' && prev.reason === 'rate_limited')) {
        clearTimeout(cooldown);
        cooldown = setTimeout(function () { dispatch({ type: 'cooldownOver' }); }, R.RATE_COOLDOWN_MS);
      }
    }
    return true;
  }

  /* Puts viewOf(state) on the page. Nothing else shows or hides a block. */
  function render(s) {
    var v = R.viewOf(s);
    card.setAttribute('data-state', s.name);
    card.setAttribute('aria-busy', v.busy ? 'true' : 'false');
    steps.forEach(function (el) { el.hidden = el.getAttribute('data-step') !== v.step; });
    $('sub').hidden = !v.showSub;

    // The field is written only when it says something else, so typing is never interrupted.
    if (v.codeLocked || R.normaliseCode(codeInput.value) !== v.code) codeInput.value = v.code;
    codeInput.readOnly = v.codeLocked;
    codeInput.setAttribute('aria-invalid', v.codeLine ? 'true' : 'false');
    $('codeLine').textContent = v.codeLine;

    modeButtons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === v.mode ? 'true' : 'false'); });
    authSubmit.textContent = v.mode === 'create' ? 'Create account' : 'Sign in';
    password.setAttribute('autocomplete', v.mode === 'create' ? 'new-password' : 'current-password');
    $('authMsg').textContent = v.authLine;

    $('who').textContent = v.who;
    redeemButton.textContent = v.action;
    $('result').textContent = v.line;

    $('doneLine').textContent = v.doneLine;
    $('renewing').hidden = !v.renewing;
    $('appStore').href = R.APP_STORE;

    // While a request is out every button is off; the action button is also off when its state says so.
    document.querySelectorAll('.redeem-card button').forEach(function (b) { b.disabled = v.busy; });
    if (v.actionOff) redeemButton.disabled = true;
    if (v.focusCode) codeInput.focus();
  }

  codeInput.addEventListener('input', function () { dispatch({ type: 'code', code: codeInput.value }); });

  modeButtons.forEach(function (b) {
    b.addEventListener('click', function () { dispatch({ type: 'mode', mode: b.getAttribute('data-mode') }); });
  });

  /* Apple and Google: the browser leaves for the provider and comes back to /redeem?promo=<code>. */
  function signInWith(provider) {
    if (!client || !dispatch({ type: 'authStart', provider: provider })) return;
    client.auth.signInWithOAuth({ provider: provider, options: { redirectTo: R.returnUrl(state.code, window.location) } })
      .then(function (res) {
        if (res && res.error) dispatch({ type: 'authFailed', line: R.authErrorMessage(res.error) });
        // Otherwise the browser is on its way to the provider.
      }, function () {
        dispatch({ type: 'authFailed', line: R.GENERIC_FAILURE });
      });
  }
  $('apple').addEventListener('click', function () { signInWith('apple'); });
  $('google').addEventListener('click', function () { signInWith('google'); });

  /* Back from the provider without signing in: Safari and Firefox restore the page from the back-forward cache, still
     awayAtProvider with every button off. Unfreeze it, then let a session, if one exists after all, move it on. */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted || state.name !== 'awayAtProvider') return;
    dispatch({ type: 'providerReturnedWithoutSignIn' });
    if (!client) return;
    client.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session) dispatch({ type: 'session', user: session.user || null });
    }, noop);
  });

  $('authForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!client || state.busy) return;
    var email = $('email').value.trim();
    var pass = password.value;
    if (!email || !pass) { dispatch({ type: 'authFailed', line: 'Type your email and a password.' }); return; }
    var creating = state.mode === 'create';
    if (!dispatch({ type: 'authStart', provider: 'email' })) return;
    var call = creating
      ? client.auth.signUp({ email: email, password: pass, options: { emailRedirectTo: R.returnUrl(state.code, window.location) } })
      : client.auth.signInWithPassword({ email: email, password: pass });
    call.then(function (res) {
      if (res.error) { dispatch({ type: 'authFailed', line: R.authErrorMessage(res.error) }); return; }
      dispatch({ type: creating ? 'signUpReturned' : 'signInReturned', data: res.data });
    }, function () {
      dispatch({ type: 'authFailed', line: R.GENERIC_FAILURE });
    });
  });

  /* Wrong email? Back to the sign-up form, with what they typed still in the email field, and the code kept. */
  $('wrongEmail').addEventListener('click', function () {
    if (dispatch({ type: 'wrongEmailTap' })) $('email').focus();
  });

  /* Not you? Signs out this browser only (the app's session stays), and keeps the code. */
  $('signout').addEventListener('click', function () {
    if (!client || !dispatch({ type: 'signOutTap' })) return;
    client.auth.signOut({ scope: 'local' }).then(noop, noop).then(function () { dispatch({ type: 'signedOut' }); });
  });

  /* POST the code with the session. Every way it can end comes back as one event. */
  function sendRedeem(code) {
    var timer = null;
    client.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (!session) { dispatch({ type: 'sessionExpired' }); return; }
      var abort = new AbortController();
      timer = setTimeout(function () { abort.abort(); }, R.REDEEM_TIMEOUT_MS);
      return fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'apikey': SUPABASE_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ code: code }),
        signal: abort.signal
      }).then(function (r) {
        return r.text().then(function (text) {
          clearTimeout(timer);
          dispatch({ type: 'response', status: r.status, body: R.parseBody(text) });
          if (r.status === 401) client.auth.signOut({ scope: 'local' }).then(noop, noop);   // drop the dead session
        });
      });
    }).then(null, function () {
      clearTimeout(timer);
      dispatch({ type: 'networkError' });
    });
  }

  redeemButton.addEventListener('click', function () {
    if (!client || !dispatch({ type: 'redeemTap' })) return;
    if (state.name === 'redeeming') sendRedeem(state.code);
  });

  /* ---- start ---- */
  var loc = window.location;
  var authError = R.authErrorInUrl(loc.search, loc.hash);
  var promo = R.promoFromSearch(loc.search);
  // The code leaves the address bar at once. Supabase's ?code= and error params stay for supabase-js to read.
  if (promo) window.history.replaceState(window.history.state, '', R.urlWithout(loc.pathname, loc.search, loc.hash, ['promo']));
  dispatch({ type: 'boot', promo: promo, stored: state.code, authError: authError });

  var stub = R.stubState(new URLSearchParams(loc.search).get('stub'), loc.hostname);
  if (stub) { dispatch({ type: 'stub', state: stub }); return; }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    dispatch({ type: 'noClient' });
    return;
  }

  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' }
  });

  client.auth.onAuthStateChange(function (event, session) {
    dispatch({ type: 'session', user: (session && session.user) || null });
    if (event === 'INITIAL_SESSION') {
      // The sign-in round trip is over: drop Supabase's ?code= and any error from the address bar.
      var here = loc.pathname + loc.search + loc.hash;
      var clean = R.urlWithout(loc.pathname, loc.search, loc.hash, R.AUTH_URL_PARAMS);
      if (clean !== here) window.history.replaceState(window.history.state, '', clean);
    }
  });
})();
