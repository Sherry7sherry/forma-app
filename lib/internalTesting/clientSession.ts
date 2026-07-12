import type { DiagnosticQueue } from '@/lib/internalTesting/indexedQueue'
export type DiagnosticLifecycle = 'idle'|'run-active'|'attempt-active'|'pending-upload'|'completed'|'failed'
export function retryDisposition(status: number) { return status === 408 || status === 429 || status >= 500 ? 'retry' : 'permanent' }
export class DiagnosticSession {
  state: DiagnosticLifecycle = 'idle'; runId: string|null=null; attemptId: string|null=null; private sequence=0
  constructor(private queue: DiagnosticQueue) {}
  startRun(id: string) { if(this.state!=='idle'&&this.state!=='completed') throw new Error('run already active'); this.runId=id; this.state='run-active' }
  startAttempt(id:string) { if(this.state!=='run-active'&&this.state!=='completed') throw new Error('run required'); this.attemptId=id; this.sequence=0; this.state='attempt-active' }
  async queueBatch(events: unknown[]) { if(!this.attemptId) throw new Error('attempt required'); await this.queue.put({attemptId:this.attemptId,sequence:this.sequence++,events}); this.state='pending-upload' }
  completeAttempt() { if(!this.attemptId) throw new Error('attempt required'); this.state='completed'; this.attemptId=null }
  fail() { this.state='failed' }
}
export function captureEnvironment() { return { userAgent: typeof navigator==='undefined'?'server':navigator.userAgent, viewport: typeof window==='undefined'?null:{width:window.innerWidth,height:window.innerHeight}, orientation: typeof screen==='undefined'?null:screen.orientation?.type ?? null, buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'unknown', profileVersion: process.env.NEXT_PUBLIC_TRACKING_PROFILE_VERSION ?? '1' } }
