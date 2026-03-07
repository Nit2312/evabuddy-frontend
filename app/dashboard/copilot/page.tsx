'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/context/AuthContext';
import { api, Source, RetrievalMetrics } from '@/lib/api';
import {
  ChatMessage,
  ChatSession,
  addMessage,
  createChatSession,
  deleteSession,
  subscribeToMessages,
  subscribeToSessions,
  updateSessionTitle,
} from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, Trash2, PanelLeftClose, PanelLeftOpen, Bot, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

function CopilotInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialSession = searchParams.get('session');

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSession);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [openSources, setOpenSources] = useState<string | null>(null);
  const [sessionsPanelCollapsed, setSessionsPanelCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSentMessage = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToSessions(user.uid, setSessions);
  }, [user]);

  useEffect(() => {
    if (!activeSessionId || !user) {
      setMessages([]);
      return;
    }
    return subscribeToMessages(activeSessionId, user.uid, (msgs) => {
      setMessages(msgs);
      scrollToBottom();
    });
  }, [activeSessionId, user, scrollToBottom]);

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5001';
    api.health()
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  const startNewSession = async () => {
    if (!user) return;
    hasSentMessage.current = false;
    const id = await createChatSession(user.uid);
    setActiveSessionId(id);
  };

  const selectSession = (id: string) => {
    hasSentMessage.current = false;
    setActiveSessionId(id);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    await deleteSession(id, user.uid);
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !user) return;
    setInput('');
    setSending(true);
    hasSentMessage.current = true;
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createChatSession(user.uid, msg.slice(0, 48));
      setActiveSessionId(sessionId);
    } else if (messages.length === 0) {
      await updateSessionTitle(sessionId, msg.slice(0, 48));
    }
    await addMessage(sessionId, user.uid, 'user', msg);
    scrollToBottom();
    try {
      const result = await api.chat(msg, user.uid, sessionId);
      await addMessage(sessionId, user.uid, 'assistant', result.response, result.sources, result.retrieval_metrics);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      await addMessage(sessionId, user.uid, 'assistant', `⚠️ ${errMsg}`);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestions = [
    'What are the steps for MH2000 to MH3000 hardware conversion?',
    'How do I set up the high speed counter?',
    'What are common elevator faults and how to fix them?',
    'How to test the low oil pressure switch?',
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">AI Copilot</h1>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              backendStatus === 'online' && 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
              backendStatus === 'offline' && 'bg-red-500/20 text-red-600 dark:text-red-400',
              backendStatus === 'unknown' && 'bg-muted text-muted-foreground'
            )}
          >
            {backendStatus === 'online' ? '● Online' : backendStatus === 'offline' ? '● Offline' : '● Connecting...'}
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={startNewSession}>
          <Plus className="mr-1 h-4 w-4" /> New Chat
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <motion.aside
          className={cn(
            'flex shrink-0 flex-col border-r border-border bg-card overflow-hidden relative',
            sessionsPanelCollapsed ? 'w-10 min-w-[2.5rem]' : 'w-64 min-w-[16rem]'
          )}
          initial={false}
          animate={{ width: sessionsPanelCollapsed ? 40 : 256 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <AnimatePresence initial={false}>
            {!sessionsPanelCollapsed && (
              <>
                <div className="flex items-center justify-between border-b border-border px-3 py-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    History
                  </span>
                  <Button variant="ghost" size="icon-sm" onClick={startNewSession} title="New chat" aria-label="New chat">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {sessions.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No sessions yet. Start a new chat!
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {sessions.map((s) => (
                        <li key={s.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => selectSession(s.id)}
                            onKeyDown={(e) => e.key === 'Enter' && selectSession(s.id)}
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted',
                              activeSessionId === s.id && 'bg-primary/10 text-primary'
                            )}
                          >
                            <MessageSquare className="h-4 w-4 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{s.title || 'Untitled'}</p>
                              <p className="text-xs text-muted-foreground">{s.messageCount ?? 0} messages</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 opacity-60 hover:opacity-100"
                              onClick={(e) => handleDeleteSession(e, s.id)}
                              title="Delete"
                              aria-label="Delete session"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setSessionsPanelCollapsed((c) => !c)}
            aria-label={sessionsPanelCollapsed ? 'Expand history' : 'Collapse history'}
            className="absolute -right-px top-1/2 z-10 flex h-14 w-4 -translate-y-1/2 items-center justify-center rounded-l-md border border-l-0 border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            {sessionsPanelCollapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" strokeWidth={2.25} />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={2.25} />
            )}
          </button>
        </motion.aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {!hasSentMessage.current && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
                >
                  <Bot className="h-8 w-8 text-primary" />
                </motion.div>
                <h2 className="text-xl font-bold">Operations AI Copilot</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Get step-by-step procedures and answers from elevator manuals and case history. Ask for installation steps, conversions, fault resolution, or testing procedures.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => sendMessage(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    openSources={openSources}
                    setOpenSources={setOpenSources}
                    userInitials={(user?.displayName || user?.email || 'U').split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)}
                  />
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/50 px-4 py-3">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.2s]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border p-4">
            <div className="mx-auto flex max-w-3xl gap-2 rounded-xl border border-input bg-background px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
              <textarea
                ref={textareaRef}
                placeholder="Ask anything about elevator procedures..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending}
                className="min-h-[24px] flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                size="icon"
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                aria-label="Send"
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              AI can make mistakes. Always verify critical procedures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  openSources,
  setOpenSources,
  userInitials,
}: {
  msg: ChatMessage;
  openSources: string | null;
  setOpenSources: (id: string | null) => void;
  userInitials: string;
}) {
  const sources = (msg.sources as Source[]) || [];
  const metrics = msg.metrics as RetrievalMetrics | null;
  const isOpen = openSources === msg.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {msg.role === 'user' ? userInitials : <Bot className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className={cn('flex min-w-0 max-w-[80%] flex-col gap-1.5', msg.role === 'user' && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            msg.role === 'user'
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'border border-border bg-muted/50 rounded-bl-md'
          )}
        >
          {msg.role === 'assistant' ? (
            <div className="prose-inline prose-sm dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          ) : (
            msg.content
          )}
        </div>

        {msg.role === 'assistant' && sources.length > 0 && (
          <div className="w-full overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              className="flex w-full items-center justify-between bg-muted/50 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted"
              onClick={() => setOpenSources(isOpen ? null : msg.id)}
            >
              📚 {sources.length} source{sources.length !== 1 ? 's' : ''} retrieved
              <span className="shrink-0">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="space-y-2 border-t border-border p-2">
                {sources.map((src, i) => (
                  <div key={i} className="rounded-md bg-background p-2 text-xs">
                    <p className="font-semibold text-primary">
                      {src.type === 'case_record'
                        ? `Case #${src.case_id} — ${src.job_name}`
                        : src.type === 'pdf_document'
                          ? `PDF: ${src.filename}`
                          : 'Document'}
                    </p>
                    <p className="mt-1 line-clamp-3 text-muted-foreground">{src.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {msg.role === 'assistant' && metrics && (
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Precision: {metrics.precision_at_k?.toFixed(2)}
            </span>
            {(metrics.recall_at_k !== null && metrics.recall_at_k !== undefined) && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Recall: {metrics.recall_at_k?.toFixed(2)}
              </span>
            )}
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
              k={metrics.k}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function CopilotPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-4 p-8">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <span className="text-sm text-muted-foreground">Loading Copilot...</span>
        </div>
      }
    >
      <CopilotInner />
    </Suspense>
  );
}
