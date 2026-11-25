// Serves the Vercel serverless Express app (api/[...path].ts) on a local port so the
// integration suite can run the same forum permission checks against both backends.
import app from '../../api/[...path].ts';

const port = Number(process.env.PORT || 0);
const server = app.listen(port, '0.0.0.0', () => {
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  console.log(`Server listening on http://0.0.0.0:${actualPort}`);
});
