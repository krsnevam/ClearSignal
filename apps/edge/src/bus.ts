/** In-process fan-out for Server-Sent Events (one per isolate / Node process). */
export interface BusMessage {
  type: 'rankings-changed';
  reason: 'sms' | 'ingest' | 'replay-restart';
  place_name?: string | null;
  at_utc: string;
}

type Listener = (m: BusMessage) => void;

export class Bus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(m: BusMessage) {
    for (const fn of this.listeners) fn(m);
  }

  get size() {
    return this.listeners.size;
  }
}
