import React, { useState, useEffect } from 'react';
import { Settings, Save, Clock, Percent, Award, Info, AlertTriangle, CheckCircle2, ShieldCheck, CalendarCheck } from 'lucide-react';
import api from '../config/api';

export default function ClassSettingsView({ profile, gradingConfigs, playSound, language }) {
  const isTeacher = profile.role === 'profesor';
  const myConfig = gradingConfigs?.find(c => c.teacher_id === profile.id) || {
    weights: { tarea: 20, actividades: 10, evaluaciones: 30, examenes: 30, proyectos: 10 },
    grade_scale: 10,
    attendance_weight: 0,
    include_attendance: false
  };

  const [weights, setWeights] = useState(myConfig.weights);
  const [globalScale, setGlobalScale] = useState(myConfig.grade_scale);
  const [attWeight, setAttWeight] = useState(myConfig.attendance_weight || 0);
  const [incAtt, setIncAtt] = useState(myConfig.include_attendance || false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const totalPercentage = Object.values(weights).reduce((a, b) => a + b, 0) + (incAtt ? attWeight : 0);

  const handleSave = async () => {
    if (totalPercentage !== 100) {
      playSound('error');
      setSaveStatus('error-percentage');
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    const configData = {
      teacher_id: profile.id,
      category: 'general',
      weights: weights,
      grade_scale: Number(globalScale),
      attendance_weight: Number(attWeight),
      include_attendance: incAtt
    };

    try {
      if (myConfig.id) {
        await api.put(`/data/grading_configs/${myConfig.id}`, configData);
      } else {
        await api.post('/data/grading_configs', configData);
      }
      setSaveStatus('success');
      playSound('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isTeacher) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
           <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto border-2 border-red-100 dark:border-red-800">
              <ShieldCheck className="text-red-500" size={40} />
           </div>
           <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{language === 'es' ? 'Acceso Restringido' : 'Restricted Access'}</h2>
           <p className="text-gray-500 font-medium">{language === 'es' ? 'Solo los profesores pueden acceder a la configuración del aula.' : 'Only teachers can access classroom settings.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter flex items-center gap-4">
            <Settings className="text-indigo-600" size={40} />
            {language === 'es' ? 'Configuración del Aula' : 'Classroom Settings'}
          </h1>
          <p className="text-gray-500 font-medium mt-2">{language === 'es' ? 'Define las reglas de evaluación, ponderaciones y parámetros administrativos.' : 'Define evaluation rules, weightings, and administrative parameters.'}</p>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`px-8 py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center gap-3 active:scale-95 ${totalPercentage === 100 ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25' : 'bg-gray-400 cursor-not-allowed'}`}
        >
          {isSaving ? <Clock className="animate-spin" /> : <Save />}
          {language === 'es' ? 'Aplicar Cambios' : 'Apply Changes'}
        </button>
      </div>

      {saveStatus === 'error-percentage' && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-4 text-red-700 dark:text-red-400 animate-shake">
           <AlertTriangle size={24} />
           <p className="font-black uppercase text-xs tracking-widest">{language === 'es' ? `Error: La suma de porcentajes es ${totalPercentage}%. Debe ser exactamente 100%.` : `Error: Sum of percentages is ${totalPercentage}%. Must be exactly 100%.`}</p>
        </div>
      )}

      {saveStatus === 'success' && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-2xl flex items-center gap-4 text-green-700 dark:text-green-400 animate-bounce-in">
           <CheckCircle2 size={24} />
           <p className="font-black uppercase text-xs tracking-widest">{language === 'es' ? 'Configuración guardada correctamente.' : 'Settings saved successfully.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: General Config */}
        <div className="lg:col-span-2 space-y-8">
           <section className="glass-card p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm space-y-8">
              <div className="flex items-center gap-4 pb-4 border-b dark:border-slate-800">
                 <Percent className="text-indigo-500" size={24} />
                 <h3 className="text-xl font-bold">{language === 'es' ? 'Sistema de Ponderación' : 'Weighting System'}</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                 {['tarea', 'actividades', 'evaluaciones', 'examenes', 'proyectos'].map(cat => (
                    <div key={cat} className="flex items-center gap-6 p-6 bg-gray-50 dark:bg-slate-900/50 rounded-3xl border border-gray-100 dark:border-slate-800 group hover:border-indigo-500/30 transition-all">
                       <div className="flex-1">
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{cat === 'tarea' ? (language === 'es' ? 'Tareas Individuales' : 'Individual Tasks') : cat}</p>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 italic">{language === 'es' ? `Peso porcentual de ${cat} en el promedio.` : `${cat} weight in GPA.`}</p>
                       </div>
                       <div className="flex items-center gap-3">
                          <input 
                            type="number"
                            value={weights[cat] || 0}
                            onChange={e => {
                              setWeights({...weights, [cat]: Math.max(0, Number(e.target.value))});
                              playSound('click');
                            }}
                            className="w-24 px-4 py-3 rounded-xl border-2 border-transparent bg-white dark:bg-slate-800 text-right font-black text-2xl text-indigo-600 focus:border-indigo-500 outline-none transition-all shadow-inner"
                          />
                          <span className="font-black text-gray-400">%</span>
                       </div>
                    </div>
                 ))}

                 {/* Attendance Integration */}
                 <div className={`p-6 rounded-[2rem] border-2 transition-all ${incAtt ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-gray-50/30 dark:bg-slate-900/20 border-gray-100 dark:border-slate-800 grayscale opacity-70'}`}>
                    <div className="flex items-center justify-between mb-6">
                       <div className="flex items-center gap-4">
                          <CalendarCheck className={incAtt ? 'text-amber-500' : 'text-gray-400'} size={28} />
                          <div>
                             <h4 className="font-black uppercase text-sm tracking-tight">{language === 'es' ? 'Ponderar Asistencia' : 'Weight Attendance'}</h4>
                             <p className="text-xs font-medium text-amber-900/60 dark:text-amber-200/60">{language === 'es' ? 'Habilitar el seguimiento de asistencia como parte del promedio.' : 'Enable attendance tracking as part of the GPA.'}</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => { setIncAtt(!incAtt); playSound('click'); }}
                         className={`w-14 h-8 rounded-full relative transition-all shadow-inner ${incAtt ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-700'}`}
                       >
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${incAtt ? 'left-7' : 'left-1'}`}></div>
                       </button>
                    </div>

                    {incAtt && (
                       <div className="flex items-center justify-between pt-6 border-t border-amber-200/50">
                          <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">{language === 'es' ? 'Peso de Asistencia' : 'Attendance Weight'}</span>
                          <div className="flex items-center gap-3">
                             <input 
                               type="number"
                               value={attWeight}
                               onChange={e => setAttWeight(Math.max(0, Number(e.target.value)))}
                               className="w-24 px-4 py-3 rounded-xl border-2 border-amber-200 bg-white dark:bg-slate-900 text-right font-black text-2xl text-amber-600 focus:border-amber-500 outline-none shadow-sm"
                             />
                             <span className="font-black text-amber-400">%</span>
                          </div>
                       </div>
                    )}
                 </div>
              </div>
           </section>
        </div>

        {/* Right: Summary & Legend */}
        <div className="space-y-8">
           <section className="glass-card p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 sticky top-24">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-indigo-100">{language === 'es' ? 'Resumen Académico' : 'Academic Summary'}</h3>
              
              <div className="space-y-6">
                 <div>
                    <p className="text-sm font-bold text-indigo-200 mb-1">{language === 'es' ? 'Total Ponderado' : 'Total Weight'}</p>
                    <div className="flex items-end gap-2">
                       <span className="text-7xl font-black tracking-tighter">{totalPercentage}</span>
                       <span className="text-2xl font-black text-indigo-300 mb-2">%</span>
                    </div>
                    <div className="h-2 w-full bg-indigo-400/30 rounded-full mt-4 overflow-hidden">
                       <div 
                         className={`h-full transition-all duration-700 ${totalPercentage === 100 ? 'bg-green-400' : totalPercentage > 100 ? 'bg-red-400' : 'bg-amber-400'}`}
                         style={{ width: `${Math.min(100, totalPercentage)}%` }}
                       ></div>
                    </div>
                    {totalPercentage !== 100 && (
                       <p className="text-[10px] font-black uppercase mt-3 text-indigo-200 animate-pulse">
                          {totalPercentage > 100 
                            ? (language === 'es' ? `Te sobran ${totalPercentage - 100}%` : `Extra ${totalPercentage - 100}%`)
                            : (language === 'es' ? `Falta ${100 - totalPercentage}% para llegar al 100%` : `Missing ${100 - totalPercentage}% to reach 100%`)}
                       </p>
                    )}
                 </div>

                 <div className="pt-6 border-t border-indigo-400/30 space-y-4">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-indigo-100 uppercase tracking-widest">{language === 'es' ? 'Escala de Evaluación' : 'Grading Scale'}</label>
                       <div className="relative">
                          <input 
                            type="number"
                            value={globalScale}
                            onChange={e => setGlobalScale(Number(e.target.value))}
                            className="w-full bg-indigo-900/30 border-2 border-indigo-400/50 rounded-2xl p-4 text-3xl font-black text-white outline-none focus:border-white transition-all"
                          />
                          <Award className="absolute right-6 top-1/2 -translate-y-1/2 text-indigo-300" size={32} />
                       </div>
                       <p className="text-[10px] font-bold text-indigo-200/70 italic">{language === 'es' ? 'Define la nota máxima (ej: 10 o 100).' : 'Set max grade (e.g., 10 or 100).'}</p>
                    </div>
                 </div>
              </div>
           </section>

           <div className="p-6 bg-gray-50/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 space-y-4">
              <div className="flex items-start gap-4 text-gray-400">
                 <Info size={18} className="shrink-0 mt-1" />
                 <p className="text-xs font-medium leading-relaxed">
                    {language === 'es' 
                      ? 'Los cambios en la ponderación se aplicarán inmediatamente a todos los estudiantes y sus promedios se recalcularán automáticamente.'
                      : 'Weighting changes will apply immediately to all students, and GPAs will be recalculated automatically.'}
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
