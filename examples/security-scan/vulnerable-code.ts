// ⚠️ INTENTIONALLY VULNERABLE CODE — FOR TESTING ONLY
/* eslint-disable @typescript-eslint/no-unused-vars */

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
  // eslint-disable-next-line no-eval
  return eval(expression); // Code injection!
}

// Missing auth on sensitive endpoint
import type { Request, Response, NextFunction } from 'express';

export function getAdminUsers(_req: Request, res: Response) {
  res.json({ users: [] }); // No auth middleware!
}

export function deleteAccount(_req: Request, res: Response) {
  res.json({ deleted: true }); // No auth!
}

// Insecure CORS
export function insecureCors(_req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*');
  next();
}
