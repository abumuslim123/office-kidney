#!/usr/bin/env node
'use strict';
// Создаёт БД kidney_office, если её нет. Загружает .env из backend/.
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
const dbName = process.env.DB_DATABASE || 'kidney_office';
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres',
};

async function main() {
  const client = new Client(config);
  try {
    await client.connect();
    const r = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (r.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log('Database created:', dbName);
    } else {
      console.log('Database already exists:', dbName);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
