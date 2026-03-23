import { describe, it, expect } from 'vitest';
import { Semaphore } from '../semaphore.js';

describe('Semaphore', () => {
  it('上限未満であれば即座に acquire できる', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    expect(sem.currentCount).toBe(1);
    await sem.acquire();
    expect(sem.currentCount).toBe(2);
  });

  it('上限まで acquire すると currentCount が max に達する', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();
    expect(sem.currentCount).toBe(2);
    expect(sem.waitingCount).toBe(0);
  });

  it('上限を超えると待機する', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    let acquired = false;
    const p = sem.acquire().then(() => {
      acquired = true;
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(acquired).toBe(false);
    expect(sem.waitingCount).toBe(1);

    sem.release();
    await p;
    expect(acquired).toBe(true);
  });

  it('release すると waitingCount が減る', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    const p = sem.acquire();
    expect(sem.waitingCount).toBe(1);

    sem.release();
    await p;
    expect(sem.waitingCount).toBe(0);
  });

  it('release すると currentCount が下がる', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();
    expect(sem.currentCount).toBe(2);

    sem.release();
    expect(sem.currentCount).toBe(1);

    sem.release();
    expect(sem.currentCount).toBe(0);
  });

  it('複数待機しているとき release のたびに順番に起こされる', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    const order: number[] = [];
    const p1 = sem.acquire().then(() => order.push(1));
    const p2 = sem.acquire().then(() => order.push(2));

    await new Promise((r) => setTimeout(r, 10));
    expect(sem.waitingCount).toBe(2);

    sem.release();
    await new Promise((r) => setTimeout(r, 10));
    sem.release();
    await Promise.all([p1, p2]);

    expect(order).toEqual([1, 2]);
  });
});
