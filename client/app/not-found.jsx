import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="digit text-7xl font-black text-accent">404</p>
        <h1 className="mt-3 text-2xl font-extrabold">This page doesn’t exist</h1>
        <p className="mt-2 text-sm text-muted">It may have been moved, or the link is wrong.</p>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">Back to dashboard</Link>
      </div>
    </div>
  );
}
