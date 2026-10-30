# Todo 앱 DB 설계 (SQLite)

PRD.md 기준: 할 일 추가/목록/완료/삭제 + 마감일(선택) + 오늘 할 일만 보기.

## 1. 구조도

표는 1개(`todos`)만 필요하다.

```
┌──────────────────────────────────────┐
│ todos                                │
├──────────────────────────────────────┤
│ PK id          INTEGER               │
│    title       TEXT      NOT NULL    │
│    is_done     INTEGER   NOT NULL  0 │
│    due_date    TEXT      NULL        │  ← 마감일(선택), 'YYYY-MM-DD'
│    created_at  TEXT      NOT NULL    │
└──────────────────────────────────────┘
```

## 2. 열 정의

| 열 이름 | 자료형 | 빈 값 허용 | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | INTEGER (PRIMARY KEY AUTOINCREMENT) | 불가 | 자동 증가 | 할 일 고유 번호 |
| `title` | TEXT | 불가 (NOT NULL) | 없음 | 할 일 내용. 빈 문자열 방지: `CHECK (length(trim(title)) > 0)` |
| `is_done` | INTEGER (0/1) | 불가 (NOT NULL) | `0` | 완료 여부. 0=미완료, 1=완료. SQLite에는 BOOLEAN이 없어 0/1 사용 |
| `due_date` | TEXT (`YYYY-MM-DD`) | **허용 (NULL)** | `NULL` | 마감일. 입력은 선택이므로 NULL이면 마감일 없음 |
| `created_at` | TEXT (`YYYY-MM-DD HH:MM:SS`) | 불가 (NOT NULL) | `CURRENT_TIMESTAMP` | 생성 시각(UTC) |

### 설계 메모
- SQLite에는 날짜 전용 자료형이 없어 `due_date`를 `'YYYY-MM-DD'` 문자열로 저장한다. 이 형식은 문자열 비교·정렬이 날짜 순서와 같고, `date('now')`와 바로 비교할 수 있다.
- 마감일을 시각 없이 날짜만 저장하므로 "오늘인가?" 판정이 단순하다.
- `created_at`은 UTC로 저장된다. 화면에 보일 때만 로컬 시간으로 바꾸면 된다.

## 3. 관계

현재 요구사항에는 표가 `todos` 하나뿐이라 **표 사이의 관계(1:N, N:M)가 없다.**

나중에 확장한다면 이렇게 된다(지금은 만들지 않음).

| 확장 | 관계 | 방법 |
|---|---|---|
| 사용자별 할 일(로그인) | users 1 : N todos | `todos.user_id`(FK) 추가. 로그인은 직접 만들지 않고 검증된 라이브러리 사용(PRD 규칙) |
| 카테고리 1개 지정 | categories 1 : N todos | `todos.category_id`(FK) 추가 |
| 태그 여러 개 | todos N : M tags | 연결 표 `todo_tags(todo_id, tag_id)` 추가 |

## 4. 생성 SQL (참고용 초안)

```sql
CREATE TABLE todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL CHECK (length(trim(title)) > 0),
  is_done    INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  due_date   TEXT    CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 오늘 할 일 조회 속도용 (선택)
CREATE INDEX idx_todos_due_date ON todos(due_date);
```

## 5. '오늘 할 일만 보기' SELECT 예시

```sql
SELECT id, title, is_done, due_date
FROM todos
WHERE due_date = date('now', 'localtime')
ORDER BY is_done ASC, id ASC;
```

- `date('now', 'localtime')`: 내 컴퓨터 시간대 기준 오늘 날짜(`YYYY-MM-DD`). `'localtime'`을 빼면 UTC 기준이라 한국에서는 자정~오전 9시 사이에 날짜가 하루 어긋난다.
- 마감일이 없는 할 일(NULL)은 `=` 비교에서 자동으로 제외된다.
- `ORDER BY is_done, id`: 미완료를 먼저, 그다음 추가한 순서로 보여 준다.
- 앱 코드에서 오늘 날짜를 직접 넘기고 싶다면 `WHERE due_date = ?`로 바꾸고 `YYYY-MM-DD` 값을 바인딩한다.

## 6. 기능별 SQL 대응 (참고)

| 기능 | SQL |
|---|---|
| 추가 | `INSERT INTO todos (title, due_date) VALUES (?, ?);` (마감일 없으면 NULL) |
| 전체 목록 | `SELECT * FROM todos ORDER BY is_done, id;` |
| 완료 표시 | `UPDATE todos SET is_done = 1 WHERE id = ?;` |
| 삭제 | `DELETE FROM todos WHERE id = ?;` |
| 오늘 할 일만 | 5번 SELECT |
