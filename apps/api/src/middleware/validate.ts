import type { Context } from 'hono';
import { z, type ZodTypeAny } from 'zod';
import { AppError } from '../infrastructure/app-error.js';

function formatIssuePath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return '';
  }

  return path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : String(segment)))
    .join('.');
}

function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = formatIssuePath(issue.path);
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    })
    .join(', ');
}

async function parseWithSchema<Schema extends ZodTypeAny>(
  schema: Schema,
  value: unknown,
): Promise<z.infer<Schema>> {
  const result = await schema.safeParseAsync(value);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', formatValidationError(result.error), 400, result.error);
  }

  return result.data;
}

async function parseJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new AppError('VALIDATION_ERROR', 'リクエストボディが不正な JSON です。', 400);
  }
}

export const validate = {
  async body<Schema extends ZodTypeAny>(c: Context, schema: Schema): Promise<z.infer<Schema>> {
    return parseWithSchema(schema, await parseJsonBody(c));
  },

  async query<Schema extends ZodTypeAny>(c: Context, schema: Schema): Promise<z.infer<Schema>> {
    const query = Object.fromEntries(new URL(c.req.url).searchParams.entries());
    return parseWithSchema(schema, query);
  },

  async params<Schema extends ZodTypeAny>(c: Context, schema: Schema): Promise<z.infer<Schema>> {
    return parseWithSchema(schema, c.req.param());
  },
};
