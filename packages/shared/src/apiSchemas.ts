import { z } from "zod";

export const ApiResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.unknown() }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string().optional(),
    }),
  }),
]);

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message?: string } };

export function apiOk<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

export function apiErr(code: string, message?: string): ApiResult<never> {
  return { ok: false, error: { code, message } };
}

export const ConnectBodySchema = z.object({
  server: z.string().min(1),
  retries: z.number().int().min(0).max(10).optional(),
});

export const ShipSelectBodySchema = z.object({
  playerShipIndex: z.number().int().min(0).max(7),
});

export const TubeActionBodySchema = z.object({
  ordnance: z.number().int().min(0).max(3),
});

export const TubeParamSchema = z.coerce.number().int().min(0).max(5);

export type ConnectBody = z.infer<typeof ConnectBodySchema>;
export type ShipSelectBody = z.infer<typeof ShipSelectBodySchema>;
export type TubeActionBody = z.infer<typeof TubeActionBodySchema>;
