import { type NextFunction, type Request, type Response } from 'express';
import { mapActivity, mapDeal, mapDealDetail } from '../lib/deal-mapper';
import {
  buildPaginationMeta,
  PaginationValidationError,
  parseListDealsQuery,
  parsePaginationQuery,
} from '../lib/pagination';
import { dealService } from '../services/deal.service';

export const listDeals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, activityLimit } = parseListDealsQuery(req.query);
    const { deals, total } = await dealService.listDeals(page, limit, activityLimit);

    res.json({
      data: deals.map(deal => ({
        ...mapDeal(deal),
        activities: deal.activities.map(mapActivity),
        activityCount: deal._count.activities,
      })),
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (error) {
    if (error instanceof PaginationValidationError) {
      res.status(400).json({
        error: {
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    next(error);
  }
};

export const getDealById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = parsePaginationQuery(req.query);
    const result = await dealService.getDealByDealId(req.params.dealId, page, limit);

    if (!result) {
      res.status(404).json({
        error: {
          message: `Deal not found: ${req.params.dealId}`,
        },
      });
      return;
    }

    res.json({
      data: mapDealDetail(result.deal, result.deal.activities),
      pagination: buildPaginationMeta(page, limit, result.activityTotal),
    });
  } catch (error) {
    if (error instanceof PaginationValidationError) {
      res.status(400).json({
        error: {
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    next(error);
  }
};
