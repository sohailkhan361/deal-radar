import { Router } from 'express';
import { ingestWebhook } from '../controllers/webhook.controller';

const router = Router();

router.post('/', ingestWebhook);

export default router;
