import { Router } from 'express';
import { getDealById, listDeals } from '../controllers/deal.controller';

const router = Router();

router.get('/', listDeals);
router.get('/:dealId', getDealById);

export default router;
