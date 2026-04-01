'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSaveProfile = async () => {
    if (!name.trim() || !auth.currentUser) return;
    setSaving(true);
    setError('');
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const initials = (user?.displayName || user?.email || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6 lg:p-8">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name and view account info.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xl font-semibold text-primary">
              {initials}
            </div>
            <div>
              <p className="font-medium">{user?.displayName || 'User'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
              Profile saved!
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email || ''}
              disabled
              className="cursor-not-allowed rounded-lg opacity-70"
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving || !name.trim()} className="w-full">
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Provider</p>
              <p className="text-xs text-muted-foreground">
                {user?.providerData?.[0]?.providerId === 'google.com' ? '🔵 Google' : '📧 Email / Password'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">UID</p>
              <p className="break-all font-mono text-xs text-muted-foreground">{user?.uid}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Actions here cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout} className="w-full">
            Sign out of OpsCopilot
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
