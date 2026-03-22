export class Semaphore {
  private current: number = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  /**
   * セマフォを取得する。空きがなければ空くまで待機する。
   */
  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }

  /**
   * セマフォを解放する。待機中のタスクがあれば1つ起こす。
   */
  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  /**
   * 現在の使用数を取得する（モニタリング用）
   */
  get currentCount(): number {
    return this.current;
  }

  /**
   * 待機中のタスク数を取得する（モニタリング用）
   */
  get waitingCount(): number {
    return this.queue.length;
  }
}
