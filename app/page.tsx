'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchDevices,
  fetchAllThresholds,
  fetchLatestLogPerDevice,
  fetchUnresolvedAlerts,
  statusFromThreshold,
  isOnline,
  type Device,
  type ThresholdConfig,
  type SensorLog,
  type AlertLog,
} from '@/lib/data';

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

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  if (isLoading) {
    return (
      <section aria-label="Memuat Dashboard" className="space-y-6">
        <header className="flex flex-col gap-1">
          <div className="h-7 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-4 w-72 animate-pulse rounded bg-slate-800" />
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-slate-800 bg-slate-900/60 p-4"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-lg border border-slate-800 bg-slate-900/60 p-6"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="max-w-md space-y-4 rounded-lg border border-rose-500/30 bg-slate-900/80 p-6">
          <h1 className="text-lg font-semibold text-slate-100">Gagal Memuat Data</h1>
          <p className="text-sm text-slate-400">{error ?? 'Terjadi kesalahan sistem.'}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setRefreshKey((k) => k + 1);
            }}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-500 focus:ring-2 focus:ring-teal-400 focus:outline-none"
          >
            Coba Muat Ulang
          </button>
        </div>
      </section>
    );
  }

  if (data.devices.length === 0) {
    return (
      <section className="space-y-6">
        <header>
          <h1 className="text-xl font-bold text-slate-100">Ringkasan Sistem Tangki</h1>
          <p className="text-sm text-slate-400">Status dan level air seluruh tangki terdaftar.</p>
        </header>

        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
          <p className="text-base font-medium text-slate-200">Belum ada perangkat tangki terdaftar</p>
          <p className="mt-1 text-sm text-slate-400">
            Tambahkan perangkat tangki terlebih dahulu melalui halaman Perangkat.
          </p>
        </div>
      </section>
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
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Ringkasan Sistem Tangki</h1>
          <p className="text-sm text-slate-400">Status dan level air seluruh tangki terdaftar.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsLoading(true);
            setRefreshKey((k) => k + 1);
          }}
          className="self-start rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 focus:ring-2 focus:ring-teal-500 focus:outline-none sm:self-auto"
        >
          Perbarui Data
        </button>
      </header>

      {activeAlertsCount > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-rose-500/40 bg-rose-950/30 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-400 ring-4 ring-rose-400/20" />
            <p className="text-rose-200">
              Ada <span className="font-semibold text-white">{activeAlertsCount}</span> peringatan aktif yang butuh penanganan.
            </p>
          </div>
          <Link
            href="/alerts"
            className="self-start rounded-md border border-rose-500/50 bg-rose-900/40 px-3 py-1 text-xs font-medium text-rose-100 transition-colors hover:bg-rose-800/50 focus:ring-2 focus:ring-rose-400 focus:outline-none sm:self-auto"
          >
            Lihat Peringatan
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">Total Tangki</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-100">{totalTanks}</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">Tangki Normal</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-emerald-400">{safeCount}</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">Status Kritis</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-rose-400">{criticalCount}</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">Perangkat Online</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-teal-400">
            {onlineCount}<span className="text-sm font-normal text-slate-500">/{totalTanks}</span>
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        Perangkat terdeteksi: {data.devices.length} tangki.
      </div>
    </section>
  );
}
