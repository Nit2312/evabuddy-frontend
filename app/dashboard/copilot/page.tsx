'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/context/AuthContext';
import { api, Source } from '@/lib/api';
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
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'initializing' | 'online' | 'offline'>('connecting');
  const [showReadyToast, setShowReadyToast] = useState(false);
  const [openSources, setOpenSources] = useState<string | null>(null);
  const [sessionsPanelCollapsed, setSessionsPanelCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSentMessage = useRef(false);
  const previousBackendStatus = useRef<'connecting' | 'initializing' | 'online' | 'offline'>('connecting');

  const isBackendReady = backendStatus === 'online';
  const mobileHistoryOpen = isMobile && !sessionsPanelCollapsed;

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
    let cancelled = false;

    const check = async () => {
      try {
        const health = await api.health();
        if (cancelled) return;
        setBackendStatus(health.initialized ? 'online' : 'initializing');
      } catch {
        if (!cancelled) setBackendStatus('offline');
      }
    };

    check();
    const intervalId = setInterval(check, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const prev = previousBackendStatus.current;
    previousBackendStatus.current = backendStatus;

    if (backendStatus !== 'online') {
      setShowReadyToast(false);
      return;
    }

    if (prev !== 'online') {
      setShowReadyToast(true);
      const timeoutId = setTimeout(() => setShowReadyToast(false), 2600);
      return () => clearTimeout(timeoutId);
    }
  }, [backendStatus]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  useEffect(() => {
    const updateViewport = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSessionsPanelCollapsed(true);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const startNewSession = async () => {
    if (!user) return;
    hasSentMessage.current = false;
    const id = await createChatSession(user.uid);
    setActiveSessionId(id);
  };

  const selectSession = (id: string) => {
    hasSentMessage.current = false;
    setActiveSessionId(id);
    if (isMobile) setSessionsPanelCollapsed(true);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    await deleteSession(id, user.uid);
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !user || !isBackendReady) return;
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
    <div className="relative flex h-full flex-col overflow-hidden">
      <AnimatePresence>
        {(backendStatus !== 'online' || showReadyToast) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'pointer-events-none absolute right-4 top-4 z-30 rounded-lg border px-3 py-2 text-xs font-medium shadow-md backdrop-blur',
              backendStatus === 'offline' && 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
              (backendStatus === 'connecting' || backendStatus === 'initializing') &&
                'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
              backendStatus === 'online' && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            )}
          >
            {backendStatus === 'connecting' && 'Connecting to backend...'}
            {backendStatus === 'initializing' && 'System is initializing. Please wait...'}
            {backendStatus === 'offline' && 'Backend is offline. Retrying connection...'}
            {backendStatus === 'online' && 'System is live. You can ask questions now.'}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1">
        {mobileHistoryOpen && (
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/40"
            aria-label="Close history"
            onClick={() => setSessionsPanelCollapsed(true)}
          />
        )}
        <motion.aside
          className={cn(
            'hidden md:flex shrink-0 flex-col border-r border-border bg-card overflow-hidden relative',
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
        <AnimatePresence>
          {mobileHistoryOpen && (
            <motion.aside
              initial={{ x: -320, opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0.9 }}
              transition={{ type: 'spring', stiffness: 330, damping: 32 }}
              className="absolute inset-y-0 left-0 z-20 flex w-[86vw] max-w-[320px] flex-col border-r border-border bg-card shadow-xl md:hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  History
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={startNewSession} title="New chat" aria-label="New chat">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSessionsPanelCollapsed(true)}
                    title="Close history"
                    aria-label="Close history"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </div>
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
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              'flex-1 overflow-y-auto transition-[padding] duration-200',
              sessionsPanelCollapsed ? 'px-2 py-2 md:px-2 md:py-3' : 'p-3 sm:p-4 md:p-6'
            )}
          >
            {isMobile && (
              <div className="mb-3 flex justify-start">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3"
                  onClick={() => setSessionsPanelCollapsed(false)}
                  aria-label="Open chat history"
                >
                  <PanelLeftOpen className="mr-1.5 h-4 w-4" />
                  History
                </Button>
              </div>
            )}
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
                      disabled={!isBackendReady || sending}
                      onClick={() => sendMessage(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  'flex w-full flex-col gap-6 transition-[max-width,margin] duration-200',
                  sessionsPanelCollapsed ? 'mx-0 max-w-none' : 'mx-auto max-w-3xl'
                )}
              >
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

          <div
            className={cn(
              'shrink-0 border-t border-border transition-[padding] duration-200',
              sessionsPanelCollapsed ? 'px-1 py-2 md:px-2 md:py-3' : 'p-4'
            )}
          >
            <div
              className={cn(
                'flex w-full gap-2 rounded-xl border border-input bg-background px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring transition-[max-width,margin] duration-200',
                sessionsPanelCollapsed ? 'mx-0 max-w-none' : 'mx-auto max-w-3xl'
              )}
            >
              <textarea
                ref={textareaRef}
                placeholder={
                  isBackendReady
                    ? 'Ask anything about elevator procedures...'
                    : 'System is initializing. Query input is disabled until backend is live.'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sending || !isBackendReady}
                className="min-h-[24px] flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                size="icon"
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending || !isBackendReady}
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
