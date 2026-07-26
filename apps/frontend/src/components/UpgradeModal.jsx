import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Zap, Layers, Activity } from 'lucide-react';
import client from '../api/client';

export default function UpgradeModal({ isOpen, onClose }) {
  const [loadingPlan, setLoadingPlan] = useState(null);

  if (!isOpen) return null;

  const handleUpgrade = async (planId) => {
    try {
      setLoadingPlan(planId);
      const { data } = await client.post('/api/billing/checkout', { plan_id: planId });
      if (data && data.payment_link) {
        window.location.href = data.payment_link;
      }
    } catch (err) {
      console.error('Failed to create checkout session:', err);
      alert('Failed to initiate checkout. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$299',
      description: 'Built for growing sales teams (10-25 reps).',
      icon: <Activity className="w-6 h-6 text-blue-400" />,
      features: [
        '1 CRM integration (Salesforce/HubSpot)',
        'Up to 10,000 leads/mo',
        'Email support + 1 call/month',
        'Automatic lead scoring split'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$799',
      description: 'For scaling departments (25-75 reps).',
      popular: true,
      icon: <Zap className="w-6 h-6 text-purple-400" />,
      features: [
        '2-3 CRM integrations',
        'Up to 25,000 leads/mo',
        'API access + advanced reporting',
        'Priority support + weekly calls'
      ]
    },
    {
      id: 'scale',
      name: 'Scale',
      price: '$1,999',
      description: 'Enterprise operations (75+ reps).',
      icon: <Layers className="w-6 h-6 text-indigo-400" />,
      features: [
        'Unlimited everything',
        'Dedicated account manager',
        'Custom model tuning',
        'Slack + strategy sessions'
      ]
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-6 md:p-8 flex-shrink-0">
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-3xl font-serif text-white mb-2">Upgrade to Download All Leads</h2>
            <p className="text-gray-400">You've unlocked your top 100 leads. Choose a plan to export your full list and train unlimited models.</p>
          </div>

          <div className="p-6 md:p-8 pt-0 overflow-y-auto custom-scrollbar">
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map(plan => (
                <div 
                  key={plan.id} 
                  className={`relative p-6 rounded-xl border flex flex-col ${
                    plan.popular 
                      ? 'border-purple-500/50 bg-purple-500/10' 
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 translate-x-2 -translate-y-2 bg-purple-500 text-white text-[0.65rem] uppercase tracking-wider font-bold px-3 py-1 rounded-full shadow-lg">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-4">
                    {plan.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <div className="text-sm text-gray-400 h-10">{plan.description}</div>
                  
                  <div className="my-6">
                    <span className="text-4xl font-light text-white">{plan.price}</span>
                    <span className="text-gray-500 ml-2">/month</span>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                        <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loadingPlan !== null}
                    className={`w-full py-3 rounded-lg font-medium transition-all flex justify-center items-center gap-2 ${
                      plan.popular
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    } ${loadingPlan !== null && loadingPlan !== plan.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loadingPlan === plan.id ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      'Choose ' + plan.name
                    )}
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-8 text-center text-gray-500 text-sm border-t border-white/5 pt-6">
              Need multi-year contracts or SLA guarantees? <a href="mailto:sales@lucidaanalytics.tech" className="text-white hover:underline ml-1">Contact us for Enterprise pricing.</a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
