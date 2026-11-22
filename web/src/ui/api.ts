export interface ModelInfo {
  id: string;
  label: string;
  input: number;
  summary: string;
  installed: boolean;
  default: boolean;
  metrics: Record<string, number | string | null>;
}

export interface Analysis {
  width: number;
  height: number;
  model: string;
  threshold: number;
  empty?: boolean;
  calibrated: boolean;
  calibration_method: string | null;
  mm_per_pixel?: number;
  foreground_pixels: number;
  image_fraction: number;
  area_cm2?: number;
  perimeter_mm?: number;
  length_mm?: number;
  width_mm?: number;
  tbsa_percent?: number | null;
  bsa_m2?: number | null;
  mean_probability?: number;
  uncertain_fraction?: number;
  elongation?: number;
  solidity?: number;
  contours: number[][][];
  warnings: string[];
  inference_ms: number;
  mask_png?: string;
  probability_png?: string;
  tissue_png?: string;
  tissue: { granulation: number; slough: number; necrosis: number; epithelium: number };
  signs: Record<string, number | boolean | null>;
  depth_class: string;
  scale: { source: string; mm_per_pixel: number; uncertainty_percent: number; detail: Record<string, unknown> };
  type: { probs: Record<string, number>; top: string; confidence: number; accuracy?: number; balanced_accuracy?: number; validated_on?: number; model?: string } | null;
  models?: string[];
}

export interface CaseRow {
  id: string;
  patient_code: string;
  label: string;
  captured_at: string;
  model: string;
  calibrated: boolean;
  area_cm2: number | null;
  perimeter_mm: number | null;
  tbsa_percent: number | null;
  has_thumb: boolean;
}

export interface Trend {
  patient_code: string;
  n: number;
  series: { id: string; captured_at: string; day: number; area_cm2: number }[];
  percent_reduction_from_first: number | null;
  rate_cm2_per_week: number | null;
  rate_percent_per_week: number | null;
  note: string | null;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const j = await r.json();
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* not json */
    }
    throw new ApiError(msg, r.status);
  }
  return r.json() as Promise<T>;
}

async function call(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('network', 0);
  }
}

export const api = {
  models: () => call('/api/models').then((r) => json<ModelInfo[]>(r)),
  auto: (fd: FormData, signal?: AbortSignal) => call('/api/auto', { method: 'POST', body: fd, signal }).then((r) => json<Analysis>(r)),
  analyze: (fd: FormData, signal?: AbortSignal) => call('/api/analyze', { method: 'POST', body: fd, signal }).then((r) => json<Analysis>(r)),
  saveCase: (fd: FormData) => call('/api/cases', { method: 'POST', body: fd }).then((r) => json<{ id: string }>(r)),
  cases: (code?: string) => call('/api/cases' + (code ? `?patient_code=${encodeURIComponent(code)}` : '')).then((r) => json<CaseRow[]>(r)),
  remove: (id: string) => call(`/api/cases/${id}`, { method: 'DELETE' }).then((r) => json<{ deleted: string }>(r)),
  trend: (code: string) => call(`/api/patients/${encodeURIComponent(code)}/trend`).then((r) => json<Trend>(r)),
};
