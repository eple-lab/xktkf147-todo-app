import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { anon, clientFor, listTodos, addTodo, setDone, deleteTodo } from './supabase.js';

const app = express();
const PORT = process.env.PORT || 4321;
const HOST = process.env.HOST || '127.0.0.1';
const isProd = process.env.NODE_ENV === 'production';
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(publicDir));

// ---- 로그인 쿠키: 토큰은 HttpOnly 쿠키에만 있고 화면 JS는 볼 수 없다 ----
const ACCESS = 'sb-access';
const REFRESH = 'sb-refresh';

function setSession(res, session) {
  const base = { httpOnly: true, sameSite: 'strict', secure: isProd, path: '/' };
  res.cookie(ACCESS, session.access_token, { ...base, maxAge: session.expires_in * 1000 });
  res.cookie(REFRESH, session.refresh_token, { ...base, maxAge: 30 * 24 * 3600 * 1000 });
}

function clearSession(res) {
  res.clearCookie(ACCESS, { path: '/' });
  res.clearCookie(REFRESH, { path: '/' });
}

// 토큰을 검증하고, 만료됐으면 refresh 토큰으로 갱신한다. 성공하면 req.user, req.db를 채운다.
async function requireUser(req, res, next) {
  let token = req.cookies[ACCESS];
  let user = null;

  if (token) {
    const { data, error } = await anon.auth.getUser(token);
    if (!error) user = data.user;
  }
  if (!user && req.cookies[REFRESH]) {
    const { data, error } = await anon.auth.refreshSession({ refresh_token: req.cookies[REFRESH] });
    if (!error && data.session) {
      setSession(res, data.session);
      token = data.session.access_token;
      user = data.user;
    }
  }
  if (!user) {
    clearSession(res);
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  req.user = user;
  req.db = clientFor(token);
  next();
}

// ---- 인증 API ----
function readCredentials(req, res) {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
    return null;
  }
  return { email: email.trim(), password };
}

app.post('/api/auth/signup', async (req, res) => {
  const cred = readCredentials(req, res);
  if (!cred) return;
  const { data, error } = await anon.auth.signUp(cred);
  if (error) return res.status(400).json({ error: `가입할 수 없습니다: ${error.message}` });
  if (!data.session) {
    // Supabase에서 "이메일 확인"이 켜져 있으면 세션 없이 확인 메일만 발송된다.
    return res.status(202).json({ message: '확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인하세요.' });
  }
  setSession(res, data.session);
  res.status(201).json({ email: data.user.email });
});

app.post('/api/auth/login', async (req, res) => {
  const cred = readCredentials(req, res);
  if (!cred) return;
  const { data, error } = await anon.auth.signInWithPassword(cred);
  if (error || !data.session) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }
  setSession(res, data.session);
  res.json({ email: data.user.email });
});

app.post('/api/auth/logout', (req, res) => {
  clearSession(res);
  res.status(204).end();
});

app.get('/api/auth/me', requireUser, (req, res) => {
  res.json({ email: req.user.email });
});

// ---- 할 일 API (로그인 필수, RLS가 자기 행만 허용) ----
function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: '잘못된 id입니다.' });
    return null;
  }
  return id;
}

app.get('/api/todos', requireUser, async (req, res) => {
  let today;
  if (req.query.filter === 'today') {
    // 서버(UTC)와 내 시간대가 다르므로 브라우저의 로컬 오늘 날짜를 받는다.
    if (!isValidDate(req.query.date)) {
      return res.status(400).json({ error: 'date는 YYYY-MM-DD 형식이어야 합니다.' });
    }
    today = req.query.date;
  }
  res.json(await listTodos(req.db, { today }));
});

app.post('/api/todos', requireUser, async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const dueDate = req.body?.due_date || null;
  if (!title) return res.status(400).json({ error: '할 일 내용을 입력하세요.' });
  if (title.length > 200) return res.status(400).json({ error: '내용은 200자 이내로 입력하세요.' });
  if (dueDate !== null && !isValidDate(dueDate)) {
    return res.status(400).json({ error: '마감일은 YYYY-MM-DD 형식이어야 합니다.' });
  }
  res.status(201).json(await addTodo(req.db, title, dueDate));
});

app.patch('/api/todos/:id', requireUser, async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  if (typeof req.body?.is_done !== 'boolean') {
    return res.status(400).json({ error: 'is_done은 true/false여야 합니다.' });
  }
  const todo = await setDone(req.db, id, req.body.is_done);
  if (!todo) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.json(todo);
});

app.delete('/api/todos/:id', requireUser, async (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  if (!(await deleteTodo(req.db, id))) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.status(204).end();
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(PORT, HOST, () => {
  console.log(`Todo 앱: http://localhost:${PORT}`);
});
