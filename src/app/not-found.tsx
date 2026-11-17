import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="system-page" id="main-content">
      <div>
        <div className="eyebrow">404 / PAGE NOT FOUND</div>
        <h1>
          Let’s get you
          <br />
          back on course.
        </h1>
        <p>This page could not be found. Explore HKGpipi’s method or return to your engagement.</p>
        <Link href="/" className="button">
          Back to HKGpipi
        </Link>{' '}
        <Link href="/portal" className="button button-secondary">
          Client portal
        </Link>
      </div>
    </main>
  );
}
