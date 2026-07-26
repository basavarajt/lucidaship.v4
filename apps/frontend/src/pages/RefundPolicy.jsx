import React from 'react';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
};

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden pb-32">
      {/* ── Dynamic Ambient Glow ── */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/30 blur-[150px] rounded-full mix-blend-screen pointer-events-none"></div>
      
      {/* ── Navbar ── */}
      <nav className="relative z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <RouterLink to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 border border-blue-500/50 flex items-center justify-center font-mono text-[0.8rem] text-blue-400 group-hover:bg-blue-500/10 transition-colors rounded-sm relative overflow-hidden">
                <span className="relative z-10">L</span>
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <span className="font-serif font-semibold text-xl tracking-wide text-gray-100">
                Lucida<span className="text-blue-500 font-light">Analytics</span><span className="text-gray-500">.tech</span>
              </span>
            </RouterLink>
            <RouterLink to="/" className="font-mono text-[0.75rem] tracking-[0.15em] uppercase text-gray-400 hover:text-white transition-colors">
              Back to Home
            </RouterLink>
          </div>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
          <h1 className="text-4xl md:text-5xl font-serif font-light mb-4 text-white">Refund & Cancellation Policy</h1>
          <p className="text-gray-400 font-mono text-sm tracking-wider uppercase mb-12">Last Updated: July 2, 2026</p>

          <div className="space-y-8 text-gray-300 font-light leading-relaxed">
            
            <p className="mb-4">
              This Refund & Cancellation Policy applies to all subscriptions and purchases made through <strong>Lucida Analytics</strong> ("the Service"), operated by <strong>Basavaraj Kareppa Talikoti</strong>, Pune, Maharashtra, India.
            </p>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">1. Subscription Plans</h2>
              <p className="mb-4">
                Lucida Analytics offers paid subscription plans, billed on a recurring basis (monthly/annual, as selected at checkout) through our payment processor, <strong>Dodo Payments</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">2. Cancellations</h2>
              <ul className="list-disc pl-5 mb-4 space-y-2">
                <li>You may cancel your subscription at any time from your account settings, or by contacting us at <strong>support@lucidaanalytics.tech</strong>.</li>
                <li>Cancellation stops all <strong>future</strong> billing. You will continue to have access to the Service until the end of your current billing cycle.</li>
                <li>No partial refunds are issued for unused time within a billing cycle upon cancellation, except as described below.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">3. Refunds</h2>
              <ul className="list-disc pl-5 mb-4 space-y-2">
                <li><strong>Free trial users:</strong> If a free trial is offered, no charges apply until the trial ends and you are converted to a paid plan; you will be notified before any such conversion where required.</li>
                <li><strong>Paid subscriptions:</strong> Fees already charged are generally <strong>non-refundable</strong>, except in the following cases:
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-400">
                    <li>A duplicate or erroneous charge caused by a technical error on our end</li>
                    <li>A service outage that materially prevented you from using the Service for an extended period, at our sole discretion</li>
                    <li>As otherwise required under applicable Indian consumer protection law</li>
                  </ul>
                </li>
                <li>Refund requests must be submitted within <strong>7 days</strong> of the charge to <strong>support@lucidaanalytics.tech</strong>, including your account email and transaction details.</li>
                <li>Approved refunds will be processed back to the original payment method via Dodo Payments within <strong>7–10 business days</strong>.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">4. Failed Payments</h2>
              <p className="mb-4">
                If a recurring payment fails (e.g., expired card, insufficient funds), we may retry the charge and/or suspend access to paid features until payment is resolved. We will notify you by email before suspending your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">5. Changes to Plans</h2>
              <p className="mb-4">
                If you upgrade or downgrade your subscription plan, billing adjustments (prorated charges or credits) will be handled automatically through Dodo Payments at the time of the change.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">6. Contact Us</h2>
              <p className="mb-2">For any billing, cancellation, or refund questions, contact:</p>
              <address className="not-italic text-sm bg-white/5 border border-white/10 p-4 rounded-lg text-gray-400">
                <strong>Lucida Analytics</strong><br />
                Basavaraj Kareppa Talikoti<br />
                Pune, Maharashtra, India<br />
                Email: <a href="mailto:support@lucidaanalytics.tech" className="text-blue-400 hover:underline">support@lucidaanalytics.tech</a>
              </address>
            </section>

          </div>
        </motion.div>
      </main>
    </div>
  );
}
