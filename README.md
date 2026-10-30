# Todo 앱

Node.js 24 + Express + Supabase(Postgres, Auth, RLS). 할 일 추가/목록/완료/삭제, 마감일, 오늘 할 일만 보기.
로그인한 사용자는 자기 할 일만 볼 수 있다.

과제 제출 내용과 실행 방법은 [제출.md](제출.md)를 본다.

## 구조
- `server/supabase.js` — Supabase 접근. DB 코드는 여기에만 있다.
- `server/index.js` — Express API (`/api/auth/*`, `/api/todos`)
- `public/` — 화면(백엔드 API만 호출)
- `supabase/schema.sql` — 표와 RLS 정책
- 문서: `PRD.md`, `DB-설계.md`, `배포-준비물.md`

로컬 SQLite 버전(길 A)은 `git checkout path-a`.
