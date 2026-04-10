const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://aprende_python_db_user:SnO6NdXUezRvBUs9ydKWSn79wTEweLiM@dpg-d7chpg9f9bms738ni3ng-a.oregon-postgres.render.com/aprende_python_db';
const sqlPath = 'c:\\Users\\Calaveroli127\\Downloads\\Aprende Python\\server\\schema.sql';

async function init() {
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  try {
    console.log('Conectando a Render PostgreSQL...');
    await client.connect();
    console.log('Conectado. Leyendo esquema...');
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Ejecutando esquema SQL...');
    
    await client.query(sql);
    console.log('¡Base de datos inicializada correctamente en Render!');
    
  } catch (err) {
    console.error('Error inicializando la base de datos:', err);
  } finally {
    await client.end();
  }
}

init();
