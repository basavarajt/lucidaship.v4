import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Layers,
  Link as LinkIcon,
  Mail,
  Sparkles,
  Star,
  User,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';

const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.14 },
  },
};

const featureCards = [
  {
    index: '01',
    title: 'Upload Any Schema',
    body: 'Lucida accepts messy CSVs from CRMs, forms, ads, webinars, and spreadsheets, then detects useful signal without manual mapping.',
    tags: ['Auto-detect', 'CSV ready'],
  },
  {
    index: '02',
    title: 'Train on Your Wins',
    body: 'The model learns from your own won and lost deals, so the score reflects the buying patterns that actually matter to your team.',
    tags: ['Predictive', 'Custom model'],
  },
  {
    index: '03',
    title: 'Score Every Lead',
    body: 'New prospects return ranked by conversion probability, with the strongest accounts separated from the noise in seconds.',
    tags: ['Ranking', 'Exportable'],
  },
];

const plans = [
  {
    name: 'Free',
    subtitle: 'First proof run',
    price: '$0',
    highlight: true,
    items: ['1 full lead ranking', 'Train 1 custom ML model', 'Export top 100 ranked leads', 'No credit card required'],
  },
  {
    name: 'Starter',
    subtitle: 'Growing sales teams',
    price: '$299',
    items: ['1 CRM workflow', 'Up to 10,000 leads/mo', 'Email support', 'Accuracy metrics'],
  },
  {
    name: 'Pro',
    subtitle: 'Scaling departments',
    price: '$799',
    popular: true,
    items: ['2-3 workflows', 'Up to 25,000 leads/mo', 'API access', 'Priority support'],
  },
  {
    name: 'Scale',
    subtitle: 'Enterprise operations',
    price: '$1,999',
    items: ['Unlimited leads', 'Custom model tuning', 'Dedicated account manager', 'SLA options'],
  },
];

const testimonials = [
  {
    name: 'Sarah Jenkins',
    role: 'VP of Sales',
    quote:
      "We threw out our old lead scoring rules on day two. Lucida found the accounts our reps should have been calling first.",
  },
  {
    name: 'David Chen',
    role: 'RevOps Lead',
    quote:
      'The ranked output was spot on. My SDRs stopped working lists in arrival order and finally had a clear call priority.',
  },
  {
    name: 'Elena Rodriguez',
    role: 'Head of Data',
    quote:
      'The model training is shockingly fast compared to tools we tried before, and the ranking accuracy makes the workflow worth it.',
  },
];

function LeadScoringAnimation() {
  const [leads, setLeads] = useState([]);
  const [counts, setCounts] = useState({ scanned: 0, filtered: 0, qualified: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);

    updateMotion();
    media.addEventListener('change', updateMotion);

    return () => media.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setCounts({ scanned: 1204, filtered: 812, qualified: 392 });
      setLeads([
        { id: 'static-1', score: 91, qualifies: true, y: 24, phase: 'settled' },
        { id: 'static-2', score: 76, qualifies: true, y: 58, phase: 'settled' },
        { id: 'static-3', score: 43, qualifies: false, y: 42, phase: 'settled' },
      ]);
      return undefined;
    }

    let id = 0;
    const spawnLead = () => {
      const score = Math.floor(Math.random() * 100);
      const lead = {
        id: `${Date.now()}-${id++}`,
        score,
        qualifies: score >= 70,
        y: 16 + Math.random() * 68,
        exitX: 40 + Math.random() * 6,
        phase: 'incoming',
      };

      setLeads((current) => [...current.slice(-9), lead]);
      setCounts((current) => ({ ...current, scanned: current.scanned + 1 }));

      window.setTimeout(() => {
        setLeads((current) =>
          current.map((item) => (item.id === lead.id ? { ...item, phase: 'decision' } : item))
        );
      }, 80);

      window.setTimeout(() => {
        setLeads((current) =>
          current.map((item) => (item.id === lead.id ? { ...item, phase: 'resolved' } : item))
        );
      }, 1300);

      window.setTimeout(() => {
        setCounts((current) => ({
          ...current,
          filtered: current.filtered + (lead.qualifies ? 0 : 1),
          qualified: current.qualified + (lead.qualifies ? 1 : 0),
        }));
        setLeads((current) => current.filter((item) => item.id !== lead.id));
      }, 3700);
    };

    spawnLead();
    const interval = window.setInterval(spawnLead, 520);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const positionFor = (lead) => {
    if (lead.phase === 'settled') {
      return lead.qualifies
        ? { left: '88%', top: `${lead.y}%`, opacity: 1 }
        : { left: '42%', top: `${lead.y + 18}%`, opacity: 0.35 };
    }

    if (lead.phase === 'incoming') {
      return { left: '-4%', top: `${lead.y}%`, opacity: 0.9 };
    }

    if (lead.phase === 'decision') {
      return { left: '50%', top: `${lead.y}%`, opacity: 1 };
    }

    return lead.qualifies
      ? { left: '88%', top: `${lead.y}%`, opacity: 1 }
      : { left: `${lead.exitX}%`, top: '108%', opacity: 0 };
  };

  return (
    <div className="relative h-[420px] overflow-hidden border border-line bg-deep shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(200,169,110,0.12),transparent_58%)]" />
      <div className="relative flex items-center justify-between border-b border-line px-5 py-4 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-dim">
        <span>live scoring feed</span>
        <span className="flex items-center gap-2 text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          streaming
        </span>
      </div>

      <div className="relative h-[calc(100%-100px)]">
        <div className="absolute bottom-0 top-0 left-[52%] w-px bg-gradient-to-b from-transparent via-muted to-transparent" />
        <div className="absolute left-[52%] top-3 -translate-x-1/2 bg-deep px-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-dim">
          score &gt;= 70
        </div>
        <div className="absolute bottom-3 left-4 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
          filtered
        </div>
        <div className="absolute bottom-3 right-4 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-accent">
          qualified
        </div>

        {leads.map((lead) => {
          const pos = positionFor(lead);
          const active = lead.qualifies && (lead.phase === 'resolved' || lead.phase === 'settled');

          return (
            <motion.div
              key={lead.id}
              animate={pos}
              transition={{ duration: 1.15, ease: [0.4, 0, 0.2, 1] }}
              className={`absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full ${
                active ? 'bg-accent shadow-[0_0_14px_rgba(200,169,110,0.65)]' : 'bg-dim shadow-[0_0_0_4px_rgba(136,136,136,0.08)]'
              }`}
            >
              <span
                className={`absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[0.62rem] ${
                  active ? 'text-accent' : 'text-dim'
                }`}
              >
                {lead.score}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="relative grid grid-cols-3 border-t border-line px-5 py-4 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-dim">
        <span>
          scanned <b className="ml-1 text-sm font-medium text-white">{counts.scanned.toLocaleString()}</b>
        </span>
        <span className="text-center">
          filtered <b className="ml-1 text-sm font-medium text-white">{counts.filtered.toLocaleString()}</b>
        </span>
        <span className="text-right">
          qualified <b className="ml-1 text-sm font-medium text-accent">{counts.qualified.toLocaleString()}</b>
        </span>
      </div>
    </div>
  );
}

function SectionHeading({ number, eyebrow, children }) {
  return (
    <div className="mb-16 flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end">
      <span className="font-serif text-[4.5rem] font-light leading-none text-white/10">{number}</span>
      <h2 className="max-w-3xl font-serif text-4xl font-light leading-tight text-white sm:text-5xl">{children}</h2>
      {eyebrow && (
        <div className="sm:ml-auto pb-2 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-accent">
          {eyebrow}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white selection:bg-accent/30">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_74%_18%,rgba(200,169,110,0.11),transparent_42%),radial-gradient(ellipse_at_18%_82%,rgba(240,237,232,0.045),transparent_34%)]" />

      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="sticky top-0 z-50 border-b border-line bg-black/85 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <RouterLink to="/" className="group flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgba(200,169,110,0.55)]" />
            <span className="font-serif text-2xl font-semibold tracking-[0.08em] text-white">
              LUCIDA<span className="text-accent">.</span>
            </span>
          </RouterLink>

          <div className="hidden items-center gap-9 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-dim md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it Works</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
            <a href="#about" className="transition-colors hover:text-white">About</a>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <RouterLink to="/rank" className="hidden font-mono text-[0.7rem] uppercase tracking-[0.14em] text-accent transition-colors hover:text-white sm:inline">
              Rank Your List
            </RouterLink>
            <RouterLink to="/login" className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-dim transition-colors hover:text-white">
              Log in
            </RouterLink>
            <RouterLink to="/register" className="hidden border border-accent px-5 py-2.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent hover:text-black sm:inline-flex">
              Get Started
            </RouterLink>
          </div>
        </div>
      </motion.nav>

      <header className="relative z-10 border-b border-line">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-28">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            <motion.div variants={fadeInUp} className="mb-7 flex items-center gap-3 font-mono text-[0.68rem] uppercase tracking-[0.24em] text-accent">
              <span className="h-px w-8 bg-accent" />
              AI lead scoring
            </motion.div>

            <motion.h1 variants={fadeInUp} className="max-w-4xl font-serif text-5xl font-light leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-[5.5rem]">
              Stop chasing leads that were <em className="text-accent">never</em> going to buy.
            </motion.h1>

            <motion.p variants={fadeInUp} className="mt-7 max-w-xl text-base leading-8 text-light sm:text-lg">
              Lucida scores every inbound lead the moment it arrives, so your team works the accounts most likely to close instead of a list sorted by arrival time.
            </motion.p>

            <motion.div variants={fadeInUp} className="mt-10 flex flex-col gap-4 sm:flex-row">
              <RouterLink to="/rank" className="inline-flex items-center justify-center gap-3 bg-accent px-8 py-4 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-black transition-all hover:-translate-y-0.5 hover:bg-white">
                Rank Your First List
                <ArrowRight className="h-4 w-4" />
              </RouterLink>
              <a href="#features" className="inline-flex items-center justify-center border border-line px-8 py-4 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-light transition-colors hover:border-accent hover:text-white">
                Watch the Model Work
              </a>
            </motion.div>

            <motion.div variants={fadeInUp} className="mt-12 grid max-w-lg grid-cols-2 gap-8 font-mono text-[0.72rem] uppercase tracking-[0.08em] text-dim">
              <div><b className="block font-serif text-3xl font-light normal-case tracking-normal text-white">68%</b> less time on dead leads</div>
              <div><b className="block font-serif text-3xl font-light normal-case tracking-normal text-white">3.4x</b> reply rate on top scores</div>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.25 }}>
            <LeadScoringAnimation />
          </motion.div>
        </div>
      </header>

      <div className="relative z-10 overflow-hidden border-b border-line bg-white/[0.015] py-6">
        <div className="flex min-w-max gap-16 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-dim animate-[marquee_34s_linear_infinite]">
          {[...Array(3)].map((_, index) => (
            <React.Fragment key={index}>
              <span className="flex items-center gap-4"><Sparkles className="h-3 w-3 text-accent" /> Predictive analytics</span>
              <span className="flex items-center gap-4"><Activity className="h-3 w-3 text-accent" /> Unsupervised ranking</span>
              <span className="flex items-center gap-4"><Layers className="h-3 w-3 text-accent" /> Automated ML pipelines</span>
              <span className="flex items-center gap-4"><Zap className="h-3 w-3 text-accent" /> Instant scoring</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <section id="features" className="relative z-10 border-b border-line py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading number="01" eyebrow="Platform Capabilities">
            One model, three jobs.
          </SectionHeading>

          <div className="grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-3">
            {featureCards.map((card) => (
              <motion.div
                key={card.title}
                whileHover={{ backgroundColor: 'rgba(200,169,110,0.035)' }}
                className="group bg-black p-8 transition-colors sm:p-10"
              >
                <div className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-accent">{card.index}</div>
                <h3 className="mt-5 font-serif text-2xl font-light text-white">{card.title}</h3>
                <p className="mt-4 text-sm leading-7 text-dim">{card.body}</p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <span key={tag} className="border border-line px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-light group-hover:border-accent/40">
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 border-b border-line py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading number="02">Three steps to better leads.</SectionHeading>

          <div className="grid gap-6 md:grid-cols-3">
            {['Upload your CSV', 'Train your model', 'Score and prioritize'].map((step, index) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: index * 0.12 }}
                className="border border-line bg-surface/50 p-8 transition-colors hover:border-accent/40"
              >
                <div className="mb-6 flex h-11 w-11 items-center justify-center border border-accent/50 bg-accent/10 font-mono text-accent">
                  {index + 1}
                </div>
                <h3 className="font-serif text-2xl font-light text-white">{step}</h3>
                <p className="mt-4 text-sm leading-7 text-dim">
                  {index === 0 && 'Bring historical wins, losses, or fresh prospect files. Lucida adapts to the shape of your data.'}
                  {index === 1 && 'The pipeline prepares features, balances classes, and trains a scoring model around your actual conversion pattern.'}
                  {index === 2 && 'Upload new leads and get a ranked list your sales team can work immediately or export into the CRM.'}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative z-10 border-b border-line bg-white/[0.012] py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading number="03" eyebrow="Outcome Based">
            B2B pricing without the enterprise theater.
          </SectionHeading>

          <div className="mb-12 border border-accent/40 bg-accent/10 p-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 border border-accent/40 px-4 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              No credit card required
            </div>
            <h3 className="font-serif text-3xl font-light text-white">Your first lead ranking is completely free.</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-light">
              Upload your CSV, train a custom ML model, and export your top 100 ranked leads before choosing a plan.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative border p-7 ${
                  plan.highlight ? 'border-accent bg-accent/10 shadow-[0_0_40px_rgba(200,169,110,0.12)]' : 'border-line bg-black'
                }`}
              >
                {plan.popular && (
                  <div className="absolute right-4 top-4 bg-accent px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-black">
                    Most Popular
                  </div>
                )}
                <div className="font-serif text-2xl font-light text-white">{plan.name}</div>
                <div className="mt-1 min-h-10 text-sm text-dim">{plan.subtitle}</div>
                <div className="mt-6">
                  <span className="font-serif text-4xl font-light text-white">{plan.price}</span>
                  {plan.name !== 'Free' && <span className="ml-2 text-sm text-dim">/month</span>}
                </div>
                <ul className="mt-7 space-y-3 text-sm text-light">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
                <RouterLink
                  to="/register"
                  className={`mt-8 flex w-full items-center justify-center px-4 py-3 text-sm font-medium transition-colors ${
                    plan.highlight ? 'bg-accent text-black hover:bg-white' : 'border border-line text-white hover:border-accent hover:text-accent'
                  }`}
                >
                  {plan.name === 'Free' ? 'Rank My Leads Free' : 'Get Started'}
                </RouterLink>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="relative z-10 border-b border-line py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading number="04" eyebrow="Our Mission">
            Clarify through data.
          </SectionHeading>

          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6 text-base leading-8 text-dim">
              <p>
                Lucida was built on a simple belief: every sales team deserves ML-powered lead scoring without hiring a data science department.
              </p>
              <p>
                Upload your data and the adaptive engine handles feature engineering, model training, scoring, and actionable recommendations.
              </p>
              <p>
                For product support or business questions, contact us at{' '}
                <a href="mailto:support@lucidaanalytics.tech" className="text-accent transition-colors hover:text-white">
                  support@lucidaanalytics.tech
                </a>
                .
              </p>
              <div className="grid gap-4 pt-6 sm:grid-cols-3">
                {['0 config required', 'Any CSV schema', 'ML powered ranking'].map((metric) => (
                  <div key={metric} className="border border-line bg-surface/40 p-5">
                    <div className="font-serif text-3xl font-light text-white">{metric.split(' ')[0]}</div>
                    <div className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-dim">{metric.split(' ').slice(1).join(' ')}</div>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="border border-line bg-black p-8"
            >
              <div className="mb-8 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-accent">Founder</div>
              <div className="mb-8 flex items-start gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-accent/50 bg-accent/10">
                  <User className="h-7 w-7 text-accent" />
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-light text-white">Basavaraj Kareppa Talikot</h3>
                  <div className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-dim">Founder & CEO</div>
                </div>
              </div>
              <p className="mb-8 text-sm leading-7 text-dim">
                Building Lucida to make predictive lead scoring practical for teams that want clarity without technical drag.
              </p>
              <a
                href="mailto:support@lucidaanalytics.tech"
                className="mb-4 inline-flex items-center gap-3 border border-line px-5 py-3 font-mono text-[0.68rem] uppercase tracking-[0.13em] text-light transition-colors hover:border-accent hover:text-accent"
              >
                <Mail className="h-4 w-4" />
                support@lucidaanalytics.tech
              </a>
              <a
                href="https://www.linkedin.com/in/basavaraj-talikoti-lucida"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 border border-accent/40 px-5 py-3 font-mono text-[0.68rem] uppercase tracking-[0.13em] text-accent transition-colors hover:bg-accent hover:text-black"
              >
                <LinkIcon className="h-4 w-4" />
                Connect on LinkedIn
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-b border-line bg-white/[0.012] py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="font-serif text-4xl font-light text-white sm:text-5xl">
              Winning with <em className="text-accent">LucidaAnalytics.tech</em>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-light">
              Modern sales teams use Lucida to rank leads, focus effort, and increase win rates.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((item) => (
              <div key={item.name} className="flex flex-col border border-line bg-black p-7 transition-colors hover:border-accent/40">
                <div className="mb-5 flex gap-1 text-accent">
                  {[...Array(5)].map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="flex-1 text-sm leading-7 text-light">"{item.quote}"</p>
                <div className="mt-8">
                  <div className="font-serif text-lg text-white">{item.name}</div>
                  <div className="font-mono text-[0.62rem] uppercase tracking-[0.15em] text-dim">{item.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto max-w-7xl px-4 py-28 text-center sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <h2 className="font-serif text-5xl font-light text-white sm:text-6xl">
            Give your sales team a <em className="text-accent">list worth working.</em>
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-light">
            Bring your CSV files and let Lucida find the highest-value prospects.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <RouterLink to="/register" className="inline-flex items-center justify-center gap-3 bg-accent px-8 py-4 font-medium text-black transition-colors hover:bg-white">
              Create Your Workspace
              <ArrowRight className="h-4 w-4" />
            </RouterLink>
            <RouterLink to="/login" className="inline-flex items-center justify-center border border-line px-8 py-4 text-white transition-colors hover:border-accent hover:text-accent">
              Sign In
            </RouterLink>
          </div>
        </motion.div>

        <div className="mt-24 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-dim md:flex-row">
          <div>© 2026 LucidaAnalytics.tech</div>
          <div className="flex flex-wrap justify-center gap-5">
            <a href="#about" className="transition-colors hover:text-white">About</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
            <RouterLink to="/terms" className="transition-colors hover:text-white">Terms</RouterLink>
            <RouterLink to="/privacy" className="transition-colors hover:text-white">Privacy</RouterLink>
            <RouterLink to="/refund" className="transition-colors hover:text-white">Refunds</RouterLink>
            <RouterLink to="/contact" className="transition-colors hover:text-white">Contact</RouterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
