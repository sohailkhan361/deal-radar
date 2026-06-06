import { Router } from 'express';
import dealsRoutes from './deals.route';
import eventsRoutes from './events.route';
import healthRoutes from './health.route';
import webhookRoutes from './webhook.route';
import adminRoutes from './admin.route';

const router = Router();

router.use('/health', healthRoutes);
router.use('/api/deals', dealsRoutes);
router.use('/api/events', eventsRoutes);
router.use('/api/webhook', webhookRoutes);
router.use('/admin/queues', adminRoutes);

export default router;
