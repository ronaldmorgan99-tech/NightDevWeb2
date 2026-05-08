import type { Handler } from '@netlify/functions';
import serverless from 'serverless-http';
import app from '../../api/[...path].ts';

const expressHandler = serverless(app);

export const handler: Handler = async (event, context) => {
  return await expressHandler(event, context);
};
