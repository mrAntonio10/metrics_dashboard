// src/services/localService.ts
import 'server-only';
import { promises as fs } from 'fs';

export const METRICS_PATH =
  process.env.METRICS_PATH ?? '/var/lib/vivace-metrics/metrics.json';

// Tipos mínimos (ajústalos si quieres tipado completo)
export type Container = {
  id: string;
  name: string;
  image: string;
  status: string;
  ports_list: string;
  client: string;
  role: string;
  tls: { exposes_443: boolean };
  started_at: string;
  uptime_seconds: number | null;
  stats: {
    cpu_percent: number;
    mem_used_bytes: number;
    mem_limit_bytes: number;
    mem_percent: number;
    net_rx_bytes: number;
    net_tx_bytes: number;
    block_read_bytes: number;
    block_write_bytes: number;
    pids: number;
  };
};

export type MetricsPayload = {
  timestamp: string;
  host: string;
  docker: {
    running: boolean;
    server_version: string;
    client_version: string;
    context: string;
  };
  containers: Container[];
  clients: string[];
  client_agg: Array<{
    client: string;
    containers: number;
    cpu_percent_sum: number;
    mem_used_bytes_sum: number;
    mem_limit_bytes_sum: number;
    net_rx_bytes_sum: number;
    net_tx_bytes_sum: number;
  }>;
};

export async function readMetrics(): Promise<MetricsPayload> {
  const raw = await fs.readFile(METRICS_PATH, 'utf8');
  return JSON.parse(raw) as MetricsPayload;
}

// versión tolerante (no lanza excepción)
export async function tryReadMetrics(): Promise<MetricsPayload | null> {
  try {
    return await readMetrics();
  } catch {
    return null;
  }
}
