import type { AnswerMap, Details } from "./types";

/**
 * Participant progress lives in sessionStorage only (this tab, cleared on
 * submit/exit). Nothing is sent to the server until the final submission.
 */
const KEYS = {
  consent: "hss.consentAt",
  details: "hss.details",
  answers: "hss.answers",
  step: "hss.step",
  started: "hss.startedAt",
  submitted: "hss.submitted",
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode / quota): the flow still works, just without persistence.
  }
}

export const flow = {
  getConsent: () => read<string>(KEYS.consent),
  setConsent: () => write(KEYS.consent, new Date().toISOString()),
  getDetails: () => read<Details>(KEYS.details),
  setDetails: (d: Details) => write(KEYS.details, d),
  getAnswers: () => read<AnswerMap>(KEYS.answers) ?? {},
  setAnswers: (a: AnswerMap) => write(KEYS.answers, a),
  getStep: () => read<number>(KEYS.step) ?? 0,
  setStep: (s: number) => write(KEYS.step, s),
  getStartedAt: () => read<number>(KEYS.started),
  markStarted: () => {
    if (read<number>(KEYS.started) === null) write(KEYS.started, Date.now());
  },
  markSubmitted: () => write(KEYS.submitted, true),
  wasSubmitted: () => read<boolean>(KEYS.submitted) === true,
  clear() {
    try {
      Object.values(KEYS).forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  },
};
