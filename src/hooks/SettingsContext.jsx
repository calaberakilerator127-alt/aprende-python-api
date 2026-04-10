import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  es: {
    app_title: "APRENDE PYTHON",
    python_lms: "PYTHON LMS",
    continue_google: "Continuar con Google",
    guest_login: "Acceder en Modo Prueba (Invitado)",
    login_loading: "Iniciando sesión...",
    profile_setup: "Perfil configurado",
    error: "Error",
    full_name: "Nombre Completo",
    what_are_you: "¿Qué eres?",
    select_role: "Selecciona un rol...",
    student: "Estudiante",
    teacher: "Profesor",
    finish_registration: "Finalizar Registro",
    cancel: "Cancelar",
    
    // Menu
    nav_dashboard: "Inicio",
    nav_tasks: "Tareas",
    nav_evaluations: "Evaluaciones",
    nav_grades: "Calificaciones",
    nav_calendar: "Calendario",
    nav_materials: "Materiales",
    nav_codelab: "Laboratorio de Código",
    nav_chat: "Chat Clase",
    nav_profile: "Mi Perfil",
    
    logout: "Cerrar Sesión",
    notifications: "Notificaciones",
    close: "Cerrar",
    no_notifications: "No tienes avisos nuevos.",
    created_by: "Creado por",

    // Profile Settings
    settings_title: "⚙️ Configuración",
    sys_sounds: "Sonidos del Sistema",
    sys_notifications: "Recibir Notificaciones",
    language: "Idioma",
    danger_zone: "Zona de Peligro",
    delete_account_warn: "Borrar tu cuenta eliminará tus datos personales del sistema definitivamente.",
    delete_account_btn: "Eliminar mi cuenta para siempre",
    edit_profile: "Editar Perfil",
    cancel_edit: "Cancelar",
    save_changes: "Guardar Cambios",
    public_name: "Nombre Público",
    bio_label: "Sobre mí (Biografía)",
    bio_placeholder: "Cuéntanos un poco sobre ti...",
    no_bio: "No has añadido una biografía todavía. ¡Cuéntale a la clase algo sobre ti!",
    joined: "Unido en:",

    // Sounds
    customize_sounds: "Personalizar Sonidos",
    sound_for_chat: "Sonido para Chat",
    sound_for_task: "Sonido para Tareas",
    sound_for_meeting: "Sonido para Clases",
    sound_bubble: "Burbuja",
    sound_bell: "Campana",
    sound_classic: "Clásico",
    sound_default: "Predeterminado",

    // Feedback
    feedback_title: "Feedback y Reportes",
    new_report: "Nuevo Reporte",
    report_id: "ID",
    report_title: "Título",
    category: "Categoría",
    status: "Estado",
    author: "Autor",
    date: "Fecha",
    comments: "Comentarios",
    likes: "Likes",
    no_reports: "No hay reportes todavía.",
    status_unsolved: "No solucionado",
    status_process: "En proceso",
    status_solved: "Solucionado",
    cat_error: "Error",
    cat_improvement: "Mejora",
    cat_ideas: "Ideas",
    cat_problems: "Problemas",
    save_report: "Enviar Reporte",
    write_comment: "Escribir un comentario...",
    attachment_label: "Adjuntar archivo",

    // Changelog
    changelog_title: "Historial de Cambios",
    version: "Versión",
    new: "Novedades",
    improvements: "Mejoras",
    fixes: "Correcciones",
    removals: "Retirado",

    // Admin
    admin_panel: "Panel de Administración",
    manage_user: "Gestionar Usuario",
    change_role: "Cambiar Rol",
    force_reset: "Forzar Reseteo de Contraseña",
    delete_user: "Eliminar Usuario",
    ban_user: "Banear Usuario",
    privileged_account: "Cuenta Privilegiada",
    switch_to_student: "Vista Estudiante",
    switch_to_teacher: "Vista Profesor",
    switch_to_developer: "Vista Desarrollador",
    switch_to_admin: "Vista Admin"
  },
  en: {
    app_title: "LEARN PYTHON",
    python_lms: "PYTHON LMS",
    continue_google: "Continue with Google",
    guest_login: "Access as Guest (Test Mode)",
    login_loading: "Logging in...",
    profile_setup: "Profile setup complete",
    error: "Error",
    full_name: "Full Name",
    what_are_you: "What are you?",
    select_role: "Select a role...",
    student: "Student",
    teacher: "Teacher",
    finish_registration: "Finish Registration",
    cancel: "Cancel",
    
    // Menu
    nav_dashboard: "Dashboard",
    nav_tasks: "Tasks",
    nav_evaluations: "Evaluations",
    nav_grades: "Grades",
    nav_calendar: "Calendar",
    nav_materials: "Materials",
    nav_codelab: "Code Lab",
    nav_chat: "Class Chat",
    nav_profile: "My Profile",
    
    logout: "Log Out",
    notifications: "Notifications",
    close: "Close",
    no_notifications: "You have no new notifications.",
    created_by: "Created by",

    // Profile Settings
    settings_title: "⚙️ Settings",
    sys_sounds: "System Sounds",
    sys_notifications: "Receive Notifications",
    language: "Language",
    danger_zone: "Danger Zone",
    delete_account_warn: "Deleting your account will permanently remove your personal data from the system.",
    delete_account_btn: "Delete my account permanently",
    edit_profile: "Edit Profile",
    cancel_edit: "Cancel",
    save_changes: "Save Changes",
    public_name: "Public Name",
    bio_label: "About me (Bio)",
    bio_placeholder: "Tell us a bit about yourself...",
    no_bio: "You haven't added a bio yet. Tell the class something about yourself!",
    joined: "Joined:",

    // Sounds
    customize_sounds: "Customize Sounds",
    sound_for_chat: "Sound for Chat",
    sound_for_task: "Sound for Tasks",
    sound_for_meeting: "Sound for Meetings",
    sound_bubble: "Bubble",
    sound_bell: "Bell",
    sound_classic: "Classic",
    sound_default: "Default",

    // Feedback
    feedback_title: "Feedback & Reports",
    new_report: "New Report",
    report_id: "ID",
    report_title: "Title",
    category: "Category",
    status: "Status",
    author: "Author",
    date: "Date",
    comments: "Comments",
    likes: "Likes",
    no_reports: "No reports yet.",
    status_unsolved: "Unsolved",
    status_process: "In Progress",
    status_solved: "Solved",
    cat_error: "Error",
    cat_improvement: "Improvement",
    cat_ideas: "Ideas",
    cat_problems: "Problems",
    save_report: "Submit Report",
    write_comment: "Write a comment...",
    attachment_label: "Attach file",

    // Changelog
    changelog_title: "Change Log",
    version: "Version",
    new: "New",
    improvements: "Improvements",
    fixes: "Fixes",
    removals: "Removals",

    // Admin
    admin_panel: "Admin Panel",
    manage_user: "Manage User",
    change_role: "Change Role",
    force_reset: "Force Password Reset",
    delete_user: "Delete User",
    ban_user: "Ban User",
    privileged_account: "Privileged Account",
    switch_to_student: "Student View",
    switch_to_teacher: "Teacher View",
    switch_to_developer: "Developer View",
    switch_to_admin: "Admin View"
  }
};

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    return localStorage.getItem('soundsEnabled') !== 'false';
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notificationsEnabled') !== 'false';
  });
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'es';
  });
  const [soundSettings, setSoundSettings] = useState(() => {
    const saved = localStorage.getItem('soundSettings');
    return saved ? JSON.parse(saved) : { chat: 'bubble', task: 'bell', meeting: 'classic' };
  });

  useEffect(() => {
    localStorage.setItem('soundsEnabled', soundsEnabled);
  }, [soundsEnabled]);

  useEffect(() => {
    localStorage.setItem('notificationsEnabled', notificationsEnabled);
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('soundSettings', JSON.stringify(soundSettings));
  }, [soundSettings]);

  const t = (key) => {
    return translations[language]?.[key] || key;
  };

  return (
    <SettingsContext.Provider value={{
      soundsEnabled, setSoundsEnabled,
      notificationsEnabled, setNotificationsEnabled,
      language, setLanguage,
      soundSettings, setSoundSettings,
      t
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => useContext(SettingsContext);
