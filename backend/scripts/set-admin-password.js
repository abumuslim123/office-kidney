#!/usr/bin/env node
'use strict';
// Устанавливает пароль пользователя admin. Загружает .env из backend/.
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}
loadEnv();

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'kidney_office',
};

const newPassword = process.argv[2] || process.env.SEED_ADMIN_PASSWORD || 'admin123';

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    const hash = await bcrypt.hash(newPassword, 10);
    const r = await client.query(
      `UPDATE users SET "passwordHash" = $1 WHERE login = 'admin' RETURNING id`,
      [hash]
    );
    if (r.rowCount === 0) {
      console.log('User with login "admin" not found.');
      process.exit(1);
    }
    console.log('Admin password updated.');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
