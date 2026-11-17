'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="system-page">
      <div>
        <div className="eyebrow">SOMETHING INTERRUPTED THIS REQUEST</div>
        <h1>Please try again.</h1>
        <p>The page could not be completed. Your saved engagement data is retained.</p>
        <button onClick={reset} className="button">
          Try again
        </button>{' '}
        <Link href="/contact" className="button button-secondary">
          Contact HKGpipi
        </Link>
      </div>
    </main>
  );
}
