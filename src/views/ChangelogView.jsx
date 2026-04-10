import React, { useState } from 'react';
import { 
  Rocket, Zap, Bug, Trash2, Calendar, 
  ChevronRight, Disc, Info, CheckCircle2, History,
  Plus, Shield, X, Edit3, Loader2, CheckCircle
} from 'lucide-react';
import { useSettings } from '../hooks/SettingsContext';
import { logAdminAction } from '../utils/auditUtils';
import { supabase } from '../config/supabase';

export default function ChangelogView({ changelog = [], profile, addOptimistic, updateOptimistic, removeOptimistic, replaceOptimistic }) {
  const { t, language } = useSettings();
  const isDeveloper = profile?.role === 'developer';

  const [isEditing, setIsEditing] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [version, setVersion] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState({ new: [], improvements: [], fixes: [], removals: [] });
  const [newItemText, setNewItemText] = useState('');
  const [activeCategory, setActiveCategory] = useState('new');
  const [isSaving, setIsSaving] = useState(false);

  const getSectionIcon = (type) => {
    switch(type) {
      case 'new': return <Rocket size={16} className="text-emerald-500" />;
      case 'improvements': return <Zap size={16} className="text-amber-500" />;
      case 'fixes': return <Bug size={16} className="text-indigo-500" />;
      case 'removals': return <Trash2 size={16} className="text-red-500" />;
      default: return <Info size={16} className="text-gray-500" />;
    }
  };

  const getSectionLabel = (key) => {
    return t(key);
  };

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    setItems(prev => ({
      ...prev,
      [activeCategory]: [...prev[activeCategory], newItemText.trim()]
    }));
    setNewItemText('');
  };

  const handleRemoveItem = (cat, idx) => {
    setItems(prev => ({
      ...prev,
      [cat]: prev[cat].filter((_, i) => i !== idx)
    }));
  };

  const handleSaveVersion = async (e) => {
    e.preventDefault();
    if (!version || isSaving) return;
    setIsSaving(true);
    
    const data = { 
      version, 
      release_date: date, 
      changes: items, 
      created_at: Date.now() 
    };

    let tempIdStr = null;

    // UI Optimista
    if (editingEntry) {
      updateOptimistic('changelog', editingEntry.id, data);
    } else {
      tempIdStr = `temp-chg-${Date.now()}`;
      addOptimistic('changelog', { ...data, id: tempIdStr, is_optimistic: true });
    }
    
    setIsEditing(false); // Cerramos el modal de inmediato para Ultra Speed

    try {
      if (editingEntry) {
        const { error } = await supabase
          .from('changelog')
          .update(data)
          .eq('id', editingEntry.id);
          
        if (error) throw error;
        await logAdminAction(profile, 'edit_changelog', editingEntry.id, editingEntry, data);
      } else {
        const { data: realRecord, error } = await supabase
          .from('changelog')
          .insert(data)
          .select().single();
          
        if (error) throw error;
        if (tempIdStr) replaceOptimistic('changelog', tempIdStr, realRecord);
      }
      setEditingEntry(null);
      setVersion('');
      setItems({ new: [], improvements: [], fixes: [], removals: [] });
    } catch (e) { 
      console.error(e); 
      // Opcional: Revertir si es crítico
    } finally { setIsSaving(false); }
  };

  const handleDeleteVersion = async (entry) => {
    if (window.confirm(language === 'es' ? '¿ELIMINAR esta versión del historial?' : 'DELETE this version from history?')) {
      // Vuelo Optimista
      removeOptimistic('changelog', entry.id);

      try {
        const { error } = await supabase.from('changelog').delete().eq('id', entry.id);
        if (error) throw error;
        await logAdminAction(profile, 'delete_changelog', entry.id, entry);
      } catch (e) { console.error(e); }
    }
  };

  const startEdit = (entry) => {
    setEditingEntry(entry);
    setVersion(entry.version);
    setDate(entry.release_date || entry.date);
    setItems({
      new: entry.changes?.new || entry.new || [],
      improvements: entry.changes?.improvements || entry.improvements || [],
      fixes: entry.changes?.fixes || entry.fixes || [],
      removals: entry.changes?.removals || entry.removals || []
    });
    setIsEditing(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-20">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-indigo-50 dark:bg-indigo-900/40 rounded-[2rem] text-indigo-600 mb-4 shadow-xl shadow-indigo-500/10">
          <History size={48} />
        </div>
        <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">{t('changelog_title')}</h1>
        <p className="text-lg text-gray-500 dark:text-slate-400 font-medium max-w-2xl mx-auto italic">
          {language === 'es' 
            ? 'Sigue la evolución de la plataforma y mantente al tanto de todas las mejoras que construimos para ti.' 
            : 'Track the evolution of the platform and stay up to date with all the improvements we build for you.'}
        </p>
        {isDeveloper && (
          <button 
            onClick={() => { setEditingEntry(null); setVersion(''); setItems({ new: [], improvements: [], fixes: [], removals: [] }); setIsEditing(true); }}
            className="mt-6 inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
          >
            <Plus size={20} /> Nueva Versión
          </button>
        )}
      </div>

      <div className="relative space-y-16 before:absolute before:left-8 md:before:left-1/2 before:top-20 before:bottom-0 before:w-1 before:bg-gradient-to-b before:from-indigo-200 before:via-purple-100 before:to-transparent dark:before:from-indigo-900/40 dark:before:via-slate-800 dark:before:to-transparent">
        {changelog.map((version, index) => (
          <div key={version.id} className={`relative flex flex-col md:flex-row items-center gap-8 ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
            <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-10 h-10 rounded-[1.25rem] bg-white dark:bg-slate-800 border-4 border-indigo-600 shadow-2xl z-10 flex items-center justify-center transition-transform hover:scale-125 duration-500">
               <Disc size={20} className="text-indigo-600 animate-pulse" />
            </div>

            <div className={`w-full md:w-[45%] group`}>
               <div className="glass-card p-10 rounded-[3rem] border border-gray-100 dark:border-slate-700/50 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                 
                 <div className="flex items-center justify-between mb-8 border-b dark:border-slate-700 pb-6">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">{t('version')} {version.version}</h2>
                      <div className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                        <Calendar size={14} /> {new Date(version.release_date || version.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    {index === 0 && (
                      <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800 shadow-lg shadow-emerald-500/10">LATEST</span>
                    )}
                    {isDeveloper && (
                        <div className="flex gap-2">
                           <button onClick={() => startEdit(version)} className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-xl transition-all"><Edit3 size={16}/></button>
                           <button onClick={() => handleDeleteVersion(version)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"><Trash2 size={16}/></button>
                        </div>
                     )}
                 </div>

                 <div className="space-y-8">
                    {['new', 'improvements', 'fixes', 'removals'].map(section => {
                      const items = version.changes?.[section] || version[section];
                      if (!items || items.length === 0) return null;
                      return (
                        <div key={section} className="space-y-4">
                           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                               {getSectionIcon(section)} {getSectionLabel(section)}
                           </div>
                           <ul className="space-y-3">
                              {items.map((item, i) => (
                                <li key={i} className="flex gap-3 text-sm font-medium text-gray-600 dark:text-slate-300 leading-relaxed group/item">
                                   <ChevronRight size={14} className="mt-1 text-indigo-400 group-hover/item:translate-x-1 transition-transform" />
                                   <span>{item}</span>
                                </li>
                              ))}
                           </ul>
                        </div>
                      )
                    })}
                 </div>
               </div>
            </div>

            <div className="hidden md:block w-[45%]"></div>
          </div>
        ))}

        {changelog.length === 0 && (
          <div className="py-20 text-center opacity-40">
             <History size={64} className="mx-auto mb-4 text-gray-300" />
             <p className="font-black uppercase tracking-widest">{language === 'es' ? 'No hay historial cargado' : 'No history loaded'}</p>
          </div>
        )}
      </div>

      <div className="bg-indigo-600 rounded-[3rem] p-12 text-white text-center space-y-6 shadow-2xl shadow-indigo-500/40 relative overflow-hidden group">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')] opacity-10"></div>
         <CheckCircle2 size={64} className="mx-auto text-indigo-100 transform group-hover:scale-125 transition-transform duration-500" />
         <h3 className="text-3xl font-black uppercase tracking-tighter leading-tight">
           {language === 'es' ? 'Trabajamos cada día para que domines Python.' : 'Working every day to help you master Python.'}
         </h3>
         <p className="text-indigo-100 font-medium max-sm mx-auto">
           {language === 'es' ? 'Reporta cualquier fallo o envíanos tus ideas en la sección de Feedback.' : 'Report any bugs or send us your ideas in the Feedback section.'}
         </p>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
           <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-8 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-50/20">
                 <div className="flex items-center gap-3">
                    <Shield size={24} className="text-indigo-600" />
                    <h2 className="text-xl font-black text-indigo-900 dark:text-white uppercase tracking-tight">Editor de Versión</h2>
                 </div>
                 <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleSaveVersion} className="flex-1 overflow-y-auto p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Versión</label>
                       <input required value={version} onChange={e => setVersion(e.target.value)} placeholder="Ej: 1.2.0" className="w-full px-6 py-4 rounded-2xl border-2 dark:bg-slate-900 font-bold outline-none focus:border-indigo-500 transition-all" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Fecha</label>
                       <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-6 py-4 rounded-2xl border-2 dark:bg-slate-900 font-bold outline-none focus:border-indigo-500 transition-all font-mono" />
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl">
                       {['new', 'improvements', 'fixes', 'removals'].map(cat => (
                         <button key={cat} type="button" onClick={() => setActiveCategory(cat)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>{cat}</button>
                       ))}
                    </div>
                    <div className="flex gap-2">
                       <input value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddItem())} placeholder="Agregar cambio..." className="flex-1 px-6 py-3 rounded-2xl border-2 dark:bg-slate-900 font-medium text-sm outline-none focus:border-indigo-500" />
                       <button type="button" onClick={handleAddItem} className="p-3 bg-indigo-600 text-white rounded-2xl"><Plus size={24} /></button>
                    </div>
                    <ul className="space-y-2">
                       {items[activeCategory].map((item, i) => (
                         <li key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl group">
                            <span className="text-sm font-medium text-gray-600 dark:text-slate-300">{item}</span>
                            <button type="button" onClick={() => handleRemoveItem(activeCategory, i)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                         </li>
                       ))}
                    </ul>
                 </div>

                 <button disabled={isSaving} type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                   {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle size={24} />}
                   Guardar Versión
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
