const { Pool } = require('pg');

const config = {
  host: 'localhost',
  port: 5151,
  user: 'postgres',
  password: '5151',
};

const pool = new Pool({ ...config, database: 'laboratorio' });

async function garantirBanco() {
  const admin = new Pool({ ...config, database: 'postgres' });
  try {
    const { rows } = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'laboratorio'");
    if (rows.length === 0) {
      await admin.query('CREATE DATABASE laboratorio');
      console.log('Banco "laboratorio" criado com sucesso.');
    }
  } finally {
    await admin.end();
  }
}

module.exports = { pool, garantirBanco };
