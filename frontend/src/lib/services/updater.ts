// src/lib/services/updater.ts
// Auto-update is a desktop-only feature — this is a no-op stub for the web app.

export interface UpdateInfo {
    version: string;
    date?: string;
    body?: string;
}

export interface UpdateCheckResult {
    available: boolean;
    update?: UpdateInfo;
}

/** No-op for web: always returns no update available. */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
    return { available: false };
}

/** No-op for web. */
export async function downloadAndInstall(
    _onProgress?: (progress: number, total: number) => void
): Promise<void> {
    console.info('Auto-update is not available in the web app.');
}

/** Returns a placeholder version string. */
export async function getCurrentVersion(): Promise<string> {
    return '2.0.0-web';
}
