/**
 * Determines if a user is considered "online" based on their status flag
 * and the lastSeen timestamp (threshold of 5 minutes).
 */
export function isUserOnline(user) {
  if (!user) return false;
  if (user.status === 'online') return true;
  
  // Si dice offline pero lastSeen es muy reciente (menos de 5 min), 
  // podría ser un error de sincronización de la sesión.
  if (user.lastSeen) {
    const diff = Date.now() - user.lastSeen;
    return diff < 300000; // 5 minutos en ms
  }
  
  return false;
}

/**
 * Formats the "last seen" time into a human-readable string.
 */
export function formatLastSeen(timestamp, language = 'es') {
  if (!timestamp) return language === 'es' ? 'Nunca' : 'Never';
  
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return language === 'es' ? 'Hace un momento' : 'Just now';
  } else if (minutes < 60) {
    return language === 'es' ? `Hace ${minutes} min` : `${minutes}m ago`;
  } else if (hours < 24) {
    return language === 'es' ? `Hace ${hours} h` : `${hours}h ago`;
  } else if (days < 7) {
    return language === 'es' ? `Hace ${days} d` : `${days}d ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}
