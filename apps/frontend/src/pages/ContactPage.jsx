import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <RouterLink
          to="/"
          className="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-dim transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Lucida
        </RouterLink>

        <section className="mt-16 border border-line bg-surface/40 p-8 sm:p-12">
          <div className="mb-7 flex h-12 w-12 items-center justify-center border border-accent/50 bg-accent/10 text-accent">
            <Mail className="h-5 w-5" />
          </div>

          <div className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-accent">
            Contact
          </div>
          <h1 className="mt-5 font-serif text-5xl font-light leading-tight text-white sm:text-6xl">
            Talk to Lucida.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-light">
            For product questions, account help, billing, privacy requests, or business inquiries, reach us at the official Lucida support email.
          </p>

          <a
            href="mailto:support@lucidaanalytics.tech"
            className="mt-10 inline-flex items-center gap-3 border border-accent bg-accent px-6 py-4 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-black transition-colors hover:bg-white"
          >
            <Mail className="h-4 w-4" />
            support@lucidaanalytics.tech
          </a>
        </section>
      </div>
    </main>
  );
}
