import { z } from 'zod';

export const DealSchema = z.object({
  title: z.string().min(3),
  description: z.string(),
  status: z.enum(['PENDING', 'ACTIVE', 'CLOSED'])
});

export type DealInput = z.infer<typeof DealSchema>;
