import Link from 'next/link';
import Image from 'next/image';
export function AccountNav() {
  return (
    <nav className="account-nav" aria-label="Account navigation">
      <Link href="/" aria-label="HKGpipi home">
        <Image
          src="/brand-wordmark.webp"
          width={172}
          height={52}
          alt="HKGpipi"
          style={{ width: 172, height: 'auto' }}
        />
      </Link>
      <Link href="/">← Return to website</Link>
    </nav>
  );
}
