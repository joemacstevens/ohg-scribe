<script lang="ts">
    interface Props {
        name: string;
        onRemove: () => void;
    }

    let { name, onRemove }: Props = $props();
</script>

<span class="preset-tag">
    {name}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg
        class="remove"
        viewBox="0 0 24 24"
        fill="none"
        stroke-width="2"
        onclick={(e) => {
            e.stopPropagation();
            onRemove();
        }}
    >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
</span>

<style>
    .preset-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px 4px 10px;
        background: linear-gradient(
            135deg,
            rgba(233, 19, 136, 0.1) 0%,
            rgba(107, 45, 123, 0.1) 100%
        );
        border: 1px solid rgba(233, 19, 136, 0.3);
        border-radius: 6px;
        font-size: 12px;
        color: var(--magenta, #e91388);
    }

    .preset-tag .remove {
        width: 14px;
        height: 14px;
        stroke: var(--magenta, #e91388);
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.15s;
    }

    .preset-tag .remove:hover {
        opacity: 1;
    }
</style>
