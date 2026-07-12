export interface QueuedBatch { attemptId: string; sequence: number; events: unknown[] }
export interface DiagnosticQueue { put(batch: QueuedBatch): Promise<void>; list(): Promise<QueuedBatch[]>; remove(attemptId: string, sequence: number): Promise<void> }

export class MemoryQueue implements DiagnosticQueue {
  private batches = new Map<string, QueuedBatch>()
  async put(batch: QueuedBatch) { this.batches.set(`${batch.attemptId}:${batch.sequence}`, structuredClone(batch)) }
  async list(): Promise<QueuedBatch[]> { return Array.from(this.batches.values()).sort((a, b) => a.sequence - b.sequence).map(batch => structuredClone(batch)) }
  async remove(attemptId: string, sequence: number) { this.batches.delete(`${attemptId}:${sequence}`) }
}

export class IndexedDbQueue implements DiagnosticQueue {
  private open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open('forma-internal-tests', 1); request.onupgradeneeded = () => request.result.createObjectStore('batches', { keyPath: 'key' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
  async put(batch: QueuedBatch) { const db = await this.open(); await new Promise<void>((resolve, reject) => { const request = db.transaction('batches', 'readwrite').objectStore('batches').put({ ...batch, key: `${batch.attemptId}:${batch.sequence}` }); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error) }); db.close() }
  async list() { const db = await this.open(); const values = await new Promise<Array<QueuedBatch & { key: string }>>((resolve, reject) => { const request = db.transaction('batches').objectStore('batches').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); db.close(); return values.sort((a,b) => a.sequence-b.sequence).map(({ key: _, ...batch }) => batch) }
  async remove(attemptId: string, sequence: number) { const db = await this.open(); await new Promise<void>((resolve, reject) => { const request = db.transaction('batches','readwrite').objectStore('batches').delete(`${attemptId}:${sequence}`); request.onsuccess=()=>resolve(); request.onerror=()=>reject(request.error) }); db.close() }
}
