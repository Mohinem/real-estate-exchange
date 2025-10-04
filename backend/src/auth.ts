import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';


const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwt';


export function signJwt(payload: object) {
return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}


export function parseJwt(req: Request, _res: Response, next: NextFunction) {
const header = req.headers.authorization;
if (!header) return next();
const token = header.replace('Bearer ', '');
try {
(req as any).jwt = jwt.verify(token, JWT_SECRET);
} catch {
// ignore invalid token; treated as anonymous
}
next();
}