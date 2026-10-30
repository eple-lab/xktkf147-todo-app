const form = document.getElementById('add-form');
const titleInput = document.getElementById('title');
const dueInput = document.getElementById('due');
const list = document.getElementById('list');
const emptyMsg = document.getElementById('empty');
const errorBox = document.getElementById('error');
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

async function api(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = '요청에 실패했습니다.';
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
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
  const todos = await api(todayOnly ? '/api/todos?filter=today' : '/api/todos');
  render(todos);
}

async function run(action) {
  try {
    showError('');
    await action();
    await load();
  } catch (e) {
    showError(e.message);
  }
}

function setFilter(today) {
  todayOnly = today;
  btnToday.classList.toggle('active', today);
  btnAll.classList.toggle('active', !today);
  run(() => Promise.resolve());
}

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

run(() => Promise.resolve());
