export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Sample standard deviation (n - 1). */
export function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

// ---- Student t distribution -------------------------------------------------

function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const cj of c) ser += cj / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// Continued fraction for the regularised incomplete beta function.
function betaCf(a: number, b: number, x: number): number {
  const MAX_IT = 300;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_IT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
export function regIncBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaCf(a, b, x)) / a
    : 1 - (bt * betaCf(b, a, 1 - x)) / b;
}

/** Two-sided p-value for a t statistic with `df` degrees of freedom. */
export function tTwoSidedP(t: number, df: number): number {
  if (df <= 0) return NaN;
  return regIncBeta(df / (df + t * t), df / 2, 0.5);
}

// ---- Correlation ------------------------------------------------------------

export type Correlation = {
  r: number | null;
  p: number | null;
  n: number;
};

/**
 * Pearson correlation using complete pairs only. Returns nulls when it is not
 * computable (n < 3 or zero variance) rather than a misleading number.
 */
export function pearson(xs: Array<number | null | undefined>, ys: Array<number | null | undefined>): Correlation {
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const x = xs[i];
    const y = ys[i];
    if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
      px.push(x);
      py.push(y);
    }
  }
  const n = px.length;
  if (n < 3) return { r: null, p: null, n };
  const mx = mean(px)!;
  const my = mean(py)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (px[i] - mx) * (py[i] - my);
    sxx += (px[i] - mx) ** 2;
    syy += (py[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return { r: null, p: null, n };
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  if (Math.abs(r) === 1) return { r, p: 0, n };
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
  return { r, p: tTwoSidedP(t, n - 2), n };
}
