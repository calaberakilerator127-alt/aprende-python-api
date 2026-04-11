import React, { useState } from 'react';
import { Cpu, FileText, Code, BookOpen } from 'lucide-react';
import CodeWorkspace from '../components/CodeLab/CodeWorkspace';
import NotesWorkspace from '../components/CodeLab/NotesWorkspace';
import { useSettings } from '../hooks/SettingsContext';

export default function CodeLabView({ profile, showToast, savedCodes, savedNotes, fetchFullRecord }) {
  const { language } = useSettings();
  const [activeTab, setActiveTab] = useState('code'); // 'code' o 'notes'

  const miCodes = savedCodes?.filter(c => c.authorId === profile?.id || c.author_id === profile?.id) || [];
  const miNotes = savedNotes?.filter(n => n.authorId === profile?.id || n.author_id === profile?.id) || [];

  return (
    <div className="space-y-10 animate-fade-in pb-20 flex flex-col h-full min-h-[85vh]">
      
      {/* HEADER PRINCIPAL DUAL AURA */}
      <div className="aura-card p-0 overflow-hidden shadow-2xl shrink-0">
        <div className="aura-gradient-secondary px-10 py-12 text-white flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="space-y-4 text-center md:text-left">
            <h1 className="text-5xl font-black uppercase tracking-tighter flex items-center justify-center md:justify-start gap-4 text-white">
              <Cpu className="text-white" size={56} /> 
              {language === 'es' ? 'Laboratorio de Código' : 'Code Laboratory'}
            </h1>
            <p className="text-white/60 font-black text-xs uppercase tracking-[0.3em]">{language === 'es' ? 'Entorno de Desarrollo de Próxima Generación' : 'Next-Generation Development Environment'}</p>
          </div>
          
          <div className="flex bg-white/10 backdrop-blur-md rounded-[2rem] p-2 shadow-inner border border-white/10">
             <button 
               onClick={() => setActiveTab('code')} 
               className={`px-10 py-5 rounded-[1.6rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-4 transition-all duration-500 ${activeTab === 'code' ? 'bg-white shadow-2xl text-indigo-600 scale-105' : 'text-white/60 hover:text-white'}`}
             >
                <Code size={20}/> {language === 'es' ? 'Workspace' : 'Workspace'}
             </button>
             <button 
               onClick={() => setActiveTab('notes')} 
               className={`px-10 py-5 rounded-[1.6rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-4 transition-all duration-500 ${activeTab === 'notes' ? 'bg-white shadow-2xl text-indigo-600 scale-105' : 'text-white/60 hover:text-white'}`}
             >
                <BookOpen size={20}/> {language === 'es' ? 'Bitácora' : 'Notebook'}
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {activeTab === 'code' && (
          <div className="animate-scale-in flex-1">
            <CodeWorkspace 
               profile={profile} 
               showToast={showToast} 
               savedCodes={miCodes} 
               fetchFullRecord={fetchFullRecord}
            />
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="animate-scale-in flex-1">
            <NotesWorkspace 
               profile={profile} 
               showToast={showToast} 
               savedNotes={miNotes} 
            />
          </div>
        )}
      </div>

    </div>
  );
}
