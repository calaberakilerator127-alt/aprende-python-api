import React, { useState } from 'react';
import { User, Camera, Save, Loader2, Mail, Calendar as CalendarIcon, Trash2, AlertTriangle, ShieldCheck, Settings, Heart, Bell, Volume2, Globe, Clock, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { supabase } from '../config/supabase';
import { useSettings } from '../hooks/SettingsContext';
import { useSound } from '../hooks/useSound';
import { isUserOnline, formatLastSeen } from '../utils/presenceUtils';

export default function ProfileView({ profile, isOwnProfile = true, updateProfileData, handleDeleteAccount, showToast, attendance = [], events = [], currentUserRole, handlePasswordChange, handleAdminResetPassword, users = [] }) {
  const { 
    soundsEnabled, setSoundsEnabled, 
    notificationsEnabled, setNotificationsEnabled, 
    language, setLanguage, 
    soundSettings, setSoundSettings,
    t 
  } = useSettings();
  const { playSound } = useSound();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Password management state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Admin Tools State
  const isAdmin = currentUserRole === 'admin';
  const isDeveloper = currentUserRole === 'developer';
  const canManage = isAdmin || isDeveloper;

  if (!profile) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <p className="text-gray-500 font-bold animate-pulse">{language === 'es' ? 'Cargando perfil...' : 'Loading profile...'}</p>
    </div>
  );

  const handleSoundChange = (category, value) => {
    setSoundSettings(prev => ({ ...prev, [category]: value }));
    playSound(value);
  };

  const safeDate = (timestamp) => {
    try {
      const d = new Date(timestamp);
      return isNaN(d.getTime()) ? (language === 'es' ? 'Reciente' : 'Recent') : d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium' });
    } catch(e) { return language === 'es' ? 'Reciente' : 'Recent'; }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
        };
      };
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const success = await updateProfileData({ name, bio });
    if (success) {
      showToast(language === 'es' ? 'Perfil actualizado con éxito' : 'Profile updated successfully');
      setIsEditing(false);
    } else {
      showToast(language === 'es' ? 'Error al actualizar perfil' : 'Error updating profile', 'error');
    }
    setIsSaving(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressedBlob = await compressImage(file);
      const fileName = `${profile.id}_${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, compressedBlob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      const success = await updateProfileData({ photo_url: publicUrl });
      if (success) {
        showToast(language === 'es' ? 'Foto de perfil lista' : 'Profile picture ready');
      } else {
        throw new Error('Database update failed');
      }
    } catch (e) {
      console.error(e);
      showToast(language === 'es' ? 'Error al subir foto' : 'Error uploading photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onPasswordUpdate = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast(language === 'es' ? 'Las contraseñas no coinciden' : 'Passwords do not match', 'error');
      return;
    }
    setIsChangingPassword(true);
    try {
      await handlePasswordChange(currentPassword, newPassword);
      showToast(language === 'es' ? 'Contraseña actualizada' : 'Password updated successfully');
      setShowPasswordForm(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setIsChangingPassword(false); }
  };

  const handleAdminRoleChange = async (newRole) => {
    if (!profile.id) return;
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id);
      if (error) throw error;
      showToast(language === 'es' ? 'Rol actualizado' : 'Role updated');
    } catch (e) { showToast(t('error'), 'error'); }
  };

  const handleAdminReset = async () => {
    const ok = window.confirm(t('force_reset') + '?');
    if (!ok) return;
    try {
      await handleAdminResetPassword(profile.email);
      showToast(language === 'es' ? 'Enlace de reseteo enviado' : 'Reset link sent');
    } catch (e) { showToast(t('error'), 'error'); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Profile Header Card */}
      <div className="glass-card rounded-[3rem] shadow-2xl border border-gray-100 dark:border-slate-700/50 overflow-hidden relative">
        <div className="h-40 md:h-56 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')] opacity-10"></div>
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
        
        <div className="px-6 md:px-12 pb-10">
          <div className="relative -mt-20 mb-8 flex flex-col md:flex-row md:items-end gap-8">
            <div className="relative group self-center md:self-auto">
              <div className="w-40 h-40 md:w-48 md:h-48 rounded-[2.5rem] overflow-hidden border-[6px] border-white dark:border-slate-800 shadow-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center transition-transform group-hover:scale-[1.02] duration-500">
                {profile.photo_url ? (
                  <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={80} className="text-gray-300 dark:text-gray-500" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20">
                     <Loader2 className="animate-spin text-white" size={40} />
                  </div>
                )}
              </div>
              {isOwnProfile && (
                <label htmlFor="avatar-upload" className="absolute bottom-3 right-3 p-3 bg-indigo-600 text-white rounded-2xl shadow-xl cursor-pointer hover:bg-indigo-700 hover:scale-110 transition-all active:scale-95 z-10 border-2 border-white dark:border-slate-800">
                  <Camera size={20} />
                  <input id="avatar-upload" name="avatar-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row justify-between items-center md:items-end gap-6 text-center md:text-left">
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter">{profile.name || 'Anonymous'}</h1>
                  <span className="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm inline-flex items-center gap-2">
                    <ShieldCheck size={12} />
                    {profile.role || 'Guest'}
                  </span>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <span className={`w-2 h-2 rounded-full ${isUserOnline(profile) ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                       {isUserOnline(profile) 
                         ? (language === 'es' ? 'En línea' : 'Online') 
                         : (language === 'es' ? `Visto: ${formatLastSeen(profile.last_seen, language)}` : `Seen: ${formatLastSeen(profile.last_seen, language)}`)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center md:justify-start gap-5 text-sm font-bold text-gray-500 dark:text-slate-400">
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <Mail size={16} className="text-indigo-500" />
                    <span className="max-w-[150px] md:max-w-none truncate">{profile.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <Clock size={16} className="text-indigo-500" />
                    <span>{t('joined')} {safeDate(profile.created_at)}</span>
                  </div>
                </div>
              </div>
              {isOwnProfile && (
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className={`group flex items-center gap-2 px-8 py-4 rounded-[1.25rem] font-black text-sm uppercase tracking-widest transition-all shadow-lg hover-spring focus-visible:ring-inset ${isEditing ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400' : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-slate-800 hover:shadow-indigo-500/10'}`}
                >
                  {isEditing ? t('cancel_edit') : <><Settings size={18} className="group-hover:rotate-90 transition-transform" /> {t('edit_profile')}</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {canManage && !isOwnProfile && (
        <div className="glass-card p-8 rounded-[3rem] border-2 border-amber-500/20 shadow-xl bg-amber-500/5 animate-fade-in space-y-6">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                <ShieldCheck size={24} />
                <h3 className="text-xl font-black uppercase tracking-tight">{t('admin_panel')}</h3>
              </div>
              <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">{isAdmin ? 'ADMIN ACCESS' : 'DEV ACCESS'}</span>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label htmlFor="admin-role-select" className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t('change_role')}</label>
                <select 
                  id="admin-role-select"
                  name="admin-role-select"
                  defaultValue={profile.role}
                  onChange={(e) => handleAdminRoleChange(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border-2 border-amber-500/10 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-amber-500 transition-all shadow-sm"
                >
                  <option value="estudiante">{t('student')}</option>
                  <option value="profesor">{t('teacher')}</option>
                  {isDeveloper && <option value="admin">Administrador</option>}
                  {isDeveloper && <option value="developer">Desarrollador</option>}
                </select>
              </div>
              <div className="flex items-end">
                 <button onClick={handleAdminReset} className="w-full py-3 px-6 bg-white dark:bg-slate-800 text-amber-600 border-2 border-amber-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all shadow-md">
                   {t('force_reset')}
                 </button>
              </div>
              {isDeveloper && (
                <div className="flex items-end gap-3">
                   <button 
                     onClick={async () => {
                       const confirm = window.confirm(language === 'es' ? '¿ELIMINAR ESTA CUENTA PARA SIEMPRE?' : 'DELETE THIS ACCOUNT FOREVER?');
                       return confirm && handleDeleteAccount();
                     }} 
                     className="flex-1 py-3 px-6 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                   >
                     {t('delete_user')}
                   </button>
                </div>
              )}
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-8 md:p-12 rounded-[3rem] shadow-xl border border-gray-100 dark:border-slate-700/50">
            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-8 animate-fade-in">
                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-3">
                    <label htmlFor="profileNameInput" className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-2">{t('public_name')}</label>
                    <input 
                      id="profileNameInput"
                      name="profileNameInput"
                      required value={name} onChange={e => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-black text-lg shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <label htmlFor="profileBioInput" className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-2">{t('bio_label')}</label>
                    <textarea 
                      id="profileBioInput"
                      name="profileBioInput"
                      rows="6" value={bio} onChange={e => setBio(e.target.value)}
                      placeholder={t('bio_placeholder')}
                      className="w-full px-6 py-4 rounded-3xl border-2 border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-base font-medium shadow-inner resize-none"
                    ></textarea>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button 
                    disabled={isSaving} type="submit" 
                    className="flex items-center justify-center gap-3 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/30 hover-spring disabled:opacity-50 w-full md:w-auto uppercase tracking-widest"
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {t('save_changes')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-12 animate-fade-in text-gray-900 dark:text-white">
                <section className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                      <Heart size={20} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">{language === 'es' ? 'Sobre mí' : 'About me'}</h3>
                  </div>
                  <p className="text-xl md:text-2xl font-medium leading-relaxed italic text-gray-600 dark:text-slate-300">
                    {profile.bio || t('no_bio')}
                  </p>
                </section>

                {profile.role === 'estudiante' && (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600">
                          <CalendarIcon size={20} />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">{language === 'es' ? 'Historial de Asistencia' : 'Attendance History'}</h3>
                      </div>
                      <div className="text-[10px] font-black text-gray-400 bg-gray-50 dark:bg-slate-900 px-3 py-1 rounded-full border border-gray-100 dark:border-slate-800">
                         {attendance.filter(a => a.student_id === profile.id && a.is_present).length} PRESENCIAS
                      </div>
                    </div>
                    
                    <div className="overflow-hidden rounded-[2rem] border-2 border-slate-50 dark:border-slate-800/50 shadow-sm bg-slate-50/30 dark:bg-slate-900/20">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-white dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                              <th className="px-8 py-5 font-black">{language === 'es' ? 'Actividad / Clase' : 'Activity / Class'}</th>
                              <th className="px-8 py-5 text-right font-black">{language === 'es' ? 'Estado' : 'Status'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {events.filter(e => {
                               const isAssigned = e.assigned_to?.includes('all') || e.assigned_to?.includes(profile.id);
                               const isPast = e.status === 'finalizada' || new Date(e.start_date || e.date) < new Date();
                               return isAssigned && isPast;
                            }).sort((a,b)=>new Date(b.start_date || b.date)-new Date(a.start_date || a.date)).map(ev => {
                               const att = attendance.find(a => a.event_id === ev.id && a.student_id === profile.id);
                               const eventDate = ev.start_date || ev.date || Date.now();
                               return (
                                  <tr key={ev.id} className="group hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                                     <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                          <div className={`w-2 h-2 rounded-full ${att?.is_present ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-400'} shrink-0`}></div>
                                          <div>
                                            <p className="font-black text-base text-gray-800 dark:text-gray-100 mb-1 leading-tight">{ev.title}</p>
                                            <p className="text-[10px] text-gray-400 font-black tracking-widest uppercase">{new Date(eventDate).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                          </div>
                                        </div>
                                     </td>
                                     <td className="px-8 py-6 text-right">
                                        {att?.is_present === true ? (
                                           <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-green-200 dark:border-green-800 shadow-sm inline-flex items-center gap-2">
                                              <CheckCircle2 size={12} /> {language === 'es' ? 'Presente' : 'Present'}
                                           </span>
                                        ) : att?.is_present === false ? (
                                           <span className="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-900/50 shadow-sm inline-flex items-center gap-2">
                                              <XCircle size={12} /> {language === 'es' ? 'Falta' : 'Absent'}
                                           </span>
                                        ) : (
                                           <span className="bg-gray-100 text-gray-400 dark:bg-slate-800/50 dark:text-slate-500 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-200 dark:border-slate-700 shadow-sm inline-flex items-center gap-2">
                                              <MinusCircle size={12} /> {language === 'es' ? 'Pendiente' : 'No Record'}
                                           </span>
                                        )}
                                     </td>
                                  </tr>
                               )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {isOwnProfile && (
            <>
              <div className="glass-card p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-700/50 space-y-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-3 mb-6">
                    <Settings size={16} className="text-indigo-500" />
                    {t('settings_title')}
                  </h3>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                          <Volume2 size={16} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('sys_sounds')}</span>
                      </div>
                      <label htmlFor="sounds-switch" className="relative inline-flex items-center cursor-pointer">
                        <input id="sounds-switch" type="checkbox" className="sr-only peer" checked={soundsEnabled} onChange={() => setSoundsEnabled(!soundsEnabled)} />
                        <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600">
                          <Bell size={16} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('sys_notifications')}</span>
                      </div>
                      <label htmlFor="notifications-switch" className="relative inline-flex items-center cursor-pointer">
                        <input id="notifications-switch" type="checkbox" className="sr-only peer" checked={notificationsEnabled} onChange={() => setNotificationsEnabled(!notificationsEnabled)} />
                        <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
                          <Globe size={16} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('language')}</span>
                      </div>
                      <label htmlFor="language-select" className="sr-only">{t('language')}</label>
                      <select 
                        id="language-select"
                        name="language-select"
                        value={language} onChange={(e) => setLanguage(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-black rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
                      >
                        <option value="es">🇪🇸 ES</option>
                        <option value="en">🇺🇸 EN</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card p-8 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-700/50 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/20"></div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-3">
                  <ShieldCheck size={18} className="text-indigo-500" />
                  {language === 'es' ? 'Seguridad y Cuenta' : 'Security & Account'}
                </h3>
                {showPasswordForm ? (
                  <form onSubmit={onPasswordUpdate} className="space-y-4 animate-fade-in">
                    <input 
                      required type="password" placeholder={language === 'es' ? 'Contraseña Actual' : 'Current Password'}
                      value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 dark:border-slate-800 dark:bg-slate-900 outline-none focus:border-indigo-500 text-xs font-bold transition-all"
                    />
                    <input 
                      required type="password" placeholder={language === 'es' ? 'Nueva Contraseña' : 'New Password'}
                      value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 dark:border-slate-800 dark:bg-slate-900 outline-none focus:border-indigo-500 text-xs font-bold transition-all"
                    />
                    <div className="flex gap-2">
                       <button type="submit" disabled={isChangingPassword} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md">
                         {isChangingPassword ? <Loader2 className="animate-spin mx-auto" size={14} /> : (language === 'es' ? 'Actualizar' : 'Update')}
                       </button>
                    </div>
                  </form>
                ) : (
                  <button onClick={()=>setShowPasswordForm(true)} className="w-full py-4 px-6 bg-white dark:bg-slate-900 text-indigo-600 border-2 border-indigo-100 dark:border-indigo-900/20 rounded-2xl hover:bg-indigo-50 transition-all text-xs font-black uppercase tracking-widest">
                    {language === 'es' ? 'Cambiar Contraseña' : 'Change Password'}
                  </button>
                )}
              </div>

              <div className="glass-card bg-red-50/50 dark:bg-red-900/5 p-8 rounded-[2.5rem] space-y-6 border border-red-100 dark:border-red-900/20 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400 flex items-center gap-3">
                  <AlertTriangle size={18} /> {t('danger_zone')}
                </h3>
                <button onClick={() => window.confirm(t('delete_account_warn')) && handleDeleteAccount()} className="w-full py-4 px-6 bg-white dark:bg-slate-900 text-red-600 border-2 border-red-100 dark:border-red-900/40 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-xs font-black uppercase tracking-widest shadow-lg active:scale-95">
                  <Trash2 size={18} /> {t('delete_account_btn')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
