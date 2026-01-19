// src/lib/services/updater.ts
// Frontend service for checking and installing app updates

import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
    version: string;
    date?: string;
    body?: string;
}

export interface UpdateCheckResult {
    available: boolean;
    update?: UpdateInfo;
}

/**
 * Check if a new version is available
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
    try {
        const update = await check();

        if (update) {
            return {
                available: true,
                update: {
                    version: update.version,
                    date: update.date,
                    body: update.body,
                },
            };
        }

        return { available: false };
    } catch (error) {
        console.error("Failed to check for updates:", error);
        throw error;
    }
}

/**
 * Download and install the update, then restart the app
 */
export async function downloadAndInstall(
    onProgress?: (progress: number, total: number) => void
): Promise<void> {
    const update = await check();

    if (!update) {
        throw new Error("No update available");
    }

    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
        switch (event.event) {
            case "Started":
                contentLength = event.data.contentLength || 0;
                console.log(`Started downloading ${contentLength} bytes`);
                break;
            case "Progress":
                downloaded += event.data.chunkLength;
                if (onProgress && contentLength > 0) {
                    onProgress(downloaded, contentLength);
                }
                break;
            case "Finished":
                console.log("Download finished");
                break;
        }
    });

    // Restart the app to apply the update
    await relaunch();
}

/**
 * Get the current app version from Tauri
 */
export async function getCurrentVersion(): Promise<string> {
    const { getVersion } = await import("@tauri-apps/api/app");
    return getVersion();
}
