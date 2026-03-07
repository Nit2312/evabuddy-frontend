'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { subscribeToProjects, subscribeToSessions, Project, ChatSession } from '@/lib/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderKanban, CheckCircle, MessageSquare, Bot, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeToProjects(user.uid, setProjects);
    const unsub2 = subscribeToSessions(user.uid, setSessions);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const totalChats = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    'on-hold': 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    completed: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    archived: 'bg-muted text-muted-foreground',
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-bold tracking-tight">
          {greeting()}, {firstName} 👋
        </h2>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s what&apos;s happening in your workspace today.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          { label: 'Total Projects', value: projects.length, icon: FolderKanban, color: 'bg-primary/10 text-primary' },
          { label: 'Active Projects', value: activeProjects, icon: CheckCircle, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
          { label: 'Chat Sessions', value: sessions.length, icon: MessageSquare, color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
          { label: 'AI Queries', value: totalChats, icon: Bot, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
        ].map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-row items-center gap-4 p-6">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 lg:grid-cols-2"
      >
        <motion.div variants={item}>
          <Card className="rounded-xl transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">Recent Projects</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/projects" className="text-primary text-sm">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderKanban className="mb-2 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No projects yet</p>
                  <Button variant="secondary" size="sm" className="mt-3" asChild>
                    <Link href="/dashboard/projects">Create project</Link>
                  </Button>
                </div>
              ) : (
                <ul className="space-y-1">
                  {projects.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/dashboard/projects/${p.id}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color || 'var(--primary)' }}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[p.status] ?? statusColors.archived}`}>
                          {p.status}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="rounded-xl transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">AI Copilot Sessions</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/copilot" className="text-primary text-sm">
                  Open <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bot className="mb-2 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No chats yet</p>
                  <Button size="sm" className="mt-3" asChild>
                    <Link href="/dashboard/copilot">Start chatting</Link>
                  </Button>
                </div>
              ) : (
                <ul className="space-y-1">
                  {sessions.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/dashboard/copilot?session=${s.id}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{s.title || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">{s.messageCount ?? 0} messages</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={item}>
        <Card className="overflow-hidden rounded-xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold">🤖 AI Copilot is ready</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask anything about elevator procedures, case history, faults, and more. Powered by semantic search + RAG.
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/dashboard/copilot">Open Copilot →</Link>
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
