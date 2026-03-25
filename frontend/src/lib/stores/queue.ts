// src/lib/stores/queue.ts
import { writable } from 'svelte/store';
import type { FileJob } from '../types';

function createQueueStore() {
    const { subscribe, update, set } = writable<FileJob[]>([]);

    return {
        subscribe,
        addFiles: (files: { filename: string; filepath: string }[]) => {
            update(queue => {
                const newJobs: FileJob[] = files.map((file, index) => ({
                    id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                    filename: file.filename,
                    filepath: file.filepath,
                    status: 'queued',
                    progress: 0
                }));
                return [...queue, ...newJobs];
            });
        },
        updateJob: (id: string, updates: Partial<FileJob>) => {
            update(queue =>
                queue.map(job => (job.id === id ? { ...job, ...updates } : job))
            );
        },
        removeJob: (id: string) => {
            update(queue => queue.filter(job => job.id !== id));
        },
        clearCompleted: () => {
            update(queue => queue.filter(job => job.status !== 'complete'));
        },
        reset: () => set([])
    };
}

export const queueStore = createQueueStore();
