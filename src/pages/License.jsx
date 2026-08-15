import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { isTradingLicensed } from "../utils/tradingLicense";

const LESSONS = [
  {
    eyebrow: "01 · Accurate listings",
    title: "Trade the exact champion copy—not a vague name.",
    body: "A good listing makes the important details obvious: the exact champion, its trait, and anything that changes what the other trader is evaluating. Clear information protects both sides.",
    points: ["List the exact champion copy you recorded in Lumio.", "Keep its champion art, name, and trait visible from the start.", "Use the note field for honest context, not pressure."],
  },
  {
    eyebrow: "02 · Evaluate carefully",
    title: "Compare the whole agreement before you accept.",
    body: "Official values are a reference based on Clan Points trained, obtainment difficulty, and a small amount of revised personal judgment. The exact copies, traits, and terms still matter, so compare the full offer before accepting.",
    points: ["Review every offered and requested copy alongside its official value.", "Ask a clear question when a detail is missing.", "You can decline any offer without owing an explanation."],
  },
  {
    eyebrow: "03 · Coordinate safely",
    title: "Lumio records the agreement; the exchange happens in game.",
    body: "When an offer is accepted, use the trade code to make sure both traders are discussing the same record. Then complete the real champion exchange inside Anime Fighting Simulator.",
    points: ["Never treat a Lumio acceptance as an automatic transfer.", "Do not mark an exchange completed until it actually happened in game.", "Keep all changes in a new, clear offer rather than rewriting an old one."],
  },
  {
    eyebrow: "04 · Protect the community",
    title: "Good traders are respectful, patient, and security-minded.",
    body: "No real trade needs a password, login code, or recovery detail. If something feels misleading, pause instead of rushing—then report it with the trade code and a concise explanation.",
    points: ["Never request or share account credentials.", "Respect a no and avoid public pressure.", "Pause unsafe offers and keep the relevant trade details for staff."],
  },
];
const EMPTY_QUESTIONS = [];

function LicenseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.6-2.9 8.1-7 10-4.1-1.9-7-5.4-7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>;
}

function optionLabel(question, optionId) {
  return question?.options?.find((option) => option.id === optionId)?.label || "No answer";
}

function License() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const licensed = isTradingLicensed(profile);
  const [stage, setStage] = useState("welcome");
  const [lessonIndex, setLessonIndex] = useState(0);
  const [exam, setExam] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const currentLesson = LESSONS[lessonIndex];
  const questions = exam?.questions || EMPTY_QUESTIONS;
  const currentQuestion = questions[activeQuestion];
  const answeredCount = useMemo(() => questions.filter((question) => answers[question.id]).length, [answers, questions]);
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const reviewByQuestion = useMemo(() => new Map((result?.review || []).map((review) => [review.question_id, review])), [result?.review]);

  const beginExam = async () => {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("begin_trading_license_exam");
    if (error || !Array.isArray(data?.questions)) {
      setMessage({ type: "error", text: error?.message || "Unable to begin the Trading License assessment." });
    } else {
      setExam(data);
      setAnswers({});
      setActiveQuestion(0);
      setResult(null);
      setStage("exam");
    }
    setBusy(false);
  };

  const submitExam = async () => {
    if (!exam || !allAnswered) {
      setMessage({ type: "error", text: "Answer every question before submitting." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("submit_trading_license_exam", {
      target_attempt_id: exam.attempt_id,
      answer_payload: answers,
    });
    if (error || !data) {
      setMessage({ type: "error", text: error?.message || "Unable to score the Trading License assessment." });
    } else {
      setResult(data);
      if (data.passed) await refreshProfile();
      setStage("result");
    }
    setBusy(false);
  };

  const chooseAnswer = (questionId, optionId) => {
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
    setMessage(null);
  };

  if (licensed && !result) {
    return <Layout><section className="license-shell"><section className="license-complete-card"><span className="license-seal"><LicenseIcon /></span><p className="eyebrow">Trading License</p><h1>Your license is active.</h1><p>You have completed Lumio’s trading standards assessment. Market, Shelf, private offers, and your trade history are now available.</p><div className="license-complete-actions"><Link className="success-action" to="/trades">Open Market</Link><Link className="secondary-action" to="/dashboard">Go to dashboard</Link></div></section></section></Layout>;
  }

  if (stage === "welcome") {
    return <Layout><section className="license-shell"><section className="license-hero"><div><p className="eyebrow">Required onboarding</p><h1>Earn your Trading License.</h1><p>Lumio is a trader-first hub. Before you can use Market, Shelf, or private offers, learn the standards that keep trades clear, safe, and respectful—then pass a short assessment.</p><div className="license-hero-actions"><button className="success-action" onClick={() => setStage("learn")} type="button">Start the guide</button><span>About 5 minutes · 80% required to pass</span></div></div><aside><span className="license-seal"><LicenseIcon /></span><strong>What your license unlocks</strong><ul><li>Market and official drops</li><li>Your public Shelf</li><li>Private trade offers</li><li>Trade records and progression</li></ul></aside></section></section></Layout>;
  }

  if (stage === "learn") {
    return <Layout><section className="license-shell"><div className="license-progress" aria-label="Trading guide progress"><span>Trading guide</span><div><i style={{ width: `${((lessonIndex + 1) / LESSONS.length) * 100}%` }} /></div><strong>{lessonIndex + 1}/{LESSONS.length}</strong></div><section className="license-lesson-card"><p className="eyebrow">{currentLesson.eyebrow}</p><h1>{currentLesson.title}</h1><p>{currentLesson.body}</p><ul>{currentLesson.points.map((point) => <li key={point}><span>✓</span>{point}</li>)}</ul><footer><button className="quiet-action" disabled={lessonIndex === 0} onClick={() => setLessonIndex((current) => current - 1)} type="button">Back</button>{lessonIndex === LESSONS.length - 1 ? <button className="success-action" onClick={() => setStage("ready")} type="button">I&apos;m ready for the assessment</button> : <button className="primary-action" onClick={() => setLessonIndex((current) => current + 1)} type="button">Continue</button>}</footer></section></section></Layout>;
  }

  if (stage === "ready") {
    return <Layout><section className="license-shell"><section className="license-ready-card"><p className="eyebrow">Assessment briefing</p><h1>Show that you can trade responsibly.</h1><p>You will receive 8 multiple-choice questions based on the guide. Score at least 7 correct to earn the Trading License. If you do not pass, Lumio will show what to review before a 10-minute retry window.</p><div className="license-assessment-rules"><div><strong>8 questions</strong><span>Randomized from Lumio standards</span></div><div><strong>7 correct</strong><span>80% score required to pass</span></div><div><strong>One clear attempt</strong><span>Answers are locked when submitted</span></div></div>{message && <p className={message.type === "success" ? "inline-success" : "inline-error"} role="alert">{message.text}</p>}<footer><button className="quiet-action" onClick={() => setStage("learn")} type="button">Review guide</button><button className="success-action" disabled={busy} onClick={() => void beginExam()} type="button">{busy ? "Preparing assessment…" : "Begin assessment"}</button></footer></section></section></Layout>;
  }

  if (stage === "exam" && currentQuestion) {
    return <Layout><section className="license-shell"><div className="license-progress license-exam-progress" aria-label="Assessment progress"><span>Trading License assessment</span><div><i style={{ width: `${((activeQuestion + 1) / questions.length) * 100}%` }} /></div><strong>{activeQuestion + 1}/{questions.length}</strong></div><section className="license-exam-card"><header><div><p className="eyebrow">{currentQuestion.topic}</p><h1>{currentQuestion.prompt}</h1></div><span>{answeredCount}/{questions.length} answered</span></header><div className="license-options" role="radiogroup" aria-label={currentQuestion.prompt}>{currentQuestion.options.map((option) => <button aria-checked={answers[currentQuestion.id] === option.id} className={answers[currentQuestion.id] === option.id ? "is-selected" : ""} key={option.id} onClick={() => chooseAnswer(currentQuestion.id, option.id)} role="radio" type="button"><i>{option.id.toUpperCase()}</i><span>{option.label}</span></button>)}</div>{message && <p className="inline-error" role="alert">{message.text}</p>}<footer><button className="quiet-action" disabled={activeQuestion === 0 || busy} onClick={() => setActiveQuestion((current) => current - 1)} type="button">Previous</button>{activeQuestion === questions.length - 1 ? <button className="success-action" disabled={!allAnswered || busy} onClick={() => void submitExam()} type="button">{busy ? "Scoring…" : "Submit assessment"}</button> : <button className="primary-action" disabled={busy} onClick={() => setActiveQuestion((current) => current + 1)} type="button">Next question</button>}</footer></section><div className="license-question-nav" aria-label="Assessment questions">{questions.map((question, index) => <button aria-current={index === activeQuestion ? "step" : undefined} aria-label={`Question ${index + 1}${answers[question.id] ? ", answered" : ""}`} className={answers[question.id] ? "is-answered" : ""} key={question.id} onClick={() => setActiveQuestion(index)} type="button">{index + 1}</button>)}</div></section></Layout>;
  }

  const passed = Boolean(result?.passed);
  return <Layout><section className="license-shell"><section className={`license-result-card${passed ? " is-passed" : " is-failed"}`}><span className="license-result-mark">{passed ? "✓" : "↗"}</span><p className="eyebrow">Assessment complete</p><h1>{passed ? "You are now a Licensed Trader." : "Review, then come back stronger."}</h1><p>{passed ? `You scored ${result.score}/${result.total_questions}. Your Market, Shelf, private offers, and trade records are now unlocked.` : `You scored ${result?.score || 0}/${result?.total_questions || 8}. You need ${result?.passing_score || 7} correct answers to earn the Trading License.`}</p>{passed ? <div className="license-complete-actions"><button className="success-action" onClick={() => navigate("/trades")} type="button">Open Market</button><Link className="secondary-action" to="/dashboard">Go to dashboard</Link></div> : <><section className="license-review"><h2>Assessment review</h2>{questions.map((question, index) => { const review = reviewByQuestion.get(question.id); const correct = answers[question.id] === review?.correct_option; return <article className={correct ? "is-correct" : "is-incorrect"} key={question.id}><span>{correct ? "Correct" : "Review"}</span><div><strong>{index + 1}. {question.prompt}</strong><p>Your answer: {optionLabel(question, answers[question.id])}</p>{!correct && <p>Best answer: {optionLabel(question, review?.correct_option)}</p>}<small>{review?.explanation}</small></div></article>; })}</section><div className="license-complete-actions"><button className="secondary-action" onClick={() => { setLessonIndex(0); setStage("learn"); }} type="button">Review the guide</button><button className="quiet-action" onClick={() => { setMessage(null); setStage("ready"); }} type="button">Try again later</button></div></>}</section></section></Layout>;
}

export default License;
