export class JobQueue {
  private readonly jobs: Array<() => Promise<void>> = [];
  private active = 0;

  constructor(private readonly concurrency: number) {}

  enqueue(job: () => Promise<void>): void {
    this.jobs.push(job);
    this.drain();
  }

  private drain(): void {
    while (this.active < this.concurrency && this.jobs.length > 0) {
      const job = this.jobs.shift();
      if (!job) return;
      this.active += 1;
      void job()
        .catch(() => undefined)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}
