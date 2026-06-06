import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { DealSchema } from '@deal-radar/validation-engine';
import { processDealWithAI } from '@deal-radar/ai-engine';

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
