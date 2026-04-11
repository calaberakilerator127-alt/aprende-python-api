import React from 'react';
import { Settings, MessageCircle, LogOut, ArrowRight, ShieldCheck, Globe, Mail } from 'lucide-react';
import { useSettings } from '../hooks/SettingsContext';

export default function MaintenanceView({ handleLogout }) {
  const { t, language } = useSettings();

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gray-50 dark:bg-slate-900 overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-4xl w-full px-6 py-12 relative z-10 flex flex-col items-center text-center">
        {/* Logo Section */}
        <div className="mb-12 animate-bounce-in">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 dark:opacity-40 animate-pulse"></div>
            <div className="relative bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-700/50 transform -rotate-3 hover:rotate-0 transition-transform duration-500 cursor-pointer group">
              <img src="/logo.png" alt="Python Master" className="w-20 h-20 sm:w-28 sm:h-28 object-contain group-hover:scale-110 transition-transform duration-500" />
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8 animate-fade-in shadow-sm border border-indigo-200 dark:border-indigo-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          {language === 'es' ? 'Actualización en curso' : 'Update in progress'}
        </div>

        {/* Main Title */}
        <h1 className="text-5xl sm:text-7xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter leading-none animate-fade-in group">
          {language === 'es' ? 'Regresamos en' : 'We\'ll be back'} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 animate-gradient-x">
            {language === 'es' ? 'unos instantes' : 'a moment'}
          </span>
        </h1>

        {/* Description */}
        <p className="text-gray-500 dark:text-slate-400 text-lg sm:text-xl font-medium max-w-2xl mb-12 leading-relaxed animate-fade-in" style={{ animationDelay: '100ms' }}>
          {language === 'es' 
            ? 'Estamos realizando mejoras estructurales para elevar tu experiencia de aprendizaje al siguiente nivel. Gracias por tu paciencia.' 
            : 'We are performing structural improvements to take your learning experience to the next level. Thank you for your patience.'}
        </p>

        {/* Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg animate-fade-in" style={{ animationDelay: '200ms' }}>
          <a 
            href="mailto:soporte@pythonmaster.com" 
            className="flex items-center justify-center gap-3 px-8 py-5 bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 rounded-3xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
          >
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <Mail size={20} />
            </div>
            <span className="font-black text-xs uppercase tracking-widest text-gray-700 dark:text-gray-200">{language === 'es' ? 'Soporte' : 'Support'}</span>
          </a>

          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 px-8 py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-3xl group hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all shadow-lg"
          >
            <div className="p-2 bg-white/10 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl group-hover:rotate-12 transition-transform">
              <LogOut size={20} />
            </div>
            <span className="font-black text-xs uppercase tracking-widest">{language === 'es' ? 'Salir' : 'Sign Out'}</span>
          </button>
        </div>

        {/* Progress Bar Mockup */}
        <div className="w-full max-w-xs mt-16 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="flex justify-between items-end mb-3">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'es' ? 'PROGRESO' : 'PROGRESS'}</span>
             <span className="text-xl font-black text-indigo-600 italic">94%</span>
          </div>
          <div className="h-3 w-full bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full animate-progress-shine" style={{ width: '94%' }}></div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-16 flex flex-col items-center gap-6 animate-fade-in opacity-50 transition-opacity hover:opacity-100" style={{ animationDelay: '400ms' }}>
           <div className="flex gap-6">
              <Globe size={20} className="text-gray-400 hover:text-indigo-400 cursor-pointer transition-colors" />
              <MessageCircle size={20} className="text-gray-400 hover:text-pink-400 cursor-pointer transition-colors" />
           </div>
           <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.3em]">
             © 2026 Python Master Team. {language === 'es' ? 'Todos los derechos reservados.' : 'All rights reserved.'}
           </p>
        </div>
      </div>
    </div>
  );
}
