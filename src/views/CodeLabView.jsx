import React, { useState } from 'react';
import { Cpu, FileText } from 'lucide-react';
import CodeWorkspace from '../components/CodeLab/CodeWorkspace';
import NotesWorkspace from '../components/CodeLab/NotesWorkspace';
import { useSettings } from '../hooks/SettingsContext';

export default function CodeLabView({ profile, showToast, savedCodes, savedNotes, fetchFullRecord }) {
  const { language } = useSettings();
  const [activeTab, setActiveTab] = useState('code'); // 'code' o 'notes'

  const miCodes = savedCodes?.filter(c => c.authorId === profile?.id) || [];
  const miNotes = savedNotes?.filter(n => n.authorId === profile?.id) || [];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* HEADER PRINCIPAL DUAL */}
      <div className="glass-card p-4 rounded-[2rem] flex flex-wrap gap-4 shadow-sm border border-gray-100 dark:border-slate-700/50 justify-center md:justify-start">
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm tracking-widest uppercase transition-all duration-300 ${activeTab === 'code' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-500/50 ring-offset-2 dark:ring-offset-slate-900' : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        >
          <Cpu size={20} />
          {language === 'es' ? 'Workspace de Código' : 'Code Workspace'}
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm tracking-widest uppercase transition-all duration-300 ${activeTab === 'notes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-500/50 ring-offset-2 dark:ring-offset-slate-900' : 'bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        >
          <FileText size={20} />
          {language === 'es' ? 'Bloc de Notas' : 'Notepad'}
        </button>
      </div>

      {activeTab === 'code' && (
        <CodeWorkspace 
           profile={profile} 
           showToast={showToast} 
           savedCodes={miCodes} 
           fetchFullRecord={fetchFullRecord}
        />
      )}

      {activeTab === 'notes' && (
        <NotesWorkspace 
           profile={profile} 
           showToast={showToast} 
           savedNotes={miNotes} 
        />
      )}

    </div>
  );
}
