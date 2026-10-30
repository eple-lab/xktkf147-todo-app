import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listTodos, addTodo, setDone, deleteTodo } from './db.js';

const app = express();
const PORT = process.env.PORT || 4321;
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

app.use(express.json());
app.use(express.static(publicDir));

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
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

app.get('/api/todos', (req, res) => {
  res.json(listTodos({ todayOnly: req.query.filter === 'today' }));
});

app.post('/api/todos', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const dueDate = req.body?.due_date || null;
  if (!title) return res.status(400).json({ error: '할 일 내용을 입력하세요.' });
  if (title.length > 200) return res.status(400).json({ error: '내용은 200자 이내로 입력하세요.' });
  if (dueDate !== null && !(typeof dueDate === 'string' && isValidDate(dueDate))) {
    return res.status(400).json({ error: '마감일은 YYYY-MM-DD 형식이어야 합니다.' });
  }
  res.status(201).json(addTodo(title, dueDate));
});

app.patch('/api/todos/:id', (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  if (typeof req.body?.is_done !== 'boolean') {
    return res.status(400).json({ error: 'is_done은 true/false여야 합니다.' });
  }
  const todo = setDone(id, req.body.is_done);
  if (!todo) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.json(todo);
});

app.delete('/api/todos/:id', (req, res) => {
  const id = parseId(req, res);
  if (id === null) return;
  if (!deleteTodo(id)) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.status(204).end();
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Todo 앱: http://localhost:${PORT}`);
});
