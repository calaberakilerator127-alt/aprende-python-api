import api from '../config/api';

/**
 * Logs an administrative action to the audit logs collection.
 * @param {Object} adminInfo - { id, name, role }
 * @param {string} action - Descriptive name of the action (e.g., 'ban_user', 'edit_report')
 * @param {string} entityId - ID of the target resource (user, report, changelog entry)
 * @param {Object} before - Previous state of the entity (optional)
 * @param {Object} after - New state of the entity (optional)
 */
export const logAdminAction = async (adminInfo, action, entityId, before = null, after = null) => {
  try {
    await api.post('/data/audit_logs', {
      admin_id: adminInfo.id,
      admin_name: adminInfo.name,
      admin_role: adminInfo.role || 'developer',
      action,
      entity_id: entityId,
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
      created_at: new Date().toISOString()
    });
    
    return true;
  } catch (e) {
    console.error("Error logging admin action:", e);
    return false;
  }
};
