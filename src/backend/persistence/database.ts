import pg from "pg";

export class PersistenceDatabase {
  readonly pool: pg.Pool | null;
  private ready = false;
  private writeError = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(databaseUrl: string | undefined, isProduction: boolean) {
    this.pool = databaseUrl
      ? new pg.Pool({
        connectionString: databaseUrl,
        ssl: isProduction ? { rejectUnauthorized: false } : undefined,
        max: 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000
      })
      : null;

    this.pool?.on("error", (error) => {
      console.error("PostgreSQL pool error:", error);
    });
  }

  get isReady(): boolean {
    return this.ready;
  }

  get hasWriteError(): boolean {
    return this.writeError;
  }

  markReady(): void {
    this.ready = true;
  }

  enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const pendingWrite = this.writeQueue.catch(() => undefined).then(operation);
    this.writeQueue = pendingWrite.then(
      () => {
        this.writeError = false;
      },
      (error: unknown) => {
        this.writeError = true;
        console.error("Failed to persist AppBey state:", error);
      }
    );
    return pendingWrite;
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }

  async drainAndClose(): Promise<void> {
    await this.writeQueue;
    await this.close();
  }
}
