"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Display";
import { Modal } from "@/components/ui/Modal";
import { flow } from "@/lib/flowState";
import { useMounted } from "@/lib/useMounted";
import { isAnswered, type AnswerMap, type AnswerValue, type Details, type Question, type QuestionSection } from "@/lib/types";
import { QuestionCard } from "./QuestionCard";
import { ReviewSummary } from "./ReviewSummary";
import { SurveyNavigation } from "./SurveyNavigation";
import { SurveyProgress } from "./SurveyProgress";

type Step = {
  id: string;
  label: string;
  title: string;
  intro?: string;
  sections: QuestionSection[];
};

const STEP_DEFS: Step[] = [
  {
    id: "pss10",
    label: "PSS-10",
    title: "Your recent experiences",
    intro:
      "The questions in this scale ask you about your feelings and thoughts during the last month. In each case, please indicate how often you felt or thought a certain way.",
    sections: ["pss10"],
  },
  {
    id: "stressors",
    label: "Academic Stressors",
    title: "Sources of academic pressure",
    intro: "Please answer each question below.",
    sections: ["stressors"],
  },
  {
    id: "perspective",
    label: "Your Perspective",
    title: "Your perspective",
    intro: "Share only what you are comfortable sharing. Questions marked (optional) can be skipped.",
    sections: ["open_ended", "demographics"],
  },
];

const SUBMIT_ERRORS: Record<string, string> = {
  survey_not_open: "This survey is no longer accepting responses.",
  duplicate: "We couldn't accept this submission. If you have already taken part, thank you — only one response per student is recorded.",
  invalid: "Some answers could not be accepted. Please go back, check your answers and try again.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  network: "We couldn't reach the server. Please check your connection and try again.",
  server: "Your response was not submitted. Please try again. If the problem continues, contact the project administrator.",
};

type Props = { versionId: string; questions: Question[] };

export function SurveyShell(props: Props) {
  // sessionStorage is client-only: render nothing until mounted.
  return useMounted() ? <SurveyRunner {...props} /> : null;
}

function SurveyRunner({ versionId, questions }: Props) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps = useMemo(
    () => STEP_DEFS.filter((s) => questions.some((q) => s.sections.includes(q.section))),
    [questions],
  );
  const totalSteps = steps.length + 1; // + review

  const consent = flow.getConsent();
  const details: Details | null = useMemo(() => flow.getDetails(), []);
  const [answers, setAnswers] = useState<AnswerMap>(() => flow.getAnswers());
  const [stepIndex, setStepIndex] = useState(() => Math.min(flow.getStep(), steps.length));
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());
  const [exitOpen, setExitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!consent) router.replace("/consent");
    else if (!details) router.replace("/details");
    else flow.markStarted();
  }, [consent, details, router]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  if (!consent || !details) return null;

  const isReview = stepIndex >= steps.length;
  const step = steps[stepIndex];
  const stepQuestions = (s: Step) => questions.filter((q) => s.sections.includes(q.section)).sort((a, b) => a.position - b.position);

  function setAnswer(id: string, v: AnswerValue) {
    const next = { ...answers, [id]: v };
    setAnswers(next);
    flow.setAnswers(next);
    if (errorIds.has(id)) {
      const e = new Set(errorIds);
      e.delete(id);
      setErrorIds(e);
    }
  }

  function goTo(i: number) {
    setStepIndex(i);
    flow.setStep(i);
    window.scrollTo({ top: 0 });
  }

  function missingRequired(s: Step) {
    return stepQuestions(s).filter((q) => {
      return q.required && !isAnswered(answers[q.id]);
    });
  }

  function next() {
    const missing = missingRequired(step);
    if (missing.length) {
      setErrorIds(new Set(missing.map((q) => q.id)));
      document.getElementById(`q-${missing[0].id}`)?.scrollIntoView({ block: "center" });
      document.getElementById(`q-${missing[0].id}`)?.focus({ preventScroll: true });
      return;
    }
    setErrorIds(new Set());
    goTo(stepIndex + 1);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    const started = flow.getStartedAt();
    const payload = {
      survey_version_id: versionId,
      consented: true,
      respondent: details,
      answers: questions
        .filter((q) => answers[q.id] !== undefined)
        .map((q) => ({ question_id: q.id, value: answers[q.id] ?? null })),
      total_time_s: started ? Math.max(0, Math.round((Date.now() - started) / 1000)) : undefined,
      website: "",
    };
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        flow.clear();
        flow.markSubmitted();
        router.push("/thanks");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setSubmitError(SUBMIT_ERRORS[body.error ?? "server"] ?? SUBMIT_ERRORS.server);
    } catch {
      setSubmitError(SUBMIT_ERRORS.network);
    }
    setSubmitting(false);
  }

  function exit() {
    flow.clear();
    router.push("/");
  }

  const reviewSections = steps.map((s) => ({ label: s.title, questions: stepQuestions(s) }));

  if (submitting) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Spinner label="Securing your response…" />
        <p className="text-muted">Please don&rsquo;t close this page.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div className="space-y-3">
        <SurveyProgress label={isReview ? "Review" : step.label} step={stepIndex + 1} total={totalSteps} />
        <div className="flex justify-end">
          <button type="button" onClick={() => setExitOpen(true)} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
            Exit survey
          </button>
        </div>
      </div>

      {isReview ? (
        <>
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">
              Almost there
            </h1>
            <p className="mt-2 text-lg text-muted">Please review your responses before submitting.</p>
          </div>
          <ReviewSummary details={details} sections={reviewSections} answers={answers} />
          {submitError && (
            <div role="alert" className="rounded-md border border-danger/40 bg-danger-tint p-4">
              <p className="font-medium text-ink">We couldn&rsquo;t submit your response</p>
              <p className="mt-1 text-[15px] text-ink">{submitError}</p>
              <Button className="mt-3" variant="secondary" onClick={submit}>
                Try again
              </Button>
            </div>
          )}
          <SurveyNavigation canGoBack onBack={() => goTo(stepIndex - 1)} onNext={submit} nextLabel="Submit survey" />
        </>
      ) : (
        <>
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">
              {step.title}
            </h1>
            {step.intro && <p className="mt-2 text-lg text-muted">{step.intro}</p>}
          </div>
          {errorIds.size > 0 && (
            <div role="alert" className="rounded-md border border-danger/40 bg-danger-tint p-4 text-[15px] text-ink">
              Please answer the highlighted question{errorIds.size > 1 ? "s" : ""} to continue.
            </div>
          )}
          <div className="space-y-5">
            {stepQuestions(step).map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                number={i + 1}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
                error={errorIds.has(q.id)}
              />
            ))}
          </div>
          <SurveyNavigation
            canGoBack={stepIndex > 0}
            onBack={() => goTo(stepIndex - 1)}
            onNext={next}
            nextLabel={stepIndex === steps.length - 1 ? "Continue to review" : `Continue to ${steps[stepIndex + 1].label.toLowerCase()}`}
          />
        </>
      )}

      <Modal open={exitOpen} title="Exit survey?" onClose={() => setExitOpen(false)}>
        <p className="text-muted">Your current progress will not be submitted.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setExitOpen(false)}>
            Continue survey
          </Button>
          <Button variant="danger" onClick={exit}>
            Exit
          </Button>
        </div>
      </Modal>
    </div>
  );
}
