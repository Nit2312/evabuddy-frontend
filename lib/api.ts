// ── Backend API URL ──────────────────────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

class ApiError extends Error {
    status: number;
    retryAfterSeconds: number | null;

    constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ChatResponse = {
    response: string;
    sources: Source[];
    retrieval_metrics: RetrievalMetrics;
};

type EvalResponse = {
    verdict: 'pass' | 'warning' | 'fail';
    score: number;
    faithfulness: number;
    answer_relevance: number;
    summary: string;
    issues: string[];
    suggestions: string[];
    strengths: string[];
};

type StatusResponse = {
    initialized: boolean;
    init_pending?: boolean;
    init_error?: string | null;
    total_cases: number;
    total_chunks: number;
    model: string;
    search_type: string;
};

export type Source = {
    type: 'case_record' | 'pdf_document' | 'unknown';
    case_id?: string;
    job_name?: string;
    filename?: string;
    content: string;
    metadata?: Record<string, unknown>;
};

export type RetrievalMetrics = {
    k: number;
    retrieved: number;
    cited_in_answer: number;
    precision_at_k: number;
    recall_at_k: number | null;
};

// Generic fetch wrapper
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BACKEND_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

    if (!res.ok) {
        let error = `HTTP ${res.status}`;
        const retryAfterHeader = res.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : null;
        try {
            const data = await res.json();
            error = data.error || error;
        } catch { /* empty */ }
        throw new ApiError(
            error,
            res.status,
            Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
        );
    }

    return res.json();
}

export type HealthResponse = {
    status: string;
    initialized: boolean;
    /** True while background RAG startup has not finished */
    init_pending?: boolean;
    /** Set when startup finished but RAG failed to load (e.g. missing env) */
    init_error?: string | null;
};

export const api = {
    /** Check if the backend is reachable */
    health: () => apiFetch<HealthResponse>('/api/health'),

    /** Get full RAG system status */
    status: () => apiFetch<StatusResponse>('/api/status'),

    /** Trigger RAG initialization */
    initialize: () =>
        apiFetch<{ success: boolean; message: string; total_cases?: number; total_chunks?: number }>(
            '/api/initialize',
            { method: 'POST' },
        ),

    /** Send a chat message */
    chat: async (message: string, userId?: string, sessionId?: string) => {
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                return await apiFetch<ChatResponse>('/api/chat', {
                    method: 'POST',
                    body: JSON.stringify({ message, user_id: userId, session_id: sessionId }),
                });
            } catch (error) {
                const isApiError = error instanceof ApiError;
                const apiError = isApiError ? error : null;
                const shouldRetry = Boolean(apiError && apiError.status === 503 && attempt < maxAttempts);

                if (!shouldRetry) {
                    throw error;
                }

                const fallbackDelaySeconds = Math.min(5 * attempt, 15);
                const delaySeconds = Math.max(apiError?.retryAfterSeconds ?? fallbackDelaySeconds, 1);
                await sleep(delaySeconds * 1000);
            }
        }

        throw new Error('Request failed after retries.');
    },

    /** Evaluate a RAG response */
    evaluate: (question: string, response: string, sources: Source[]) =>
        apiFetch<EvalResponse>('/api/evaluate', {
            method: 'POST',
            body: JSON.stringify({ question, response, sources }),
        }),
};
