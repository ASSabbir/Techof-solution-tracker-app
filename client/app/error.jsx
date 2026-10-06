'use client';

export default function GlobalError({ reset }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-extrabold">Something went wrong.</h1>
        <p className="mt-2 text-sm text-muted">Please try again.</p>
        <button onClick={reset} className="btn-primary mt-6">Try again</button>
      </div>
    </div>
  );
}
