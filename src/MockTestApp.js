import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";
import "./MockTestApp.css";
import { saveQuiz, fetchQuizzes, fetchQuizWithQuestions, deleteQuiz } from "./supabase";
import { saveAttempt, fetchMyAttempts, fetchAttemptsForQuiz, fetchAttemptDetail } from "./supabase";
import { signIn, signInWithGoogle, signUp, signOut, onAuthChange, fetchUserRole } from "./auth";

// Theme Context
const ThemeContext = createContext();
function useTheme() { return useContext(ThemeContext); }

// Auth Context
const AuthContext = createContext();
function useAuth() { return useContext(AuthContext); }

// Color Tokens
const TOKENS = {
  dark: {
    bg: "#0a0f1e", bgCard: "#0d1424", bgDeep: "#060c1a",
    bgHover: "#1e293b",
    border: "#1e293b", borderMid: "#334155",
    text1: "#f1f5f9", text2: "#e2e8f0", text3: "#94a3b8", text4: "#64748b",
    code: "#a5f3fc",
  },
  light: {
    bg: "#f1f5f9", bgCard: "#ffffff", bgDeep: "#e8edf5",
    bgHover: "#e2e8f0",
    border: "#e2e8f0", borderMid: "#cbd5e1",
    text1: "#0f172a", text2: "#1e293b", text3: "#475569", text4: "#64748b",
    code: "#4338ca",
  },
};

// ─── Responsive Hook ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []); 
  return isMobile;
}

// ─── Shuffle Utility ─────────────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle questions, keeping their options and answer tracking intact
function buildShuffledTest(test) {
  const shuffledQuestions = shuffleArray(test.questions);
  return { ...test, questions: shuffledQuestions };
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── JSON Template ───────────────────────────────────────────────────────────
const JSON_TEMPLATE = `{
  "title": "Your Test Title",
  "subject": "Subject Area",
  "topic": "Topic Name",
  "duration": 600,
  "totalQuestions": 1,
  "positiveMarking": 1,
  "negativeMarking": 0.25,
  "questions": [
    {
      "question": "Your question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "explanation": "Explanation of why Option A is correct."
    }
  ]
}`;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Navigation ──────────────────────────────────────────────────────────────
function Nav({ page, setPage, testsCount }) {
  const { t, isDark, toggle } = useTheme();
  const { user, role, handleSignOut } = useAuth();
  const isMobile = useIsMobile();
  const styles = getStyles(t);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
 
  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);
 
  const avatarLetter = user?.email?.[0]?.toUpperCase() || "U";
 
  return (
    <nav style={styles.nav}>
      {/* Brand — hide text on mobile to save space */}
      <div style={{ ...styles.navBrand, cursor: "pointer" }} onClick={() => setPage("dashboard")}>
        <div style={styles.navLogo}>▲</div>
        {/* {!isMobile && <span style={styles.navTitle}>EXAMFORGE</span>} */}
        <span style={styles.navTitle}>EXAMFORGE</span>
      </div>
 
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px", flexShrink: 0 }}>
 
        {/* Dashboard */}
        <button
          onClick={() => setPage("dashboard")}
          style={{ ...styles.navBtn, ...(page === "dashboard" ? styles.navBtnActive : {}), ...(isMobile ? { padding: "8px 10px" } : {}) }}
        >
          {isMobile ? "🏠" : <span>Dashboard <span style={styles.navBadge}>{testsCount}</span></span>}
        </button>
 
        {/* New test — admin only */}
        {role === "admin" && (
          <button
            onClick={() => setPage("create")}
            style={{ ...styles.navBtn, ...(page === "create" ? styles.navBtnActive : {}), ...(isMobile ? { padding: "8px 10px" } : {}) }}
          >
            {isMobile ? "＋" : "+ New Test"}
          </button>
        )}
 
        {/* Theme toggle — icon only on mobile */}
        <button
          onClick={toggle}
          style={{
            background: t.bgHover, border: `1px solid ${t.borderMid}`, borderRadius: "8px",
            padding: isMobile ? "8px 10px" : "6px 14px",
            cursor: "pointer", fontSize: isMobile ? "15px" : "13px",
            color: t.text3, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
          }}
        >
          {isDark ? "☀️" : "🌙"}
          {!isMobile && (isDark ? " Light" : " Dark")}
        </button>
 
        {/* User avatar button — avatar only on mobile */}
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0, zIndex: 200 }}>
          <button
            onClick={() => setShowUserMenu(m => !m)}
            style={{
              background: t.bgHover, border: `1px solid ${t.borderMid}`, borderRadius: "8px",
              padding: isMobile ? "5px 6px" : "5px 8px", cursor: "pointer", color: t.text3, fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            {/* Avatar circle */}
            <span style={{
              width: "28px", height: "28px", borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", color: "white", fontWeight: "700", flexShrink: 0,
            }}>
              {avatarLetter}
            </span>
            {/* Desktop: show ADMIN badge or email */}
            {!isMobile && role === "admin" && (
              <span style={{ fontSize: "10px", background: "#6366f120", color: "#6366f1", border: "1px solid #6366f140", borderRadius: "4px", padding: "2px 6px", fontWeight: "700" }}>ADMIN</span>
            )}
            {!isMobile && role !== "admin" && user?.email && (
              <span style={{ fontSize: "12px", color: t.text3, maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
            )}
          </button>
 
          {/* Dropdown — fixed so it escapes the sticky nav stacking context */}
          {showUserMenu && (
            <div style={{
              position: "fixed", right: "clamp(12px, 4vw, 32px)", top: "64px",
              background: t.bgCard, border: `1px solid ${t.border}`,
              borderRadius: "12px", padding: "8px", minWidth: "200px",
              zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}>
              <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border}`, marginBottom: "6px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: t.text1, marginBottom: "2px" }}>
                  {user?.user_metadata?.full_name || "User"}
                </div>
                <div style={{ fontSize: "11px", color: t.text4, wordBreak: "break-all" }}>{user?.email}</div>
                <div style={{ fontSize: "10px", color: "#6366f1", fontWeight: "700", marginTop: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>{role}</div>
              </div>
              <button
                onClick={() => { setShowUserMenu(false); handleSignOut(); }}
                style={{
                  width: "100%", padding: "9px 12px", background: "transparent",
                  border: "none", color: "#f87171", cursor: "pointer",
                  fontFamily: "inherit", fontSize: "13px", textAlign: "left", borderRadius: "6px",
                }}
              >
                ↪ Sign Out
              </button>
            </div>
          )}
        </div>
 
      </div>
    </nav>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ tests, onStart, onDelete, onViewAttempts, loading, error }) {
  const { t } = useTheme();
  const styles = getStyles(t);
  return (
    <div style={styles.page}>
      <div style={styles.dashHeader}>
        <div>
          <h1 style={styles.dashTitle}>Test Library</h1>
          <p style={styles.dashSub}>
            {loading ? "Loading tests…" : `${tests.length} mock test${tests.length !== 1 ? "s" : ""} available`}
          </p>
        </div>
      </div>
 
      {error && (
        <div style={styles.dbErrorBox}>
          <span style={styles.dbErrorIcon}>⚠</span>
          <div>
            <strong>Database error</strong>
            <p style={styles.dbErrorMsg}>{error}</p>
          </div>
        </div>
      )}
 
      {loading ? (
        <div style={styles.loadingState}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Fetching tests from database…</p>
        </div>
      ) : tests.length === 0 && !error ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📋</div>
          <h2 style={styles.emptyTitle}>No tests yet</h2>
          <p style={styles.emptySub}>Create your first mock test to get started</p>
        </div>
      ) : (
        <div style={styles.cardGrid}>
          {tests.map(test => (
            <TestCard key={test.id} test={test} onStart={onStart} onDelete={onDelete} onViewAttempts={onViewAttempts} />
          ))}
        </div>
      )}
    </div>
  );
}
 
function TestCard({ test, onStart, onDelete, onViewAttempts }) {
  const { t } = useTheme();
  const { user, role } = useAuth();
  const styles = getStyles(t);
  const [hovered, setHovered] = useState(false);
  const [attemptCount, setAttemptCount] = useState(null);  // null=loading
  const [showChoice, setShowChoice] = useState(false);      // choice overlay
 
  useEffect(() => {
    if (!user) return;
    fetchAttemptsForQuiz(user.id, test.id)
      .then(arr => setAttemptCount(arr.length))
      .catch(() => setAttemptCount(0));
  }, [test.id, user]);
 
  const hasAttempts = attemptCount > 0;
 
  function handleCardClick() {
    if (hasAttempts) setShowChoice(true);
    else onStart(test);
  }
 
  return (
    <div style={{ position: "relative" }}>
      {/* Choice overlay — shown when card clicked and attempts exist */}
      {showChoice && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: t.bgCard,
          border: `1px solid ${t.borderMid}`,
          borderRadius: "12px",
          display: "flex", flexDirection: "column",
          padding: "20px", gap: "12px",
        }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: t.text1, marginBottom: "4px" }}>
            {test.title}
          </div>
          <button
            onClick={() => { setShowChoice(false); onStart(test); }}
            style={{ ...styles.startBtn, width: "100%", justifyContent: "center" }}
          >
            Start New Attempt →
          </button>
          <button
            onClick={() => { setShowChoice(false); onViewAttempts(test); }}
            style={{
              width: "100%", padding: "11px", borderRadius: "8px",
              border: `1px solid ${t.borderMid}`, background: t.bgDeep,
              color: t.text2, cursor: "pointer", fontFamily: "inherit",
              fontSize: "13px", fontWeight: "600",
            }}
          >
            View Past Attempts ({attemptCount})
          </button>
          <button
            onClick={() => setShowChoice(false)}
            style={{
              background: "none", border: "none", color: t.text4,
              cursor: "pointer", fontSize: "12px", fontFamily: "inherit",
              padding: "4px",
            }}
          >
            ✕ Cancel
          </button>
        </div>
      )}
 
      {/* Card */}
      <div
        style={{ ...styles.card, ...(hovered && !showChoice ? styles.cardHover : {}), cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleCardClick}
      >
        <div style={styles.cardTop}>
          <span style={styles.cardSubject}>{test.subject}</span>
          {attemptCount > 0 && (
            <span style={{ fontSize: "11px", color: "#4ade80", background: "#4ade8015", border: "1px solid #4ade8030", borderRadius: "4px", padding: "2px 8px", fontWeight: "600" }}>
              {attemptCount} attempt{attemptCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <h2 style={styles.cardTitle}>{test.title}</h2>
        <div style={styles.cardMeta}>
          <span style={styles.metaItem}>⏱ {Math.floor(test.duration / 60)} min</span>
          <span style={styles.metaItem}>❓ {test.totalQuestions || (test.questions?.length ?? 0)} questions</span>
          <span style={styles.metaItem}>📅 {test.createdOn}</span>
        </div>
 
        <div style={{ ...styles.cardActions, pointerEvents: "none" }}>
          <div style={{ ...styles.startBtn, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {hasAttempts ? "Retry / View Attempts" : "Start Test →"}
          </div>
          {role === "admin" && (
            <div style={{ pointerEvents: "auto" }} onClick={e => e.stopPropagation()}>
              <button style={styles.deleteBtn} onClick={() => onDelete(test.id)}>🗑</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
 
 
// ─── Quiz Attempts Page ───────────────────────────────────────────────────────
function QuizAttemptsPage({ quiz, onBack, onViewDetail, onStartTest }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [attempts, setAttempts] = useState(null);   // null = loading
  const [error, setError] = useState("");
 
  useEffect(() => {
    if (!user) return;
    fetchAttemptsForQuiz(user.id, quiz.id)
      .then(setAttempts)
      .catch(e => setError(e.message));
  }, [quiz.id, user]);
 
  const best = attempts?.length
    ? attempts.reduce((b, a) => a.score > b.score ? a : b, attempts[0])
    : null;
 
  return (
    <div>
      {/* Back + header */}
      <button onClick={onBack} style={{ background: "none", border: "none", color: t.text4, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", padding: "0 0 20px", display: "flex", alignItems: "center", gap: "6px" }}>
        ← Back to Dashboard
      </button>
 
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: "600", letterSpacing: "2px", color: "#6366f1", textTransform: "uppercase", marginBottom: "6px" }}>{quiz.subject}</div>
          <h1 style={{ fontSize: isMobile ? "20px" : "26px", fontWeight: "800", color: t.text1, margin: 0, letterSpacing: "-0.5px" }}>{quiz.title}</h1>
          <p style={{ color: t.text4, margin: "6px 0 0", fontSize: "13px", fontFamily: "'IBM Plex Mono', monospace" }}>
            ⏱ {Math.floor(quiz.duration / 60)} min · ❓ {quiz.totalQuestions} questions
          </p>
        </div>
        <button onClick={onStartTest} style={{ padding: "10px 22px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: "8px", color: "white", fontFamily: "inherit", fontSize: "13px", fontWeight: "700", cursor: "pointer", flexShrink: 0 }}>
          + New Attempt
        </button>
      </div>
 
      {/* Best score summary bar */}
      {best && (
        <div style={{ display: "flex", gap: isMobile ? "16px" : "32px", padding: "16px 20px", background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
          {[
            { label: "Total Attempts", value: attempts.length, color: t.text1 },
            { label: "Best Score", value: `${best.pct}%`, color: best.passed ? "#4ade80" : "#f87171" },
            { label: "Best Correct", value: best.correct, color: "#4ade80" },
            { label: "Latest", value: new Date(attempts[0].submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), color: t.text3 },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "10px", color: t.text4, textTransform: "uppercase", letterSpacing: "1px" }}>{s.label}</span>
              <span style={{ fontSize: "18px", fontWeight: "800", color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
 
      {/* Attempts list */}
      {attempts === null && (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px", color: t.text4, fontSize: "13px" }}>
          <span style={{ width: "20px", height: "20px", borderRadius: "50%", border: "2px solid #6366f1", borderTop: "2px solid transparent", animation: "spin 0.8s linear infinite", display: "inline-block", marginRight: "10px" }} />
          Loading attempts…
        </div>
      )}
      {error && <div style={{ color: "#f87171", fontSize: "13px", padding: "20px" }}>Error: {error}</div>}
      {attempts !== null && attempts.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: t.text4 }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
          <p style={{ fontSize: "14px" }}>No attempts yet. Start your first attempt!</p>
        </div>
      )}
 
      {attempts?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {attempts.map(a => {
            const dt = new Date(a.submittedAt);
            const date = dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
            const time = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const passColor = a.passed ? "#4ade80" : "#f87171";
            return (
              <div
                key={a.id}
                onClick={() => onViewDetail(a)}
                style={{
                  background: t.bgCard, border: `1px solid ${t.border}`,
                  borderLeft: `4px solid ${passColor}`, borderRadius: "10px",
                  padding: "14px 18px", display: "flex", alignItems: "center",
                  gap: "16px", cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.borderMid; e.currentTarget.style.transform = "translateX(2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = "none"; }}
              >
                {/* Score pill */}
                <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: a.passed ? "#4ade8012" : "#f8717112", border: `2px solid ${passColor}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: "800", color: passColor, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{a.pct}%</span>
                  <span style={{ fontSize: "8px", color: passColor, textTransform: "uppercase", fontWeight: "700", marginTop: "2px" }}>{a.passed ? "Pass" : "Fail"}</span>
                </div>
 
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: t.text1, marginBottom: "3px" }}>
                    Attempt #{a.attemptNum}
                  </div>
                  <div style={{ fontSize: "12px", color: t.text4, fontFamily: "'IBM Plex Mono', monospace", marginBottom: "5px" }}>
                    {date} · {time}
                  </div>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {[
                      { v: a.correct,              label: "Correct",  c: "#4ade80" },
                      { v: a.incorrect,             label: "Wrong",    c: "#f87171" },
                      { v: a.unanswered,            label: "Skipped",  c: t.text3  },
                      { v: formatTime(a.timeTaken), label: "Time",     c: "#6366f1" },
                    ].map(s => (
                      <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "800", color: s.c, fontFamily: "'IBM Plex Mono', monospace" }}>{s.v}</span>
                        <span style={{ fontSize: "10px", color: t.text4, textTransform: "uppercase" }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
 
                <span style={{ color: t.text4, fontSize: "16px", flexShrink: 0 }}>›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
 
// ─── Attempt Detail Page ──────────────────────────────────────────────────────
function AttemptDetailPage({ attempt, onBack }) {
  const { t } = useTheme();
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");    // all | correct | wrong | unanswered | flagged
  const [expandedIdx, setExpandedIdx] = useState(null);
 
  useEffect(() => {
    fetchAttemptDetail(attempt.id)
      .then(setDetail)
      .catch(e => setError(e.message));
  }, [attempt.id]);
 
  if (error) return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: t.text4, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", padding: "0 0 20px" }}>← Back</button>
      <div style={{ color: "#f87171", fontSize: "13px" }}>Error loading attempt: {error}</div>
    </div>
  );
 
  if (!detail) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "80px", flexDirection: "column", gap: "16px" }}>
      <span style={{ width: "32px", height: "32px", borderRadius: "50%", border: "3px solid #6366f1", borderTop: "3px solid transparent", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
      <span style={{ color: t.text4, fontSize: "13px" }}>Loading attempt…</span>
    </div>
  );
 
  const dt = new Date(detail.submittedAt);
  const dateStr = dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const passColor = detail.passed ? "#4ade80" : "#f87171";
 
  const filterCounts = {
    all:        detail.answers.length,
    correct:    detail.answers.filter(a => a.status === "correct").length,
    wrong:      detail.answers.filter(a => a.status === "wrong").length,
    unanswered: detail.answers.filter(a => a.status === "unanswered").length,
    flagged:    detail.answers.filter(a => a.isFlagged).length,
  };
 
  const filtered = detail.answers.filter(a => {
    if (filter === "all")        return true;
    if (filter === "correct")    return a.status === "correct";
    if (filter === "wrong")      return a.status === "wrong";
    if (filter === "unanswered") return a.status === "unanswered";
    if (filter === "flagged")    return a.isFlagged;
    return true;
  });
 
  return (
    <div>
      {/* Back */}
      <button onClick={onBack} style={{ background: "none", border: "none", color: t.text4, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", padding: "0 0 20px", display: "flex", alignItems: "center", gap: "6px" }}>
        ← Back to Attempts
      </button>
 
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: "600", letterSpacing: "2px", color: "#6366f1", textTransform: "uppercase", marginBottom: "4px" }}>{detail.quizSubject}</div>
        <h1 style={{ fontSize: isMobile ? "18px" : "24px", fontWeight: "800", color: t.text1, margin: "0 0 4px", letterSpacing: "-0.5px" }}>{detail.quizTitle}</h1>
        <div style={{ fontSize: "12px", color: t.text4, fontFamily: "'IBM Plex Mono', monospace" }}>
          {dateStr} · {timeStr} · Attempt #{attempt.attemptNum}
        </div>
      </div>
 
      {/* Score summary */}
      <div style={{ display: "flex", gap: "16px", padding: "16px 20px", background: t.bgCard, border: `1px solid ${t.border}`, borderLeft: `4px solid ${passColor}`, borderRadius: "10px", marginBottom: "28px", alignItems: "center", flexWrap: "wrap" }}>
        {/* Big score */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "64px" }}>
          <span style={{ fontSize: "28px", fontWeight: "800", color: passColor, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{detail.pct}%</span>
          <span style={{ fontSize: "10px", color: passColor, textTransform: "uppercase", fontWeight: "700", marginTop: "3px" }}>{detail.passed ? "Passed" : "Failed"}</span>
        </div>
        <div style={{ width: "1px", background: t.border, alignSelf: "stretch", flexShrink: 0 }} />
        {[
          { label: "Score",     value: `${detail.score}/${detail.total}`, color: passColor },
          { label: "Correct",   value: detail.correct,   color: "#4ade80" },
          { label: "Wrong",     value: detail.incorrect,  color: "#f87171" },
          { label: "Skipped",   value: detail.unanswered, color: t.text3  },
          { label: "Time",      value: formatTime(detail.timeTaken), color: "#6366f1" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ fontSize: "10px", color: t.text4, textTransform: "uppercase", letterSpacing: "0.8px" }}>{s.label}</span>
            <span style={{ fontSize: "16px", fontWeight: "800", color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</span>
          </div>
        ))}
      </div>
 
      {/* Filter bar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        {[
          { key: "all",        label: `All (${filterCounts.all})` },
          { key: "correct",    label: `✓ Correct (${filterCounts.correct})` },
          { key: "wrong",      label: `✗ Wrong (${filterCounts.wrong})` },
          { key: "unanswered", label: `— Skipped (${filterCounts.unanswered})` },
          ...(filterCounts.flagged > 0 ? [{ key: "flagged", label: `🚩 Flagged (${filterCounts.flagged})` }] : []),
        ].map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setExpandedIdx(null); }}
            style={{
              padding: "6px 14px", borderRadius: "20px", fontFamily: "inherit", fontSize: "12px", cursor: "pointer",
              border: filter === f.key ? "1px solid #6366f1" : `1px solid ${t.borderMid}`,
              background: filter === f.key ? "#6366f115" : "transparent",
              color: filter === f.key ? "#6366f1" : t.text3,
              fontWeight: filter === f.key ? "700" : "400",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
 
      {/* Question review list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map((a, i) => {
          const expanded = expandedIdx === i;
          const statusColor = a.status === "correct" ? "#4ade80" : a.status === "wrong" ? "#f87171" : t.text4;
          const statusIcon  = a.status === "correct" ? "✓" : a.status === "wrong" ? "✗" : "—";
 
          return (
            <div key={a.position} style={{ background: t.bgCard, border: `1px solid ${a.status === "correct" ? "#4ade8030" : a.status === "wrong" ? "#f8717130" : t.border}`, borderRadius: "10px", overflow: "hidden" }}>
              {/* Question row — click to expand */}
              <div
                onClick={() => setExpandedIdx(expanded ? null : i)}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", cursor: "pointer" }}
              >
                <span style={{ fontSize: "15px", fontWeight: "800", color: statusColor, width: "20px", flexShrink: 0, textAlign: "center" }}>{statusIcon}</span>
                <span style={{ fontSize: "12px", color: t.text4, width: "32px", flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>Q{a.position}</span>
                {a.isFlagged && <span style={{ fontSize: "11px", flexShrink: 0 }}>🚩</span>}
                <span style={{ flex: 1, fontSize: "13px", color: t.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>{a.question}</span>
                <span style={{ color: t.text4, fontSize: "14px", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
              </div>
 
              {/* Expanded detail */}
              {expanded && (
                <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${t.border}` }}>
                  {/* Options */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                    {a.options.map((opt, oi) => {
                      const isCorrect = opt === a.correctAnswer;
                      const isSelected = opt === a.selectedAnswer;
                      return (
                        <div key={oi} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 14px", borderRadius: "8px",
                          background: isCorrect ? "#4ade8015" : isSelected && !isCorrect ? "#f8717115" : t.bgDeep,
                          border: `1px solid ${isCorrect ? "#4ade8050" : isSelected && !isCorrect ? "#f8717150" : t.border}`,
                        }}>
                          <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: isCorrect ? "#4ade8030" : isSelected && !isCorrect ? "#f8717130" : t.bgHover, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", color: isCorrect ? "#4ade80" : isSelected && !isCorrect ? "#f87171" : t.text4, flexShrink: 0 }}>
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span style={{ flex: 1, fontSize: "13px", color: isCorrect ? "#4ade80" : isSelected && !isCorrect ? "#f87171" : t.text2 }}>{opt}</span>
                          {isCorrect && <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: "700", flexShrink: 0 }}>✓ Correct</span>}
                          {isSelected && !isCorrect && <span style={{ fontSize: "11px", color: "#f87171", fontWeight: "700", flexShrink: 0 }}>✗ Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
 
                  {/* Unanswered notice */}
                  {a.status === "unanswered" && (
                    <div style={{ marginTop: "12px", padding: "10px 14px", background: "#64748b15", border: `1px solid #64748b30`, borderRadius: "8px", fontSize: "12px", color: t.text4 }}>
                      — This question was not attempted
                    </div>
                  )}
 
                  {/* Explanation */}
                  {a.explanation && a.status !== "correct" && (
                    <div style={{ marginTop: "12px", padding: "12px 14px", background: "#6366f110", border: `1px solid #6366f130`, borderRadius: "8px" }}>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>💡 Explanation</div>
                      <div style={{ fontSize: "13px", color: t.text2, lineHeight: 1.6 }}>{a.explanation}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Create Test ─────────────────────────────────────────────────────────────
function CreateTest({ onCreate }) {
  const { t } = useTheme();
  const styles = getStyles(t);
  const [json, setJson] = useState(JSON_TEMPLATE);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [dbLog, setDbLog] = useState([]);          // step-by-step save progress
  const isMobile = useIsMobile();

  async function handleSubmit() {
    setError("");
    setSuccess(false);
    setDbLog([]);

    // ── Validate JSON ──────────────────────────────────────────────────────
    let data;
    try {
      data = JSON.parse(json);
      if (!data.title) throw new Error("Missing 'title' field");
      if (!Array.isArray(data.questions) || data.questions.length === 0)
        throw new Error("'questions' must be a non-empty array");
      if (!data.duration || typeof data.duration !== "number")
        throw new Error("'duration' must be a number (seconds)");
      data.questions.forEach((q, i) => {
        if (!q.question) throw new Error(`Question ${i + 1}: missing 'question'`);
        if (!Array.isArray(q.options) || q.options.length < 2)
          throw new Error(`Question ${i + 1}: 'options' must have at least 2 items`);
        if (!q.answer) throw new Error(`Question ${i + 1}: missing 'answer'`);
        if (!q.options.includes(q.answer))
          throw new Error(`Question ${i + 1}: 'answer' must exactly match one of the options`);
      });

      // Detect truly duplicate questions within this JSON before hitting the DB.
      // Two questions are duplicates only if question + options + answer all match.
      // Same question text with different options (e.g. "Which is correct?") is fine.
      const fingerprints = new Set();
      data.questions.forEach((q, i) => {
        const fp = `${q.question.trim()}__${q.answer.trim()}`;
        if (fingerprints.has(fp)) {
          throw new Error(`Question ${i + 1} is a duplicate of an earlier question in this JSON (same question and answer).`);
        }
        fingerprints.add(fp);
      });

    } catch (e) {
      setError(e.message);
      return;
    }

    // ── Save to Supabase ───────────────────────────────────────────────────
    setSaving(true);
    try {
      setDbLog(["Saving quiz metadata → quizzes table…"]);
      // saveQuiz handles all three table writes atomically in sequence
      setDbLog(prev => [...prev, `Upserting ${data.questions.length} question(s) → questions table…`]);
      setDbLog(prev => [...prev, "Linking questions → questions_quizzes table…"]);

      const savedQuiz = await saveQuiz(data);

      setDbLog(prev => [...prev, `✓ Quiz saved with id: ${savedQuiz.id}`]);

      // Build the full in-memory test object for instant UI update
      const newTest = {
        ...savedQuiz,
        positiveMarking: savedQuiz.positive_marking ?? data.positiveMarking ?? 1,
        negativeMarking: savedQuiz.negative_marking ?? data.negativeMarking ?? 0,
        createdOn: new Date().toISOString().split("T")[0],
        totalQuestions: data.questions.length,
        questions: data.questions,
      };

      onCreate(newTest);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setDbLog([]); }, 4000);
    } catch (e) {
      setError(`Database error: ${e.message}`);
      setDbLog(prev => [...prev, `✗ Failed: ${e.message}`]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={{ ...styles.dashTitle, ...(isMobile ? { fontSize: "22px" } : {}) }}>Create New Test</h1>
      <p style={styles.dashSub}>Paste your test JSON below — follow the template structure</p>

      <div style={{ ...styles.createLayout, ...(isMobile ? styles.createLayoutMobile : {}) }}>
        <div style={styles.editorPanel}>
          <div style={styles.editorHeader}>
            <span style={styles.editorLabel}>JSON Input</span>
            <div style={{ display: "flex", gap: "8px" }}>
              {isMobile && (
                <button style={styles.resetBtn} onClick={() => setShowSchema(s => !s)}>
                  {showSchema ? "Hide Schema" : "View Schema"}
                </button>
              )}
              <button style={styles.resetBtn} onClick={() => setJson(JSON_TEMPLATE)}>Reset</button>
            </div>
          </div>
          {isMobile && showSchema && <SchemaReference />}
          <textarea
            style={{ ...styles.textarea, ...(isMobile ? { minHeight: "320px", fontSize: "12px", padding: "14px" } : {}) }}
            value={json}
            onChange={e => setJson(e.target.value)}
            spellCheck={false}
          />

          {/* DB write progress log */}
          {dbLog.length > 0 && (
            <div style={styles.dbLog}>
              {dbLog.map((line, i) => (
                <div key={i} style={styles.dbLogLine}>
                  <span style={{ color: line.startsWith("✓") ? "#4ade80" : line.startsWith("✗") ? "#f87171" : "#6366f1" }}>
                    {line.startsWith("✓") || line.startsWith("✗") ? "" : "›"}
                  </span>
                  {line}
                </div>
              ))}
            </div>
          )}

          {error && <div style={styles.errorBox}>⚠ {error}</div>}
          {success && <div style={styles.successBox}>✓ Quiz saved to Supabase successfully!</div>}

          <button
            style={{ ...styles.createBtn, ...(isMobile ? { width: "100%" } : {}), ...(saving ? styles.createBtnSaving : {}) }}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Saving to database…" : "Create Test ↗"}
          </button>
        </div>

        {!isMobile && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <SchemaReference />
            {/* <ArchitectureCard /> */}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Schema Reference (shared) ───────────────────────────────────────────────
function SchemaReference() {
  const { t } = useTheme();
  const styles = getStyles(t);
  return (
    <div style={styles.schemaPanel}>
      <h3 style={styles.schemaTitle}>Schema Reference</h3>
      {[
        { field: "title", type: "string", req: true, desc: "Name of the test" },
        { field: "subject", type: "string", req: false, desc: "Subject/category label" },
        { field: "topic", type: "string", req: false, desc: "Topic/category label" },
        { field: "duration", type: "number", req: true, desc: "Time limit in seconds" },
        { field: "totalQuestions", type: "number", req: true, desc: "Total Number of Questions" },
        { field: "questions", type: "array", req: true, desc: "Array of question objects" },
        { field: "questions[].question", type: "string", req: true, desc: "Question text" },
        { field: "questions[].options", type: "string[]", req: true, desc: "Answer choices (min 2)" },
        { field: "questions[].answer", type: "string", req: true, desc: "Correct option (exact match)" },
        { field: "questions[].explanation", type: "string", req: false, desc: "Why this answer is correct" }
      ].map(row => (
        <div key={row.field} style={styles.schemaRow}>
          <div style={styles.schemaField}>
            <code style={styles.fieldCode}>{row.field}</code>
            {row.req && <span style={styles.reqBadge}>required</span>}
          </div>
          <span style={styles.schemaType}>{row.type}</span>
          <span style={styles.schemaDesc}>{row.desc}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Architecture Card ────────────────────────────────────────────────────────
// function ArchitectureCard() {
//  const { t } = useTheme();
// const styles = getStyles(t);
//   return (
//     <div style={{ ...styles.schemaPanel, gap: "10px" }}>
//       <h3 style={styles.schemaTitle}>Question Bank Architecture</h3>
//       {[
//         { table: "quizzes", color: "#6366f1", desc: "Quiz title, subject, duration, marking scheme" },
//         { table: "questions", color: "#4ade80", desc: "Question text, options[], answer, explanation" },
//         { table: "questions_quizzes", color: "#facc15", desc: "Many-to-many join: quiz_id ↔ question_id + position" },
//       ].map(row => (
//         <div key={row.table} style={styles.archRow}>
//           <span style={{ ...styles.archTable, borderColor: row.color, color: row.color }}>{row.table}</span>
//           <span style={styles.schemaDesc}>{row.desc}</span>
//         </div>
//       ))}
//       <p style={{ ...styles.schemaDesc, marginTop: "4px", lineHeight: 1.6 }}>
//         Questions are <strong style={{ color: "#a5f3fc" }}>deduplicated</strong> — identical questions shared across quizzes are stored once and linked via the join table.
//       </p>
//     </div>
//   );
// }

// ─── Test Interface ───────────────────────────────────────────────────────────
function TestInterface({ test, onFinish, onBack, onAttemptSaved, onRetake}) {
  const { t } = useTheme();
  const styles = getStyles(t);
  // Shuffle once on mount, never again
  const shuffledTest = useMemo(() => buildShuffledTest(test), [test]);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(shuffledTest.duration);
  const [submitted, setSubmitted] = useState(false);
  const [fsExited, setFsExited] = useState(false); // gate — only show Results after FS is gone
  const [flagged, setFlagged] = useState(new Set());
  const [showQNav, setShowQNav] = useState(false);
  const isMobile = useIsMobile();

  // ── Anti-cheat state ──────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsWarning, setFsWarning] = useState(false);          // lost fullscreen warning
  const [tabWarnings, setTabWarnings] = useState(0);          // tab-switch counter
  const [showTabAlert, setShowTabAlert] = useState(false);
  const [copyWarning, setCopyWarning] = useState(false);
  const testContainerRef = useRef(null);

  // ── Enter fullscreen on desktop ───────────────────────────────────────────
  useEffect(() => {
    if (isMobile) return;
    const el = document.documentElement;
    const enter = async () => {
      try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        setIsFullscreen(true);
      } catch (_) { /* user denied or not supported */ }
    };
    enter();
    return () => {
      // Always exit fullscreen when TestInterface unmounts (submit or back)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.().catch(() => {});
    };
  }, [isMobile]);

  // ── Detect fullscreen exit ────────────────────────────────────────────────
  useEffect(() => {
    if (isMobile || submitted) return;
    const handleFsChange = () => {
      const inFs = !!document.fullscreenElement;
      setIsFullscreen(inFs);
      if (!inFs) setFsWarning(true);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, [isMobile, submitted]);

  // ── Detect tab switch / window blur ──────────────────────────────────────
  useEffect(() => {
    if (submitted) return;
    const handleBlur = () => {
      setTabWarnings(n => n + 1);
      setShowTabAlert(true);
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [submitted]);

  // ── Block copy / paste / cut / contextmenu ────────────────────────────────
  useEffect(() => {
    if (submitted) return;
    const block = (e) => {
      e.preventDefault();
      setCopyWarning(true);
      setTimeout(() => setCopyWarning(false), 2500);
    };
    const blockCtx = (e) => e.preventDefault();
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("contextmenu", blockCtx);
    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("contextmenu", blockCtx);
    };
  }, [submitted]);

  // ── Block keyboard shortcuts (Ctrl+C, Ctrl+V, PrintScreen, etc.) ─────────
  useEffect(() => {
    if (submitted) return;
    const handleKey = (e) => {
      const blocked = (
        (e.ctrlKey || e.metaKey) && ["c", "v", "x", "u", "s", "p", "a"].includes(e.key.toLowerCase())
      ) || e.key === "PrintScreen";
      if (blocked) {
        e.preventDefault();
        setCopyWarning(true);
        setTimeout(() => setCopyWarning(false), 2500);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [submitted]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.webkitFullscreenElement) {
        await document.webkitExitFullscreen?.();
      }
    } catch (_) {}
    setFsExited(true);
    setSubmitted(true);
  }, []);

  useEffect(() => {
    if (submitted || timeLeft <= 0) {
      if (timeLeft <= 0 && !submitted) handleSubmit(); // handleSubmit is async and awaits fullscreen exit internally
      return;
    }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, submitted, handleSubmit]);

  // ── Re-enter fullscreen handler ───────────────────────────────────────────
  const reEnterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      setFsWarning(false);
    } catch (_) {}
  };

  if (submitted) {
    // Show a brief blank screen while waiting for fullscreen to fully exit
    if (!fsExited && document.fullscreenElement) {
      return <div style={{ minHeight: "100vh", background: "#0a0f1e" }} />;
    }
    return (
      <Results
        test={shuffledTest}
        answers={answers}
        timeTaken={shuffledTest.duration - timeLeft}
        flagged={flagged}
        tabSwitches={tabWarnings}
        onBack={onBack}
        onRetake={onRetake}
        onAttemptSaved={onAttemptSaved}
      />
    );
  }

  const q = shuffledTest.questions[current];
  const totalQ = shuffledTest.questions.length;
  const answered = Object.keys(answers).filter(k => answers[k] !== null).length;
  const pct = Math.round((timeLeft / shuffledTest.duration) * 100);
  const timerDanger = timeLeft < 300;

  return (
    <div
      ref={testContainerRef}
      style={{ ...styles.testWrap}}
    >
      {/* ── Fullscreen warning overlay ── */}
      {fsWarning && !isMobile && (
        <div style={styles.warningOverlay}>
          <div style={styles.warningBox}>
            <div style={styles.warningIcon}>⚠️</div>
            <h2 style={styles.warningTitle}>Fullscreen Required</h2>
            <p style={styles.warningDesc}>
              You exited fullscreen mode. Please return to fullscreen to continue the test.
              This incident has been noted.
            </p>
            <button style={styles.warningBtn} onClick={reEnterFullscreen}>
              Re-enter Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* ── Tab switch alert ── */}
      {showTabAlert && (
        <div style={styles.tabAlertBanner}>
          <span>⚠ Tab switch detected ({tabWarnings} time{tabWarnings !== 1 ? "s" : ""}). This activity is being tracked.</span>
          <button style={styles.tabAlertClose} onClick={() => setShowTabAlert(false)}>✕</button>
        </div>
      )}

      {/* ── Copy/paste blocked notice ── */}
      {copyWarning && (
        <div style={styles.copyBanner}>
          🚫 Copy / Paste is disabled during the test
        </div>
      )}

      {/* Timer Bar */}
      <div style={{ ...styles.timerBar, ...(isMobile ? styles.timerBarMobile : {}) }}>
        <div style={styles.timerLeft}>
          <span style={{ ...styles.testTitleSmall, ...(isMobile ? { display: "none" } : {}) }}>{shuffledTest.title}</span>
          {isMobile && (
            <button style={styles.qNavToggleBtn} onClick={() => setShowQNav(s => !s)}>
              ☰ {answered}/{totalQ}
            </button>
          )}
        </div>
        <div style={{ ...styles.timerDisplay, ...(timerDanger ? styles.timerDanger : {}), ...(isMobile ? styles.timerDisplayMobile : {}) }}>
          <span style={styles.timerIcon}>⏱</span>
          <span style={{ ...styles.timerText, ...(isMobile ? { fontSize: "16px" } : {}) }}>{formatTime(timeLeft)}</span>
        </div>
        <div style={styles.timerRight}>
          {isMobile ? (
            <button style={styles.submitTopBtn} onClick={handleSubmit}>Submit</button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {tabWarnings > 0 && (
                <span style={styles.warningChip}>⚠ {tabWarnings} switch{tabWarnings !== 1 ? "es" : ""}</span>
              )}
              {!isMobile && (
                <span style={{ ...styles.fsIndicator, color: isFullscreen ? "#4ade80" : "#f87171" }}>
                  {isFullscreen ? "⛶ Fullscreen" : "⚠ Not Fullscreen"}
                </span>
              )}
              <span style={styles.timerProgress}>{answered}/{totalQ} answered</span>
            </div>
          )}
        </div>
      </div>

      {/* Timer progress line */}
      <div style={styles.timerTrack}>
        <div style={{
          ...styles.timerFill,
          width: `${pct}%`,
          background: timerDanger ? "#f87171" : "linear-gradient(90deg, #6366f1, #8b5cf6)"
        }} />
      </div>

      {/* Mobile: Q Nav Drawer */}
      {isMobile && showQNav && (
        <div style={styles.mobileQNav}>
          <div style={styles.mobileQNavHeader}>
            <span style={styles.sidebarLabel}>Questions</span>
            <button style={styles.closeDrawerBtn} onClick={() => setShowQNav(false)}>✕</button>
          </div>
          <div style={styles.qGrid}>
            {shuffledTest.questions.map((_, i) => {
              const isAnswered = answers[i] !== undefined && answers[i] !== null;
              const isCurrent = i === current;
              const isFlagged = flagged.has(i);
              return (
                <button
                  key={i}
                  style={{
                    ...styles.qDot,
                    ...(isCurrent ? styles.qDotCurrent : {}),
                    ...(isAnswered && !isCurrent ? styles.qDotAnswered : {}),
                    ...(isFlagged ? styles.qDotFlagged : {})
                  }}
                  onClick={() => { setCurrent(i); setShowQNav(false); }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div style={styles.sidebarLegend}>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#6366f1" }} /> Current</span>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#4ade80" }} /> Answered</span>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#facc15" }} /> Flagged</span>
          </div>
        </div>
      )}

      <div style={{ ...styles.testBody, ...(isMobile ? { flexDirection: "column" } : {}) }}>
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div style={styles.sidebar}>
            <p style={styles.sidebarLabel}>Questions</p>
            <div style={styles.qGrid}>
              {shuffledTest.questions.map((_, i) => {
                const isAnswered = answers[i] !== undefined && answers[i] !== null;
                const isCurrent = i === current;
                const isFlagged = flagged.has(i);
                return (
                  <button
                    key={i}
                    style={{
                      ...styles.qDot,
                      ...(isCurrent ? styles.qDotCurrent : {}),
                      ...(isAnswered && !isCurrent ? styles.qDotAnswered : {}),
                      ...(isFlagged ? styles.qDotFlagged : {})
                    }}
                    onClick={() => setCurrent(i)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div style={styles.sidebarLegend}>
              <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#6366f1" }} /> Current</span>
              <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#4ade80" }} /> Answered</span>
              <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#facc15" }} /> Flagged</span>
            </div>
            <button style={styles.submitSideBtn} onClick={handleSubmit}>
              Submit Test
            </button>
          </div>
        )}

        {/* Question Area */}
        <div style={{ ...styles.questionArea, ...(isMobile ? styles.questionAreaMobile : {}) }}>
          <div style={styles.questionMeta}>
            <span style={styles.questionNum}>Question {current + 1} of {totalQ}</span>
            <button
              style={{ ...styles.flagBtn, ...(flagged.has(current) ? styles.flagBtnActive : {}) }}
              onClick={() => {
                setFlagged(prev => {
                  const n = new Set(prev);
                  n.has(current) ? n.delete(current) : n.add(current);
                  return n;
                });
              }}
            >
              {flagged.has(current) ? "🚩" : "⚐"}
              {!isMobile && (flagged.has(current) ? " Flagged" : " Flag")}
            </button>
          </div>

          <h2 style={{ ...styles.questionText, ...(isMobile ? styles.questionTextMobile : {}) }}>{q.question}</h2>

          <div style={styles.optionsList}>
            {q.options.map((opt, oi) => {
              const selected = answers[current] === opt;
              return (
                <button
                  key={oi}
                  style={{ ...styles.optionBtn, ...(selected ? styles.optionBtnSelected : {}), ...(isMobile ? styles.optionBtnMobile : {}) }}
                  onClick={() => setAnswers(prev => ({ ...prev, [current]: prev[current] === opt ? null : opt }))}
                >
                  <span style={{ ...styles.optionLabel, ...(selected ? styles.optionLabelSelected : {}) }}>
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <span style={{ ...styles.optionText, ...(isMobile ? { fontSize: "14px" } : {}) }}>{opt}</span>
                </button>
              );
            })}
          </div>

          <div style={{ ...styles.navBtns, ...(isMobile ? styles.navBtnsMobile : {}) }}>
            <button
              style={{ ...styles.navTestBtn, ...(current === 0 ? styles.navTestBtnDisabled : {}), ...(isMobile ? { flex: 1 } : {}) }}
              onClick={() => setCurrent(p => Math.max(0, p - 1))}
              disabled={current === 0}
            >
              ← Prev
            </button>

            <button
              style={{
                ...styles.navTestBtnPrimary,
                ...(current === totalQ - 1 ? styles.navTestBtnDisabled : {}),
                ...(isMobile ? { flex: 1 } : {})
              }}
              onClick={() => setCurrent(p => Math.min(totalQ - 1, p + 1))}
              disabled={current === totalQ - 1}
            >
              Next →
            </button>
          </div>

          {/* Mobile Submit */}
          {/* {isMobile && (
            <button style={{ ...styles.submitSideBtn, marginTop: "12px", width: "100%" }} onClick={handleSubmit}>
              Submit Test
            </button>
          )} */}
        </div>
      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────
function Results({ test, answers, timeTaken, flagged, tabSwitches, onBack, onRetake, onAttemptSaved }) {
  const { t } = useTheme();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saving");
  const [filter, setFilter] = useState("all"); // all | correct | wrong | unanswered | flagged
 
  // ── Score calculations ──────────────────────────────────────────────────────
  let nCorrect = 0, nWrong = 0, nUnanswered = 0;
  const score = test.questions.reduce((acc, q, i) => {
    if (!answers[i])            { ++nUnanswered; return acc; }
    if (answers[i] === q.answer){ ++nCorrect;    return acc + test.positiveMarking; }
    ++nWrong;
    return acc - test.negativeMarking;
  }, 0);
 
  const total      = test.questions.length;
  const pct        = Math.round((score / total) * 100);
  const passed     = pct >= 60;
  const attempted  = nCorrect + nWrong;
  const accuracy   = attempted > 0 ? Math.round((nCorrect / attempted) * 100) : 0;
  const avgTime    = attempted > 0 ? Math.round(timeTaken / total) : 0;
  const nFlagged   = flagged instanceof Set ? flagged.size : 0;
  const passColor  = passed ? "#4ade80" : "#f87171";
 
  // ── Save once on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setSaveStatus("error"); return; }
    saveAttempt({
      quizId: test.id, userId: user.id, questions: test.questions,
      answers, flagged: flagged ?? new Set(), score,
      correct: nCorrect, incorrect: nWrong, unanswered: nUnanswered,
      timeTaken, tabSwitches: tabSwitches ?? 0,
    })
      .then(() => { setSaveStatus("saved"); onAttemptSaved?.(); })
      .catch(() => setSaveStatus("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
 
  // ── Filter logic ────────────────────────────────────────────────────────────
  const filteredQuestions = test.questions.map((q, i) => ({ q, i })).filter(({ q, i }) => {
    const userAns = answers[i];
    const isCorrect   = userAns === q.answer;
    const isUnanswered = !userAns;
    const isFlaggedQ  = flagged instanceof Set ? flagged.has(i) : false;
    if (filter === "correct")    return isCorrect;
    if (filter === "wrong")      return !isUnanswered && !isCorrect;
    if (filter === "unanswered") return isUnanswered;
    if (filter === "flagged")    return isFlaggedQ;
    return true;
  });
 
  const filterCounts = {
    all:        total,
    correct:    nCorrect,
    wrong:      nWrong,
    unanswered: nUnanswered,
    flagged:    nFlagged,
  };
 
  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
 
      {/* ── Results Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: t.bgCard, borderBottom: `1px solid ${t.border}`,
        height: "56px", display: "flex", alignItems: "center",
        padding: "0 clamp(12px, 4vw, 32px)", gap: "12px",
      }}>
        {/* Logo + brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <div style={{ width: "30px", height: "30px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "bold", color: "white" }}>▲</div>
          {!isMobile && <span style={{ fontSize: "14px", fontWeight: "700", letterSpacing: "3px", color: t.text1 }}>EXAMFORGE</span>}
        </div>
 
        {/* Divider */}
        <div style={{ width: "1px", height: "28px", background: t.border, flexShrink: 0 }} />
 
        {/* Test name — truncated */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", color: t.text4, textTransform: "uppercase", letterSpacing: "1px", lineHeight: 1 }}>Results</div>
          <div style={{ fontSize: "13px", fontWeight: "700", color: t.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>{test.title}</div>
        </div>
 
        {/* Save status */}
        <div style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {saveStatus === "saving" && <>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", border: "2px solid #6366f1", borderTop: "2px solid transparent", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
            {!isMobile && <span style={{ color: t.text4 }}>Saving…</span>}
          </>}
          {saveStatus === "saved"  && <span style={{ color: "#4ade80" }}>✓ {!isMobile ? "Result saved" : ""}</span>}
          {saveStatus === "error"  && <span style={{ color: "#f87171" }}>⚠ {!isMobile ? "Could not save" : ""}</span>}
        </div>
 
        {/* Nav action buttons */}
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{ padding: isMobile ? "7px 10px" : "7px 16px", borderRadius: "8px", border: `1px solid ${t.borderMid}`, background: t.bgDeep, color: t.text2, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}
          >
            {isMobile ? "🏠" : "← Dashboard"}
          </button>
          {onRetake && (
            <button
              onClick={onRetake}
              style={{ padding: isMobile ? "7px 10px" : "7px 16px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}
            >
              {isMobile ? "↺" : "↺ Retake Test"}
            </button>
          )}
        </div>
      </nav>
 
      {/* ── Page content ── */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: isMobile ? "16px" : "28px 24px" }}>
 
      {/* ── Score card ── */}
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: isMobile ? "20px 16px" : "28px 32px", marginBottom: "24px" }}>
 
        {/* Title row */}
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "800", color: t.text1, margin: 0, letterSpacing: "-0.5px" }}>
            Overall Performance Summary
          </h1>
          {/* <p style={{ color: t.text4, margin: "4px 0 0", fontSize: "13px", fontFamily: "'IBM Plex Mono', monospace" }}>{test.title}</p> */}
        </div>
 
        {/* Score circle + stats — side by side desktop, stacked mobile */}
        {/* The circle diameter is set to exactly match 2 stat rows + gap between them */}
        <div style={{ display: "flex", gap: "24px", alignItems: "stretch", flexDirection: isMobile ? "column" : "row" }}>
 
          {/* Score ring — diameter = (2 × ROW_H) + GAP = (76 × 2) + 10 = 162px */}
          <div style={{ position: "relative", flexShrink: 0, width: isMobile ? "100%" : "162px", ...(isMobile ? { display: "flex", justifyContent: "center", paddingBottom: "4px" } : {}) }}>
            <svg width="162" height="162" viewBox="0 0 162 162" style={{ display: "block", ...(isMobile ? { margin: "0 auto" } : {}) }}>
              <circle cx="81" cy="81" r="68" fill="none" stroke={t.bgDeep} strokeWidth="11" />
              <circle cx="81" cy="81" r="68" fill="none" stroke={passColor} strokeWidth="11"
                strokeDasharray={`${2 * Math.PI * 68}`}
                strokeDashoffset={`${2 * Math.PI * 68 * (1 - Math.min(pct, 100) / 100)}`}
                strokeLinecap="round" transform="rotate(-90 81 81)"
                style={{ transition: "stroke-dashoffset 1.2s ease" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "24px", fontWeight: "800", color: passColor, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{score}</span>
              <span style={{ fontSize: "12px", color: t.text4, marginTop: "4px" }}>/ {total}</span>
              {/* <span style={{ fontSize: "13px", fontWeight: "700", color: passColor, marginTop: "4px" }}>{passed ? "PASS" : "FAIL"}</span> */}
            </div>
          </div>
 
          {/* Stats grid — 2 rows × 4 cols, each box has fixed height so rows are uniform */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
 
            {/* Row 1 — Performance metrics (height: 76px) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
              {[
                { label: "Percentage",     value: `${pct}%`,             color: passColor },
                { label: "Accuracy",       value: `${accuracy}%`,        color: "#6366f1" },
                { label: "Total Time",     value: formatTime(timeTaken), color: "#6366f1" },
                { label: "Avg Time", value: `${avgTime}s`,         color: t.text2   },
              ].map(s => (
                <div key={s.label} style={{
                  background: t.bgDeep, borderRadius: "10px",
                  height: "76px", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: "5px",
                  padding: "0 6px", textAlign: "center",
                }}>
                  <span style={{ fontSize: isMobile ? "15px" : "18px", fontWeight: "800", color: s.color, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: "9px", color: t.text4, textTransform: "uppercase", letterSpacing: "0.6px", whiteSpace: "nowrap" }}>{s.label}</span>
                </div>
              ))}
            </div>
 
            {/* Row 2 — Question counts with marks pills (height: 76px) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
              {[
                { label: "Correct",   value: nCorrect,    color: "#4ade80", bg: "#4ade8010", border: "#4ade8025", pill: `↑ +${test.positiveMarking}`,  pillColor: "#4ade80", pillBg: "#4ade8020", pillBorder: "#4ade8040" },
                { label: "Incorrect", value: nWrong,      color: "#f87171", bg: "#f8717110", border: "#f8717125", pill: `↓ −${test.negativeMarking}`,  pillColor: "#f87171", pillBg: "#f8717120", pillBorder: "#f8717140" },
                { label: "Skipped",   value: nUnanswered, color: t.text3,   bg: t.bgDeep,   border: t.border,    pill: "— No mark",                    pillColor: t.text4,   pillBg: t.bgHover,  pillBorder: t.borderMid  },
                { label: "Flagged",   value: nFlagged,    color: "#facc15", bg: "#facc1510", border: "#facc1525", pill: "🚩 Marked",                    pillColor: "#facc15", pillBg: "#facc1520", pillBorder: "#facc1540" },
              ].map(s => (
                <div key={s.label} style={{
                  background: s.bg, border: `1px solid ${s.border}`, borderRadius: "10px",
                  height: "76px", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: "4px",
                  padding: "0 6px", textAlign: "center",
                }}>
                  <span style={{ fontSize: isMobile ? "15px" : "18px", fontWeight: "800", color: s.color, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: "9px", color: t.text4, textTransform: "uppercase", letterSpacing: "0.6px" }}>{s.label}</span>
                  <span style={{ fontSize: "9px", fontWeight: "700", color: s.pillColor, background: s.pillBg, border: `1px solid ${s.pillBorder}`, borderRadius: "20px", padding: "1px 7px", whiteSpace: "nowrap" }}>{s.pill}</span>
                </div>
              ))}
            </div>
 
          </div>
        </div>
 
        {/* Action buttons removed — now in nav */}
      </div>
 
      {/* ── Question Review ── */}
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{ fontSize: isMobile ? "18px" : "22px", fontWeight: "800", color: t.text1, margin: "0 0 14px", letterSpacing: "-0.5px" }}>Question Review</h2>
 
        {/* Filter bar */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { key: "all",        label: `All (${filterCounts.all})` },
            { key: "correct",    label: `✓ Correct (${filterCounts.correct})` },
            { key: "wrong",      label: `✗ Wrong (${filterCounts.wrong})` },
            { key: "unanswered", label: `— Skipped (${filterCounts.unanswered})` },
            { key: "flagged", label: `🚩 Flagged (${filterCounts.flagged})` }
            // ...(nFlagged > 0 ? [{ key: "flagged", label: `🚩 Flagged (${filterCounts.flagged})` }] : []),
          ].map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setExpandedIdx(null); }} style={{
              padding: "6px 14px", borderRadius: "20px", fontFamily: "inherit", fontSize: "12px", cursor: "pointer",
              border: filter === f.key ? "1px solid #6366f1" : `1px solid ${t.borderMid}`,
              background: filter === f.key ? "#6366f115" : "transparent",
              color: filter === f.key ? "#6366f1" : t.text3,
              fontWeight: filter === f.key ? "700" : "400",
            }}>{f.label}</button>
          ))}
        </div>
      </div>
 
      {/* Question cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredQuestions.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: t.text4, fontSize: "13px" }}>No questions in this category.</div>
        )}
        {filteredQuestions.map(({ q, i }) => {
          const userAns    = answers[i];
          const isCorrect  = userAns === q.answer;
          const isSkipped  = !userAns;
          const isFlaggedQ = flagged instanceof Set ? flagged.has(i) : false;
          const expanded   = expandedIdx === i;
 
          const statusColor = isCorrect ? "#4ade80" : isSkipped ? t.text4 : "#f87171";
          const statusIcon  = isCorrect ? "✓" : isSkipped ? "—" : "✗";
          const cardBorder  = isCorrect ? "#4ade8030" : isSkipped ? t.border : "#f8717130";
 
          return (
            <div key={i} style={{ background: t.bgCard, border: `1px solid ${cardBorder}`, borderRadius: "10px", overflow: "hidden" }}>
              {/* Question header row */}
              <div onClick={() => setExpandedIdx(expanded ? null : i)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "13px 16px", cursor: "pointer" }}>
                <span style={{ fontSize: "15px", fontWeight: "800", color: statusColor, width: "18px", flexShrink: 0, textAlign: "center" }}>{statusIcon}</span>
                <span style={{ fontSize: "12px", color: t.text4, width: "30px", flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>Q{i + 1}</span>
                {isFlaggedQ && <span style={{ fontSize: "11px", flexShrink: 0 }}>🚩</span>}
                {q.subject && (
                  <span style={{ fontSize: "10px", color: "#6366f1", background: "#6366f115", border: "1px solid #6366f130", borderRadius: "4px", padding: "1px 6px", fontWeight: "600", flexShrink: 0, whiteSpace: "nowrap" }}>
                    {q.subject}
                  </span>
                )}
                {/* <span style={{ flex: 1, fontSize: "13px", color: t.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>{q.question}</span> */}
                <span style={{ flex: 1, fontSize: "13px", color: t.text2, whiteSpace: "normal", wordBreak: "break-word" }}>{q.question}</span>
                <span style={{ color: t.text4, fontSize: "13px", flexShrink: 0, marginLeft: "8px" }}>{expanded ? "▲" : "▼"}</span>
              </div>
 
              {/* Expanded detail */}
              {expanded && (
                <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${t.border}` }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                    {q.options.map((opt, oi) => {
                      const isOptCorrect = opt === q.answer;
                      const isOptUser    = opt === userAns;
                      return (
                        <div key={oi} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 14px", borderRadius: "8px",
                          background: isOptCorrect ? "#4ade8015" : isOptUser && !isCorrect ? "#f8717115" : t.bgDeep,
                          border: `1px solid ${isOptCorrect ? "#4ade8050" : isOptUser && !isCorrect ? "#f8717150" : t.border}`,
                        }}>
                          <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: isOptCorrect ? "#4ade8030" : isOptUser && !isCorrect ? "#f8717130" : t.bgHover, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", color: isOptCorrect ? "#4ade80" : isOptUser && !isCorrect ? "#f87171" : t.text4, flexShrink: 0 }}>
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span style={{ flex: 1, fontSize: "13px", color: isOptCorrect ? "#4ade80" : isOptUser && !isCorrect ? "#f87171" : t.text2 }}>{opt}</span>
                          {isOptCorrect && <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: "700", flexShrink: 0 }}>✓ Correct</span>}
                          {isOptUser && !isCorrect && <span style={{ fontSize: "11px", color: "#f87171", fontWeight: "700", flexShrink: 0 }}>✗ Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
 
                  {/* Unanswered notice */}
                  {/* {isSkipped && (
                    <div style={{ marginTop: "12px", padding: "10px 14px", background: `${t.bgDeep}`, border: `1px solid ${t.border}`, borderRadius: "8px", fontSize: "12px", color: t.text4 }}>
                      — This question was not attempted
                    </div>
                  )} */}
 
                  {/* Explanation — shown for ALL questions (correct, wrong, skipped) */}
                  {q.explanation && (
                    <div style={{ marginTop: "12px", padding: "12px 14px", background: "#6366f110", border: "1px solid #6366f130", borderRadius: "8px" }}>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>💡 Explanation</div>
                      <div style={{ fontSize: "13px", color: t.text2, lineHeight: 1.7 }}>{q.explanation}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onSwitch }) {
  const { t } = useTheme();
  const s = getStyles(t);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
 
  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signIn({ email, password });
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }
 
  async function handleGoogle() {
    setError("");
    try { await signInWithGoogle(); }
    catch (err) { setError(err.message); }
  }
 
  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ ...s.navLogo, width: "48px", height: "48px", fontSize: "22px", margin: "0 auto 16px" }}>▲</div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: t.text1, margin: "0 0 8px" }}>EXAMFORGE</h1>
          <p style={{ color: t.text4, fontSize: "14px", margin: 0 }}>Sign in to your account</p>
        </div>
 
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "32px" }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: t.text3, letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@example.com"
                style={{ ...s.authInput }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: t.text3, letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{ ...s.authInput }}
              />
            </div>
 
            {error && <div style={s.errorBox}>⚠ {error}</div>}
 
            <button type="submit" disabled={loading} style={{ ...s.createBtn, width: "100%", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>
 
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
            <div style={{ flex: 1, height: "1px", background: t.border }} />
            <span style={{ fontSize: "12px", color: t.text4 }}>or</span>
            <div style={{ flex: 1, height: "1px", background: t.border }} />
          </div>
 
          <button onClick={handleGoogle} style={{ ...s.authSocialBtn, width: "100%" }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            Continue with Google
          </button>
 
          <p style={{ textAlign: "center", fontSize: "13px", color: t.text4, marginTop: "24px" }}>
            No account?{" "}
            <button onClick={onSwitch} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontWeight: "600", fontSize: "13px", fontFamily: "inherit" }}>
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
 
// ─── Signup Page ──────────────────────────────────────────────────────────────
function SignupPage({ onSwitch }) {
  const { t } = useTheme();
  const s = getStyles(t);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
 
  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await signUp({ email, password, name });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }
 
  async function handleGoogle() {
    setError("");
    try { await signInWithGoogle(); }
    catch (err) { setError(err.message); }
  }
 
  if (success) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "48px 40px", maxWidth: "420px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📬</div>
          <h2 style={{ color: t.text1, fontSize: "22px", fontWeight: "800", margin: "0 0 12px" }}>Check your email</h2>
          <p style={{ color: t.text3, fontSize: "14px", lineHeight: 1.7, margin: "0 0 24px" }}>
            We sent a confirmation link to <strong style={{ color: t.text1 }}>{email}</strong>. Click it to activate your account, then come back to sign in.
          </p>
          <button onClick={onSwitch} style={{ ...s.createBtn, width: "100%" }}>Back to Sign In</button>
        </div>
      </div>
    );
  }
 
  return (
    <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ ...s.navLogo, width: "48px", height: "48px", fontSize: "22px", margin: "0 auto 16px" }}>▲</div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: t.text1, margin: "0 0 8px" }}>EXAMFORGE</h1>
          <p style={{ color: t.text4, fontSize: "14px", margin: 0 }}>Create your account</p>
        </div>
 
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px", padding: "32px" }}>
          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: t.text3, letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Full Name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="Your name"
                style={{ ...s.authInput }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: t.text3, letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@example.com"
                style={{ ...s.authInput }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: t.text3, letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="Min. 6 characters"
                style={{ ...s.authInput }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: t.text3, letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Confirm Password</label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                placeholder="••••••••"
                style={{ ...s.authInput }}
              />
            </div>
 
            {error && <div style={s.errorBox}>⚠ {error}</div>}
 
            <button type="submit" disabled={loading} style={{ ...s.createBtn, width: "100%", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Creating account…" : "Create Account →"}
            </button>
          </form>
 
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
            <div style={{ flex: 1, height: "1px", background: t.border }} />
            <span style={{ fontSize: "12px", color: t.text4 }}>or</span>
            <div style={{ flex: 1, height: "1px", background: t.border }} />
          </div>
 
          <button onClick={handleGoogle} style={{ ...s.authSocialBtn, width: "100%" }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            Continue with Google
          </button>
 
          <p style={{ textAlign: "center", fontSize: "13px", color: t.text4, marginTop: "24px" }}>
            Already have an account?{" "}
            <button onClick={onSwitch} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontWeight: "600", fontSize: "13px", fontFamily: "inherit" }}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function MockTestApp() {
  // ── Theme ──────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("examforge-theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const toggleTheme = () => setIsDark(d => {
    localStorage.setItem("examforge-theme", !d ? "dark" : "light");
    return !d;
  });
  const t = isDark ? TOKENS.dark : TOKENS.light;

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [user, setUser] = useState(undefined);   // undefined = loading, null = signed out
  const [role, setRole] = useState(null);
  const [authPage, setAuthPage] = useState("login");  // "login" | "signup"
 
  // ── Quiz + Attempts state ─────────────────────────────────────────────────
  const [tests, setTests] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [activeTest, setActiveTest] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);   // quiz for per-quiz attempts page
  const [activeAttempt, setActiveAttempt] = useState(null); // attempt detail
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState("");

  // Single source of truth: load everything inside onAuthStateChange.
  // This fires on every page load (restoring the session from localStorage)
  // and on login/logout. We never rely on a separate useEffect([user]) because
  // that creates a race between setUser() and the data-fetch trigger.
  useEffect(() => {
    // Safety net: if auth hasn't resolved in 6s, stop spinning and show login.
    // This prevents being stuck forever if Supabase is unreachable.
    const timeout = setTimeout(() => {
      setUser(prev => prev === undefined ? null : prev);
    }, 6000);

    const unsub = onAuthChange(async (session) => {
      clearTimeout(timeout);
      const u = session?.user ?? null;
      setUser(u);
 
      if (u) {
        // Fetch role + data in parallel — all within this same callback,
        // after Supabase has confirmed the session is valid
        const [r] = await Promise.all([
          fetchUserRole(u.id),
          _loadTests(),
          _loadAttempts(u.id),
        ]);
        setRole(r);
      } else {
        // Signed out — clear everything
        setRole(null);
        setTests([]);
        setAttempts([]);
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
 
  async function handleSignOut() {
    try {
      await signOut();
      setPage("dashboard");
      // onAuthChange will fire with null session and clear state automatically
    } catch (e) {
      alert(e.message);
    }
  }
 
  // Private helpers — can be called with or without user in scope
  async function _loadTests() {
    setLoading(true);
    setDbError("");
    try {
      const quizzes = await fetchQuizzes();
      setTests(quizzes);
    } catch (e) {
      setDbError(e.message);
    } finally {
      setLoading(false);
    }
  }
 
  async function _loadAttempts(userId) {
    if (!userId) return;
    try {
      const data = await fetchMyAttempts(userId);
      setAttempts(data);
    } catch (_) { /* non-critical */ }
  }
 
  // Public refresh functions for post-action updates
  // function loadTests() { _loadTests(); }
  function loadAttempts() { if (user) _loadAttempts(user.id); }

  // ── When a new quiz is created, add it to local state instantly ────────────
  function handleCreate(test) {
    setTests(prev => [test, ...prev]);
  }

  // ── Delete quiz from Supabase + local state ────────────────────────────────
  async function handleDelete(id) {
    try {
      await deleteQuiz(id);
      setTests(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  // ── Start a test: fetch full question data from Supabase ───────────────────
  async function handleStart(test) {
    try {
      const fullTest = await fetchQuizWithQuestions(test.id);
      setActiveTest(fullTest);
      setPage("test");
    } catch (e) {
      alert(`Failed to load test questions: ${e.message}`);
    }
  }

  function handleBack() {
    setActiveTest(null);
    setPage("dashboard");
  }

  // function handleRetake() {
  //   setActiveTest(null); 
  //   setTimeout(() => handleStart(activeTest), 0);
  // }

  function handleViewAttempts(quiz) {
    setActiveQuiz(quiz);
    setPage("quiz-attempts");
  }
 
  function handleViewAttemptDetail(attempt) {
    setActiveAttempt(attempt);
    setPage("attempt-detail");
  }
 
  function handleBackToQuizAttempts() {
    setActiveAttempt(null);
    setPage("quiz-attempts");
  }
 
  function handleBackToDashboard() {
    setActiveQuiz(null);
    setActiveAttempt(null);
    setPage("dashboard");
  }

  // ── Context values ─────────────────────────────────────────────────────────
  const themeValue = { t, isDark, toggle: toggleTheme };
  const authValue  = { user, role, handleSignOut };
 
  const appShell = (children) => (
    <ThemeContext.Provider value={themeValue}>
      <AuthContext.Provider value={authValue}>
        <div style={{ minHeight: "100vh", background: t.bg, color: t.text2, fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
          {children}
        </div>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
 
  // ── Loading auth state ─────────────────────────────────────────────────────
  if (user === undefined) {
    return appShell(
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: "20px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid #1e293b", borderTop: "3px solid #6366f1", animation: "spin 0.8s linear infinite" }} />
        <span style={{ color: "#64748b", fontSize: "14px" }}>Loading…</span>
      </div>
    );
  }
 
  // ── Not authenticated — show login / signup ────────────────────────────────
  if (!user) {
    return appShell(
      authPage === "login"
        ? <LoginPage  onSwitch={() => setAuthPage("signup")} />
        : <SignupPage onSwitch={() => setAuthPage("login")}  />
    );
  }
 
  // ── Authenticated — show app ───────────────────────────────────────────────
  if (page === "test" && activeTest) {
    return appShell(
      <TestInterface
        test={activeTest}
        onBack={handleBack}
        onRetake={() => { setActiveTest(null); setTimeout(() => handleStart(activeTest), 0); }}
        onAttemptSaved={() => loadAttempts()}
      />
    );
  }

  if (page === "quiz-attempts" && activeQuiz) {
    return appShell(
      <>
        <Nav page={page} setPage={setPage} testsCount={tests.length} />
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "clamp(16px, 4vw, 40px) clamp(12px, 4vw, 32px)" }}>
          <QuizAttemptsPage
            quiz={activeQuiz}
            onBack={handleBackToDashboard}
            onViewDetail={handleViewAttemptDetail}
            onStartTest={() => handleStart(activeQuiz)}
          />
        </main>
      </>
    );
  }
 
  if (page === "attempt-detail" && activeAttempt) {
    return appShell(
      <>
        <Nav page={page} setPage={setPage} testsCount={tests.length} />
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "clamp(16px, 4vw, 40px) clamp(12px, 4vw, 32px)" }}>
          <AttemptDetailPage
            attempt={activeAttempt}
            onBack={handleBackToQuizAttempts}
          />
        </main>
      </>
    );
  }

  return appShell(
    <>
      <Nav page={page} setPage={setPage} testsCount={tests.length} />
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "clamp(16px, 4vw, 40px) clamp(12px, 4vw, 32px)" }}>
          {page === "dashboard" && (
            <Dashboard
              tests={tests}
              attempts={attempts}
              onStart={handleStart}
              onDelete={handleDelete}
              onViewAttempts={handleViewAttempts}
              loading={loading}
              error={dbError}
            />
          )}
          {page === "create" && role === "admin" && (
            <CreateTest onCreate={test => { handleCreate(test); setPage("dashboard"); }} />
          )}
          {page === "create" && role !== "admin" && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
            <h2 style={{ color: t.text1, fontSize: "20px", fontWeight: "800" }}>Admin Only</h2>
            <p style={{ color: t.text4 }}>Only admins can create tests.</p>
          </div>
        )}
        </main>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
function getStyles(t) { return {
  root: {
    minHeight: "100vh",
    background: t.bg,
    color: t.text2,
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace"
  },
  // NAV
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 clamp(12px, 4vw, 32px)", height: "56px",
    background: t.bgCard, borderBottom: `1px solid ${t.border}`,
    position: "sticky", top: 0, zIndex: 100,
    overflowY: "visible",
  },
  navBrand: { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", overflow: "hidden", minWidth: 0 },
  navLogo: {
    width: "32px", height: "32px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "16px", borderRadius: "6px", fontWeight: "bold"
  },
  navTitle: { fontSize: "16px", fontWeight: "700", letterSpacing: "4px", color: t.text1 },
  navLinks: { display: "flex", gap: "8px" },
  navBtn: {
    padding: "8px 20px", borderRadius: "6px", border: `1px solid ${t.border}`,
    background: "transparent", color: t.text3, cursor: "pointer",
    fontSize: "13px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "8px",
    transition: "all 0.2s"
  },
  navBtnActive: { background: t.bgHover, color: t.text2, borderColor: "#334155" },
  navBadge: {
    background: "#6366f1", color: "white", borderRadius: "10px",
    padding: "1px 8px", fontSize: "11px", fontWeight: "bold"
  },
  // MAIN
  main: { maxWidth: "1200px", margin: "0 auto", padding: "clamp(16px, 4vw, 40px) clamp(12px, 4vw, 32px)" },
  page: {},
  // DASHBOARD
  dashHeader: { marginBottom: "32px" },
  dashTitle: { fontSize: "clamp(22px, 5vw, 32px)", fontWeight: "700", color: t.text1, margin: 0, letterSpacing: "-0.5px" },
  dashSub: { color: t.text4, marginTop: "6px", fontSize: "14px" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: "16px" },
  card: {
    background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "12px",
    padding: "24px", transition: "all 0.2s", cursor: "default"
  },
  cardHover: { border: `1px solid ${t.borderMid}`, transform: "translateY(-2px)", boxShadow: "0 8px 32px #6366f120" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  cardSubject: { fontSize: "11px", fontWeight: "600", letterSpacing: "2px", color: "#6366f1", textTransform: "uppercase" },
  cardDiff: { fontSize: "12px", fontWeight: "600" },
  cardTitle: { fontSize: "18px", fontWeight: "700", color: t.text1, margin: "0 0 16px", lineHeight: 1.3 },
  cardMeta: { display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "20px" },
  metaItem: { fontSize: "12px", color: t.text4 },
  cardActions: { display: "flex", gap: "10px", alignItems: "center" },
  startBtn: {
    flex: 1, padding: "10px 20px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "600", fontSize: "13px"
  },
  deleteBtn: {
    padding: "10px 12px", background: t.bgHover, border: `1px solid ${t.borderMid}`,
    borderRadius: "8px", cursor: "pointer", fontSize: "14px"
  },
  emptyState: { textAlign: "center", padding: "80px 20px" },
  emptyIcon: { fontSize: "64px", marginBottom: "20px" },
  emptyTitle: { fontSize: "24px", fontWeight: "700", color: t.text2, margin: "0 0 8px" },
  emptySub: { color: t.text4, fontSize: "14px" },
  // CREATE
  createLayout: { display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px", marginTop: "24px" },
  editorPanel: { display: "flex", flexDirection: "column", gap: "12px" },
  editorHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  editorLabel: { fontSize: "13px", fontWeight: "600", color: t.text3, letterSpacing: "1px" },
  resetBtn: {
    padding: "6px 14px", background: "transparent", border: `1px solid ${t.borderMid}`,
    color: t.text4, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit"
  },
  textarea: {
    width: "100%", minHeight: "460px", padding: "20px",
    background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "10px",
    color: t.code, fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px",
    lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box"
  },
  errorBox: {
    background: "#f8717115", border: "1px solid #f8717140", borderRadius: "8px",
    padding: "12px 16px", color: "#f87171", fontSize: "13px"
  },
  successBox: {
    background: "#4ade8015", border: "1px solid #4ade8040", borderRadius: "8px",
    padding: "12px 16px", color: "#4ade80", fontSize: "13px"
  },
  createBtn: {
    padding: "14px 28px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "10px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "14px", letterSpacing: "0.5px"
  },
  schemaPanel: {
    background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "12px",
    padding: "24px", display: "flex", flexDirection: "column", gap: "12px",
    alignSelf: "start", position: "sticky", top: "80px"
  },
  schemaTitle: { fontSize: "13px", fontWeight: "600", color: t.text3, margin: "0 0 8px", letterSpacing: "1px", textTransform: "uppercase" },
  schemaRow: { display: "flex", flexDirection: "column", gap: "3px", paddingBottom: "10px", borderBottom: `1px solid ${t.border}` },
  schemaField: { display: "flex", alignItems: "center", gap: "8px" },
  fieldCode: { fontSize: "12px", color: t.code, background: "#0a1628", padding: "2px 6px", borderRadius: "4px" },
  reqBadge: { fontSize: "10px", color: "#f87171", border: "1px solid #f8717140", borderRadius: "4px", padding: "1px 6px" },
  schemaType: { fontSize: "11px", color: "#6366f1" },
  schemaDesc: { fontSize: "12px", color: t.text4 },
  // TEST
  testWrap: { minHeight: "100vh", background: t.bg, display: "flex", flexDirection: "column", touchAction: "manipulation" },
  timerBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 32px", background: t.bgCard, borderBottom: `1px solid ${t.border}`
  },
  timerLeft: {},
  testTitleSmall: { fontSize: "13px", color: t.text4, fontFamily: "'IBM Plex Mono', monospace" },
  timerDisplay: {
    display: "flex", alignItems: "center", gap: "8px",
    background: t.bgHover, padding: "8px 20px", borderRadius: "8px"
  },
  timerDanger: { background: "#f8717120", animation: "pulse 1s infinite" },
  timerIcon: { fontSize: "16px" },
  timerText: { fontSize: "20px", fontWeight: "700", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "2px" },
  timerRight: {},
  timerProgress: { fontSize: "13px", color: t.text4, fontFamily: "'IBM Plex Mono', monospace" },
  timerTrack: { height: "3px", background: t.bgHover },
  timerFill: { height: "100%", transition: "width 1s linear" },
  testBody: { display: "flex", flex: 1 },
  // SIDEBAR
  sidebar: {
    width: "220px", background: t.bgCard, borderRight: `1px solid ${t.border}`,
    padding: "24px 16px", display: "flex", flexDirection: "column", gap: "16px"
  },
  sidebarLabel: { fontSize: "11px", fontWeight: "600", color: t.text4, letterSpacing: "2px", textTransform: "uppercase", margin: 0 },
  qGrid: { display: "flex", flexWrap: "wrap", gap: "6px" },
  qDot: {
    width: "36px", height: "36px", borderRadius: "8px",
    background: t.bgHover, border: `1px solid ${t.borderMid}`, color: t.text3,
    cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "inherit"
  },
  qDotCurrent: { background: "#6366f1", border: "1px solid #6366f1", color: "white" },
  qDotAnswered: { background: "#4ade8020", border: "1px solid #4ade8060", color: "#4ade80" },
  qDotFlagged: { background: "#facc1520", border: "1px solid #facc1560", color: "#facc15" },
  sidebarLegend: { display: "flex", flexDirection: "column", gap: "6px" },
  legendItem: { fontSize: "11px", color: t.text4, display: "flex", alignItems: "center", gap: "6px" },
  legendDot: { width: "10px", height: "10px", borderRadius: "50%", display: "inline-block" },
  submitSideBtn: {
    marginTop: "auto", padding: "12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "13px"
  },
  // QUESTION AREA
  questionArea: { flex: 1, padding: "40px 48px", maxWidth: "800px" },
  questionMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" },
  questionNum: { fontSize: "13px", color: t.text4, fontFamily: "'IBM Plex Mono', monospace" },
  flagBtn: {
    padding: "6px 14px", background: "transparent", border: `1px solid ${t.borderMid}`,
    color: t.text4, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit"
  },
  flagBtnActive: { border: "1px solid #facc1560", color: "#facc15", background: "#facc1510" },
  questionText: { fontSize: "22px", fontWeight: "600", color: t.text1, lineHeight: 1.5, marginBottom: "32px" },
  optionsList: { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "40px" },
  optionBtn: {
    display: "flex", alignItems: "center", gap: "16px",
    padding: "16px 20px", background: t.bgCard, border: `2px solid ${t.border}`,
    borderRadius: "10px", cursor: "pointer", color: t.text2,
    textAlign: "left", transition: "all 0.15s", fontFamily: "inherit",
    width: "100%", pointerEvents: "auto", userSelect: "none", WebkitUserSelect: "none",
    touchAction: "manipulation"
  },
  optionBtnSelected: { border: "2px solid #6366f1", background: "#6366f115" },
  optionLabel: {
    width: "32px", height: "32px", background: t.bgHover, borderRadius: "6px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px", fontWeight: "700", color: t.text4, flexShrink: 0
  },
  optionLabelSelected: { background: "#6366f1", color: "white" },
  optionText: { fontSize: "15px" },
  navBtns: { display: "flex", gap: "12px" },
  navTestBtn: {
    padding: "12px 24px", background: t.bgHover, border: `1px solid ${t.borderMid}`,
    color: t.text3, borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px"
  },
  navTestBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  navTestBtnPrimary: {
    padding: "12px 24px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "13px"
  },
  navTestBtnSubmit: {
    padding: "12px 24px", background: "linear-gradient(135deg, #4ade80, #22c55e)",
    color: t.bg, border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "13px"
  },
  // RESULTS
  resultsWrap: { maxWidth: "900px", margin: "0 auto", padding: "40px 32px" },
  resultsSummary: {
    display: "flex", gap: "48px", alignItems: "center",
    background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: "16px",
    padding: "40px", marginBottom: "48px"
  },
  scoreCircleWrap: { position: "relative", flexShrink: 0 },
  scoreInner: {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center"
  },
  scoreNum: { fontSize: "28px", fontWeight: "800", fontFamily: "'IBM Plex Mono', monospace" },
  scoreLabel: { fontSize: "13px", color: t.text4 },
  summaryInfo: { flex: 1 },
  resultsTitle: { fontSize: "28px", fontWeight: "800", color: t.text1, margin: "0 0 8px" },
  resultsSub: { color: t.text4, fontSize: "14px", marginBottom: "28px" },
  summaryStats: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" },
  statBox: {
    background: t.bg, border: `1px solid ${t.border}`, borderRadius: "10px",
    padding: "16px", display: "flex", flexDirection: "column", gap: "4px"
  },
  statValue: { fontSize: "22px", fontWeight: "800", fontFamily: "'IBM Plex Mono', monospace" },
  statLabel: { fontSize: "11px", color: t.text4, textTransform: "uppercase", letterSpacing: "1px" },
  backBtn: {
    padding: "12px 24px", background: t.bgHover, border: `1px solid ${t.borderMid}`,
    color: t.text2, borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "600", fontSize: "13px"
  },
  reviewTitle: { fontSize: "20px", fontWeight: "700", color: t.text1, marginBottom: "20px" },
  reviewList: { display: "flex", flexDirection: "column", gap: "12px" },
  reviewCard: {
    background: t.bgCard, border: "1px solid", borderRadius: "10px", overflow: "hidden"
  },
  reviewCardTop: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 20px", cursor: "pointer"
  },
  reviewCardLeft: { display: "flex", alignItems: "center", gap: "12px", flex: 1 },
  reviewStatus: { fontSize: "18px", fontWeight: "800", width: "24px" },
  reviewQNum: { fontSize: "12px", color: t.text4, fontFamily: "'IBM Plex Mono', monospace" },
  reviewQText: { fontSize: "14px", color: t.text2 },
  reviewExpand: { fontSize: "12px", color: t.text4 },
  reviewDetail: { padding: "0 20px 20px", borderTop: `1px solid ${t.border}` },
  reviewOptions: { display: "flex", flexDirection: "column", gap: "8px", paddingTop: "16px" },
  reviewOpt: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "10px 14px", border: "1px solid", borderRadius: "8px", fontSize: "13px", color: t.text2
  },
  reviewOptLabel: {
    width: "24px", height: "24px", background: t.bgHover, borderRadius: "4px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "11px", fontWeight: "700", flexShrink: 0
  },
  correctTag: { marginLeft: "auto", fontSize: "11px", color: "#4ade80", fontWeight: "600" },
  wrongTag: { marginLeft: "auto", fontSize: "11px", color: "#f87171", fontWeight: "600" },
  explanation: {
    marginTop: "16px", background: "#6366f110", border: "1px solid #6366f130",
    borderRadius: "8px", padding: "16px"
  },
  explanationLabel: { fontSize: "12px", fontWeight: "700", color: "#6366f1", letterSpacing: "1px", display: "block", marginBottom: "8px" },
  explanationText: { fontSize: "13px", color: t.text3, lineHeight: 1.7, margin: 0 },
 
  // ─── MOBILE / RESPONSIVE ────────────────────────────────────────────────────
  navBtnMobile: { padding: "8px 14px", fontSize: "16px" },
  createLayoutMobile: { gridTemplateColumns: "1fr" },
  timerBarMobile: { padding: "10px 16px" },
  timerDisplayMobile: { padding: "6px 14px" },
  questionAreaMobile: { padding: "20px 16px 160px 16px", maxWidth: "100%" },
  questionTextMobile: { fontSize: "17px", marginBottom: "20px" },
  optionBtnMobile: { padding: "14px 14px", gap: "12px" },
  navBtnsMobile: { position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: t.bg, borderTop: `1px solid ${t.border}`, zIndex: 50 },
  qNavToggleBtn: {
    padding: "6px 12px", background: t.bgHover, border: `1px solid ${t.borderMid}`,
    color: t.text3, borderRadius: "6px", cursor: "pointer", fontSize: "13px",
    fontFamily: "inherit"
  },
  submitTopBtn: {
    padding: "6px 14px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "12px"
  },
  mobileQNav: {
    background: t.bgCard, borderBottom: `1px solid ${t.borderMid}`,
    padding: "16px", display: "flex", flexDirection: "column", gap: "12px"
  },
  mobileQNavHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  closeDrawerBtn: {
    background: "transparent", border: "none", color: t.text3,
    fontSize: "16px", cursor: "pointer", padding: "4px 8px"
  },
  resultsWrapMobile: { padding: "16px" },
  resultsSummaryMobile: { flexDirection: "column", gap: "20px", padding: "24px", alignItems: "center", textAlign: "center" },
  summaryStatsMobile: { gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" },
  statBoxMobile: { padding: "12px" },
  reviewOptMobile: { flexWrap: "wrap", gap: "8px" },
 
  // ─── ANTI-CHEAT ─────────────────────────────────────────────────────────────
  warningOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, backdropFilter: "blur(6px)"
  },
  warningBox: {
    background: t.bgCard, border: "2px solid #f87171",
    borderRadius: "16px", padding: "48px 40px", maxWidth: "420px",
    textAlign: "center", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "16px", boxShadow: "0 0 60px #f8717140"
  },
  warningIcon: { fontSize: "48px" },
  warningTitle: { fontSize: "22px", fontWeight: "800", color: "#f87171", margin: 0 },
  warningDesc: { fontSize: "14px", color: t.text3, lineHeight: 1.6, margin: 0 },
  warningBtn: {
    marginTop: "8px", padding: "12px 32px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "14px"
  },
  tabAlertBanner: {
    background: "#facc1515", borderBottom: "1px solid #facc1540",
    color: "#facc15", padding: "10px 20px", fontSize: "13px",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    fontFamily: "inherit"
  },
  tabAlertClose: {
    background: "transparent", border: "none", color: "#facc15",
    cursor: "pointer", fontSize: "14px", padding: "2px 6px", fontFamily: "inherit"
  },
  copyBanner: {
    position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)",
    background: "#f8717120", border: "1px solid #f87171", borderRadius: "8px",
    color: "#f87171", padding: "10px 20px", fontSize: "13px",
    zIndex: 9000, pointerEvents: "none", whiteSpace: "nowrap"
  },
  warningChip: {
    fontSize: "12px", color: "#facc15", background: "#facc1515",
    border: "1px solid #facc1540", borderRadius: "20px", padding: "3px 10px"
  },
  fsIndicator: {
    fontSize: "12px", fontFamily: "inherit"
  },
 
  // ─── DB / LOADING ────────────────────────────────────────────────────────────
  loadingState: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "80px 20px", gap: "20px"
  },
  spinner: {
    width: "40px", height: "40px", borderRadius: "50%",
    border: `3px solid ${t.border}`, borderTop: "3px solid #6366f1",
    animation: "spin 0.8s linear infinite"
  },
  loadingText: { color: t.text4, fontSize: "14px" },
  dbErrorBox: {
    background: "#f8717110", border: "1px solid #f8717140", borderRadius: "10px",
    padding: "16px 20px", marginBottom: "24px", display: "flex", gap: "14px", alignItems: "flex-start"
  },
  dbErrorIcon: { fontSize: "20px", color: "#f87171", flexShrink: 0 },
  dbErrorMsg: { margin: "4px 0 0", fontSize: "13px", color: t.text3 },
  dbLog: {
    background: t.bgDeep, border: `1px solid ${t.border}`, borderRadius: "8px",
    padding: "14px 16px", display: "flex", flexDirection: "column", gap: "6px"
  },
  dbLogLine: {
    fontSize: "12px", color: t.text3, fontFamily: "'IBM Plex Mono', monospace",
    display: "flex", gap: "8px", alignItems: "flex-start"
  },
  createBtnSaving: { opacity: 0.6, cursor: "not-allowed" },
  archRow: { display: "flex", flexDirection: "column", gap: "4px", paddingBottom: "10px", borderBottom: `1px solid ${t.border}` },
  archTable: {
    fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: "700",
    border: "1px solid", borderRadius: "4px", padding: "2px 8px",
    display: "inline-block", alignSelf: "flex-start"
  },
  // AUTH
  authInput: {
    width: "100%", padding: "12px 14px", background: t.bgDeep,
    border: `1px solid ${t.border}`, borderRadius: "8px",
    color: t.text1, fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px",
    outline: "none", boxSizing: "border-box",
  },
  authSocialBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
    padding: "12px 16px", background: t.bgDeep, border: `1px solid ${t.borderMid}`,
    borderRadius: "8px", cursor: "pointer", color: t.text2,
    fontFamily: "inherit", fontSize: "13px", fontWeight: "600",
  },
}; }