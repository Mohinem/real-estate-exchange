import type { Request } from 'express';


export type JwtClaims = {
role: 'anonymous' | 'user' | 'admin';
user_id?: number;
};


export function getPgSettingsFromReq(req: Request) {
const claims = (req as any).jwt as JwtClaims | undefined;
const settings: Record<string, string> = {
'role': claims?.role ?? 'anonymous',
};
if (claims?.user_id) settings['jwt.claims.user_id'] = String(claims.user_id);
if (claims?.role) settings['jwt.claims.role'] = claims.role;
return settings;
}