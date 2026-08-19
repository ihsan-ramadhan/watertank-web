'use client';

import { useEffect, useState } from 'react';
import {
  fetchDevices,
  fetchAllThresholds,
  fetchLatestLogPerDevice,
  fetchUnresolvedAlerts,
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

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        Perangkat terdeteksi: {data.devices.length} tangki.
      </div>
    </section>
  );
}
