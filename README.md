# Todo 앱

로컬에서 도는 Todo 앱. Node.js 24 + Express + SQLite(`node:sqlite`, 별도 빌드 도구 불필요).

## 실행
```
npm install
copy .env.example .env
npm start
```
브라우저에서 http://localhost:4321 을 연다. 데이터는 `todo.db`(자동 생성)에 저장된다.

## 구조
- `server/db.js` — SQLite 접근(파라미터화 쿼리). DB 코드는 여기에만 있다.
- `server/index.js` — Express API (`/api/todos`)
- `public/` — 화면(API만 호출)
- 설계: `PRD.md`, `DB-설계.md`

## PRD 확인 조건 점검 결과
- [x] 할 일을 추가하고 새로고침·앱 재시작 후에도 남는다
- [x] 완료 표시와 삭제가 동작하고, 그 결과도 재시작 후에 남는다
- [x] 마감일이 오늘인 할 일만 걸러 볼 수 있다
