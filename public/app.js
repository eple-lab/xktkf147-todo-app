const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnSignup = document.getElementById('btn-signup');
const btnLogout = document.getElementById('btn-logout');
const userBar = document.getElementById('user-bar');
const userEmail = document.getElementById('user-email');

const form = document.getElementById('add-form');
const titleInput = document.getElementById('title');
const dueInput = document.getElementById('due');
const list = document.getElementById('list');
const emptyMsg = document.getElementById('empty');
const errorBox = document.getElementById('error');
const noticeBox = document.getElementById('notice');
const btnAll = document.getElementById('btn-all');
const btnToday = document.getElementById('btn-today');

let todayOnly = false;

function localToday() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function showError(msg) {
  errorBox.textContent = msg || '';
  errorBox.hidden = !msg;
}

function showNotice(msg) {
  noticeBox.textContent = msg || '';
  noticeBox.hidden = !msg;
}

class AuthError extends Error {}

async function api(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401 && url !== '/api/auth/login') throw new AuthError('로그인이 필요합니다.');
  if (!res.ok) {
    let msg = '요청에 실패했습니다.';
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

function showLoggedOut() {
  appView.hidden = true;
  userBar.hidden = true;
  authView.hidden = false;
  list.replaceChildren();
}

function showLoggedIn(email) {
  authView.hidden = true;
  appView.hidden = false;
  userBar.hidden = false;
  userEmail.textContent = email;
}

function render(todos) {
  const today = localToday();
  list.replaceChildren();
  for (const t of todos) {
    const li = document.createElement('li');
    if (t.is_done) li.classList.add('done');

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = !!t.is_done;
    check.setAttribute('aria-label', '완료 표시');
    check.addEventListener('change', () => run(() =>
      api(`/api/todos/${t.id}`, { method: 'PATCH', body: JSON.stringify({ is_done: check.checked }) })
    ));

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = t.title;

    li.append(check, text);

    if (t.due_date) {
      const due = document.createElement('span');
      due.className = 'due';
      if (t.due_date === today) due.classList.add('today');
      else if (t.due_date < today && !t.is_done) due.classList.add('overdue');
      due.textContent = `마감 ${t.due_date}`;
      li.append(due);
    }

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.textContent = '삭제';
    del.addEventListener('click', () => run(() =>
      api(`/api/todos/${t.id}`, { method: 'DELETE' })
    ));
    li.append(del);

    list.append(li);
  }
  emptyMsg.hidden = todos.length > 0;
}

async function load() {
  const url = todayOnly
    ? `/api/todos?filter=today&date=${encodeURIComponent(localToday())}`
    : '/api/todos';
  render(await api(url));
}

async function run(action) {
  try {
    showError('');
    await action();
    await load();
  } catch (e) {
    if (e instanceof AuthError) {
      showLoggedOut();
      showError('로그인이 필요합니다.');
    } else {
      showError(e.message);
    }
  }
}

function setFilter(today) {
  todayOnly = today;
  btnToday.classList.toggle('active', today);
  btnAll.classList.toggle('active', !today);
  run(() => Promise.resolve());
}

function credentials() {
  return JSON.stringify({ email: emailInput.value, password: passwordInput.value });
}

async function enter(email) {
  passwordInput.value = '';
  showLoggedIn(email);
  await run(() => Promise.resolve());
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  showNotice('');
  try {
    const me = await api('/api/auth/login', { method: 'POST', body: credentials() });
    await enter(me.email);
  } catch (err) {
    showError(err.message);
  }
});

btnSignup.addEventListener('click', async () => {
  if (!authForm.reportValidity()) return;
  showError('');
  showNotice('');
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: credentials(),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 201) return await enter(body.email);
    if (res.status === 202) return showNotice(body.message);
    showError(body.error || '가입에 실패했습니다.');
  } catch (err) {
    showError(err.message);
  }
});

btnLogout.addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  showError('');
  showLoggedOut();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const body = { title: titleInput.value, due_date: dueInput.value || null };
  run(async () => {
    await api('/api/todos', { method: 'POST', body: JSON.stringify(body) });
    titleInput.value = '';
    dueInput.value = '';
    titleInput.focus();
  });
});

btnAll.addEventListener('click', () => setFilter(false));
btnToday.addEventListener('click', () => setFilter(true));

(async () => {
  try {
    const me = await api('/api/auth/me');
    showLoggedIn(me.email);
    await run(() => Promise.resolve());
  } catch {
    showLoggedOut();
  }
})();
