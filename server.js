import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'NOVA backend is running',
    status: 'ok'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'NOVA API healthy'
  });
});

app.post('/api/test', (req, res) => {
  const { name } = req.body || {};

  res.json({
    message: `Hello ${name || 'friend'} from the NOVA backend`,
    received: req.body || {}
  });
});

app.listen(PORT, () => {
  console.log(`NOVA backend running on http://localhost:${PORT}`);
});
