import express from 'express';
const app = express();
app.get('*', (req, res) => res.send('JS Server Working'));
app.listen(3000, '0.0.0.0', () => console.log('Listening on 3000'));
