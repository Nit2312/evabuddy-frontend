// ── Backend API URL ──────────────────────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

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
        try {
            const data = await res.json();
            error = data.error || error;
        } catch { /* empty */ }
        throw new Error(error);
    }

    return res.json();
}

export const api = {
    /** Check if the backend is reachable */
    health: () => apiFetch<{ status: string; initialized: boolean }>('/api/health'),

    /** Get full RAG system status */
    status: () => apiFetch<StatusResponse>('/api/status'),

    /** Trigger RAG initialization */
    initialize: () =>
        apiFetch<{ success: boolean; message: string }>('/api/initialize', { method: 'POST' }),

    /** Send a chat message */
    chat: (message: string, userId?: string, sessionId?: string) =>
        apiFetch<ChatResponse>('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ message, user_id: userId, session_id: sessionId }),
        }),

    /** Evaluate a RAG response */
    evaluate: (question: string, response: string, sources: Source[]) =>
        apiFetch<EvalResponse>('/api/evaluate', {
            method: 'POST',
            body: JSON.stringify({ question, response, sources }),
        }),
};
