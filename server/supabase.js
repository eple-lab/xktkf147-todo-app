import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY를 .env에 넣어 주세요.');
  process.exit(1);
}

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

// 로그인 전 요청(회원가입·로그인·토큰 검증)용. Publishable 키만 쓴다.
export const anon = createClient(url, key, { auth: authOptions });

// 로그인한 사용자의 토큰으로 요청하는 클라이언트 → DB가 RLS를 이 사용자 기준으로 적용한다.
export function clientFor(accessToken) {
  return createClient(url, key, {
    auth: authOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

const COLUMNS = 'id, title, is_done, due_date, created_at';

export async function listTodos(db, { today } = {}) {
  let q = db.from('todos').select(COLUMNS);
  if (today) q = q.eq('due_date', today);
  const { data, error } = await q.order('is_done', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  return data;
}

// user_id는 보내지 않는다: DB 기본값(auth.uid())이 로그인한 사용자로 채우고 RLS가 검사한다.
export async function addTodo(db, title, dueDate) {
  const { data, error } = await db
    .from('todos')
    .insert({ title, due_date: dueDate })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

// 남의 행이거나 없는 행이면 RLS 때문에 0행이 갱신되어 null을 돌려준다.
export async function setDone(db, id, isDone) {
  const { data, error } = await db
    .from('todos')
    .update({ is_done: isDone })
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteTodo(db, id) {
  const { data, error } = await db.from('todos').delete().eq('id', id).select('id');
  if (error) throw error;
  return data.length > 0;
}
