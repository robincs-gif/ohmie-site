// The redeem page's pure functions (redeem.js block 1). Run: node --test tests/redeem.test.mjs
// Loads redeem.js the way a browser would, as a plain script, in a context with no window, so block 2 stays off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../redeem.js', import.meta.url), 'utf8');
const sandbox = { URLSearchParams };
vm.runInNewContext(source, sandbox, { filename: 'redeem.js' });
const R = sandbox.OhmieRedeem;

test('normaliseCode trims, uppercases and drops every space', () => {
  assert.equal(R.normaliseCode('  ohmie-ab12cd34ef  '), 'OHMIE-AB12CD34EF');
  assert.equal(R.normaliseCode('ohmie - ab12 cd34\tef\n'), 'OHMIE-AB12CD34EF');
  assert.equal(R.normaliseCode(''), '');
  assert.equal(R.normaliseCode(null), '');
  assert.equal(R.normaliseCode(undefined), '');
});

test('promoFromSearch reads ?promo= and normalises it', () => {
  assert.equal(R.promoFromSearch('?promo=ohmie-ab12cd34ef'), 'OHMIE-AB12CD34EF');
  assert.equal(R.promoFromSearch('?src=email&promo=%20ohmie-xy%2099%20'), 'OHMIE-XY99');
  assert.equal(R.promoFromSearch('?promo=OHMIE+AB12'), 'OHMIEAB12');   // a + in a query is a space
  assert.equal(R.promoFromSearch(''), '');
  assert.equal(R.promoFromSearch('?promo='), '');
});

test('promoFromSearch never reads Supabase\'s ?code=', () => {
  assert.equal(R.promoFromSearch('?code=0b8f3a52-6c1e-4d2a-9f7b-3e5d1c2a4b6f'), '');
  assert.equal(R.promoFromSearch('?code=OHMIE-AB12CD34EF'), '');
  assert.equal(R.promoFromSearch('?promo=OHMIE-AB12&code=0b8f3a52-6c1e-4d2a-9f7b-3e5d1c2a4b6f'), 'OHMIE-AB12');
});

test('urlWithout strips the promo at boot and leaves PKCE params for supabase-js', () => {
  const uuid = '0b8f3a52-6c1e-4d2a-9f7b-3e5d1c2a4b6f';
  assert.equal(R.urlWithout('/redeem', '?promo=OHMIE-AB12', '', ['promo']), '/redeem');
  assert.equal(R.urlWithout('/redeem', `?promo=OHMIE-AB12&code=${uuid}`, '', ['promo']), `/redeem?code=${uuid}`);
  assert.equal(R.urlWithout('/redeem', '?stub=granted&promo=X', '#top', ['promo']), '/redeem?stub=granted#top');
  assert.equal(R.urlWithout('/redeem', '', '', ['promo']), '/redeem');
});

test('urlWithout drops Supabase\'s code and error params after the session resolves', () => {
  const P = R.AUTH_URL_PARAMS;
  assert.equal(R.urlWithout('/redeem', '?code=0b8f3a52-6c1e-4d2a-9f7b-3e5d1c2a4b6f', '', P), '/redeem');
  assert.equal(R.urlWithout('/redeem', '?error=access_denied&error_code=x&error_description=y', '', P), '/redeem');
  assert.equal(R.urlWithout('/redeem', '', '#error=server_error&error_code=otp_expired&error_description=z', P), '/redeem');
  assert.equal(R.urlWithout('/redeem', '?stub=x', '#top', P), '/redeem?stub=x#top');
});

test('returnUrl carries the code back: ohmie.io/redeem, or this page on localhost', () => {
  const prod = { hostname: 'ohmie.io', origin: 'https://ohmie.io', pathname: '/redeem' };
  const local = { hostname: 'localhost', origin: 'http://localhost:8765', pathname: '/redeem.html' };
  assert.equal(R.returnUrl('ohmie-ab12', prod), 'https://ohmie.io/redeem?promo=OHMIE-AB12');
  assert.equal(R.returnUrl('', prod), 'https://ohmie.io/redeem');
  assert.equal(R.returnUrl('OHMIE-AB12', { hostname: 'evil.example', origin: 'https://evil.example', pathname: '/x' }),
    'https://ohmie.io/redeem?promo=OHMIE-AB12');
  assert.equal(R.returnUrl('OHMIE-AB12', local), 'http://localhost:8765/redeem.html?promo=OHMIE-AB12');
  assert.equal(R.returnUrl('A&B=C', prod), 'https://ohmie.io/redeem?promo=A%26B%3DC');
});

test('stored code: kept for a day, then gone', () => {
  const t0 = Date.UTC(2026, 10, 24, 12);
  const day = R.CODE_TTL_MS;
  assert.equal(day, 24 * 60 * 60 * 1000);
  const rec = R.encodeStoredCode(' ohmie-ab12 ', t0);
  assert.equal(R.decodeStoredCode(rec, t0, day), 'OHMIE-AB12');
  assert.equal(R.decodeStoredCode(rec, t0 + day, day), 'OHMIE-AB12');
  assert.equal(R.decodeStoredCode(rec, t0 + day + 1, day), '');
  assert.equal(R.decodeStoredCode(rec, t0 - 1, day), '');               // from the future
  assert.equal(R.decodeStoredCode(rec, t0 + day + 1), '');               // default ttl is the day
  assert.equal(R.decodeStoredCode(null, t0, day), '');
  assert.equal(R.decodeStoredCode('OHMIE-AB12', t0, day), '');           // the old bare-string format
  assert.equal(R.decodeStoredCode('{"code":5,"at":1}', t0, day), '');
  assert.equal(R.decodeStoredCode('{"code":"X"}', t0, day), '');
});

test('parseBody and isExistingEmailSignUp', () => {
  assert.deepEqual({ ...R.parseBody('{"result":"granted"}') }, { result: 'granted' });
  assert.equal(R.parseBody('<html>502</html>'), null);
  assert.equal(R.parseBody(''), null);
  assert.equal(R.isExistingEmailSignUp({ user: { id: 'u', identities: [] }, session: null }), true);
  assert.equal(R.isExistingEmailSignUp({ user: { id: 'u', identities: [{ id: 'i' }] }, session: null }), false);
  assert.equal(R.isExistingEmailSignUp({ user: { id: 'u', identities: [] }, session: { access_token: 't' } }), false);
  assert.equal(R.isExistingEmailSignUp({ user: { id: 'u' }, session: null }), false);
  assert.equal(R.isExistingEmailSignUp(null), false);
});

test('authErrorInUrl spots an error in the query or the hash', () => {
  assert.equal(R.authErrorInUrl('?error=access_denied&error_description=x', ''), true);
  assert.equal(R.authErrorInUrl('', '#error=server_error&error_description=Email+link+is+invalid'), true);
  assert.equal(R.authErrorInUrl('?code=OHMIE-AB12', ''), false);
  assert.equal(R.authErrorInUrl('', ''), false);
});

test('formatDate writes a plain US date, or nothing for a bad one', () => {
  assert.equal(R.formatDate('2027-11-24T12:00:00Z', 'UTC'), 'November 24, 2027');
  assert.equal(R.formatDate('2027-01-01T03:00:00Z', 'America/Los_Angeles'), 'December 31, 2026');
  assert.equal(R.formatDate('not a date', 'UTC'), '');
  assert.equal(R.formatDate('', 'UTC'), '');
  assert.equal(R.formatDate(undefined, 'UTC'), '');
});

test('resultOf takes the result field, anything else is a failure', () => {
  assert.equal(R.resultOf({ result: 'granted', granted_until: '2027-11-24T00:00:00Z' }), 'granted');
  assert.equal(R.resultOf({ result: 'used_up' }), 'used_up');
  assert.equal(R.resultOf(null), 'failed');
  assert.equal(R.resultOf({ code: 401, msg: 'Invalid JWT' }), 'failed');
  assert.equal(R.resultOf({ result: 7 }), 'failed');
});

test('messageFor maps every result to its one line', () => {
  assert.deepEqual({ ...R.messageFor('granted', '2027-11-24T12:00:00Z', 'UTC') },
    { ok: true, text: "You're in. Ohmie Pro is on until November 24, 2027." });
  assert.deepEqual({ ...R.messageFor('granted', undefined, 'UTC') }, { ok: true, text: "You're in. Ohmie Pro is on." });
  assert.deepEqual({ ...R.messageFor('already', '2027-11-24T12:00:00Z', 'UTC') },
    { ok: true, text: 'This code is already on your account. Pro is on until November 24, 2027.' });
  assert.deepEqual({ ...R.messageFor('already', undefined, 'UTC') }, { ok: true, text: 'This code is already on your account.' });
  const lines = {
    invalid: "That code didn't work. Check it and try again.",
    expired: 'That code has expired.',
    used_up: 'That code has been used up.',
    rate_limited: 'Too many tries. Wait an hour and try again.',
    anonymous: 'Confirm your email first, then try again.',
    unconfirmed: 'Confirm your email first, then try again.',
    failed: 'Something went wrong on our side. Try again in a minute.',
    pending: 'Something went wrong on our side. Try again in a minute.',
    store_active: 'Something went wrong on our side. Try again in a minute.',   // retired 2026-11-24: time stacks on top
    something_new: 'Something went wrong on our side. Try again in a minute.',
    toString: 'Something went wrong on our side. Try again in a minute.'
  };
  for (const [result, text] of Object.entries(lines)) {
    assert.deepEqual({ ...R.messageFor(result) }, { ok: false, text }, result);
  }
});

test('no line has an exclamation mark', () => {
  for (const r of ['granted', 'already', 'invalid', 'expired', 'used_up', 'rate_limited', 'anonymous', 'unconfirmed', 'failed']) {
    assert.ok(!R.messageFor(r, '2027-11-24T12:00:00Z', 'UTC').text.includes('!'), r);
  }
  for (const name of R.STUB_NAMES) {
    const v = R.viewOf(R.stubState(name, 'localhost'), 'UTC');
    for (const t of [v.codeLine, v.line, v.doneLine, v.authLine]) assert.ok(!t.includes('!'), name);
  }
});

test('isRejection is a result the server gave on purpose, never a failure', () => {
  for (const r of ['invalid', 'expired', 'used_up', 'rate_limited']) assert.equal(R.isRejection(r), true, r);
  for (const r of ['failed', 'granted', 'already', 'store_active', 'pending', 'toString']) assert.equal(R.isRejection(r), false, r);
});

test('viewOf: one step on screen per state, with the plan\'s copy', () => {
  const v = (s) => R.viewOf(s, 'UTC');
  assert.equal(v({ name: 'resolving' }).step, 'resolving');
  assert.equal(v({ name: 'resolving' }).busy, true);
  assert.equal(v({ name: 'signedOut' }).step, 'signedOut');
  assert.equal(v({ name: 'signedOut' }).showSub, true);
  assert.equal(v({ name: 'signedOut', mode: 'signin' }).mode, 'signin');
  assert.equal(v({ name: 'awaitingEmailConfirm' }).step, 'awaitingEmailConfirm');

  const signedIn = v({ name: 'signedIn', email: 'sam@example.com' });
  assert.deepEqual([signedIn.step, signedIn.who, signedIn.action, signedIn.actionOff, signedIn.line, signedIn.showSub],
    ['signedIn', 'sam@example.com', 'Redeem', false, '', false]);
  assert.equal(v({ name: 'signedIn' }).who, 'your account');
  assert.equal(v({ name: 'signedIn', reason: 'needCode' }).codeLine, 'Type your code first.');

  const redeeming = v({ name: 'redeeming' });
  assert.deepEqual([redeeming.action, redeeming.actionOff, redeeming.busy, redeeming.codeLocked], ['Redeeming', true, true, true]);

  const granted = v({ name: 'granted', until: '2027-02-24T12:00:00Z' });
  assert.deepEqual([granted.step, granted.doneLine, granted.renewing, granted.codeLocked],
    ['done', "You're in. Ohmie Pro is on until February 24, 2027.", false, true]);
  assert.equal(v({ name: 'granted', until: '2027-02-24T12:00:00Z', renewing: true }).renewing, true);
  assert.equal(v({ name: 'already', until: '2027-02-24T12:00:00Z' }).doneLine,
    'This code is already on your account. Pro is on until February 24, 2027.');

  for (const [reason, text] of [['invalid', "That code didn't work. Check it and try again."],
    ['expired', 'That code has expired.'], ['used_up', 'That code has been used up.']]) {
    const r = v({ name: 'rejected', reason });
    assert.deepEqual([r.step, r.codeLine, r.focusCode, r.line, r.actionOff], ['signedIn', text, true, '', false], reason);
  }
  const rate = v({ name: 'rejected', reason: 'rate_limited' });
  assert.deepEqual([rate.codeLine, rate.line, rate.actionOff], ['', 'Too many tries. Wait an hour and try again.', true]);

  const failed = v({ name: 'failed' });
  assert.deepEqual([failed.step, failed.line, failed.action, failed.actionOff],
    ['signedIn', 'Something went wrong on our side. Try again in a minute.', 'Try again', false]);

  const away = v({ name: 'awayAtProvider' });
  assert.deepEqual([away.step, away.busy, away.showSub], ['signedOut', true, true]);
  assert.equal(v({ name: 'signedIn', code: 'OHMIE-AB12' }).code, 'OHMIE-AB12');

  assert.equal(v({ name: 'nonsense' }).step, 'resolving');
});

test('stubState works on localhost only, for listed names only', () => {
  assert.equal(R.stubState('granted', 'localhost').name, 'granted');
  assert.equal(R.stubState('granted', '127.0.0.1').name, 'granted');
  assert.equal(R.stubState('grantedRenewing', 'localhost').renewing, true);
  assert.equal(R.stubState('signedIn', 'localhost').email, 'sam@example.com');
  assert.equal(R.stubState('used_up', 'localhost').reason, 'used_up');
  assert.equal(R.stubState('granted', 'ohmie.io'), null);
  assert.equal(R.stubState('granted', 'localhost.ohmie.io'), null);
  assert.equal(R.stubState('granted', ''), null);
  assert.equal(R.stubState('toString', 'localhost'), null);
  assert.equal(R.stubState('', 'localhost'), null);
  assert.equal(R.stubState(null, 'localhost'), null);
  for (const name of R.STUB_NAMES) assert.ok(R.stubState(name, 'localhost'), name);
});

test('authErrorMessage gives a plain line for the common sign-in errors', () => {
  assert.equal(R.authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }), "That email and password don't match.");
  assert.equal(R.authErrorMessage({ message: 'Email not confirmed' }), 'Confirm your email first, then try again.');
  assert.equal(R.authErrorMessage({ code: 'user_already_exists' }), 'That email already has an account. Choose "I have an account".');
  assert.equal(R.authErrorMessage({ code: 'weak_password' }), 'That password is too short or too simple. Try a longer one.');
  assert.equal(R.authErrorMessage({ status: 429 }), 'Too many tries. Wait an hour and try again.');
  assert.equal(R.authErrorMessage({ message: 'boom' }), "Sign-in didn't work. Try again.");
  assert.equal(R.authErrorMessage(null), "Sign-in didn't work. Try again.");
});

/* ---------- next(state, event): every row of the plan's Web machine table ---------- */
const plain = (o) => JSON.parse(JSON.stringify(o));
const go = (s, ...events) => events.reduce((acc, e) => R.next(acc, e), s);
const booted = (code = 'OHMIE-AB12') => R.next(undefined, { type: 'boot', promo: code });
const signedIn = (code = 'OHMIE-AB12') => go(booted(code), { type: 'session', user: { email: 'sam@example.com' } });
const redeeming = (code) => go(signedIn(code), { type: 'redeemTap' });
const UNTIL = '2027-02-24T12:00:00Z';

test('next boot: the link\'s code first, then the kept one; a sign-in error in the URL is kept for signedOut', () => {
  assert.deepEqual(plain(R.next(undefined, { type: 'boot', promo: ' ohmie-ab12 ', stored: 'OHMIE-OLD' })),
    { name: 'resolving', mode: 'create', code: 'OHMIE-AB12', reason: '', email: '', authLine: '', busy: false });
  assert.equal(R.next(undefined, { type: 'boot', promo: '', stored: 'OHMIE-OLD' }).code, 'OHMIE-OLD');
  assert.equal(R.next(undefined, { type: 'boot' }).code, '');
  const err = R.next(undefined, { type: 'boot', authError: true });
  assert.equal(err.authLine, "Sign-in didn't work. Try again.");
  const out = R.next(err, { type: 'session', user: null });
  assert.deepEqual([out.name, out.authLine], ['signedOut', "Sign-in didn't work. Try again."]);
});

test('next resolving: no session is signedOut, a user is signedIn', () => {
  const out = R.next(booted(), { type: 'session', user: null });
  assert.deepEqual([out.name, out.code], ['signedOut', 'OHMIE-AB12']);
  const inn = signedIn();
  assert.deepEqual([inn.name, inn.email, inn.code, inn.reason], ['signedIn', 'sam@example.com', 'OHMIE-AB12', '']);
  assert.equal(R.next(booted(), { type: 'session', user: {} }).email, '');
});

test('next signedOut: Apple or Google tap is awayAtProvider (busy, code kept); a provider error comes back with its line', () => {
  const out = go(booted(), { type: 'session', user: null });
  for (const provider of ['apple', 'google']) {
    const away = R.next(out, { type: 'authStart', provider });
    assert.deepEqual([away.name, away.busy, away.code], ['awayAtProvider', true, 'OHMIE-AB12'], provider);
    assert.equal(R.next(away, { type: 'authStart', provider }), away, 'a second tap does nothing');
    const back = R.next(away, { type: 'authFailed', line: 'Provider is not enabled.' });
    assert.deepEqual([back.name, back.busy, back.authLine, back.code], ['signedOut', false, 'Provider is not enabled.', 'OHMIE-AB12']);
    assert.equal(R.next(away, { type: 'authFailed' }).authLine, "Sign-in didn't work. Try again.");
  }
  // The trip ends in a new page load: boot again, with the code from ?promo= or storage.
  assert.equal(R.next(undefined, { type: 'boot', promo: 'OHMIE-AB12' }).name, 'resolving');
});

test('next signedOut: email sign-up without a session waits for the confirm link', () => {
  const out = go(booted(), { type: 'session', user: null });
  const busy = R.next(out, { type: 'authStart', provider: 'email' });
  assert.deepEqual([busy.name, busy.busy], ['signedOut', true]);
  const wait = R.next(busy, { type: 'signUpReturned', data: { user: { id: 'u', identities: [{ id: 'i' }] }, session: null } });
  assert.deepEqual([wait.name, wait.busy, wait.code], ['awaitingEmailConfirm', false, 'OHMIE-AB12']);
  assert.equal(R.next(wait, { type: 'session', user: null }), wait, 'no session yet: still waiting');
  assert.equal(R.next(wait, { type: 'session', user: { email: 'sam@example.com' } }).name, 'signedIn');
});

test('next awayAtProvider: Back without signing in (bfcache restore) is signedOut, code kept, no line', () => {
  const out = go(booted(), { type: 'session', user: null });
  for (const provider of ['apple', 'google']) {
    const away = R.next(out, { type: 'authStart', provider });
    const back = R.next(away, { type: 'providerReturnedWithoutSignIn' });
    assert.deepEqual([back.name, back.busy, back.authLine, back.code], ['signedOut', false, '', 'OHMIE-AB12'], provider);
    assert.equal(R.viewOf(back).busy, false, 'every button on again');
    assert.equal(R.next(back, { type: 'session', user: { email: 'sam@example.com' } }).name, 'signedIn',
      'a session found on restore still moves it on');
  }
  assert.equal(R.next(out, { type: 'providerReturnedWithoutSignIn' }), out, 'only from awayAtProvider');
  const s = signedIn();
  assert.equal(R.next(s, { type: 'providerReturnedWithoutSignIn' }), s);
});

test('next awaitingEmailConfirm: Wrong email? Go back is the sign-up form again, code kept', () => {
  const wait = go(booted(), { type: 'session', user: null }, { type: 'mode', mode: 'create' },
    { type: 'authStart', provider: 'email' },
    { type: 'signUpReturned', data: { user: { id: 'u', identities: [{ id: 'i' }] }, session: null } });
  assert.equal(wait.name, 'awaitingEmailConfirm');
  const back = R.next(wait, { type: 'wrongEmailTap' });
  assert.deepEqual([back.name, back.mode, back.busy, back.authLine, back.code],
    ['signedOut', 'create', false, '', 'OHMIE-AB12']);
  const v = R.viewOf(back);
  assert.deepEqual([v.step, v.mode, v.busy, v.code], ['signedOut', 'create', false, 'OHMIE-AB12']);
  assert.equal(R.next(back, { type: 'wrongEmailTap' }), back, 'only from awaitingEmailConfirm');
  const s = signedIn();
  assert.equal(R.next(s, { type: 'wrongEmailTap' }), s);
});

test('next signedOut: sign-up for an existing email says so and switches to sign in', () => {
  const busy = go(booted(), { type: 'session', user: null }, { type: 'authStart', provider: 'email' });
  const out = R.next(busy, { type: 'signUpReturned', data: { user: { id: 'u', identities: [] }, session: null } });
  assert.deepEqual([out.name, out.mode, out.busy, out.authLine],
    ['signedOut', 'signin', false, 'You already have an account. Sign in instead.']);
});

test('next signedOut: sign-up or sign-in with a session waits for the session event', () => {
  const busy = go(booted(), { type: 'session', user: null }, { type: 'authStart', provider: 'email' });
  const up = R.next(busy, { type: 'signUpReturned', data: { user: { identities: [{}] }, session: { access_token: 't' } } });
  assert.deepEqual([up.name, up.busy], ['signedOut', false]);
  assert.deepEqual([R.next(busy, { type: 'signInReturned' }).name, R.next(busy, { type: 'signInReturned' }).busy], ['signedOut', false]);
  const inn = R.next(busy, { type: 'session', user: { email: 'sam@example.com' } });
  assert.deepEqual([inn.name, inn.busy], ['signedIn', false]);
  assert.equal(R.next(inn, { type: 'signInReturned' }), inn, 'late answer after the session: nothing');
  const failed = R.next(busy, { type: 'authFailed', line: "That email and password don't match." });
  assert.deepEqual([failed.busy, failed.authLine], [false, "That email and password don't match."]);
});

test('next mode: only on signedOut, and it clears the sign-in line', () => {
  const out = go(booted(), { type: 'session', user: null }, { type: 'authFailed', line: 'x' });
  const m = R.next(out, { type: 'mode', mode: 'signin' });
  assert.deepEqual([m.mode, m.authLine], ['signin', '']);
  assert.equal(R.next(m, { type: 'mode', mode: 'nonsense' }).mode, 'create');
  const s = signedIn();
  assert.equal(R.next(s, { type: 'mode', mode: 'signin' }), s);
});

test('next signedIn: Redeem with no code is needCode; editing the code clears it', () => {
  const need = R.next(signedIn(''), { type: 'redeemTap' });
  assert.deepEqual([need.name, need.reason], ['signedIn', 'needCode']);
  const typed = R.next(need, { type: 'code', code: ' ohmie-zz ' });
  assert.deepEqual([typed.name, typed.reason, typed.code], ['signedIn', '', 'OHMIE-ZZ']);
});

test('next signedIn: Redeem with a code is redeeming; the code cannot change while it is out', () => {
  const r = redeeming();
  assert.deepEqual([r.name, r.code], ['redeeming', 'OHMIE-AB12']);
  assert.equal(R.next(r, { type: 'redeemTap' }), r);
  assert.equal(R.next(r, { type: 'code', code: 'OTHER' }), r);
  assert.equal(R.next(r, { type: 'signOutTap' }), r);
});

test('next redeeming: granted and granted+renewing carry the date', () => {
  const g = R.next(redeeming(), { type: 'response', status: 200, body: { result: 'granted', granted_until: UNTIL } });
  assert.deepEqual([g.name, g.until, g.renewing, g.code], ['granted', UNTIL, false, 'OHMIE-AB12']);
  const gr = R.next(redeeming(), { type: 'response', status: 200, body: { result: 'granted', granted_until: UNTIL, renewing: true } });
  assert.deepEqual([gr.name, gr.renewing], ['granted', true]);
  assert.equal(R.viewOf(gr, 'UTC').renewing, true);
  assert.equal(R.next(redeeming(), { type: 'response', status: 200, body: { result: 'granted', renewing: 'yes' } }).renewing, false);
});

test('next redeeming: already shows the date', () => {
  const a = R.next(redeeming(), { type: 'response', status: 200, body: { result: 'already', granted_until: UNTIL } });
  assert.deepEqual([a.name, a.until], ['already', UNTIL]);
  assert.equal(R.viewOf(a, 'UTC').doneLine, 'This code is already on your account. Pro is on until February 24, 2027.');
});

test('next granted and already are terminal', () => {
  for (const result of ['granted', 'already']) {
    const t = R.next(redeeming(), { type: 'response', status: 200, body: { result, granted_until: UNTIL } });
    for (const e of [{ type: 'session', user: null }, { type: 'session', user: { email: 'x' } }, { type: 'code', code: 'X' },
      { type: 'redeemTap' }, { type: 'response', status: 500 }, { type: 'networkError' }, { type: 'signOutTap' },
      { type: 'signedOut' }, { type: 'cooldownOver' }, { type: 'noClient' }]) {
      assert.equal(R.next(t, e), t, `${result} ${e.type}`);
    }
  }
});

test('next redeeming: invalid, expired, used_up are rejected with the line under the code', () => {
  for (const reason of ['invalid', 'expired', 'used_up']) {
    const r = R.next(redeeming(), { type: 'response', status: 200, body: { result: reason } });
    assert.deepEqual([r.name, r.reason, r.code], ['rejected', reason, 'OHMIE-AB12'], reason);
    assert.equal(R.viewOf(r).focusCode, true);
    const edited = R.next(r, { type: 'code', code: 'OHMIE-AB13' });
    assert.deepEqual([edited.name, edited.reason, R.viewOf(edited).codeLine], ['signedIn', '', ''], `${reason} edit clears`);
    assert.equal(R.next(r, { type: 'redeemTap' }).name, 'redeeming', `${reason} retry`);
  }
});

test('next redeeming: rate_limited (a result or a 429) turns the button off until cooldownOver', () => {
  for (const e of [{ type: 'response', status: 200, body: { result: 'rate_limited' } }, { type: 'response', status: 429, body: null }]) {
    const r = R.next(redeeming(), e);
    assert.deepEqual([r.name, r.reason], ['rejected', 'rate_limited']);
    assert.equal(R.viewOf(r).actionOff, true);
    assert.equal(R.next(r, { type: 'redeemTap' }), r);
    const edited = R.next(r, { type: 'code', code: 'OHMIE-AB13' });
    assert.deepEqual([edited.name, edited.reason, edited.code], ['rejected', 'rate_limited', 'OHMIE-AB13'], 'editing does not re-enable');
    const back = R.next(edited, { type: 'cooldownOver' });
    assert.deepEqual([back.name, back.reason, R.viewOf(back).actionOff], ['signedIn', '', false]);
  }
  assert.equal(R.next(signedIn(), { type: 'cooldownOver' }).name, 'signedIn');
  assert.equal(R.RATE_COOLDOWN_MS, 60000);
});

test('next redeeming: a 401, or no session at all, is signedOut with the code kept', () => {
  for (const e of [{ type: 'response', status: 401, body: { msg: 'Invalid JWT' } }, { type: 'sessionExpired' }]) {
    const out = R.next(redeeming(), e);
    assert.deepEqual([out.name, out.code, out.email, out.busy, out.authLine],
      ['signedOut', 'OHMIE-AB12', '', false, 'Sign in again to use your code.'], e.type);
    const settled = R.next(out, { type: 'session', user: null });   // the local sign-out that follows
    assert.equal(settled, out);
  }
});

test('next redeeming: network, timeout, 5xx, other 4xx, bad body and pending are failed, and retry is allowed', () => {
  const events = [
    { type: 'networkError' },
    { type: 'response', status: 500, body: { result: 'granted' } },
    { type: 'response', status: 502, body: null },
    { type: 'response', status: 400, body: { result: 'invalid' } },
    { type: 'response', status: 200, body: null },
    { type: 'response', status: 200, body: { result: 'pending' } },
    { type: 'response', status: 200, body: { result: 'store_active' } },
    { type: 'response', status: 200, body: { result: 'something_new' } }
  ];
  for (const e of events) {
    const f = R.next(redeeming(), e);
    assert.deepEqual([f.name, f.code], ['failed', 'OHMIE-AB12'], JSON.stringify(e));
    assert.equal(R.viewOf(f).action, 'Try again');
    assert.equal(R.next(f, { type: 'redeemTap' }).name, 'redeeming');
  }
  const f = R.next(redeeming(), { type: 'networkError' });
  assert.deepEqual([R.next(f, { type: 'code', code: 'OHMIE-AB13' }).name, R.viewOf(R.next(f, { type: 'code', code: 'X' })).line],
    ['signedIn', ''], 'editing the code clears the failure line');
  assert.equal(R.REDEEM_TIMEOUT_MS, 15000);
});

test('next anonymous and unconfirmed are rejections shown under the button', () => {
  for (const reason of ['anonymous', 'unconfirmed']) {
    const r = R.next(redeeming(), { type: 'response', status: 200, body: { result: reason } });
    assert.deepEqual([r.name, r.reason, R.viewOf(r).line], ['rejected', reason, 'Confirm your email first, then try again.']);
  }
});

test('next a late answer after leaving redeeming does nothing', () => {
  const out = R.next(redeeming(), { type: 'session', user: null });
  assert.equal(out.name, 'signedOut');
  for (const e of [{ type: 'response', status: 200, body: { result: 'granted' } }, { type: 'networkError' }, { type: 'sessionExpired' }]) {
    assert.equal(R.next(out, e), out, e.type);
  }
});

test('next Not you?: signOutTap is busy, then signedOut with the code kept', () => {
  for (const from of [signedIn(), R.next(redeeming(), { type: 'networkError' }),
    R.next(redeeming(), { type: 'response', status: 200, body: { result: 'invalid' } }),
    R.next(redeeming(), { type: 'response', status: 429 })]) {
    const busy = R.next(from, { type: 'signOutTap' });
    assert.equal(busy.busy, true, from.name);
    assert.equal(R.next(busy, { type: 'signOutTap' }), busy);
    const out = R.next(busy, { type: 'signedOut' });
    assert.deepEqual([out.name, out.code, out.email, out.busy, out.reason, out.authLine],
      ['signedOut', 'OHMIE-AB12', '', false, '', ''], from.name);
  }
  const out = go(booted(), { type: 'session', user: null });
  assert.equal(R.next(out, { type: 'signOutTap' }), out, 'nothing to sign out of');
});

test('next session: a token refresh keeps the state; a sign-out elsewhere goes to signedOut', () => {
  const r = redeeming();
  const refreshed = R.next(r, { type: 'session', user: { email: 'sam2@example.com' } });
  assert.deepEqual([refreshed.name, refreshed.email], ['redeeming', 'sam2@example.com']);
  const out = R.next(signedIn(), { type: 'session', user: null });
  assert.deepEqual([out.name, out.code], ['signedOut', 'OHMIE-AB12']);
  const away = go(booted(), { type: 'session', user: null }, { type: 'authStart', provider: 'google' });
  assert.equal(R.next(away, { type: 'session', user: null }), away);
});

test('next noClient: failed with every button off', () => {
  const f = R.next(booted(), { type: 'noClient' });
  assert.deepEqual([f.name, f.busy, R.viewOf(f).busy], ['failed', true, true]);
  assert.equal(R.next(f, { type: 'redeemTap' }), f);
  assert.equal(R.next(f, { type: 'code', code: 'X' }).name, 'failed');
});

test('next code edits elsewhere only update the code', () => {
  const out = go(booted(), { type: 'session', user: null });
  const e = R.next(out, { type: 'code', code: 'ohmie-new' });
  assert.deepEqual([e.name, e.code], ['signedOut', 'OHMIE-NEW']);
  assert.equal(R.next(e, { type: 'code', code: 'OHMIE-NEW ' }), e, 'same code: same state');
  assert.equal(R.next(e, { type: 'nonsense' }), e);
});

test('next stub: every stub goes through the reducer, with a demo code unless one is set', () => {
  for (const name of R.STUB_NAMES) {
    const st = R.next(booted(''), { type: 'stub', state: R.stubState(name, 'localhost') });
    assert.equal(st.stub, true, name);
    assert.equal(st.code, 'OHMIE-7KQ3WX9PRM', name);
    assert.equal(st.name, R.stubState(name, 'localhost').name, name);
  }
  assert.equal(R.next(booted('OHMIE-MINE'), { type: 'stub', state: R.stubState('granted', 'localhost') }).code, 'OHMIE-MINE');
});
