export const STUDY_NAME = "LNMIIT HSS Academic Stress Study";
export const STUDY_SHORT = "LNMIIT HSS";

// Replace with the real campus resources before data collection begins.
export const SUPPORT = {
  counsellingLabel: "Campus Counselling",
  counsellingHref: "https://www.lnmiit.ac.in/",
  helplineLabel: "Helpline (Tele-MANAS, India)",
  helplineHref: "tel:14416",
  helplineNumber: "14416",
} as const;

export const YEARS = [
  { value: 1, label: "1st year" },
  { value: 2, label: "2nd year" },
  { value: 3, label: "3rd year" },
  { value: 4, label: "4th year" },
] as const;

export const BRANCHES = ["CSE", "CCE", "ECE", "MME", "Other"] as const;

export const PSS_BANDS = [
  { key: "low", label: "Low perceived stress", min: 0, max: 13 },
  { key: "moderate", label: "Moderate perceived stress", min: 14, max: 26 },
  { key: "high", label: "High perceived stress", min: 27, max: 40 },
] as const;

export const BANDS_DISCLAIMER =
  "Commonly used interpretive bands — not clinical diagnostic thresholds.";

export const ASSOCIATION_NOTE = "Association, not causal effect.";

// Submissions faster than this are flagged for review (never auto-deleted).
export const FAST_SUBMISSION_SECONDS = 60;
