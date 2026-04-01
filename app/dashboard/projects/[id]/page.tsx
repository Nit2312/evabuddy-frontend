'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Project, Task, subscribeToProjects, subscribeToTasks, createTask, updateTask, deleteTask } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, CheckSquare, Check, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToProjects(user.uid, (projects) => {
      setProject(projects.find((p) => p.id === id) || null);
    });
    return unsub;
  }, [user, id]);

  useEffect(() => {
    return subscribeToTasks(id, setTasks);
  }, [id]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !user) return;
    setAddingTask(true);
    try {
      await createTask(id, user.uid, { title: newTaskTitle.trim(), status: 'todo', priority: 'medium' });
      setNewTaskTitle('');
      setShowInput(false);
    } finally {
      setAddingTask(false);
    }
  };

  const toggleTask = async (task: Task) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    await updateTask(task.id, { status: next });
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
  };

  const done = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  const statusClass: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    'on-hold': 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    completed: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    archived: 'bg-muted text-muted-foreground',
  };
  const priorityClass: Record<string, string> = {
    high: 'bg-red-500/20 text-red-600 dark:text-red-400',
    medium: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    low: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <span className="text-sm text-muted-foreground">Loading project...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/projects" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="mr-1 h-4 w-4" /> Projects
          </Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{project.name}</span>
      </div>

      <Card className="overflow-hidden rounded-xl">
        <div className="flex gap-3 p-4 sm:gap-4 sm:p-6">
          <div className="h-full w-1 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{project.name}</h2>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusClass[project.status])}>
                {project.status}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {project.priority} priority
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {tasks.length} tasks
              </span>
            </div>
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="border-t border-border px-6 pb-6 pt-4">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{done}/{tasks.length} done ({progress}%)</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Tasks</h3>
        <Button variant="secondary" size="sm" onClick={() => setShowInput(!showInput)}>
          <Plus className="mr-1 h-4 w-4" /> Add Task
        </Button>
      </div>

      {showInput && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Task title..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTask();
              if (e.key === 'Escape') setShowInput(false);
            }}
            className="rounded-lg"
            autoFocus
          />
          <Button
            onClick={handleAddTask}
            disabled={addingTask || !newTaskTitle.trim()}
            className="sm:w-auto"
          >
            {addingTask ? '...' : 'Add'}
          </Button>
        </div>
      )}

      {tasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center rounded-xl py-12">
          <CardContent className="flex flex-col items-center gap-2 text-center">
            <CheckSquare className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No tasks yet</p>
            <p className="text-sm text-muted-foreground">Add tasks to track your project&apos;s progress.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:border-border/80 sm:flex-nowrap sm:gap-3 sm:px-4"
            >
              <button
                type="button"
                onClick={() => toggleTask(task)}
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                  task.status === 'done'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30 hover:border-primary/50'
                )}
                aria-label={task.status === 'done' ? 'Mark incomplete' : 'Mark done'}
              >
                {task.status === 'done' && <Check className="h-3 w-3" />}
              </button>
              <span
                className={cn(
                  'min-w-0 flex-1 text-sm',
                  task.status === 'done' && 'text-muted-foreground line-through'
                )}
              >
                {task.title}
              </span>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', priorityClass[task.priority] ?? priorityClass.medium)}>
                {task.priority}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDeleteTask(task.id)}
                title="Delete task"
                aria-label="Delete task"
                className="ml-auto text-muted-foreground hover:text-destructive sm:ml-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
