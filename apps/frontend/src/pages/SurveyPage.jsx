import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, CheckCircle2, ChevronRight, Calculator, Send } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Link } from 'react-router-dom';

const STEPS = [
  { id: 'basic', title: 'Basic Info', desc: 'Who are you?' },
  { id: 'metrics', title: 'Sales Metrics', desc: 'Your numbers' },
  { id: 'problem', title: 'The Problem', desc: 'Current setup' },
  { id: 'decision', title: 'Decision', desc: 'Budget & Timeline' },
  { id: 'result', title: 'Your Custom ROI', desc: 'The math' }
];

export default function SurveyPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    companyName: '',
    role: '',
    roleOther: '',
    companySize: '',
    email: '',
    phone: '',
    
    reps: '',
    dealSize: '',
    closeRate: '',
    
    hoursWasted: '',
    crm: '',
    crmOther: '',
    frustrations: [],
    frustrationOther: '',
    
    decisionMaker: '',
    decisionMakerOther: '',
    budget: '',
    timeline: '',
    notes: ''
  });

  const [roiResult, setRoiResult] = useState(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      if (checked) {
        setFormData(prev => ({ ...prev, frustrations: [...prev.frustrations, value] }));
      } else {
        setFormData(prev => ({ ...prev, frustrations: prev.frustrations.filter(f => f !== value) }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const calculateROI = () => {
    const reps = parseFloat(formData.reps) || 0;
    const dealSize = parseFloat(formData.dealSize) || 0;
    const closeRate = parseFloat(formData.closeRate) || 0;
    const hoursWeek = parseFloat(formData.hoursWasted) || 0;
    
    // Hourly loaded cost = $35
    const hoursPerMonth = reps * hoursWeek * 4.3;
    const monthlyWaste = hoursPerMonth * 35;
    const annualWaste = monthlyWaste * 12;
    
    let monthlyCost = 299; // Starter
    if (reps >= 25 && reps < 75) monthlyCost = 799; // Pro
    if (reps >= 75) monthlyCost = 1999; // Scale
    
    const annualCost = monthlyCost * 12;
    
    // Annual recovery is 40% of waste minus the cost
    const annualRecovery = (annualWaste * 0.40) - annualCost;
    const paybackDays = annualWaste > 0 ? (annualCost / annualWaste) * 365 : 0;
    
    return {
      annualWaste,
      annualCost,
      annualRecovery,
      paybackDays: Math.round(paybackDays),
      recommendedTier: monthlyCost === 299 ? 'Starter' : monthlyCost === 799 ? 'Pro' : 'Scale'
    };
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 2) {
      setCurrentStep(curr => curr + 1);
      window.scrollTo(0, 0);
    } else if (currentStep === STEPS.length - 2) {
      submitForm();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(curr => curr - 1);
      window.scrollTo(0, 0);
    }
  };

  const submitForm = async () => {
    setIsSubmitting(true);
    try {
      const result = calculateROI();
      setRoiResult(result);
      
      await addDoc(collection(db, 'roi_surveys'), {
        ...formData,
        calculatedROI: result,
        submittedAt: serverTimestamp(),
        trialSent: false,
        converted: false
      });
      
      setCurrentStep(STEPS.length - 1); // Move to results step
      window.scrollTo(0, 0);
    } catch (err) {
      console.error("Error saving survey:", err);
      alert("There was an issue saving your response. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if current step is valid
  const isStepValid = () => {
    if (currentStep === 0) {
      return formData.fullName && formData.companyName && formData.role && formData.companySize && formData.email;
    }
    if (currentStep === 1) {
      return formData.reps && formData.dealSize && formData.closeRate;
    }
    if (currentStep === 2) {
      return formData.hoursWasted && formData.crm && (formData.frustrations.length > 0 || formData.frustrationOther);
    }
    if (currentStep === 3) {
      return formData.decisionMaker && formData.budget && formData.timeline;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-gray-200 font-sans selection:bg-blue-500/30">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                <span className="font-serif font-bold text-white text-lg">L</span>
              </div>
              <span className="font-serif text-xl font-medium tracking-tight text-white">
                Lucida<span className="text-blue-500 font-light">Analytics</span>
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono uppercase tracking-wider mb-6">
            <Calculator className="w-3.5 h-3.5" />
            ROI Calculator
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif text-white mb-6 font-light">
            Your Custom <em className="italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Lead Scoring</em> ROI
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto font-light leading-relaxed">
            Before we launch our paid tiers, we want to show you exactly how much revenue your team could recover by prioritizing leads better. Takes 2 minutes.
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="mb-10 flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-white/10 -z-10"></div>
          {STEPS.map((step, idx) => {
            const isCompleted = currentStep > idx;
            const isCurrent = currentStep === idx;
            return (
              <div key={step.id} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 mb-2 transition-colors ${
                  isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 
                  isCurrent ? 'bg-[#0a0a0b] border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 
                  'bg-[#111] border-white/10 text-gray-500'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <div className={`text-[0.65rem] uppercase tracking-widest font-mono hidden sm:block ${isCurrent ? 'text-blue-400' : 'text-gray-600'}`}>
                  {step.title}
                </div>
              </div>
            );
          })}
        </div>

        {/* Form Container */}
        <div className="bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle top gradient line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500"></div>

          <AnimatePresence mode="wait">
            {/* ── STEP 0: BASIC INFO ── */}
            {currentStep === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-serif text-white mb-6">Basic Info</h2>
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Full Name *</label>
                      <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Jane Doe" required />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Company Name *</label>
                      <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Acme Corp" required />
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Your Role *</label>
                      <select name="role" value={formData.role} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none">
                        <option value="">Select a role...</option>
                        <option value="Sales Director">Sales Director</option>
                        <option value="VP of Sales">VP of Sales</option>
                        <option value="Chief Revenue Officer">Chief Revenue Officer</option>
                        <option value="Sales Operations Manager">Sales Operations Manager</option>
                        <option value="Other">Other</option>
                      </select>
                      {formData.role === 'Other' && (
                        <input type="text" name="roleOther" value={formData.roleOther} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 mt-3 text-white focus:border-blue-500" placeholder="Please specify..." />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Company Size *</label>
                      <select name="companySize" value={formData.companySize} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none">
                        <option value="">Select size...</option>
                        <option value="50-100 employees">50-100 employees</option>
                        <option value="100-250 employees">100-250 employees</option>
                        <option value="250-500 employees">250-500 employees</option>
                        <option value="500-1000 employees">500-1000 employees</option>
                        <option value="1000+ employees">1000+ employees</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Work Email *</label>
                      <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 transition-colors" placeholder="jane@acme.com" required />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Phone Number (Optional)</label>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 transition-colors" placeholder="+1 (555) 000-0000" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 1: METRICS ── */}
            {currentStep === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-serif text-white mb-6">Sales Metrics</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">How many reps are on your sales team? *</label>
                    <input type="number" name="reps" value={formData.reps} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 transition-colors" placeholder="e.g. 30" min="1" required />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">What's your average deal size (USD)? *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-500">$</span>
                      <input type="number" name="dealSize" value={formData.dealSize} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg pl-8 pr-4 py-3 text-white focus:border-blue-500 transition-colors" placeholder="50000" min="1" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">What's your current sales close rate (%)? *</label>
                    <div className="relative">
                      <input type="number" name="closeRate" value={formData.closeRate} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 transition-colors" placeholder="12" min="0" max="100" required />
                      <span className="absolute right-4 top-3 text-gray-500">%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: PROBLEM ── */}
            {currentStep === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-serif text-white mb-6">The Problem</h2>
                <div className="space-y-8">
                  <div>
                    <label className="block text-sm text-gray-400 mb-4">Currently, how much time does each rep spend <strong className="text-white font-medium">per week</strong> trying to figure out if a lead is actually qualified? *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: '30 minutes (0.5 hours)', value: '0.5' },
                        { label: '1-2 hours', value: '1.5' },
                        { label: '2-4 hours', value: '3' },
                        { label: '4+ hours', value: '4' }
                      ].map(opt => (
                        <label key={opt.value} className={`border rounded-lg p-4 cursor-pointer transition-all ${formData.hoursWasted === opt.value ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-black border-white/10 hover:border-white/30 text-gray-300'}`}>
                          <input type="radio" name="hoursWasted" value={opt.value} checked={formData.hoursWasted === opt.value} onChange={handleInputChange} className="hidden" />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-4">What CRM do you use? *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['Salesforce', 'HubSpot', 'Pipedrive', 'Custom'].map(opt => (
                        <label key={opt} className={`border rounded-lg p-3 text-center text-sm cursor-pointer transition-all ${formData.crm === opt ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-black border-white/10 hover:border-white/30 text-gray-300'}`}>
                          <input type="radio" name="crm" value={opt} checked={formData.crm === opt} onChange={handleInputChange} className="hidden" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-4">What's your biggest frustration with current lead quality? (Select all that apply) *</label>
                    <div className="space-y-2">
                      {[
                        'Too many unqualified leads wasting rep time',
                        'Can\'t identify which leads will actually close',
                        'Manual prioritization is inconsistent',
                        'Takes too long to work through a queue',
                        'No clear scoring system'
                      ].map(frust => (
                        <label key={frust} className="flex items-start gap-3 p-3 rounded-lg bg-black border border-white/5 hover:bg-white/[0.02] cursor-pointer group">
                          <input type="checkbox" name="frustrations" value={frust} checked={formData.frustrations.includes(frust)} onChange={handleInputChange} className="mt-1 bg-black border-white/20 text-blue-500 rounded" />
                          <span className="text-gray-300 group-hover:text-white transition-colors">{frust}</span>
                        </label>
                      ))}
                      <div className="flex gap-3 items-center mt-2 p-3">
                        <span className="text-gray-400 text-sm whitespace-nowrap">Other:</span>
                        <input type="text" name="frustrationOther" value={formData.frustrationOther} onChange={handleInputChange} className="w-full bg-black border-b border-white/20 px-2 py-1 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Please specify..." />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: DECISION ── */}
            {currentStep === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-serif text-white mb-6">Decision Makers & Closing</h2>
                <div className="space-y-8">
                  <div>
                    <label className="block text-sm text-gray-400 mb-3">Are you the final decision maker on sales tools? *</label>
                    <select name="decisionMaker" value={formData.decisionMaker} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none">
                      <option value="">Select...</option>
                      <option value="I decide">I decide</option>
                      <option value="Need approval">Need approval from someone else</option>
                    </select>
                    {formData.decisionMaker === 'Need approval' && (
                      <input type="text" name="decisionMakerOther" value={formData.decisionMakerOther} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 mt-3 text-white focus:border-blue-500" placeholder="Who needs to approve? (e.g. CRO, CFO)" />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-3">What's your budget range for a lead scoring tool per month? *</label>
                    <select name="budget" value={formData.budget} onChange={handleInputChange} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none">
                      <option value="">Select budget range...</option>
                      <option value="Under $500">Under $500</option>
                      <option value="$500-$1,000">$500-$1,000</option>
                      <option value="$1,000-$2,500">$1,000-$2,500</option>
                      <option value="$2,500-$5,000">$2,500-$5,000</option>
                      <option value="$5,000+">$5,000+</option>
                      <option value="Not sure yet">Not sure yet</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-3">How soon do you want to see results? *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        'ASAP (within 30 days)',
                        'This quarter',
                        'Just exploring options',
                        'No specific timeline'
                      ].map(opt => (
                        <label key={opt} className={`border rounded-lg p-3 text-center text-sm cursor-pointer transition-all ${formData.timeline === opt ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-black border-white/10 hover:border-white/30 text-gray-300'}`}>
                          <input type="radio" name="timeline" value={opt} checked={formData.timeline === opt} onChange={handleInputChange} className="hidden" />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Anything else I should know? (Optional)</label>
                    <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 transition-colors" placeholder="Any specific CRM setups or data challenges?"></textarea>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: RESULTS ── */}
            {currentStep === 4 && roiResult && (
              <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-6">
                  <SparkleIcon className="w-8 h-8" />
                </div>
                
                <h2 className="text-3xl font-serif text-white mb-2">Your ROI Calculation is Ready</h2>
                <p className="text-gray-400 mb-10">Based on your {formData.reps} sales reps and {formData.hoursWasted} hours wasted per week.</p>

                <div className="bg-black/50 border border-white/10 rounded-2xl p-6 sm:p-8 mb-8 text-left space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div>
                      <div className="text-sm font-mono text-gray-500 uppercase tracking-wider mb-2">Total Waste</div>
                      <div className="text-3xl font-light text-red-400">${roiResult.annualWaste.toLocaleString()}<span className="text-sm text-gray-500 ml-1">/year</span></div>
                      <p className="text-xs text-gray-500 mt-2">Cost of rep time spent manually filtering leads.</p>
                    </div>
                    <div>
                      <div className="text-sm font-mono text-gray-500 uppercase tracking-wider mb-2">You Can Recover</div>
                      <div className="text-3xl font-light text-green-400">${Math.round(roiResult.annualRecovery).toLocaleString()}<span className="text-sm text-gray-500 ml-1">/year</span></div>
                      <p className="text-xs text-gray-500 mt-2">Net savings after paying for Lucida {roiResult.recommendedTier} tier.</p>
                    </div>
                  </div>
                  
                  <div className="h-px w-full bg-white/5"></div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-mono text-gray-500 uppercase tracking-wider mb-1">Payback Period</div>
                      <div className="text-xl text-white">{roiResult.paybackDays} days</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-gray-500 uppercase tracking-wider mb-1">Recommended Plan</div>
                      <div className="text-xl text-blue-400 font-medium">{roiResult.recommendedTier} (${roiResult.annualCost / 12}/mo)</div>
                    </div>
                  </div>
                </div>

                <p className="text-gray-300 leading-relaxed mb-10">
                  I'll be sending you a detailed one-pager of these metrics to <strong className="text-white">{formData.email}</strong>, along with a link to claim your <span className="text-blue-400 font-medium">free 14-day trial</span>.
                </p>

                <Link to="/" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-colors w-full sm:w-auto">
                  Back to Home
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          {currentStep < 4 && (
            <div className="mt-10 flex items-center justify-between pt-6 border-t border-white/10">
              <button 
                onClick={prevStep}
                disabled={currentStep === 0 || isSubmitting}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              
              <button 
                onClick={nextStep}
                disabled={!isStepValid() || isSubmitting}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isStepValid() 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25' 
                    : 'bg-white/5 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">Calculating... <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div></span>
                ) : currentStep === STEPS.length - 2 ? (
                  <span className="flex items-center gap-2">Calculate ROI <Send className="w-4 h-4" /></span>
                ) : (
                  <span className="flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SparkleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
