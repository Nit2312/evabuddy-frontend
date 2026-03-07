import { redirect } from 'next/navigation';

// Root path: redirect to dashboard
export default function RootPage() {
  redirect('/dashboard');
}
