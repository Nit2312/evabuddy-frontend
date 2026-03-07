'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Project,
  createProject,
  deleteProject,
  subscribeToProjects,
  updateProject,
} from '@/lib/firestore';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FolderKanban, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f87171'];

const statusOptions = ['active', 'on-hold', 'completed', 'archived'] as const;
const priorityOptions = ['low', 'medium', 'high'] as const;

interface ModalState {
  open: boolean;
  editing: Project | null;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [modal, setModal] = useState<ModalState>({ open: false, editing: null });
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active' as Project['status'],
    priority: 'medium' as Project['priority'],
    color: PROJECT_COLORS[0],
  });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!user) return;
    return subscribeToProjects(user.uid, setProjects);
  }, [user]);

  const openCreate = () => {
    setForm({ name: '', description: '', status: 'active', priority: 'medium', color: PROJECT_COLORS[0] });
    setModal({ open: true, editing: null });
  };

  const openEdit = (p: Project) => {
    setForm({ name: p.name, description: p.description, status: p.status, priority: p.priority, color: p.color });
    setModal({ open: true, editing: p });
  };

  const closeModal = () => setModal({ open: false, editing: null });

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);
    try {
      if (modal.editing) {
        await updateProject(modal.editing.id, form);
      } else {
        await createProject(user.uid, form);
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project and all its tasks?')) return;
    await deleteProject(id);
  };

  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter);

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

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {['all', ...statusOptions].map((s) => (
            <Button
              key={s}
              variant={filter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
        <Button onClick={openCreate}>+ New Project</Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center rounded-xl py-16">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-semibold">No projects yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filter === 'all' ? 'Create your first project to get started.' : `No ${filter} projects found.`}
              </p>
            </div>
            {filter === 'all' && (
              <Button onClick={openCreate}>+ Create Project</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden rounded-xl transition-shadow hover:shadow-md">
              <div className="h-1 shrink-0" style={{ backgroundColor: p.color }} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} title="Edit" aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(p.id)} title="Delete" aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {p.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusClass[p.status])}>
                      {p.status}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', priorityClass[p.priority])}>
                      {p.priority}
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/dashboard/projects/${p.id}`}>
                      View <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modal.open} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{modal.editing ? 'Edit Project' : 'New Project'}</DialogTitle>
            <DialogDescription>
              {modal.editing ? 'Update project details.' : 'Create a new project.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="My awesome project"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="What is this project about?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as Project['priority'] })}
                >
                  {priorityOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform',
                      form.color === c ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : modal.editing ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
