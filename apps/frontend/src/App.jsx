import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import SurveyPage from './pages/SurveyPage';
import RankingPage from './pages/RankingPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import RefundPolicy from './pages/RefundPolicy';
import ContactPage from './pages/ContactPage';
import FoundingMembersSignup from './pages/FoundingMembersSignup';
import AdminDashboard from './pages/AdminDashboard';
import CampaignSignupPage from './pages/CampaignSignupPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black font-sans text-white selection:bg-accent/30">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/rank" element={<RankingPage />} />
          <Route path="/survey" element={<SurveyPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/refund" element={<RefundPolicy />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/founding-members" element={<FoundingMembersSignup />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/founding-members" element={<Navigate to="/admin/dashboard" />} />
          <Route path="/campaigns/*" element={<CampaignSignupPage />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
