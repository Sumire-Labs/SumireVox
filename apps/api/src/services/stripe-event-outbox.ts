import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { logger } from '../infrastructure/logger.js';
import { processStripeEvent } from './stripe-webhook-handler.js';

const PENDING = 'PENDING';
const PROCESSED = 'PROCESSED';

// 再試行回数の上限。これを超えた PENDING 行はドレイン対象から外し（実質の死票化）、
// 恒久失敗する毒行がキューの先頭に居座って後続イベントを恒久的にブロックするのを防ぐ。
// 死票行は attempts / last_error で特定でき、監視対象とする。
const MAX_PROCESSING_ATTEMPTS = 100;

let drainInProgress = false;

/**
 * Stripe Webhook イベントを永続化（outbox 化）する。
 *
 * 署名検証後に 200 を返す前に DB へ保存することで、その後の業務処理の失敗や
 * プロセスクラッシュがあってもイベントが失われない。未処理イベントは
 * drainStripeEventOutbox が起動時・定期で必ず再生する。
 */
export async function enqueueStripeEvent(event: Stripe.Event): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.stripeEvent.upsert({
      where: { id: event.id },
      create: {
        id: event.id,
        type: event.type,
        payload: event as unknown as Prisma.InputJsonValue,
        status: PENDING,
      },
      update: {}, // 既知イベント（再配信・処理済み）は何もしない
    });
  } catch (error) {
    // 同時受信で一意制約に当たった場合、既に他が enqueue 済みなので成功扱い
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return;
    }
    throw error;
  }
}

/**
 * PENDING な Stripe イベントを古い順に処理し、成功したものを PROCESSED へ移す。
 *
 * プロセス内ミューテックスで同時実行を防ぐ。失敗したイベントは PENDING のまま残し、
 * attempts / lastError を更新して次回の drain（起動時・定期整合処理）で再試行する。
 * Stripe 無効時は何もしない（Webhook 自体が受信されないため PENDING は発生しない）。
 */
export async function drainStripeEventOutbox(limit = 20): Promise<void> {
  if (!stripe || drainInProgress) return;
  drainInProgress = true;

  try {
    const prisma = getPrisma();
    const pending = await prisma.stripeEvent.findMany({
      where: { status: PENDING, attempts: { lt: MAX_PROCESSING_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    for (const record of pending) {
      try {
        const event = record.payload as unknown as Stripe.Event;
        await processStripeEvent(event);
        await prisma.stripeEvent.update({
          where: { id: record.id },
          data: { status: PROCESSED, processedAt: new Date(), attempts: 0, lastError: null },
        });
        logger.info({ eventId: record.id, type: record.type }, 'Stripe outbox event processed');
      } catch (error) {
        await prisma.stripeEvent.update({
          where: { id: record.id },
          data: { attempts: { increment: 1 }, lastError: error instanceof Error ? error.message : String(error) },
        });
        logger.error({ err: error, eventId: record.id, type: record.type }, 'Stripe outbox event processing failed');
      }
    }
  } finally {
    drainInProgress = false;
  }
}