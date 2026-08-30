import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { JobInfo } from '@/lib/types'; // Sesuaikan path import types Anda

export function useJobToasts(initialJobs: JobInfo[], videoId: string) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobInfo[]>(initialJobs);
  const [dismissedToastIds, setDismissedToastIds] = useState<Record<string, boolean>>({});
  const [closingToastIds, setClosingToastIds] = useState<Record<string, boolean>>({});
  const jobsRef = useRef(jobs);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // 🛠️ PERBAIKAN 1: Sinkronisasi jika props initialJobs berubah dari server (misal setelah router.refresh)
  const prevInitialJobsRef = useRef(initialJobs);
  useEffect(() => {
    if (prevInitialJobsRef.current !== initialJobs) {
      prevInitialJobsRef.current = initialJobs;
      setJobs(initialJobs);
    }
  }, [initialJobs]);

  // Helper to dismiss toast with smooth exit animation
  const dismissToastWithAnimation = useCallback((id: string) => {
    setClosingToastIds((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setDismissedToastIds((prev) => ({ ...prev, [id]: true }));
      setClosingToastIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 350);
  }, []);

  // Automatically dismiss completed jobs after 2 seconds with exit animation
  useEffect(() => {
    const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');
    if (completedJobs.length === 0) return;

    const timers = completedJobs.map((job) => {
      if (!dismissedToastIds[job.id] && !closingToastIds[job.id]) {
        return setTimeout(() => {
          dismissToastWithAnimation(job.id);
        }, 2000);
      }
      return null;
    });

    return () => {
      timers.forEach((t) => t && clearTimeout(t));
    };
  }, [jobs, dismissedToastIds, closingToastIds, dismissToastWithAnimation]);

  const isJobRunning = jobs.some(
    (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
  );

  // 🛠️ PERBAIKAN 2: Polling segera berjalan jika ada perubahan status isJobRunning
  useEffect(() => {
    if (!isJobRunning) return;

    const pollJobs = async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}`);
        const data = await res.json();
        if (data.success && data.video && data.video.jobs) {
          const fetchedJobs: JobInfo[] = data.video.jobs;

          const wasRunning = jobsRef.current.some(
            (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
          );
          const nowRunning = fetchedJobs.some(
            (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
          );

          setJobs(fetchedJobs);

          if (wasRunning && !nowRunning) {
            router.refresh();
          }
        }
      } catch (err) {
        console.error('Error polling video jobs:', err);
      }
    };

    // Eksekusi polling pertama secara langsung (tanpa menunggu 4 detik) agar toast langsung muncul
    pollJobs();

    const timer = setInterval(pollJobs, 4000);
    return () => clearInterval(timer);
  }, [isJobRunning, videoId, router]);

  return {
    jobs,
    setJobs,
    isJobRunning,
    dismissedToastIds,
    closingToastIds,
    dismissToastWithAnimation,
  };
}