import React, { useState, useEffect } from 'react';
import { AppProgress, PointProgress, StrategyCategory } from './types';
import { STRATEGY_CATEGORIES } from './constants';
import StrategyDetail from './components/StrategyDetail';

interface NMRHIPageProps {
  currentUserName?: string;
  categoryId?: string; // Optional: if provided, directly show that category

}

const NMRHIPage: React.FC<NMRHIPageProps> = ({ currentUserName, categoryId }) => {
  const [activeCategory, setActiveCategory] = useState<StrategyCategory | null>(null);
  const [progress, setProgress] = useState<AppProgress>({});

  // If categoryId is provided, find and set the active category
  useEffect(() => {
    if (categoryId) {
      const category = STRATEGY_CATEGORIES.find(c => c.id === categoryId);
      if (category) {
        setActiveCategory(category);
      }
    } else {
      setActiveCategory(null);
    }
  }, [categoryId]);

  const handleUpdateProgress = (key: string, updates: Partial<PointProgress>) => {
    setProgress(prev => ({
      ...prev,
      [key]: { ...prev[key], ...updates }
    }));
  };

  const getCategoryProgress = (category: StrategyCategory) => {
    let total = 0;
    let completed = 0;
    
    category.sections.forEach((section, sIdx) => {
      section.points.forEach((_, pIdx) => {
        total++;
        const key = `${category.id}-${sIdx}-${pIdx}`;
        if (progress[key]?.status === 'completed') {
          completed++;
        }
      });
    });
    
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  if (activeCategory) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Back Navigation */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setActiveCategory(null)}
              className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-semibold transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to NMRHI Overview
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')}
                className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                ChatGPT
              </button>
              <button
                onClick={() => window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer')}
                className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Gemini
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-[1400px] mx-auto p-4 md:p-6">
          <div className="min-w-0">
            <StrategyDetail
              category={activeCategory}
              progress={progress}
              onUpdateProgress={handleUpdateProgress}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      {/* Header */}
      <header className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 shadow-lg shadow-blue-200">
          Strategic Framework
        </div>
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">
          NMRHI Strategy System
        </h1>
        <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
          A comprehensive framework for New business development, Market expansion, Resource optimization, 
          Human capital development, and Innovation & Improvement.
        </p>
        {currentUserName && (
          <p className="text-slate-400 text-sm mt-4">
            Welcome, <span className="font-semibold text-slate-600">{currentUserName}</span>
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            ChatGPT
          </button>
          <button
            onClick={() => window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Gemini
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto">
        {/* Strategy Cards Grid */}
        <div className="min-w-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {STRATEGY_CATEGORIES.map((category, idx) => {
            const progressPercent = getCategoryProgress(category);
            
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category)}
                className="group relative bg-white rounded-3xl border-2 border-slate-100 p-6 text-left hover:border-blue-500 hover:shadow-xl hover:shadow-blue-100 transition-all duration-300 hover:-translate-y-2"
              >
                {/* Progress Ring */}
                <div className="absolute top-4 right-4">
                  <div className="relative w-12 h-12">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="#f1f5f9"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="#3b82f6"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={125.6}
                        strokeDashoffset={125.6 - (125.6 * progressPercent) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-black text-slate-600">{progressPercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Letter Badge */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-black mb-4 shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                  {category.name}
                </div>

                {/* Category Info */}
                <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight">
                  {category.fullName}
                </h3>
                <p className="text-slate-400 text-xs font-medium leading-relaxed mb-4">
                  {category.description.substring(0, 80)}...
                </p>

                {/* Sections Preview */}
                <div className="flex flex-wrap gap-1.5">
                  {category.sections.slice(0, 3).map((section, sIdx) => (
                    <span
                      key={sIdx}
                      className="text-[9px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold uppercase tracking-wider"
                    >
                      {section.title.substring(0, 10)}
                    </span>
                  ))}
                  {category.sections.length > 3 && (
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold">
                      +{category.sections.length - 3}
                    </span>
                  )}
                </div>

                {/* Hover Indicator */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-slate-400 text-[10px] uppercase font-bold tracking-widest">
        NMRHI Strategic Framework &bull; Internal Use Only
      </footer>
    </div>
  );
};

export default NMRHIPage;
