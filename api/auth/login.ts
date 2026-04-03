import app from '../[...path].js';

export default function handler(req: any, res: any) {
  req.url = '/api/auth/login';
  return (app as any)(req, res);
}
