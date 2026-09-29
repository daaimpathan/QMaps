'use client';

import React from 'react';
import Image from 'next/image';
import { BarChart3, Home, MapPin, RefreshCw, Shield, Truck } from 'lucide-react';
import type { AppSection } from './HomeLanding';

interface NavbarProps {
  currentSection: AppSection;
  onNavigate: (section: AppSection) => void;
  isBackendConnected: boolean;
  onRefreshData?: () => void;
}

const navigation: { id: AppSection; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Overview', icon: Home },
  { id: 'admin', label: 'Dispatch desk', icon: Shield },
  { id: 'driver', label: 'Driver view', icon: Truck },
  { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
];

export const Navbar: React.FC<NavbarProps> = ({ currentSection, onNavigate, isBackendConnected, onRefreshData }) => (
  <header className="sticky top-0 z-[1000] border-b border-sand-300/90 bg-[#fbf9f2]/95 text-olive-950 backdrop-blur-xl">
    <div className="mx-auto flex min-h-[4.35rem] max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-2 sm:px-7 lg:px-10">
      <button onClick={() => onNavigate('home')} className="group flex items-center gap-2.5 text-left" aria-label="QMaps overview">
        <Image src="/qmaps-route-mark.svg" alt="" width={42} height={42} priority className="rounded-[13px] shadow-sm transition-transform group-hover:-rotate-3" />
        <span>
          <span className="block font-serif text-[19px] font-semibold leading-5 tracking-tight">QMaps</span>
          <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-stone-500"><MapPin className="h-3 w-3 text-olive-700" /> Navi Mumbai operations</span>
        </span>
      </button>

      <nav aria-label="Main navigation" className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onNavigate(id)} aria-current={currentSection === id ? 'page' : undefined}
            className={`relative inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-500 ${currentSection === id ? 'bg-olive-100 text-olive-950' : 'text-stone-600 hover:bg-sand-100 hover:text-olive-950'}`}>
            <Icon className="h-3.5 w-3.5" />{label}
            {currentSection === id && <span className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-olive-600" />}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2.5">
        {onRefreshData && (currentSection === 'admin' || currentSection === 'driver') && (
          <button onClick={onRefreshData} title="Reset to preset dispatch data" aria-label="Reset to preset dispatch data" className="rounded-lg border border-sand-300 bg-white p-2 text-stone-600 transition hover:border-olive-400 hover:bg-olive-50 hover:text-olive-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-olive-500">
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        <span className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white/80 px-2.5 py-1.5 text-[10px] font-semibold text-stone-600 sm:text-[11px]" aria-live="polite">
          <span className={`h-1.5 w-1.5 rounded-full ${isBackendConnected ? 'bg-olive-600' : 'bg-amber-500'}`} />
          <span className="hidden sm:inline">{isBackendConnected ? 'API connected' : 'API offline'}</span>
        </span>
      </div>
    </div>
  </header>
);
