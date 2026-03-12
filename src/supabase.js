import { createClient } from "@supabase/supabase-js";

// ─── Supabase Client ──────────────────────────────────────────────────────────
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE SCHEMA (run this SQL in your Supabase SQL editor)
// ═══════════════════════════════════════════════════════════════════════════════
//
// -- QUESTIONS TABLE
// create table questions (
//   id          uuid primary key default gen_random_uuid(),
//   question    text not null,
//   options     text[] not null,
//   answer      text not null,
//   explanation text,
//   topic     text,
//   fingerprint text not null,        -- question + answer (identity key)
// );
//
// -- REQUIRED: unique index on fingerprint for deduplication
// -- Two questions are identical if question text + answer both match
// create unique index on questions(fingerprint);
//
// -- QUIZZES TABLE
// create table quizzes (
//   id               uuid primary key default gen_random_uuid(),
//   title            text not null,
//   subject          text,
//   topic            text,
//   duration         integer not null,          -- seconds
//   total_questions  integer not null,
//   positive_marking numeric(4,2) default 1,
//   negative_marking numeric(4,2) default 0,
//   created_on       date default current_date
// );
//
// -- QUESTIONS_QUIZZES (join table – many-to-many)
// create table questions_quizzes (
//   id          uuid primary key default gen_random_uuid(),
//   quiz_id     uuid not null references quizzes(id) on delete cascade,
//   question_id uuid not null references questions(id) on delete cascade,
//   position    integer,              -- display order within the quiz
//   unique(quiz_id, question_id)
// );
//
// -- Indexes for fast lookups
// create index on questions_quizzes(quiz_id);
// create index on questions_quizzes(question_id);
//
// -- Optional: add this index to speed up duplicate-question lookups at scale
// -- create index on questions(question);
//
// ═══════════════════════════════════════════════════════════════════════════════
//
//
// ═══════════════════════════════════════════════════════════════════════════════
// ATTEMPTS SCHEMA — run this SQL in your Supabase SQL editor
// ═══════════════════════════════════════════════════════════════════════════════
//
// -- ATTEMPTS TABLE (one row per test submission)
// create table attempts (
//   id           uuid primary key default gen_random_uuid(),
//   quiz_id      uuid not null references quizzes(id) on delete cascade,
//   user_id      uuid not null references auth.users(id) on delete cascade,
//   score        numeric(8,2) not null,
//   total        integer not null,
//   correct      integer not null default 0,
//   incorrect    integer not null default 0,
//   unanswered   integer not null default 0,
//   time_taken   integer not null,       -- seconds used
//   tab_switches integer not null default 0,
//   submitted_at timestamptz default now()
// );
//
// -- ATTEMPT_ANSWERS TABLE (one row per question per attempt)
// create table attempt_answers (
//   id              uuid primary key default gen_random_uuid(),
//   attempt_id      uuid not null references attempts(id) on delete cascade,
//   question_id     uuid not null references questions(id) on delete cascade,
//   selected_answer text,                -- null = unanswered
//   is_correct      boolean not null,
//   is_flagged      boolean not null default false,
//   position        integer not null     -- question number in the shuffled order
// );
//
// -- Indexes for fast per-user and per-quiz queries
// create index on attempts(user_id);
// create index on attempts(quiz_id);
// create index on attempt_answers(attempt_id);
//
// -- ROW LEVEL SECURITY
// alter table attempts         enable row level security;
// alter table attempt_answers  enable row level security;
//
// -- Users can only read/insert their own attempts
// create policy "users read own attempts"
//   on attempts for select using (user_id = auth.uid());
//
// create policy "users insert own attempts"
//   on attempts for insert with check (user_id = auth.uid());
//
// -- attempt_answers are readable if the parent attempt belongs to the user
// create policy "users read own attempt_answers"
//   on attempt_answers for select
//   using (
//     exists (
//       select 1 from attempts
//       where attempts.id = attempt_answers.attempt_id
//       and attempts.user_id = auth.uid()
//     )
//   );
//
// create policy "users insert own attempt_answers"
//   on attempt_answers for insert
//   with check (
//     exists (
//       select 1 from attempts
//       where attempts.id = attempt_answers.attempt_id
//       and attempts.user_id = auth.uid()
//     )
//   );
//
// -- Admins can read all attempts (for analytics)
// create policy "admin read all attempts"
//   on attempts for select
//   using ((select role from profiles where id = auth.uid()) = 'admin');
//
// ═══════════════════════════════════════════════════════════════════════════════
//
//
// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * A question's identity is: question text + answer.
 * "Which of the following is correct?" with a different answer = different question.
 * "Which of the following is correct?" with the same answer = same question (deduplicated).
 */
function questionFingerprint({ question, answer }) {
  const q = (question || "").trim();
  const a = (answer || "").trim();
  if (!q || !a) throw new Error(`Cannot generate fingerprint — question or answer is empty. question="${q}" answer="${a}"`);
  return `${q}__${a}`;
}

/**
 * Find-or-create a question using question+answer as the identity fingerprint.
 * Stores the fingerprint in a dedicated column for fast lookup.
 * Uses select-first to find an existing row, inserts only if missing.
 * Returns the question id.
 */
async function findOrCreateQuestion({ question, options, answer, explanation, topic }) {
  const fingerprint = questionFingerprint({ question, answer });
  
  // 1. Look for an existing question with the same text
  const { data: existing, error: findErr } = await supabase
    .from("questions")
    .select("id")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing.id;

  // 2. Not found — insert as a new question
  const { data: inserted, error: insertErr } = await supabase
    .from("questions")
    .insert({
      question,
      options,
      answer,
      explanation: explanation || null,
      topic: topic || null,
      fingerprint,                    // store for future lookups
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;
  return inserted.id;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a full quiz into the three tables.
 *
 * Question bank deduplication rules:
 *  - Same question text in DIFFERENT quizzes → shared row in questions table,
 *    each quiz gets its own row in questions_quizzes pointing to the same question_id.
 *    This is the whole point of the bank — reuse without duplication.
 *
 *  - Same question text appearing TWICE in the SAME quiz JSON → only one
 *    questions_quizzes row is created (the duplicate is silently dropped).
 *    A question can only appear once per quiz.
 *
 * Flow:
 *   1. Insert quiz row → quizzes
 *   2. Find-or-create each question → questions
 *   3. Deduplicate collected ids, insert join rows → questions_quizzes
 */
export async function saveQuiz(data) {
  // 1. Insert quiz metadata → quizzes table
  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      title: data.title,
      subject: data.subject || "General",
      topic: data.topic || "General",
      duration: data.duration,
      total_questions: data.totalQuestions,
      positive_marking: data.positiveMarking ?? 1,
      negative_marking: data.negativeMarking ?? 0,
      created_on: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (quizErr) throw quizErr;

  try {

    // ── Step 2: find-or-create every question ───────────────────────────────────
    // For each question text:
    //   • Already in the bank (any quiz) → reuse its existing id
    //   • New question → insert and get new id
    // This means two quizzes CAN share the same question_id — that is correct.
    const questionIds = [];
    for (const q of data.questions) {
      const id = await findOrCreateQuestion({
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        topic: q.topic || data.topic || null,
        fingerprint: q.fingerprint
      });
      questionIds.push(id);
    }

    // ── Step 3: build join rows, skip intra-quiz duplicates ─────────────────────
    // The unique(quiz_id, question_id) constraint means a question can appear
    // at most once per quiz. If the same question text appeared twice in the
    // submitted JSON they would resolve to the same question_id — we keep only
    // the first occurrence (earliest position).
    const seen = new Set();
    const joinRows = [];
    questionIds.forEach((question_id, idx) => {
      if (!seen.has(question_id)) {
        seen.add(question_id);
        joinRows.push({ quiz_id: quiz.id, question_id, position: idx + 1 });
      }
    });

    // ── Step 4: insert join rows ─────────────────────────────────────────────────
    // Plain insert is safe here because:
    //  a) We just created this quiz_id seconds ago — no prior rows can exist for it.
    //  b) We already deduped question_ids above with the Set.
    // So no conflict is possible. If somehow one occurs (retry scenario), the
    // error is descriptive enough to debug.
    const { error: joinErr } = await supabase
      .from("questions_quizzes")
      .insert(joinRows);

    if (joinErr) throw joinErr;

    return quiz;

  } catch (err) {
    // ── Rollback: delete the quiz we just created so retries are clean ────────
    await supabase.from("quizzes").delete().eq("id", quiz.id);
    throw err;
  }

}

/**
 * Fetch all quizzes with their question count.
 * Returns array of quiz metadata rows.
 */
export async function fetchQuizzes() {
  const { data, error } = await supabase
    .from("quizzes")
    .select(`
      id,
      title,
      subject,
      topic,
      duration,
      total_questions,
      positive_marking,
      negative_marking,
      created_on,
      questions_quizzes(count)
    `)
    .order("created_on", { ascending: false });

  if (error) throw error;

  // Normalize: flatten question count
  return data.map(q => ({
    ...q,
    positiveMarking: q.positive_marking,
    negativeMarking: q.negative_marking,
    createdOn: q.created_on,
    totalQuestions: q.total_questions,
  }));
}

/**
 * Fetch a single quiz with all its questions (via join table).
 * Returns a quiz object shaped like the in-memory format.
 */
export async function fetchQuizWithQuestions(quizId) {
  // Fetch quiz metadata
  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .single();

  if (quizErr) throw quizErr;

  // Fetch join rows ordered by position
  const { data: joinRows, error: joinErr } = await supabase
    .from("questions_quizzes")
    .select("position, questions(*)")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });

  if (joinErr) throw joinErr;

  const questions = joinRows.map(row => ({
    id: row.questions.id,
    question: row.questions.question,
    options: row.questions.options,
    answer: row.questions.answer,
    explanation: row.questions.explanation,
    topic: row.questions.topic,
    fingerprint: row.questions.fingerprint
  }));

  return {
    id: quiz.id,
    title: quiz.title,
    subject: quiz.subject,
    topic: quiz.topic,
    duration: quiz.duration,
    totalQuestions: quiz.total_questions,
    positiveMarking: quiz.positive_marking,
    negativeMarking: quiz.negative_marking,
    createdOn: quiz.created_on,
    questions,
  };
}

/**
 * Delete a quiz (cascades to questions_quizzes via FK).
 * Questions themselves are NOT deleted — they remain in the question bank.
 */
export async function deleteQuiz(quizId) {
  const { error } = await supabase
    .from("quizzes")
    .delete()
    .eq("id", quizId);

  if (error) throw error;
}
//
//
// ─── Attempts API ─────────────────────────────────────────────────────────────
//
// 
/**
 * Save a completed attempt with all per-question answers.
 *
 * @param {object} params
 *   quizId      - uuid of the quiz
 *   userId      - uuid of the current user (auth.uid())
 *   questions   - shuffled questions array from the test
 *   answers     - { [positionIndex]: selectedOptionString | null }
 *   flagged     - Set of position indexes the user flagged
 *   score       - calculated score (after +/- marking)
 *   correct     - count of correct answers
 *   incorrect   - count of incorrect answers
 *   unanswered  - count of unanswered questions
 *   timeTaken   - seconds elapsed
 *   tabSwitches - number of tab switches detected
 */

export async function saveAttempt({
  quizId, userId, questions, answers, flagged,
  score, correct, incorrect, unanswered, timeTaken, tabSwitches,
}) {
  // ── Step 1: insert the attempt row ────────────────────────────────────────
  const { data: attempt, error: attemptErr } = await supabase
    .from("attempts")
    .insert({
      quiz_id:      quizId,
      user_id:      userId,
      score,
      total:        questions.length,
      correct,
      incorrect,
      unanswered,
      time_taken:   timeTaken,
      tab_switches: tabSwitches ?? 0,
    })
    .select("id")
    .single();
 
  if (attemptErr) throw attemptErr;
 
  // ── Step 2: batch insert one row per question ─────────────────────────────
  const answerRows = questions.map((q, idx) => ({
    attempt_id:      attempt.id,
    question_id:     q.id,
    selected_answer: answers[idx] ?? null,
    is_correct:      answers[idx] === q.answer,
    is_flagged:      flagged instanceof Set ? flagged.has(idx) : false,
    position:        idx + 1,
  }));
 
  const { error: answersErr } = await supabase
    .from("attempt_answers")
    .insert(answerRows);
 
  if (answersErr) {
    // Rollback the attempt row so retries are clean
    await supabase.from("attempts").delete().eq("id", attempt.id);
    throw answersErr;
  }
 
  return attempt.id;
}
 
/**
 * Fetch all attempts for the current user, joined with quiz title.
 * Returns newest first.
 */
export async function fetchMyAttempts(userId) {
  if (!userId) return [];
 
  const { data, error } = await supabase
    .from("attempts")
    .select(`
      id,
      score,
      total,
      correct,
      incorrect,
      unanswered,
      time_taken,
      tab_switches,
      submitted_at,
      quizzes ( id, title, subject )
    `)
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false });
 
  if (error) throw error;
 
  return data.map(a => ({
    id:          a.id,
    score:       a.score,
    total:       a.total,
    correct:     a.correct,
    incorrect:   a.incorrect,
    unanswered:  a.unanswered,
    timeTaken:   a.time_taken,
    tabSwitches: a.tab_switches,
    submittedAt: a.submitted_at,
    quizId:      a.quizzes?.id,
    quizTitle:   a.quizzes?.title,
    quizSubject: a.quizzes?.subject,
    pct:         Math.round((a.score / a.total) * 100),
    passed:      Math.round((a.score / a.total) * 100) >= 60,
  }));
}
 
/**
 * Fetch all attempts across all users for a specific quiz.
 * Admin only — protected by RLS policy.
 */
export async function fetchQuizAttempts(quizId) {
  const { data, error } = await supabase
    .from("attempts")
    .select(`
      id, score, total, correct, incorrect, unanswered,
      time_taken, tab_switches, submitted_at,
      profiles ( email )
    `)
    .eq("quiz_id", quizId)
    .order("submitted_at", { ascending: false });
 
  if (error) throw error;
  return data.map(a => ({
    ...a,
    userEmail:  a.profiles?.email,
    timeTaken:  a.time_taken,
    pct:        Math.round((a.score / a.total) * 100),
    passed:     Math.round((a.score / a.total) * 100) >= 60,
  }));
}