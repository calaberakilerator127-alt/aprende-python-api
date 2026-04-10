import api from './api';
import socket from './socket';

/**
 * SHIM DE COMPATIBILIDAD (SUPABASE -> API INDEPENDIENTE)
 * Este objeto imita la sintaxis de Supabase para que el código existente siga funcionando
 * sin necesidad de reescribir docenas de archivos.
 */
class SupabaseShim {
  constructor() {
    this.auth = {
      getUser: async () => {
        try {
          const { data } = await api.get('/auth/me');
          return { data: { user: data }, error: null };
        } catch (e) {
          return { data: { user: null }, error: e };
        }
      },
      signOut: async () => {
        localStorage.clear();
        window.location.reload();
      }
    };
  }

  from(table) {
    const builder = {
      table,
      _filters: {},
      _limit: null,
      _order: null,

      _upsert: false,

      select: (columns) => builder,
      eq: (col, val) => {
        builder._filters[col] = val;
        return builder;
      },
      order: (col, opts) => {
        builder._order = col;
        return builder;
      },
      limit: (n) => {
        builder._limit = n;
        return builder;
      },
      single: async () => {
        const { data, error } = await builder;
        return { data: Array.isArray(data) ? data[0] : data, error };
      },
      contains: (col, val) => builder, // Simplificado

      // Ejecución (Thenable)
      then: async (resolve, reject) => {
        try {
          if (builder._method === 'upsert') {
            const { data } = await api.post(`/data/${builder.table}`, builder._payload); // El backend maneja ON CONFLICT si se define en schema
            return resolve({ data, error: null });
          }
          
          if (builder._method === 'insert') {
            const { data } = await api.post(`/data/${builder.table}`, builder._payload);
            return resolve({ data, error: null });
          }
          if (builder._method === 'update') {
            // El id suele estar en los filtros de .eq('id', id)
            const id = builder._filters.id;
            const { data } = await api.put(`/data/${builder.table}/${id}`, builder._payload);
            return resolve({ data, error: null });
          }
          if (builder._method === 'delete') {
            const id = builder._filters.id;
            const { data } = await api.delete(`/data/${builder.table}/${id}`);
            return resolve({ data, error: null });
          }
          
          // Por defecto es un SELECT
          const { data } = await api.get(`/data/${builder.table}`);
          let filteredData = data;
          
          // Aplicar filtros básicos localmente (opcional si el backend no lo hace)
          Object.keys(builder._filters).forEach(key => {
            filteredData = filteredData.filter(item => item[key] == builder._filters[key]);
          });
          
          resolve({ data: filteredData, error: null });
        } catch (err) {
          console.error(`Error en Supabase Shim (${builder.table}):`, err);
          resolve({ data: null, error: err });
        }
      },

      insert: (payload) => {
        builder._method = 'insert';
        builder._payload = payload;
        return builder;
      },
      update: (payload) => {
        builder._method = 'update';
        builder._payload = payload;
        return builder;
      },
      delete: () => {
        builder._method = 'delete';
        return builder;
      },
      upsert: (payload) => {
        builder._method = 'upsert';
        builder._payload = payload;
        return builder;
      }
    };
    return builder;
  }

  get storage() {
    return {
      from: (bucket) => ({
        upload: async (path, file) => {
          const formData = new FormData();
          formData.append('file', file);
          const { data } = await api.post('/upload', formData);
          return { data: { path: data.filename }, error: null };
        },
        remove: async (paths) => {
          // Opcional: Implementar borrado real si el backend tiene DELETE /upload/:filename
          return { data: null, error: null };
        },
        getPublicUrl: (path) => ({
          data: { publicUrl: `${api.defaults.baseURL.replace('/api', '')}/uploads/${path}` }
        })
      })
    };
  }

  channel(name) {
    const chan = {
      on: (type, config, callback) => {
        if (type === 'postgres_changes') {
          socket.on('db_change', (payload) => {
            // Filtrar por tabla si se especifica en config
            if (config.table && payload.table !== config.table) return;
            callback(payload);
          });
        }
        return chan;
      },
      subscribe: () => {
        if (!socket.connected) socket.connect();
        return chan;
      },
      unsubscribe: () => {
        return chan;
      },
      track: (state) => {
        // Mapear a lógica de presencia de sockets si es necesario
        return Promise.resolve();
      }
    };
    return chan;
  }

  // Compatibilidad con getChannels de useTyping
  getChannels() {
    return [];
  }

  removeChannel(chan) {
    // No hacer nada, el socket gestiona sus propios eventos
  }
}

export const supabase = new SupabaseShim();

export const getSupabaseUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
