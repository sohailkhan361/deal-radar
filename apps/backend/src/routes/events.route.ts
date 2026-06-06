import { Router } from 'express';
import { eventStream } from '../sse/event-stream';

const router = Router();

router.get('/stream', (req, res) => {
  eventStream.addClient(req, res);
});

export default router;
