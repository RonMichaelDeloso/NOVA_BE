import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const rawPool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  database: process.env.DB_NAME || process.env.PGDATABASE || 'nova_db',
  user: process.env.DB_USER || process.env.PGUSER || 'postgres',
  password: String(process.env.DB_PASSWORD || process.env.PGPASSWORD || ''),
  max: 10,
  idleTimeoutMillis: 30000
});

export const pool = {
  async query(sqlText, params = []) {
    let paramIndex = 1;
    let convertedSql = sqlText.replace(/\?/g, () => `$${paramIndex++}`);

    // Replace MySQL DATE_FORMAT functions with PostgreSQL TO_CHAR
    convertedSql = convertedSql
      .replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m-%d'\)/gi, "TO_CHAR($1, 'YYYY-MM-DD')")
      .replace(/DATE_FORMAT\(([^,]+),\s*'%H:%i'\)/gi, "TO_CHAR($1, 'HH24:MI')")
      .replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m-%d %H:%i'\)/gi, "TO_CHAR($1, 'YYYY-MM-DD HH24:MI')");

    // Automatically append RETURNING id for INSERT statements if not present
    const isInsert = /^\s*INSERT\s+INTO/i.test(convertedSql);
    if (isInsert && !/RETURNING/i.test(convertedSql)) {
      convertedSql = `${convertedSql} RETURNING id`;
    }

    const res = await rawPool.query(convertedSql, params);

    const insertId = isInsert && res.rows[0]?.id ? res.rows[0].id : null;
    const meta = {
      insertId,
      affectedRows: res.rowCount,
      rowCount: res.rowCount
    };

    return [res.rows, meta];
  },

  async end() {
    return rawPool.end();
  }
};

export default pool;
