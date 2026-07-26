import React from 'react';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
};

export default function PrivacyPolicy() {
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
          <h1 className="text-4xl md:text-5xl font-serif font-light mb-4 text-white">Privacy Policy</h1>
          <p className="text-gray-400 font-mono text-sm tracking-wider uppercase mb-12">Last Updated: July 2, 2026</p>

          <div className="space-y-8 text-gray-300 font-light leading-relaxed">
            
            <section>
              <h2 className="text-2xl font-serif text-white mb-4">1. Who We Are</h2>
              <p className="mb-4">
                Lucida Analytics ("the Service") is operated by <strong>Basavaraj Kareppa Talikoti</strong>, a sole proprietor based in Pune, Maharashtra, India ("Operator," "we," "us," or "our"). This Privacy Policy explains how we collect, use, store, and protect your data, including uploaded Lead Data.
              </p>
              <address className="not-italic text-sm bg-white/5 border border-white/10 p-4 rounded-lg">
                <strong>Contact for privacy requests:</strong> <a href="mailto:support@lucidaanalytics.tech" className="text-blue-400 hover:underline">support@lucidaanalytics.tech</a><br />
                <strong>Mailing address:</strong> Pune, Maharashtra, India <em>(full street address to be added once finalized)</em>
              </address>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">2. What Data We Collect</h2>
              
              <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">Account Data (via Firebase Authentication):</h3>
              <ul className="list-disc pl-5 mb-4 space-y-1">
                <li>Name, email address, and login credentials</li>
                <li>Authentication metadata (login timestamps, device/session info)</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">Lead Data (uploaded by you):</h3>
              <ul className="list-disc pl-5 mb-4 space-y-1">
                <li>Names, contact details, and other information contained in the sales leads you upload for filtering/scoring</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">Usage Data:</h3>
              <ul className="list-disc pl-5 mb-4 space-y-1">
                <li>Interactions with the Service, feature usage, and performance logs</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">Payment Data (via Dodo Payments):</h3>
              <p>We do not store your full payment card details. Payment processing is handled entirely by Dodo Payments, which maintains its own privacy and security practices.</p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">3. How We Use Your Data</h2>
              <p className="mb-2">We use collected data to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Provide and operate the ML-based lead filtering and scoring functionality</li>
                <li>Authenticate and secure your account</li>
                <li>Process subscription payments</li>
                <li>Improve and maintain the Service</li>
                <li>Communicate with you regarding your account or the Service</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">4. Legal Basis for Processing</h2>
              <p className="mb-2">Where applicable (e.g., under GDPR for EU-based users, or India's Digital Personal Data Protection Act, 2023), we process data based on:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Your consent (given at signup or upload)</li>
                <li>Performance of a contract (providing the Service you signed up for)</li>
                <li>Legitimate business interests (improving and securing the Service)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">5. Third-Party Sub-processors</h2>
              <p className="mb-4">We share data with the following third parties strictly to operate the Service:</p>
              
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="py-3 px-4 font-medium text-white">Sub-processor</th>
                      <th className="py-3 px-4 font-medium text-white">Data Shared</th>
                      <th className="py-3 px-4 font-medium text-white">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-4 font-medium">Firebase Authentication (Google)</td>
                      <td className="py-3 px-4">Account credentials, authentication metadata</td>
                      <td className="py-3 px-4">User login and identity management</td>
                    </tr>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="py-3 px-4 font-medium">Google Cloud Platform</td>
                      <td className="py-3 px-4">Application and Lead Data (as processed/stored)</td>
                      <td className="py-3 px-4">Hosting and infrastructure</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-4 font-medium">Dodo Payments</td>
                      <td className="py-3 px-4">Billing information, transaction data</td>
                      <td className="py-3 px-4">Subscription and payment processing</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="font-medium text-blue-400">We do not sell your data or your Lead Data to third parties.</p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">6. Data Retention</h2>
              <ul className="list-disc pl-5 space-y-3">
                <li><strong>Active accounts:</strong> We retain your Account Data and Lead Data for as long as your account remains active.</li>
                <li><strong>After account deletion:</strong> We retain data for <strong>30 days</strong> following account deletion or a request to delete data, after which it is permanently erased from our production systems. This window exists to allow for accidental-deletion recovery and to complete any pending processing. Backups may persist for a limited additional period before being purged in the normal backup rotation cycle.</li>
                <li>You may request earlier deletion by contacting us at <a href="mailto:support@lucidaanalytics.tech" className="text-blue-400 hover:underline">support@lucidaanalytics.tech</a>.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">7. Your Rights</h2>
              <p className="mb-2">Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>Access the data we hold about you</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data ("right to be forgotten")</li>
                <li>Object to or restrict certain processing</li>
                <li>Request a copy of your data in a portable format</li>
                <li>Withdraw consent at any time (where processing is based on consent)</li>
              </ul>
              <p>To exercise any of these rights, contact us at <a href="mailto:support@lucidaanalytics.tech" className="text-blue-400 hover:underline">support@lucidaanalytics.tech</a>. We will respond within a reasonable timeframe as required by applicable law.</p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">8. Data Security</h2>
              <p>
                We rely on industry-standard security practices provided by our infrastructure partners (Firebase Authentication, Google Cloud Platform) and apply reasonable technical and organizational measures to protect your data. However, no system is completely secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">9. International Data Transfers</h2>
              <p>
                Your data may be processed on servers located outside your country of residence, depending on Google Cloud Platform's data center locations. By using the Service, you consent to such transfers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">10. Children's Privacy</h2>
              <p>
                The Service is not intended for individuals under 18. We do not knowingly collect data from minors.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">11. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy periodically. Material changes will be communicated via email or an in-app notice. Continued use of the Service after changes take effect constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">12. Governing Law</h2>
              <p>
                This Privacy Policy is governed by the laws of India. Any disputes shall be subject to the jurisdiction of the courts of Pune, Maharashtra, India.
              </p>
            </section>

          </div>
        </motion.div>
      </main>
    </div>
  );
}
