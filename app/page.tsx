'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchDevices,
  fetchAllThresholds,
  fetchLatestLogPerDevice,
  fetchUnresolvedAlerts,
  statusFromThreshold,
  formatTime,
  timeAgo,
  isOnline,
  type Device,
  type ThresholdConfig,
  type SensorLog,
  type AlertLog,
} from '@/lib/data';
import { supabase } from '@/lib/supabaseClient';

interface DashboardData {
  devices: Device[];
  thresholds: Map<string, ThresholdConfig>;
  latestLogs: Map<string, SensorLog>;
  unresolvedAlerts: AlertLog[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [devices, thresholdList, latestLogs, unresolvedAlerts] = await Promise.all([
          fetchDevices(),
          fetchAllThresholds(),
          fetchLatestLogPerDevice(),
          fetchUnresolvedAlerts(),
        ]);

        if (ignore) return;

        const thresholds = new Map<string, ThresholdConfig>();
        for (const t of thresholdList) {
          thresholds.set(t.device_id, t);
        }

        setData({ devices, thresholds, latestLogs, unresolvedAlerts });
        setError(null);
      } catch (err: unknown) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat data dashboard.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    load();

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_logs' },
        (payload) => {
          const newLog = payload.new as SensorLog;
          setData((prev) => {
            if (!prev) return prev;
            const updatedLogs = new Map(prev.latestLogs);
            const existing = updatedLogs.get(newLog.device_id);
            if (!existing || new Date(newLog.recorded_at) >= new Date(existing.recorded_at)) {
              updatedLogs.set(newLog.device_id, newLog);
            }
            return { ...prev, latestLogs: updatedLogs };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alert_logs' },
        () => {
          fetchUnresolvedAlerts()
            .then((alerts) => {
              setData((prev) => (prev ? { ...prev, unresolvedAlerts: alerts } : prev));
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, [refreshKey]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-72 animate-pulse rounded bg-slate-800/60" />
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-slate-800/80 bg-slate-900/60" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-lg border border-slate-800/80 bg-slate-900/60" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-4 text-center">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-rose-500/30 bg-slate-900/90 p-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
            !
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-100">Gagal Memuat Dashboard</h1>
            <p className="mt-1 text-xs text-slate-400">{error ?? 'Koneksi ke server database terputus.'}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setRefreshKey((k) => k + 1);
            }}
            className="w-full rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-500 focus:ring-2 focus:ring-teal-400 focus:outline-none"
          >
            Muat Ulang Data
          </button>
        </div>
      </div>
    );
  }

  if (data.devices.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-lg font-bold text-slate-100">Pemantauan Tangki Air</h1>
          <p className="text-xs text-slate-400">Status telemetri dan level air seluruh tangki terpasang.</p>
        </header>

        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg border border-slate-800 bg-slate-950 font-mono text-slate-400">
            [T]
          </div>
          <p className="text-sm font-semibold text-slate-200">Belum Ada Tangki Terdaftar</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Tambahkan perangkat tangki baru untuk memulai pemantauan sensor level air secara realtime.
          </p>
          <Link
            href="/perangkat"
            className="mt-4 inline-flex items-center rounded-md bg-teal-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-500 focus:ring-2 focus:ring-teal-400 focus:outline-none"
          >
            Buka Manajemen Perangkat
          </Link>
        </div>
      </div>
    );
  }

  const totalTanks = data.devices.length;
  let onlineCount = 0;
  let criticalCount = 0;
  let safeCount = 0;

  for (const device of data.devices) {
    const log = data.latestLogs.get(device.id);
    const threshold = data.thresholds.get(device.id);
    if (isOnline(log?.recorded_at)) {
      onlineCount += 1;
    }
    const st = statusFromThreshold(log?.level_percent, threshold);
    if (st.key === 'critical') {
      criticalCount += 1;
    } else if (st.key === 'safe' || st.key === 'info') {
      safeCount += 1;
    }
  }

  const activeAlertsCount = data.unresolvedAlerts.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-100">Pemantauan Tangki Air</h1>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-300">
              {totalTanks} UNIT
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Telemetri ketinggian dan kapasitas penampungan air lapangan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setRefreshKey((k) => k + 1);
            }}
            aria-label="Sinkronisasi Data"
            title="Sinkronisasi Data"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-800/90 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.5a.75.75 0 0 0-.75.75v3.732a.75.75 0 0 0 1.5 0v-2.138l.427.427a7 7 0 0 0 11.712-3.136.75.75 0 0 0-1.077-.8zM4.688 8.576a5.5 5.5 0 0 1 9.201-2.466l.312.311H11.768a.75.75 0 0 0 0 1.5h3.732a.75.75 0 0 0 .75-.75V3.439a.75.75 0 0 0-1.5 0v2.138l-.427-.427A7 7 0 0 0 2.611 8.286a.75.75 0 0 0 1.077.8z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>

      {activeAlertsCount > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <p className="text-rose-200">
              <strong className="font-semibold text-rose-100">{activeAlertsCount} peringatan aktif</strong> membutuhkan pemeriksaan batas ambang sensor.
            </p>
          </div>
          <Link
            href="/alerts"
            className="self-start rounded border border-rose-500/40 bg-rose-900/50 px-2.5 py-1 text-xs font-medium text-rose-100 transition-colors hover:bg-rose-800/60 focus:ring-2 focus:ring-rose-400 focus:outline-none sm:self-auto"
          >
            Buka Log Peringatan
          </Link>
        </div>
      )}

      {/* Telemetry Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3.5">
          <span className="text-[11px] font-medium text-slate-400">Total Tangki</span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-slate-100">{totalTanks}</span>
            <span className="text-[11px] text-slate-500">unit</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3.5">
          <span className="text-[11px] font-medium text-slate-400">Status Normal</span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-emerald-400">{safeCount}</span>
            <span className="text-[11px] text-slate-500">unit</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3.5">
          <span className="text-[11px] font-medium text-slate-400">Status Kritis</span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-rose-400">{criticalCount}</span>
            <span className="text-[11px] text-slate-500">unit</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3.5">
          <span className="text-[11px] font-medium text-slate-400">Koneksi Aktif</span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-teal-400">{onlineCount}</span>
            <span className="font-mono text-xs text-slate-500">/{totalTanks}</span>
          </div>
        </div>
      </div>

      {/* Tank Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.devices.map((device) => {
          const log = data.latestLogs.get(device.id);
          const threshold = data.thresholds.get(device.id);
          const online = isOnline(log?.recorded_at);
          const percent = log?.level_percent != null ? Number(log.level_percent) : null;
          const status = statusFromThreshold(percent, threshold);

          const lowThresh = Number(threshold?.low_threshold_percent ?? 15);
          const highThresh = Number(threshold?.high_threshold_percent ?? 90);

          let barColor = 'bg-teal-500';
          let textColor = 'text-teal-400';
          let borderColor = 'border-slate-800';

          if (status.key === 'critical') {
            barColor = 'bg-rose-500';
            textColor = 'text-rose-400';
            borderColor = 'border-rose-500/40';
          } else if (status.key === 'info') {
            barColor = 'bg-sky-500';
            textColor = 'text-sky-400';
          } else if (status.key === 'unknown') {
            barColor = 'bg-slate-600';
            textColor = 'text-slate-400';
          }

          const fillHeight = percent != null ? Math.min(100, Math.max(0, percent)) : 0;

          return (
            <div
              key={device.id}
              className={`flex flex-col justify-between rounded-lg border bg-slate-900/80 p-4 transition-colors ${borderColor}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">{device.name}</h2>
                    <p className="text-xs text-slate-400">{device.location ?? 'Lokasi tidak diset'}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-600'}`}
                      title={online ? 'Perangkat terhubung' : 'Perangkat offline'}
                    />
                    <span className="font-mono text-[11px] text-slate-400">
                      {online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                {/* Level Gauge Visualizer */}
                <div className="my-4 flex items-center gap-4 rounded-md border border-slate-800/80 bg-slate-950/60 p-3">
                  <div className="relative flex h-24 w-12 flex-col justify-end overflow-hidden rounded border border-slate-700 bg-slate-900">
                    {/* Threshold marks */}
                    <div
                      className="absolute w-full border-b border-dashed border-rose-500/60"
                      style={{ bottom: `${lowThresh}%` }}
                      title={`Batas Rendah: ${lowThresh}%`}
                    />
                    <div
                      className="absolute w-full border-b border-dashed border-sky-400/60"
                      style={{ bottom: `${highThresh}%` }}
                      title={`Batas Penuh: ${highThresh}%`}
                    />

                    {/* Water fill column */}
                    <div
                      className={`w-full transition-all duration-500 ${barColor}`}
                      style={{ height: `${fillHeight}%` }}
                    />
                  </div>

                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-medium tracking-wider text-slate-500 uppercase">
                      Level Ketinggian
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className={`font-mono text-2xl font-bold ${textColor}`}>
                        {percent != null ? `${percent.toFixed(1)}` : '-'}
                      </span>
                      <span className="font-mono text-xs text-slate-400">%</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-[11px]">
                      <span className="text-slate-400">Status:</span>
                      <span className={`font-medium ${textColor}`}>{status.label}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-800/60 pt-3 text-[11px] text-slate-400">
                  <div>
                    <span className="text-slate-500">Ambang Rendah:</span>{' '}
                    <span className="font-mono text-slate-300">{lowThresh}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Ambang Tinggi:</span>{' '}
                    <span className="font-mono text-slate-300">{highThresh}%</span>
                  </div>
                  <div className="col-span-2 text-slate-500">
                    Pembaruan:{' '}
                    <span className="font-mono text-slate-300" title={formatTime(log?.recorded_at)}>
                      {timeAgo(log?.recorded_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2">
                <Link
                  href={`/riwayat?device=${device.id}`}
                  className="block w-full rounded border border-slate-700 bg-slate-800/80 py-1.5 text-center text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  Lihat Riwayat & Grafik
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
