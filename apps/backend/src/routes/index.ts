import { Router } from 'express';
import eventsRoutes from './events.route';
import healthRoutes from './health.route';
import webhookRoutes from './webhook.route';

const router = Router();

router.use('/health', healthRoutes);
router.use('/api/events', eventsRoutes);
router.use('/api/webhook', webhookRoutes);

export default router;
