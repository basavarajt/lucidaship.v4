import React from 'react';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
};

export default function TermsOfService() {
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
          <h1 className="text-4xl md:text-5xl font-serif font-light mb-4 text-white">Terms of Service</h1>
          <p className="text-gray-400 font-mono text-sm tracking-wider uppercase mb-12">Last Updated: July 2, 2026</p>

          <div className="space-y-8 text-gray-300 font-light leading-relaxed">
            
            <section>
              <h2 className="text-2xl font-serif text-white mb-4">1. Introduction</h2>
              <p className="mb-4">
                Welcome to Lucida Analytics ("the Service"). The Service is currently owned and operated by <strong>Basavaraj Kareppa Talikoti</strong>, a sole proprietor based in Pune, Maharashtra, India ("Operator," "we," "us," or "our"). The Service provides machine-learning-based lead filtering and qualification tools for sales organizations.
              </p>
              <p className="mb-4">
                By accessing or using the Service, you ("User," "you," or "your") agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.
              </p>
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-5 text-sm">
                <strong>Note on business structure:</strong> The Service is presently operated by an individual as a sole proprietorship under Indian law. Should the Operator incorporate a formal legal entity (e.g., a Private Limited Company) in the future, all rights, obligations, and agreements under these Terms will transfer to that successor entity, and Users will be notified via email and/or an update to this document.
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">2. Description of Service</h2>
              <p>
                The Service uses machine learning models to analyze, score, and filter sales lead data uploaded by Users, with the goal of reducing the time and cost associated with lead qualification.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">3. Eligibility</h2>
              <p>
                You must be at least 18 years old and capable of entering into a binding contract to use the Service. If you are using the Service on behalf of a company, you represent that you have authority to bind that company to these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">4. Account Registration</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Accounts are created and authenticated via <strong>Firebase Authentication</strong>.</li>
                <li>You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.</li>
                <li>You must provide accurate and complete information during registration.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">5. Acceptable Use</h2>
              <p className="mb-2">You agree not to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Upload lead data that you do not have the legal right to collect, use, or share</li>
                <li>Use the Service to violate any applicable data protection law (including India's Digital Personal Data Protection Act, 2023, and, where applicable, GDPR)</li>
                <li>Reverse-engineer, scrape, or attempt to extract the underlying ML models</li>
                <li>Use the Service for any unlawful, harassing, or fraudulent purpose</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">6. User Data and Lead Data</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>You retain ownership of any lead data ("Lead Data") you upload to the Service.</li>
                <li>You represent and warrant that you have obtained all necessary consents to upload and process Lead Data through the Service, including consents from the individuals whose data is contained within it.</li>
                <li>We process Lead Data solely to provide, maintain, and improve the Service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">7. Payments and Billing</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Payments are processed through <strong>Dodo Payments</strong>, a third-party payment processor.</li>
                <li>By subscribing to a paid plan, you authorize Dodo Payments to charge your chosen payment method on a recurring basis, as applicable to your selected plan.</li>
                <li>All fees are non-refundable except where required by law or explicitly stated otherwise.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">8. Third-Party Services (Sub-processors)</h2>
              <p className="mb-4">The Service relies on the following third-party providers to operate:</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="py-3 px-4 font-medium text-white">Service</th>
                      <th className="py-3 px-4 font-medium text-white">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-4">Firebase Authentication</td>
                      <td className="py-3 px-4">User login and identity management</td>
                    </tr>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <td className="py-3 px-4">Google Cloud Platform</td>
                      <td className="py-3 px-4">Application hosting and infrastructure</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-4">Dodo Payments</td>
                      <td className="py-3 px-4">Subscription billing and payment processing</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4">We may update this list as the Service evolves. Material changes will be reflected in our Privacy Policy.</p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">9. Intellectual Property</h2>
              <p>
                The Service, including its underlying ML models, software, and design, is the property of the Operator. These Terms do not grant you any ownership rights in the Service itself.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">10. Termination</h2>
              <p>
                We may suspend or terminate your access to the Service at our discretion, including for violation of these Terms. You may terminate your account at any time by contacting us at support@lucidaanalytics.tech.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">11. Disclaimer of Warranties</h2>
              <p>
                The Service is provided "as is" and "as available," without warranties of any kind, express or implied. We do not guarantee that lead scoring or filtering outputs will be error-free or fit for any particular business outcome.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">12. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, the Operator shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability for any claim shall not exceed the amount you paid for the Service in the twelve (12) months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">13. Governing Law and Jurisdiction</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in Pune, Maharashtra, India.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">14. Changes to These Terms</h2>
              <p>
                We may update these Terms from time to time. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-serif text-white mb-4">15. Contact Us</h2>
              <p className="mb-2">For questions about these Terms, contact:</p>
              <address className="not-italic text-gray-400">
                <strong className="text-white">Basavaraj Kareppa Talikoti</strong><br />
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
