'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchDevices,
  fetchSensorLogs,
  fetchAggregatedLogs,
  fetchThresholds,
  RANGE_OPTIONS,
  type Device,
  type SensorLog,
  type AggregatedPoint,
  type ThresholdConfig,
  type RangeKey,
} from '@/lib/data';

const CHART_W = 800;
const CHART_H = 260;
const PAD = { l: 36, r: 12, t: 12, b: 24 };

function LevelChart({ data, low, high }: { data: AggregatedPoint[]; low: number; high: number }) {
  const plotW = CHART_W - PAD.l - PAD.r;
  const plotH = CHART_H - PAD.t - PAD.b;

  const xFor = (i: number) =>
    data.length <= 1 ? PAD.l + plotW / 2 : PAD.l + (i / (data.length - 1)) * plotW;
  const yFor = (v: number) => PAD.t + (1 - Math.min(100, Math.max(0, v)) / 100) * plotH;

  const linePts = data.map((d, i) => `${xFor(i)},${yFor(d.avg)}`).join(' ');
  const areaPath =
    data.length > 1
      ? `M ${xFor(0)} ${PAD.t + plotH} ` +
        data.map((d, i) => `L ${xFor(i)} ${yFor(d.avg)}`).join(' ') +
        ` L ${xFor(data.length - 1)} ${PAD.t + plotH} Z`
      : '';
  const yTicks = [0, 25, 50, 75, 100];
  const xIdx = data.length <= 1 ? [0] : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" role="img" aria-label="Grafik level air">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} y1={yFor(t)} x2={CHART_W - PAD.r} y2={yFor(t)} stroke="rgb(51 65 85 / 0.5)" strokeWidth={1} />
          <text x={PAD.l - 6} y={yFor(t) + 3} textAnchor="end" fill="#94a3b8" fontSize={10}>
            {t}
          </text>
        </g>
      ))}

      {low > 0 && low < 100 && (
        <line x1={PAD.l} y1={yFor(low)} x2={CHART_W - PAD.r} y2={yFor(low)} stroke="rgb(251 113 133 / 0.5)" strokeWidth={1} strokeDasharray="4 3" />
      )}
      {high > 0 && high < 100 && (
        <line x1={PAD.l} y1={yFor(high)} x2={CHART_W - PAD.r} y2={yFor(high)} stroke="rgb(56 189 248 / 0.5)" strokeWidth={1} strokeDasharray="4 3" />
      )}

      {areaPath && <path d={areaPath} fill="rgb(20 184 166 / 0.12)" />}
      {data.length > 0 && (
        <polyline points={linePts} fill="none" stroke="#14b8a6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      )}
      {data.length === 1 && <circle cx={xFor(0)} cy={yFor(data[0].avg)} r={4} fill="#14b8a6" />}

      {xIdx.map((i, idx) => (
        <text key={idx} x={xFor(i)} y={CHART_H - 6} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          {new Date(data[i].ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </text>
      ))}
    </svg>
  );
}

function RiwayatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialDevice = searchParams.get('device') ?? '';

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState(initialDevice);
  const [logs, setLogs] = useState<SensorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [range, setRange] = useState<RangeKey>('24h');
  const [aggLogs, setAggLogs] = useState<AggregatedPoint[]>([]);
  const [threshold, setThreshold] = useState<ThresholdConfig | null>(null);
  const [aggLoading, setAggLoading] = useState(true);
  const [aggError, setAggError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const devicesList = devices.length > 0 ? devices : await fetchDevices();
        if (ignore) return;

        if (devices.length === 0) {
          setDevices(devicesList);
        }

        const targetId =
          selectedId || (devicesList.length > 0 ? devicesList[0].id : '');

        if (targetId && targetId !== selectedId) {
          setSelectedId(targetId);
          return;
        }

        if (!targetId) {
          setLogs([]);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);
        const data = await fetchSensorLogs(targetId, 100);
        if (ignore) return;
        setLogs(data);
      } catch (err: unknown) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat riwayat sensor.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [selectedId, devices, refreshKey]);

  useEffect(() => {
    let ignore = false;

    async function loadChart() {
      if (!selectedId) {
        setAggLogs([]);
        setThreshold(null);
        setAggLoading(false);
        return;
      }

      try {
        setAggLoading(true);
        setAggError(null);
        const [agg, th] = await Promise.all([
          fetchAggregatedLogs(selectedId, range),
          fetchThresholds(selectedId),
        ]);
        if (ignore) return;
        setAggLogs(agg);
        setThreshold(th);
      } catch (err: unknown) {
        if (ignore) return;
        setAggError(err instanceof Error ? err.message : 'Gagal memuat grafik.');
      } finally {
        if (!ignore) setAggLoading(false);
      }
    }

    loadChart();

    return () => {
      ignore = true;
    };
  }, [selectedId, range, refreshKey]);

  function handleDeviceChange(value: string) {
    setSelectedId(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('device', value);
    } else {
      params.delete('device');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const selectedDevice = devices.find((d) => d.id === selectedId);
  const lowThresh = Number(threshold?.low_threshold_percent ?? 15);
  const highThresh = Number(threshold?.high_threshold_percent ?? 90);

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
            <h1 className="text-lg font-bold text-slate-100">Riwayat Sensor</h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {selectedDevice
              ? `${selectedDevice.name} \u2014 ${selectedDevice.location ?? 'Lokasi tidak diset'}`
              : 'Pilih tangki untuk melihat riwayat pembacaan sensor'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <option value="" disabled>
              Pilih Tangki
            </option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            aria-label="Muat ulang riwayat"
            title="Muat ulang riwayat"
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

      {!selectedId && devices.length > 0 && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg border border-slate-800 bg-slate-950 font-mono text-slate-400">
            [?]
          </div>
          <p className="text-sm font-semibold text-slate-200">Pilih tangki terlebih dahulu</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Gunakan dropdown di atas untuk memilih tangki yang ingin dilihat riwayat sensornya.
          </p>
        </div>
      )}

      {!selectedId && devices.length === 0 && !isLoading && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg border border-slate-800 bg-slate-950 font-mono text-slate-400">
            [T]
          </div>
          <p className="text-sm font-semibold text-slate-200">Belum ada tangki terdaftar</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Tambahkan perangkat tangki terlebih dahulu melalui halaman Perangkat.
          </p>
          <Link
            href="/perangkat"
            className="mt-4 inline-flex items-center rounded-md bg-teal-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-500 focus:ring-2 focus:ring-teal-400 focus:outline-none"
          >
            Buka Manajemen Perangkat
          </Link>
        </div>
      )}

      {selectedId && (
        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60">
          <div className="flex flex-col gap-3 border-b border-slate-800/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Grafik Level Air</h2>
              <p className="text-[11px] text-slate-400">Rata-rata level per interval waktu</p>
            </div>
            <div className="flex w-full rounded-md border border-slate-700 sm:w-auto" role="group" aria-label="Pilih rentang waktu">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRange(opt.key)}
                  aria-pressed={range === opt.key}
                  className={`flex-1 px-3 py-1.5 text-[11px] font-medium transition-colors sm:flex-none ${
                    range === opt.key
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  } ${opt.key === '1h' ? 'rounded-l-md' : ''} ${opt.key === '7d' ? 'rounded-r-md' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {aggLoading ? (
              <div className="h-44 animate-pulse rounded bg-slate-800/40" />
            ) : aggError ? (
              <div className="flex h-44 items-center justify-center text-xs text-rose-300">
                {aggError}
              </div>
            ) : aggLogs.length === 0 ? (
              <div className="flex h-44 items-center justify-center text-xs text-slate-500">
                Tidak ada data pada rentang waktu ini
              </div>
            ) : (
              <LevelChart data={aggLogs} low={lowThresh} high={highThresh} />
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg border border-slate-800/80 bg-slate-900/60" />
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

      {!isLoading && !error && selectedId && logs.length === 0 && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg border border-slate-800 bg-slate-950 font-mono text-slate-400">
            [0]
          </div>
          <p className="text-sm font-semibold text-slate-200">Belum ada riwayat sensor</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Tangki ini belum mengirim pembacaan sensor. Pastikan perangkat sudah aktif dan terhubung.
          </p>
        </div>
      )}

      {!isLoading && !error && logs.length > 0 && (
        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
            <span className="text-xs font-medium text-slate-400">
              {logs.length} catatan terbaru
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-120 text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/60 text-[11px] text-slate-500 uppercase">
                  <th className="px-4 py-2.5 font-medium">Waktu</th>
                  <th className="px-4 py-2.5 font-medium">Level</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const level = Number(log.level_percent);
                  let levelColor = 'text-teal-400';
                  if (level < 15) levelColor = 'text-rose-400';
                  else if (level > 90) levelColor = 'text-sky-400';

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-slate-300">
                        {new Date(log.recorded_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className={`px-4 py-2.5 font-mono font-semibold ${levelColor}`}>
                        {level.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${
                            level < 15
                              ? 'bg-rose-500/15 text-rose-400'
                              : level > 90
                                ? 'bg-sky-500/15 text-sky-400'
                                : 'bg-emerald-500/15 text-emerald-400'
                          }`}
                        >
                          {level < 15 ? 'Kritis' : level > 90 ? 'Penuh' : 'Aman'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RiwayatPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <header className="h-6 w-48 animate-pulse rounded bg-slate-800" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg border border-slate-800/80 bg-slate-900/60" />
            ))}
          </div>
        </div>
      }
    >
      <RiwayatContent />
    </Suspense>
  );
}
