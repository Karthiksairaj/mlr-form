import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RunRecord } from '../types.js';

export function withoutPayload(record: RunRecord): RunRecord {
  const { payload: _payload, ...request } = record.request;
  return { ...record, request };
}

export class RunStore {
  private readonly records = new Map<string, RunRecord>();

  constructor(private readonly artifactRoot: string) {}

  async initialize(): Promise<void> {
    await mkdir(this.artifactRoot, { recursive: true });
  }

  get(id: string): RunRecord | undefined {
    return this.records.get(id);
  }

  async create(record: RunRecord): Promise<void> {
    this.records.set(record.id, record);
    await mkdir(this.runDirectory(record.id), { recursive: true });
    await this.persist(record);
  }

  async update(id: string, update: Partial<RunRecord>): Promise<RunRecord> {
    const current = this.records.get(id);
    if (!current) throw new Error(`Run ${id} was not found.`);
    const next = { ...current, ...update, updatedAt: new Date().toISOString() };
    this.records.set(id, next);
    await this.persist(next);
    return next;
  }

  runDirectory(id: string): string {
    return path.join(this.artifactRoot, id);
  }

  artifactPath(id: string, name: string): string {
    return path.join(this.runDirectory(id), path.basename(name));
  }

  private async persist(record: RunRecord): Promise<void> {
    await writeFile(
      this.artifactPath(record.id, 'run.json'),
      JSON.stringify(withoutPayload(record), null, 2),
      'utf8'
    );
  }
}
