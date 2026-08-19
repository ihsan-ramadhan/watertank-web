import { supabase } from './supabaseClient';
import type { Tables } from './database.types';

export type Device = Tables<'devices'>;
export type SensorLog = Tables<'sensor_logs'>;
export type ThresholdConfig = Tables<'threshold_configs'>;
export type AlertLog = Tables<'alert_logs'> & {
  devices?: Pick<Device, 'name' | 'location'> | null;
};

// devices
export async function fetchDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchDevice(id: string): Promise<Device | null> {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDevice(id: string, fields: Partial<Device>): Promise<Device> {
  const { data, error } = await supabase
    .from('devices')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// thresholds
export async function fetchThresholds(deviceId: string): Promise<ThresholdConfig | null> {
  const { data, error } = await supabase
    .from('threshold_configs')
    .select('*')
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAllThresholds(): Promise<ThresholdConfig[]> {
  const { data, error } = await supabase.from('threshold_configs').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function updateThreshold(
  id: string,
  fields: Partial<ThresholdConfig>
): Promise<ThresholdConfig> {
  const { data, error } = await supabase
    .from('threshold_configs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// sensor logs
export async function fetchSensorLogs(deviceId: string, limit = 50): Promise<SensorLog[]> {
  const { data, error } = await supabase
    .from('sensor_logs')
    .select('*')
    .eq('device_id', deviceId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchSensorLogsRange(deviceId: string, hours: number): Promise<SensorLog[]> {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('sensor_logs')
    .select('*')
    .eq('device_id', deviceId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return data ?? [];
}

export interface AggregatedPoint {
  ts: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

function aggregateLogs(logs: SensorLog[], intervalMs: number): AggregatedPoint[] {
  if (!logs || logs.length === 0) return [];
  const buckets = new Map<number, number[]>();
  for (const log of logs) {
    const ts = new Date(log.recorded_at).getTime();
    const bucketKey = Math.floor(ts / intervalMs) * intervalMs;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey)!.push(Number(log.level_percent));
  }
  const result: AggregatedPoint[] = [];
  for (const [ts, vals] of buckets) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    result.push({
      ts,
      avg: Math.round(avg * 100) / 100,
      min: Math.min(...vals),
      max: Math.max(...vals),
      count: vals.length,
    });
  }
  return result.sort((a, b) => a.ts - b.ts);
}

export type RangeKey = '1h' | '24h' | '7d';

export const RANGE_OPTIONS: { key: RangeKey; label: string; hours: number }[] = [
  { key: '1h', label: '1 Jam', hours: 1 },
  { key: '24h', label: '24 Jam', hours: 24 },
  { key: '7d', label: '7 Hari', hours: 168 },
];

export async function fetchAggregatedLogs(deviceId: string, range: RangeKey): Promise<AggregatedPoint[]> {
  const { hours, intervalMs } =
    range === '1h'
      ? { hours: 1, intervalMs: 5 * 60 * 1000 }
      : range === '24h'
        ? { hours: 24, intervalMs: 60 * 60 * 1000 }
        : { hours: 168, intervalMs: 6 * 3600 * 1000 };
  const logs = await fetchSensorLogsRange(deviceId, hours);
  return aggregateLogs(logs, intervalMs);
}

export async function fetchLatestLogPerDevice(): Promise<Map<string, SensorLog>> {
  const { data: devices, error: devErr } = await supabase.from('devices').select('id');
  if (devErr) throw devErr;
  if (!devices || devices.length === 0) return new Map();

  const { data, error } = await supabase
    .from('sensor_logs')
    .select('*')
    .in('device_id', devices.map((d) => d.id))
    .order('recorded_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  const map = new Map<string, SensorLog>();
  for (const log of data ?? []) {
    if (!map.has(log.device_id)) map.set(log.device_id, log);
  }
  return map;
}

// alerts
export async function fetchAlerts(): Promise<AlertLog[]> {
  const { data, error } = await supabase
    .from('alert_logs')
    .select('*, devices(name, location)')
    .order('triggered_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function fetchUnresolvedAlerts(): Promise<AlertLog[]> {
  const { data, error } = await supabase
    .from('alert_logs')
    .select('*, devices(name, location)')
    .is('resolved_at', null)
    .order('triggered_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function resolveAlert(id: string): Promise<AlertLog> {
  const { data, error } = await supabase
    .from('alert_logs')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, devices(name, location)')
    .single();
  if (error) throw error;
  return data;
}

// status helpers
export type StatusKey = 'safe' | 'critical' | 'info' | 'unknown';

export interface Status {
  label: string;
  key: StatusKey;
  color: string;
}

export function statusFromThreshold(level: number | null | undefined, threshold?: ThresholdConfig | null): Status {
  if (level == null) {
    return { label: 'Belum Ada Data', key: 'unknown', color: 'var(--text-muted)' };
  }
  const low = Number(threshold?.low_threshold_percent ?? 15);
  const high = Number(threshold?.high_threshold_percent ?? 90);
  if (Number(level) < low) {
    return { label: 'Hampir Habis', key: 'critical', color: 'var(--danger)' };
  }
  if (Number(level) > high) {
    return { label: 'Penuh', key: 'info', color: 'var(--primary)' };
  }
  return { label: 'Aman', key: 'safe', color: 'var(--success)' };
}

export function statusBadgeClass(key: StatusKey): string {
  const map: Record<StatusKey, string> = {
    safe: 'badge badge-success-subtle',
    critical: 'badge badge-danger-subtle',
    info: 'badge badge-info-subtle',
    unknown: 'badge badge-muted',
  };
  return map[key];
}

export function alertTypeBadge(type: string): string {
  if (type === 'low') return 'badge badge-danger';
  if (type === 'full') return 'badge badge-info';
  return 'badge badge-muted';
}

export function alertTypeLabel(type: string): string {
  if (type === 'low') return 'Hampir Habis';
  if (type === 'full') return 'Penuh';
  return type;
}

// formatting
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateShort(ts: string | null | undefined): string {
  if (!ts) return '\u2014';
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}d lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j lalu`;
  const day = Math.floor(hr / 24);
  return `${day}h lalu`;
}

export function isOnline(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}
