import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.env.DB_PATH || './todo.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL CHECK (length(trim(title)) > 0),
    is_done    INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
    due_date   TEXT    CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
`);

export function listTodos({ todayOnly = false } = {}) {
  if (todayOnly) {
    return db
      .prepare(
        `SELECT id, title, is_done, due_date, created_at FROM todos
         WHERE due_date = date('now', 'localtime')
         ORDER BY is_done ASC, id ASC`
      )
      .all();
  }
  return db
    .prepare(
      `SELECT id, title, is_done, due_date, created_at FROM todos
       ORDER BY is_done ASC, id ASC`
    )
    .all();
}

export function getTodo(id) {
  return db
    .prepare('SELECT id, title, is_done, due_date, created_at FROM todos WHERE id = ?')
    .get(id);
}

export function addTodo(title, dueDate) {
  const result = db
    .prepare('INSERT INTO todos (title, due_date) VALUES (?, ?)')
    .run(title, dueDate);
  return getTodo(Number(result.lastInsertRowid));
}

export function setDone(id, isDone) {
  const result = db
    .prepare('UPDATE todos SET is_done = ? WHERE id = ?')
    .run(isDone ? 1 : 0, id);
  return result.changes > 0 ? getTodo(id) : undefined;
}

export function deleteTodo(id) {
  return db.prepare('DELETE FROM todos WHERE id = ?').run(id).changes > 0;
}
