// ⚠️ INTENTIONALLY VULNERABLE CODE — FOR TESTING ONLY

const API_KEY = 'sk-ant-api03-FAKE_KEY_FOR_TESTING_1234567890abcdef';
const DB_PASSWORD = 'super_secret_password_123';

// SQL Injection vulnerability
export function getUserByName(name: string) {
  const query = `SELECT * FROM users WHERE name = '${name}'`;
  return query; // would be db.execute(query)
}

// XSS vulnerability
export function renderUserComment(comment: string) {
  const div = document.createElement('div');
  div.innerHTML = comment; // XSS!
  return div;
}

// Eval injection
export function calculate(expression: string) {
  return eval(expression); // Code injection!
}

// Missing auth on sensitive endpoint
import express from 'express';
const app = express();

app.get('/admin/users', (req, res) => {
  res.json({ users: [] }); // No auth middleware!
});

app.post('/api/account/delete', (req, res) => {
  res.json({ deleted: true }); // No auth!
});

// Insecure CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});
