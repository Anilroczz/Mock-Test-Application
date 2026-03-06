import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import CNSQuiz1 from "./quiz/CNSQuiz1";
import BloodQuiz1 from "./quiz/BloodQuiz1";
import './App.css';

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

// Shuffle questions and their options, keeping answer tracking intact
function buildShuffledTest(test) {
  const shuffledQuestions = shuffleArray(test.questions).map(q => {
    const shuffledOptions = shuffleArray(q.options);
    return { ...q, options: shuffledOptions };
  });
  return { ...test, questions: shuffledQuestions };
}

// ─── Sample Data ────────────────────────────────────────────────────────────
const SAMPLE_TESTS = [
  CNSQuiz1,
  BloodQuiz1
];

// ─── Utilities ───────────────────────────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── JSON Template ───────────────────────────────────────────────────────────
const JSON_TEMPLATE = `{
  "id": "test-001",
  "title": "Your Test Title",
  "subject": "Subject Area",
  "duration": 600,
  "totalQuestions": 1,
  "positiveMarking": 1,
  "negativeMarking": 0.25,
  "createdOn": "2026-03-06",
  "questions": [
    {
      "id": 1,
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
  const isMobile = useIsMobile();
  return (
    <nav style={styles.nav}>
      <div style={styles.navBrand} onClick={() => setPage("dashboard")}>
        <div style={styles.navLogo}>▲</div>
        <span style={styles.navTitle}>EXAMFORGE</span>
      </div>
      <div style={styles.navLinks}>
        <button
          style={{ ...styles.navBtn, ...(page === "dashboard" ? styles.navBtnActive : {}), ...(isMobile ? styles.navBtnMobile : {}) }}
          onClick={() => setPage("dashboard")}
        >
          {isMobile ? "🏠" : "Dashboard"}
          {!isMobile && <span style={styles.navBadge}>{testsCount}</span>}
        </button>
        <button
          style={{ ...styles.navBtn, ...(page === "create" ? styles.navBtnActive : {}), ...(isMobile ? styles.navBtnMobile : {}) }}
          onClick={() => setPage("create")}
        >
          {isMobile ? "+" : "+ New Test"}
        </button>
      </div>
    </nav>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ tests, onStart, onDelete }) {
  return (
    <div style={styles.page}>
      <div style={styles.dashHeader}>
        <div>
          <h1 style={styles.dashTitle}>Test Library</h1>
          <p style={styles.dashSub}>{tests.length} mock test{tests.length !== 1 ? "s" : ""} available</p>
        </div>
      </div>

      {tests.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📋</div>
          <h2 style={styles.emptyTitle}>No tests yet</h2>
          <p style={styles.emptySub}>Create your first mock test to get started</p>
        </div>
      ) : (
        <div style={styles.cardGrid}>
          {tests.map(test => (
            <TestCard key={test.id} test={test} onStart={onStart} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function TestCard({ test, onStart, onDelete }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...styles.card, ...(hovered ? styles.cardHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.cardTop}>
        <span style={styles.cardSubject}>{test.subject}</span>
      </div>
      <h2 style={styles.cardTitle}>{test.title}</h2>
      <div style={styles.cardMeta}>
        <span style={styles.metaItem}>⏱ {Math.floor(test.duration / 60)} min</span>
        <span style={styles.metaItem}>❓ {test.totalQuestions || test.questions.length} questions</span>
        <span style={styles.metaItem}>📅 {test.createdOn}</span>
      </div>
      <div style={styles.cardActions}>
        <button style={styles.startBtn} onClick={() => onStart(test)}>
          Start Test →
        </button>
        <button style={styles.deleteBtn} onClick={() => onDelete(test.id)}>🗑</button>
      </div>
    </div>
  );
}

// ─── Create Test ─────────────────────────────────────────────────────────────
function CreateTest({ onCreate }) {
  const [json, setJson] = useState(JSON_TEMPLATE);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const isMobile = useIsMobile();

  function handleSubmit() {
    setError("");
    setSuccess(false);
    try {
      const data = JSON.parse(json);
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
      });

      const newTest = {
        ...data,
        id: `test-${Date.now()}`,
        totalQuestions: data.questions.length,
        createdOn: new Date().toISOString().split("T")[0],
        difficulty: data.difficulty || "Medium",
        subject: data.subject || "General"
      };
      onCreate(newTest);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.message);
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
          {isMobile && showSchema && (
            <SchemaReference />
          )}
          <textarea
            style={{ ...styles.textarea, ...(isMobile ? { minHeight: "320px", fontSize: "12px", padding: "14px" } : {}) }}
            value={json}
            onChange={e => setJson(e.target.value)}
            spellCheck={false}
          />
          {error && <div style={styles.errorBox}>⚠ {error}</div>}
          {success && <div style={styles.successBox}>✓ Test created successfully!</div>}
          <button style={{ ...styles.createBtn, ...(isMobile ? { width: "100%" } : {}) }} onClick={handleSubmit}>
            Create Test ↗
          </button>
        </div>

        {!isMobile && <SchemaReference />}
      </div>
    </div>
  );
}

// ─── Schema Reference (shared) ───────────────────────────────────────────────
function SchemaReference() {
  return (
    <div style={styles.schemaPanel}>
      <h3 style={styles.schemaTitle}>Schema Reference</h3>
      {[
        { field: "title", type: "string", req: true, desc: "Name of the test" },
        { field: "subject", type: "string", req: false, desc: "Subject/category label" },
        { field: "duration", type: "number", req: true, desc: "Time limit in seconds" },
        { field: "difficulty", type: "string", req: false, desc: "Easy | Medium | Hard" },
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

// ─── Test Interface ───────────────────────────────────────────────────────────
function TestInterface({ test, onFinish, onBack }) {
  // Shuffle once on mount, never again
  const shuffledTest = useMemo(() => buildShuffledTest(test), [test]);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(shuffledTest.duration);
  const [submitted, setSubmitted] = useState(false);
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
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
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
  const handleSubmit = useCallback(() => setSubmitted(true), []);

  useEffect(() => {
    if (submitted || timeLeft <= 0) {
      if (timeLeft <= 0 && !submitted) handleSubmit();
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
    return (
      <Results
        test={shuffledTest}
        answers={answers}
        timeTaken={shuffledTest.duration - timeLeft}
        onBack={onBack}
      />
    );
  }

  const q = shuffledTest.questions[current];
  const totalQ = shuffledTest.questions.length;
  const answered = Object.keys(answers).filter(k => answers[k] !== null).length;
  const pct = Math.round((timeLeft / shuffledTest.duration) * 100);
  const timerDanger = timeLeft < 60;

  return (
    <div
      ref={testContainerRef}
      style={{ ...styles.testWrap, userSelect: "none", WebkitUserSelect: "none" }}
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
function Results({ test, answers, timeTaken, onBack }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const isMobile = useIsMobile();

  let correctquetions = 0;
  let wrongquestions = 0;
  let unansweredquestions = 0;

  // const score = test.questions.reduce((acc, q, i) => {
  //   return acc + (answers[i] === q.answer ? test.positivePoints : -test.negativePoints);
  // }, 0);

  const score = test.questions.reduce((acc, q, i) => {
    // unanswered
    if (!answers[i]) {
      ++unansweredquestions;
      return acc; 
    }

    // correct answer
    if (answers[i] === q.answer) {
      ++correctquetions;
      return acc + test.positiveMarking;
    } 

    // incorrect answer
    ++wrongquestions;
    return acc - test.negativeMarking;
  }, 0);

  const total = test.questions.length;
  const pct = Math.round((score / total) * 100);
  const passed = pct >= 60;

  return (
    <div style={{ ...styles.resultsWrap, ...(isMobile ? styles.resultsWrapMobile : {}) }}>
      <div style={{ ...styles.resultsSummary, ...(isMobile ? styles.resultsSummaryMobile : {}) }}>
        <div style={styles.scoreCircleWrap}>
          <svg width={isMobile ? "100" : "140"} height={isMobile ? "100" : "140"} viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="58" fill="none" stroke="#1e293b" strokeWidth="10" />
            <circle
              cx="70" cy="70" r="58"
              fill="none"
              stroke={passed ? "#4ade80" : "#f87171"}
              strokeWidth="10"
              strokeDasharray={`${2 * Math.PI * 58}`}
              strokeDashoffset={`${2 * Math.PI * 58 * (1 - pct / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div style={styles.scoreInner}>
            <span style={{ ...styles.scoreNum, color: passed ? "#4ade80" : "#f87171", ...(isMobile ? { fontSize: "20px" } : {}) }}>{score}/{total}</span>
          </div>
        </div>

        <div style={styles.summaryInfo}>
          <h1 style={{ ...styles.resultsTitle, ...(isMobile ? { fontSize: "20px" } : {}) }}>{passed ? "Well done! 🎉" : "Keep practicing 💪"}</h1>
          <p style={styles.resultsSub}>{test.title}</p>
          <div style={{ ...styles.summaryStats, ...(isMobile ? styles.summaryStatsMobile : {}) }}>
            <StatBox label="Correct" value={correctquetions} color="#4ade80" isMobile={isMobile} />
            <StatBox label="Incorrect" value={wrongquestions} color="#f87171" isMobile={isMobile} />
            <StatBox label="Unanswered" value={unansweredquestions} color="#c9d0ccff" isMobile={isMobile} />
            <StatBox label="Time Taken" value={formatTime(timeTaken)} color="#6366f1" isMobile={isMobile} />
          </div>
          <button style={{ ...styles.backBtn, ...(isMobile ? { width: "100%" } : {}) }} onClick={onBack}>← Back to Dashboard</button>
        </div>
      </div>

      <h2 style={styles.reviewTitle}>Question Review</h2>
      <div style={styles.reviewList}>
        {test.questions.map((q, i) => {
          const userAns = answers[i];
          const correct = userAns === q.answer;
          const expanded = expandedIdx === i;
          return (
            <div key={i} style={{ ...styles.reviewCard, borderColor: correct ? "#4ade8040" : "#f8717140" }}>
              <div style={styles.reviewCardTop} onClick={() => setExpandedIdx(expanded ? null : i)}>
                <div style={styles.reviewCardLeft}>
                  <span style={{ ...styles.reviewStatus, color: correct ? "#4ade80" : "#f87171" }}>
                    {correct ? "✓" : "✗"}
                  </span>
                  <span style={styles.reviewQNum}>Q{i + 1}</span>
                  <span style={{ ...styles.reviewQText, ...(isMobile ? { fontSize: "13px" } : {}) }}>{q.question}</span>
                </div>
                <span style={styles.reviewExpand}>{expanded ? "▲" : "▼"}</span>
              </div>

              {expanded && (
                <div style={styles.reviewDetail}>
                  <div style={styles.reviewOptions}>
                    {q.options.map((opt, oi) => {
                      const isCorrect = opt === q.answer;
                      const isUser = opt === userAns;
                      return (
                        <div key={oi} style={{
                          ...styles.reviewOpt,
                          ...(isMobile ? styles.reviewOptMobile : {}),
                          background: isCorrect ? "#4ade8018" : isUser && !correct ? "#f8717118" : "transparent",
                          borderColor: isCorrect ? "#4ade80" : isUser && !correct ? "#f87171" : "#334155"
                        }}>
                          <span style={styles.reviewOptLabel}>{String.fromCharCode(65 + oi)}</span>
                          <span style={{ flex: 1 }}>{opt}</span>
                          {isCorrect && <span style={{ ...styles.correctTag, flexShrink: 0 }}>✓</span>}
                          {isUser && !correct && <span style={{ ...styles.wrongTag, flexShrink: 0 }}>✗</span>}
                        </div>
                      );
                    })}
                  </div>
                  {!correct && q.explanation && (
                    <div style={styles.explanation}>
                      <span style={styles.explanationLabel}>💡 Explanation</span>
                      <p style={styles.explanationText}>{q.explanation}</p>
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

function StatBox({ label, value, color, isMobile }) {
  return (
    <div style={{ ...styles.statBox, ...(isMobile ? styles.statBoxMobile : {}) }}>
      <span style={{ ...styles.statValue, color, ...(isMobile ? { fontSize: "16px" } : {}) }}>{value}</span>
      <span style={{ ...styles.statLabel, ...(isMobile ? { fontSize: "10px" } : {}) }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tests, setTests] = useState(SAMPLE_TESTS);
  const [page, setPage] = useState("dashboard");
  const [activeTest, setActiveTest] = useState(null);

  function handleCreate(test) {
    setTests(prev => [test, ...prev]);
  }

  function handleDelete(id) {
    setTests(prev => prev.filter(t => t.id !== id));
  }

  function handleStart(test) {
    setActiveTest(test);
    setPage("test");
  }

  function handleBack() {
    setActiveTest(null);
    setPage("dashboard");
  }

  if (page === "test" && activeTest) {
    return (
      <div style={styles.root}>
        <TestInterface test={activeTest} onBack={handleBack} />
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <Nav page={page} setPage={setPage} testsCount={tests.length} />
      <main style={styles.main}>
        {page === "dashboard" && (
          <Dashboard tests={tests} onStart={handleStart} onDelete={handleDelete} />
        )}
        {page === "create" && (
          <CreateTest onCreate={test => { handleCreate(test); setPage("dashboard"); }} />
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = {
  root: {
    minHeight: "100vh",
    background: "#0a0f1e",
    color: "#e2e8f0",
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace"
  },
  // NAV
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 clamp(12px, 4vw, 32px)", height: "56px",
    background: "#0d1424", borderBottom: "1px solid #1e293b",
    position: "sticky", top: 0, zIndex: 100
  },
  navBrand: { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" },
  navLogo: {
    width: "32px", height: "32px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "16px", borderRadius: "6px", fontWeight: "bold"
  },
  navTitle: { fontSize: "16px", fontWeight: "700", letterSpacing: "4px", color: "#f1f5f9" },
  navLinks: { display: "flex", gap: "8px" },
  navBtn: {
    padding: "8px 20px", borderRadius: "6px", border: "1px solid #1e293b",
    background: "transparent", color: "#94a3b8", cursor: "pointer",
    fontSize: "13px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "8px",
    transition: "all 0.2s"
  },
  navBtnActive: { background: "#1e293b", color: "#e2e8f0", borderColor: "#334155" },
  navBadge: {
    background: "#6366f1", color: "white", borderRadius: "10px",
    padding: "1px 8px", fontSize: "11px", fontWeight: "bold"
  },
  // MAIN
  main: { maxWidth: "1200px", margin: "0 auto", padding: "clamp(16px, 4vw, 40px) clamp(12px, 4vw, 32px)" },
  page: {},
  // DASHBOARD
  dashHeader: { marginBottom: "32px" },
  dashTitle: { fontSize: "clamp(22px, 5vw, 32px)", fontWeight: "700", color: "#f1f5f9", margin: 0, letterSpacing: "-0.5px" },
  dashSub: { color: "#64748b", marginTop: "6px", fontSize: "14px" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: "16px" },
  card: {
    background: "#0d1424", border: "1px solid #1e293b", borderRadius: "12px",
    padding: "24px", transition: "all 0.2s", cursor: "default"
  },
  cardHover: { border: "1px solid #334155", transform: "translateY(-2px)", boxShadow: "0 8px 32px #6366f120" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  cardSubject: { fontSize: "11px", fontWeight: "600", letterSpacing: "2px", color: "#6366f1", textTransform: "uppercase" },
  cardDiff: { fontSize: "12px", fontWeight: "600" },
  cardTitle: { fontSize: "18px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 16px", lineHeight: 1.3 },
  cardMeta: { display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "20px" },
  metaItem: { fontSize: "12px", color: "#64748b" },
  cardActions: { display: "flex", gap: "10px", alignItems: "center" },
  startBtn: {
    flex: 1, padding: "10px 20px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "600", fontSize: "13px"
  },
  deleteBtn: {
    padding: "10px 12px", background: "#1e293b", border: "1px solid #334155",
    borderRadius: "8px", cursor: "pointer", fontSize: "14px"
  },
  emptyState: { textAlign: "center", padding: "80px 20px" },
  emptyIcon: { fontSize: "64px", marginBottom: "20px" },
  emptyTitle: { fontSize: "24px", fontWeight: "700", color: "#e2e8f0", margin: "0 0 8px" },
  emptySub: { color: "#64748b", fontSize: "14px" },
  // CREATE
  createLayout: { display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px", marginTop: "24px" },
  editorPanel: { display: "flex", flexDirection: "column", gap: "12px" },
  editorHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  editorLabel: { fontSize: "13px", fontWeight: "600", color: "#94a3b8", letterSpacing: "1px" },
  resetBtn: {
    padding: "6px 14px", background: "transparent", border: "1px solid #334155",
    color: "#64748b", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit"
  },
  textarea: {
    width: "100%", minHeight: "460px", padding: "20px",
    background: "#0d1424", border: "1px solid #1e293b", borderRadius: "10px",
    color: "#a5f3fc", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px",
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
    background: "#0d1424", border: "1px solid #1e293b", borderRadius: "12px",
    padding: "24px", display: "flex", flexDirection: "column", gap: "12px",
    alignSelf: "start", position: "sticky", top: "80px"
  },
  schemaTitle: { fontSize: "13px", fontWeight: "600", color: "#94a3b8", margin: "0 0 8px", letterSpacing: "1px", textTransform: "uppercase" },
  schemaRow: { display: "flex", flexDirection: "column", gap: "3px", paddingBottom: "10px", borderBottom: "1px solid #1e293b" },
  schemaField: { display: "flex", alignItems: "center", gap: "8px" },
  fieldCode: { fontSize: "12px", color: "#a5f3fc", background: "#0a1628", padding: "2px 6px", borderRadius: "4px" },
  reqBadge: { fontSize: "10px", color: "#f87171", border: "1px solid #f8717140", borderRadius: "4px", padding: "1px 6px" },
  schemaType: { fontSize: "11px", color: "#6366f1" },
  schemaDesc: { fontSize: "12px", color: "#64748b" },
  // TEST
  testWrap: { minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column" },
  timerBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 32px", background: "#0d1424", borderBottom: "1px solid #1e293b"
  },
  timerLeft: {},
  testTitleSmall: { fontSize: "13px", color: "#64748b", fontFamily: "'IBM Plex Mono', monospace" },
  timerDisplay: {
    display: "flex", alignItems: "center", gap: "8px",
    background: "#1e293b", padding: "8px 20px", borderRadius: "8px"
  },
  timerDanger: { background: "#f8717120", animation: "pulse 1s infinite" },
  timerIcon: { fontSize: "16px" },
  timerText: { fontSize: "20px", fontWeight: "700", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "2px" },
  timerRight: {},
  timerProgress: { fontSize: "13px", color: "#64748b", fontFamily: "'IBM Plex Mono', monospace" },
  timerTrack: { height: "3px", background: "#1e293b" },
  timerFill: { height: "100%", transition: "width 1s linear" },
  testBody: { display: "flex", flex: 1 },
  // SIDEBAR
  sidebar: {
    width: "220px", background: "#0d1424", borderRight: "1px solid #1e293b",
    padding: "24px 16px", display: "flex", flexDirection: "column", gap: "16px"
  },
  sidebarLabel: { fontSize: "11px", fontWeight: "600", color: "#64748b", letterSpacing: "2px", textTransform: "uppercase", margin: 0 },
  qGrid: { display: "flex", flexWrap: "wrap", gap: "6px" },
  qDot: {
    width: "36px", height: "36px", borderRadius: "8px",
    background: "#1e293b", border: "1px solid #334155", color: "#94a3b8",
    cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "inherit"
  },
  qDotCurrent: { background: "#6366f1", border: "1px solid #6366f1", color: "white" },
  qDotAnswered: { background: "#4ade8020", border: "1px solid #4ade8060", color: "#4ade80" },
  qDotFlagged: { background: "#facc1520", border: "1px solid #facc1560", color: "#facc15" },
  sidebarLegend: { display: "flex", flexDirection: "column", gap: "6px" },
  legendItem: { fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" },
  legendDot: { width: "10px", height: "10px", borderRadius: "50%", display: "inline-block" },
  submitSideBtn: {
    marginTop: "auto", padding: "12px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "13px"
  },
  // QUESTION AREA
  questionArea: { flex: 1, padding: "40px 48px", maxWidth: "800px" },
  questionMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" },
  questionNum: { fontSize: "13px", color: "#64748b", fontFamily: "'IBM Plex Mono', monospace" },
  flagBtn: {
    padding: "6px 14px", background: "transparent", border: "1px solid #334155",
    color: "#64748b", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit"
  },
  flagBtnActive: { border: "1px solid #facc1560", color: "#facc15", background: "#facc1510" },
  questionText: { fontSize: "22px", fontWeight: "600", color: "#f1f5f9", lineHeight: 1.5, marginBottom: "32px" },
  optionsList: { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "40px" },
  optionBtn: {
    display: "flex", alignItems: "center", gap: "16px",
    padding: "16px 20px", background: "#0d1424", border: "2px solid #1e293b",
    borderRadius: "10px", cursor: "pointer", color: "#e2e8f0",
    textAlign: "left", transition: "all 0.15s", fontFamily: "inherit"
  },
  optionBtnSelected: { border: "2px solid #6366f1", background: "#6366f115" },
  optionLabel: {
    width: "32px", height: "32px", background: "#1e293b", borderRadius: "6px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px", fontWeight: "700", color: "#64748b", flexShrink: 0
  },
  optionLabelSelected: { background: "#6366f1", color: "white" },
  optionText: { fontSize: "15px" },
  navBtns: { display: "flex", gap: "12px" },
  navTestBtn: {
    padding: "12px 24px", background: "#1e293b", border: "1px solid #334155",
    color: "#94a3b8", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px"
  },
  navTestBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  navTestBtnPrimary: {
    padding: "12px 24px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "13px"
  },
  navTestBtnSubmit: {
    padding: "12px 24px", background: "linear-gradient(135deg, #4ade80, #22c55e)",
    color: "#0a0f1e", border: "none", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "13px"
  },
  // RESULTS
  resultsWrap: { maxWidth: "900px", margin: "0 auto", padding: "40px 32px" },
  resultsSummary: {
    display: "flex", gap: "48px", alignItems: "center",
    background: "#0d1424", border: "1px solid #1e293b", borderRadius: "16px",
    padding: "40px", marginBottom: "48px"
  },
  scoreCircleWrap: { position: "relative", flexShrink: 0 },
  scoreInner: {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center"
  },
  scoreNum: { fontSize: "28px", fontWeight: "800", fontFamily: "'IBM Plex Mono', monospace" },
  scoreLabel: { fontSize: "13px", color: "#64748b" },
  summaryInfo: { flex: 1 },
  resultsTitle: { fontSize: "28px", fontWeight: "800", color: "#f1f5f9", margin: "0 0 8px" },
  resultsSub: { color: "#64748b", fontSize: "14px", marginBottom: "28px" },
  summaryStats: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" },
  statBox: {
    background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: "10px",
    padding: "16px", display: "flex", flexDirection: "column", gap: "4px"
  },
  statValue: { fontSize: "22px", fontWeight: "800", fontFamily: "'IBM Plex Mono', monospace" },
  statLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" },
  backBtn: {
    padding: "12px 24px", background: "#1e293b", border: "1px solid #334155",
    color: "#e2e8f0", borderRadius: "8px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "600", fontSize: "13px"
  },
  reviewTitle: { fontSize: "20px", fontWeight: "700", color: "#f1f5f9", marginBottom: "20px" },
  reviewList: { display: "flex", flexDirection: "column", gap: "12px" },
  reviewCard: {
    background: "#0d1424", border: "1px solid", borderRadius: "10px", overflow: "hidden"
  },
  reviewCardTop: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 20px", cursor: "pointer"
  },
  reviewCardLeft: { display: "flex", alignItems: "center", gap: "12px", flex: 1 },
  reviewStatus: { fontSize: "18px", fontWeight: "800", width: "24px" },
  reviewQNum: { fontSize: "12px", color: "#64748b", fontFamily: "'IBM Plex Mono', monospace" },
  reviewQText: { fontSize: "14px", color: "#e2e8f0" },
  reviewExpand: { fontSize: "12px", color: "#64748b" },
  reviewDetail: { padding: "0 20px 20px", borderTop: "1px solid #1e293b" },
  reviewOptions: { display: "flex", flexDirection: "column", gap: "8px", paddingTop: "16px" },
  reviewOpt: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "10px 14px", border: "1px solid", borderRadius: "8px", fontSize: "13px", color: "#e2e8f0"
  },
  reviewOptLabel: {
    width: "24px", height: "24px", background: "#1e293b", borderRadius: "4px",
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
  explanationText: { fontSize: "13px", color: "#94a3b8", lineHeight: 1.7, margin: 0 },

  // ─── MOBILE / RESPONSIVE ────────────────────────────────────────────────────
  navBtnMobile: { padding: "8px 14px", fontSize: "16px" },
  createLayoutMobile: { gridTemplateColumns: "1fr" },
  timerBarMobile: { padding: "10px 16px" },
  timerDisplayMobile: { padding: "6px 14px" },
  questionAreaMobile: { padding: "20px 16px 160px 16px", maxWidth: "100%" },
  questionTextMobile: { fontSize: "17px", marginBottom: "20px" },
  optionBtnMobile: { padding: "14px 14px", gap: "12px" },
  navBtnsMobile: { position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "#0a0f1e", borderTop: "1px solid #1e293b", zIndex: 50 },
  qNavToggleBtn: {
    padding: "6px 12px", background: "#1e293b", border: "1px solid #334155",
    color: "#94a3b8", borderRadius: "6px", cursor: "pointer", fontSize: "13px",
    fontFamily: "inherit"
  },
  submitTopBtn: {
    padding: "6px 14px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
    fontFamily: "inherit", fontWeight: "700", fontSize: "12px"
  },
  mobileQNav: {
    background: "#0d1424", borderBottom: "1px solid #334155",
    padding: "16px", display: "flex", flexDirection: "column", gap: "12px"
  },
  mobileQNavHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  closeDrawerBtn: {
    background: "transparent", border: "none", color: "#94a3b8",
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
    background: "#0d1424", border: "2px solid #f87171",
    borderRadius: "16px", padding: "48px 40px", maxWidth: "420px",
    textAlign: "center", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "16px", boxShadow: "0 0 60px #f8717140"
  },
  warningIcon: { fontSize: "48px" },
  warningTitle: { fontSize: "22px", fontWeight: "800", color: "#f87171", margin: 0 },
  warningDesc: { fontSize: "14px", color: "#94a3b8", lineHeight: 1.6, margin: 0 },
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
};