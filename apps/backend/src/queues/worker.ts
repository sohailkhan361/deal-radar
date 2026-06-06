import { DEAL_EVENTS_QUEUE_NAME, type DealEventJobData, type DealEventJobName, type DealEventJobResult } from './bull.queue';
import { queueService } from './queue.service';

let dealEventsWorker: ReturnType<typeof queueService.registerWorker<DealEventJobData, DealEventJobResult, DealEventJobName>> | null = null;

export const registerDealEventsWorker = () => {
  if (dealEventsWorker) {
    return dealEventsWorker;
  }

  dealEventsWorker = queueService.registerWorker<DealEventJobData, DealEventJobResult, DealEventJobName>(
    DEAL_EVENTS_QUEUE_NAME,
    async job => {
      console.log(`[worker:${DEAL_EVENTS_QUEUE_NAME}] Job ${job.id} received (${job.name}); processing not implemented yet`);
    },
  );

  return dealEventsWorker;
};
