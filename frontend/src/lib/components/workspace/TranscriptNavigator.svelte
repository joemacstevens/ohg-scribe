<script lang="ts">
    import { workspaceStore } from "$lib/stores/workspace";

    // We'll calculate speakers and their talk time/segment count
    let speakers = $derived.by(() => {
        const segs = $workspaceStore.currentTranscript?.segments || [];
        const map = new Map<string, number>();
        segs.forEach((s) => {
            map.set(s.speaker, (map.get(s.speaker) || 0) + 1);
        });

        return Array.from(map.entries()).map(([name, count]) => ({
            name,
            count,
        }));
    });

    function getInitials(name: string) {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
    }
</script>

<div class="nav-container">
    <div class="section">
        <div class="section-title">Speakers</div>
        <div class="speaker-list">
            {#each speakers as speaker}
                <button
                    class="speaker-item"
                    onclick={() => workspaceStore.scrollToSpeaker(speaker.name)}
                >
                    <div class="avatar">
                        {getInitials(speaker.name)}
                    </div>
                    <div class="info">
                        <span class="name">{speaker.name}</span>
                        <span class="count">{speaker.count} segments</span>
                    </div>
                </button>
            {/each}
        </div>
    </div>
</div>

<style>
    .nav-container {
        padding: 20px;
        height: 100%;
        overflow-y: auto;
        background: var(--bg-primary);
    }

    .section-title {
        text-transform: uppercase;
        font-size: 11px;
        font-weight: 700;
        color: var(--gray-400);
        margin-bottom: 16px;
        letter-spacing: 0.05em;
    }

    .speaker-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .speaker-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border: 1px solid transparent;
        background: var(--white);
        cursor: pointer;
        border-radius: 12px;
        text-align: left;
        color: var(--navy);
        transition: all 0.2s;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    }

    .speaker-item:hover {
        border-color: var(--lavender-dark);
        background: var(--lavender-light);
        transform: translateY(-1px);
    }

    .avatar {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        background: var(--lavender);
        color: var(--purple);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
    }

    .info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .name {
        font-size: 14px;
        font-weight: 500;
    }

    .count {
        font-size: 11px;
        color: var(--gray-400);
    }
</style>
