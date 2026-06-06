import { z } from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_ACTIVITY_LIMIT = 10;
const MAX_ACTIVITY_LIMIT = 50;

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

const listDealsQuerySchema = paginationQuerySchema.extend({
  activityLimit: z.coerce.number().int().min(0).max(MAX_ACTIVITY_LIMIT).default(DEFAULT_ACTIVITY_LIMIT),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export class PaginationValidationError extends Error {
  constructor(public readonly details: z.ZodFormattedError<unknown>) {
    super('Invalid pagination parameters');
    this.name = 'PaginationValidationError';
  }
}

const formatPaginationError = (error: z.ZodError) => error.format();

export const parsePaginationQuery = (query: unknown): PaginationQuery => {
  const parsed = paginationQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new PaginationValidationError(formatPaginationError(parsed.error));
  }

  return parsed.data;
};

export const parseListDealsQuery = (query: unknown): ListDealsQuery => {
  const parsed = listDealsQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new PaginationValidationError(formatPaginationError(parsed.error));
  }

  return parsed.data;
};

export const buildPaginationMeta = (page: number, limit: number, total: number): PaginationMeta => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
};
