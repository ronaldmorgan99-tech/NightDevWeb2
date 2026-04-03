import app from '../[...path].js';

export default function handler(req: any, res: any) {
  req.url = '/api/community/stats';
  return (app as any)(req, res);
}
