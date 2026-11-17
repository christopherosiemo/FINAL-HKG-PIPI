'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowUpRight, Menu, X, ArrowRight } from 'lucide-react';
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="HKGpipi home">
      <span className="brand-crop">
        <img src="/brand-wordmark.webp" alt="HKGpipi" width="380" height="83" />
      </span>
    </Link>
  );
}
const nav = [
  ['Our method', '/method'],
  ['Engagements', '/savings-sprint'],
  ['Verification', '/verification'],
  ['Security', '/security'],
  ['Pricing', '/pricing'],
];
export function Header() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav aria-label="Main navigation" className={open ? 'site-nav is-open' : 'site-nav'}>
            {nav.map(([label, href]) => (
              <Link
                href={href}
                key={href}
                aria-current={path === href ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            <Link href="/login" className="nav-login" onClick={() => setOpen(false)}>
              Client login
            </Link>
          </nav>
          <Link className="button header-cta" href="/start">
            Start a Savings Sprint <ArrowUpRight size={16} />
          </Link>
          <button
            className="menu-toggle"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-top">
        <div>
          <div className="eyebrow">YOUR NEXT ENGINEERING DECISION</div>
          <h2>
            Find what is
            <br />
            worth changing.
          </h2>
        </div>
        <Link href="/start" className="button">
          Start your Savings Sprint <ArrowRight size={17} />
        </Link>
      </div>
      <div className="wrap footer-grid">
        <div>
          <Brand />
          <p>
            Engineering-led AWS cost reduction.
            <br />
            Measured against the bill.
          </p>
          <a href="mailto:enquiries@hkgpipi.com">enquiries@hkgpipi.com</a>
        </div>
        <div>
          <strong>Engagements</strong>
          <Link href="/savings-sprint">14-Day Savings Sprint</Link>
          <Link href="/implementation">Implementation Sprint</Link>
          <Link href="/pricing">Pricing & options</Link>
          <Link href="/start">Start an engagement</Link>
        </div>
        <div>
          <strong>Our approach</strong>
          <Link href="/method">Our method</Link>
          <Link href="/verification">Savings verification</Link>
          <Link href="/security">Security & AWS access</Link>
          <Link href="/faq">Frequently asked questions</Link>
        </div>
        <div>
          <strong>HKGpipi</strong>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Client portal</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms & checkout policies</Link>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© {new Date().getFullYear()} HKGpipi</span>
        <span>
          VISIBILITY <i /> OPTIMIZATION <i /> IMPACT
        </span>
      </div>
    </footer>
  );
}
