import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE SETUP — run this SQL in your Supabase SQL editor
// ═══════════════════════════════════════════════════════════════════════════════
//
// -- 1. PROFILES TABLE (stores role per user)
// create table profiles (
//   id         uuid primary key references auth.users(id) on delete cascade,
//   email      text,
//   role       text not null default 'user',   -- 'admin' | 'user'
//   created_at timestamptz default now()
// );
//
// -- 2. Auto-create profile row on every new signup
// create or replace function handle_new_user()
// returns trigger as $$
// begin
//   insert into public.profiles (id, email, role)
//   values (new.id, new.email, 'user');
//   return new;
// end;
// $$ language plpgsql security definer;
//
// create trigger on_auth_user_created
//   after insert on auth.users
//   for each row execute procedure handle_new_user();
//
// -- 3. Set yourself as admin (run once after you sign up)
// update profiles set role = 'admin' where email = 'your@email.com';
//
// -- 4. ROW LEVEL SECURITY
// alter table profiles enable row level security;
// alter table quizzes  enable row level security;
// alter table questions enable row level security;
// alter table questions_quizzes enable row level security;
//
// -- Profiles: users can only read their own row
// create policy "users read own profile"
//   on profiles for select using (id = auth.uid());
//
// -- Quizzes: anyone authenticated can read
// create policy "authenticated can read quizzes"
//   on quizzes for select using (auth.role() = 'authenticated');
//
// -- Quizzes: only admin can insert/delete
// create policy "admin can insert quizzes"
//   on quizzes for insert
//   with check ((select role from profiles where id = auth.uid()) = 'admin');
//
// create policy "admin can delete quizzes"
//   on quizzes for delete
//   using ((select role from profiles where id = auth.uid()) = 'admin');
//
// -- Questions: anyone authenticated can read
// create policy "authenticated can read questions"
//   on questions for select using (auth.role() = 'authenticated');
//
// -- Questions: only admin can insert
// create policy "admin can insert questions"
//   on questions for insert
//   with check ((select role from profiles where id = auth.uid()) = 'admin');
//
// -- questions_quizzes: anyone authenticated can read
// create policy "authenticated can read questions_quizzes"
//   on questions_quizzes for select using (auth.role() = 'authenticated');
//
// -- questions_quizzes: only admin can insert/delete
// create policy "admin can insert questions_quizzes"
//   on questions_quizzes for insert
//   with check ((select role from profiles where id = auth.uid()) = 'admin');
//
// create policy "admin can delete questions_quizzes"
//   on questions_quizzes for delete
//   using ((select role from profiles where id = auth.uid()) = 'admin');
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Auth API ─────────────────────────────────────────────────────────────────

/**
 * Sign up a new user with email + password.
 * Profile row is auto-created by the DB trigger with role = 'user'.
 */
export async function signUp({ email, password, name }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with email + password.
 */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with Google OAuth.
 * Redirects the browser — no return value needed.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current user session (null if not logged in).
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Fetch the role of the currently logged-in user.
 * Returns 'admin' | 'user' | null
 */
export async function fetchUserRole(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data.role;
}

/**
 * Bootstrap auth state and subscribe to future changes.
 *
 * Problem: supabase.auth.onAuthStateChange does NOT reliably fire on page
 * load/refresh in Supabase JS v2 — it only fires on actual state *changes*
 * (login, logout, token refresh). So on a cold refresh the callback never
 * runs and the app stays stuck on the loading spinner forever.
 *
 * Fix: call getSession() immediately to seed the initial state, then let
 * onAuthStateChange handle all subsequent changes (login, logout, etc).
 *
 * Returns the unsubscribe function.
 */
export function onAuthChange(callback) {
  // 1. Immediately seed with the current session (handles page refresh)
  supabase.auth.getSession().then(({ data }) => {
    callback(data.session ?? null);
  });

  // 2. Then subscribe to future auth state changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      // INITIAL_SESSION fires right after getSession resolves in some versions
      // — skip it to avoid calling the callback twice on load
      if (event === "INITIAL_SESSION") return;
      callback(session ?? null);
    }
  );

  return () => subscription.unsubscribe();
}