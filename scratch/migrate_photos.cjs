/**
 * Script de Migración de Fotos: Firebase -> Supabase
 * Ejecución: node scratch/migrate_photos.js
 */
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no encontrada en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function migrate() {
  console.log('🚀 Iniciando migración de fotos de perfil...');

  // 1. Obtener perfiles que tienen URLs de Firebase
  const { data: profiles, error: fetchError } = await supabase
    .from('profiles')
    .select('id, photo_url')
    .ilike('photo_url', '%firebasestorage%');

  if (fetchError) {
    console.error('❌ Error al obtener perfiles:', fetchError);
    return;
  }

  console.log(`📊 Encontrados ${profiles.length} perfiles para migrar.`);

  for (const profile of profiles) {
    try {
      console.log(`\n⏳ Procesando usuario: ${profile.id}...`);
      
      // 2. Descargar la imagen de Firebase
      const response = await axios.get(profile.photo_url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const extension = contentType.split('/')[1] || 'jpg';
      
      const fileName = `${profile.id}_${Date.now()}.${extension}`;
      const filePath = `avatars/${fileName}`;

      // 3. Subir a Supabase Storage (Bucket: profiles)
      const { error: uploadError } = await supabase
        .storage
        .from('profiles')
        .upload(filePath, buffer, {
          contentType,
          upsert: true
        });

      if (uploadError) {
        console.error(`  ❌ Error subiendo a Supabase Storage:`, uploadError);
        continue;
      }

      // 4. Obtener la URL pública de la nueva imagen
      const { data: { publicUrl } } = supabase
        .storage
        .from('profiles')
        .getPublicUrl(filePath);

      // 5. Actualizar el perfil en la tabla 'profiles'
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) {
        console.error(`  ❌ Error actualizando tabla profiles:`, updateError);
      } else {
        console.log(`  ✅ Migrado con éxito: ${publicUrl}`);
      }

    } catch (e) {
      console.error(`  ❌ Error procesando usuario ${profile.id}:`, e.message);
    }
  }

  console.log('\n🏁 Migración finalizada.');
}

migrate();
