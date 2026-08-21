'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchAlerts,
  type AlertLog,
} from '@/lib/data';

type FilterKey = 'all' | 'active' | 'resolved';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'resolved', label: 'Selesai' },
];

function alertTypeLabel(alert: AlertLog): string {
  if (alert.alert_type === 'low') return 'Hampir Habis';
  if (alert.alert_type === 'full') return 'Penuh';
  return alert.alert_type;
}

function alertTypeColor(type: string): string {
  if (type === 'low') return 'text-rose-400';
  if (type === 'full') return 'text-sky-400';
  return 'text-slate-400';
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('active');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const data = await fetchAlerts();
        if (ignore) return;
        setAlerts(data);
        setError(null);
      } catch (err: unknown) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat daftar peringatan.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const visible = alerts.filter((a) =>
    filter === 'active'
      ? a.resolved_at === null
      : filter === 'resolved'
        ? a.resolved_at !== null
        : true
  );

  const activeCount = alerts.filter((a) => a.resolved_at === null).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <h1 className="text-lg font-bold text-slate-100">Peringatan</h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {activeCount > 0
              ? `${activeCount} peringatan aktif perlu penanganan`
              : 'Tidak ada peringatan aktif'}
          </p>
        </div>

        <div className="flex w-full rounded-md border border-slate-700 sm:w-auto" role="group" aria-label="Filter status peringatan">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors sm:flex-none ${
                filter === f.key
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              } ${f.key === 'all' ? 'rounded-l-md' : ''} ${f.key === 'resolved' ? 'rounded-r-md' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-slate-800/80 bg-slate-900/60" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-950/30 p-4 text-xs text-rose-200">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/20 font-mono text-[10px] font-bold text-rose-400">
            !
          </span>
          <div className="flex-1">
            <p className="font-semibold text-rose-100">Gagal memuat data</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="shrink-0 rounded border border-rose-500/40 bg-rose-900/50 px-2.5 py-1 text-[11px] font-medium text-rose-100 transition-colors hover:bg-rose-800/60 focus:ring-2 focus:ring-rose-400 focus:outline-none"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {!isLoading && !error && visible.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg border border-slate-800 bg-slate-950 font-mono text-slate-400">
            [✓]
          </div>
          <p className="text-sm font-semibold text-slate-200">
            {filter === 'active' ? 'Tidak ada peringatan aktif' : 'Belum ada catatan peringatan'}
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            {filter === 'active'
              ? 'Semua tangki berada dalam ambang batas normal.'
              : 'Peringatan yang sudah ditangani akan muncul di sini.'}
          </p>
        </div>
      )}

      {!isLoading && !error && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((alert) => {
            const device = alert.devices;
            const isResolved = alert.resolved_at !== null;
            const level = Number(alert.level_percent_at_trigger);

            return (
              <div
                key={alert.id}
                className={`flex flex-col gap-3 rounded-lg border bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between ${
                  isResolved ? 'border-slate-800/60 opacity-70' : 'border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 grid h-2.5 w-2.5 shrink-0 place-items-center rounded-full ${
                      isResolved ? 'bg-slate-600' : 'bg-rose-500'
                    }`}
                    title={isResolved ? 'Selesai' : 'Aktif'}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-semibold ${alertTypeColor(alert.alert_type)}`}>
                        {alertTypeLabel(alert)}
                      </span>
                      <span className="text-xs text-slate-500">
                        Level {level.toFixed(1)}%
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {device?.name ?? 'Tangki tidak diketahui'}
                      {device?.location ? ` · ${device.location}` : ''}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {new Date(alert.triggered_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {isResolved && alert.resolved_at
                        ? ` · diselesaikan ${new Date(alert.resolved_at).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
