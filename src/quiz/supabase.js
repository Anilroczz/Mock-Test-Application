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
//   topic     text
// );
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
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Upsert a single question by its text content.
 * If an identical question already exists in the bank, reuse its id.
 * Returns the question row.
 */
async function upsertQuestion({ question, options, answer, explanation, topic }) {
  // Try to find an existing question with the same text (deduplicate the bank)
  const { data: existing, error: findErr } = await supabase
    .from("questions")
    .select("id")
    .eq("question", question)
    .maybeSingle();

  if (findErr) throw findErr;

  if (existing) return existing;

  // Insert new question
  const { data: inserted, error: insertErr } = await supabase
    .from("questions")
    .insert({ question, options, answer, explanation: explanation || null, topic: topic || null })
    .select("id")
    .single();

  if (insertErr) throw insertErr;
  return inserted;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a full quiz (parsed from JSON) into the three tables.
 * Returns the newly created quiz row (with id).
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

  // 2. Upsert each question → questions table (deduplicates automatically)
  const questionIds = [];
  for (const q of data.questions) {
    const row = await upsertQuestion({
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      topic: data.topic || null,
    });
    questionIds.push(row.id);
  }

  // 3. Insert join rows → questions_quizzes table
  const joinRows = questionIds.map((question_id, idx) => ({
    quiz_id: quiz.id,
    question_id,
    position: idx + 1,
  }));

  const { error: joinErr } = await supabase
    .from("questions_quizzes")
    .insert(joinRows);

  if (joinErr) throw joinErr;

  return quiz;
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
    topic: row.questions.topic
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