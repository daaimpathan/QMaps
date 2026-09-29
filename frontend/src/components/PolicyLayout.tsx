import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const links = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/licenses', label: 'Licenses' },
];

export const PolicyLayout: React.FC<{ title: string; eyebrow: string; updated?: string; children: React.ReactNode }> = ({ title, eyebrow, updated = 'Updated 27 September 2026', children }) => (
  <main className="min-h-screen bg-sand-100 px-4 py-5 text-olive-950 sm:px-7 sm:py-8">
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-sand-300 pb-5">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-500">
          <Image src="/qmaps-route-mark.svg" alt="" width={38} height={38} priority className="rounded-xl" />
          <span className="font-serif text-lg font-semibold">QMaps</span>
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-olive-800 hover:text-olive-950"><ArrowLeft className="h-3.5 w-3.5" /> Back to the product</Link>
      </header>
      <article className="mx-auto max-w-3xl py-10 sm:py-14">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-olive-700">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-xs text-stone-500">{updated} · Product demo documentation</p>
        <div className="policy-copy mt-9 space-y-7">{children}</div>
      </article>
      <nav aria-label="Policy pages" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-sand-300 py-5 text-xs text-stone-500">
        {links.map((link) => <Link key={link.href} href={link.href} className="hover:text-olive-900">{link.label}</Link>)}
      </nav>
    </div>
  </main>
);
