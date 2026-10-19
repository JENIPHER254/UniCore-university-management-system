import type { NextFunction, RequestHandler } from "express";
import { ZodError, type ZodType } from "zod";
import { badRequest } from "../lib/errors.js";

/** Validates req.body against a zod schema; throws a fielded 400 on failure. */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    try {
      (req as { body: unknown }).body = schema.parse(req.body ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".") || "_";
          if (!details[key]) details[key] = issue.message;
        }
        next(badRequest("Validation failed", details));
      } else {
        next(err);
      }
    }
  };
}

export function validateQuery<T extends ZodType>(schema: T): RequestHandler {
  return (req, _res, next) => {
    try {
      (req as unknown as { query: unknown }).query = schema.parse(req.query ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(badRequest("Invalid query parameters"));
      } else {
        next(err);
      }
    }
  };
}
