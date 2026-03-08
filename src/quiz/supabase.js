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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * True DB upsert on the `question` text column.
 * Requires a unique index on questions(question) — see schema note below.
 * On conflict (same question text), updates options/answer/explanation so
 * the bank stays fresh, and always returns the canonical row id.
 */
async function upsertQuestion({ question, options, answer, explanation, topic }) {
  const { data, error } = await supabase
    .from("questions")
    .upsert(
      { question, options, answer, explanation: explanation || null, topic: topic || null },
      { onConflict: "question", ignoreDuplicates: false }   // update existing row in place
    )
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * A question's identity is: question text + answer.
 * "Which of the following is correct?" with a different answer = different question.
 * "Which of the following is correct?" with the same answer = same question (deduplicated).
 */
function questionFingerprint({ question, answer }) {
  return `${question.trim()}__${answer.trim()}`;
}

/**
 * Find-or-create a question by its text content.
 * Works without any unique index on the questions table.
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
        topic: data.topic || null,
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