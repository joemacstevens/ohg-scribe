<script lang="ts">
    interface Props {
        label: string;
        checked: boolean;
        onchange?: (checked: boolean) => void;
    }

    let { label, checked = $bindable(), onchange }: Props = $props();

    function handleClick() {
        checked = !checked;
        onchange?.(checked);
    }
</script>

<div
    class="toggle-item"
    class:active={checked}
    onclick={handleClick}
    role="switch"
    aria-checked={checked}
    tabindex="0"
    onkeydown={(e) => e.key === "Enter" && handleClick()}
>
    <span class="toggle-label">{label}</span>
    <div class="toggle-switch"></div>
</div>

<style>
    .toggle-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: var(--gray-100, #f9fafb);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
        user-select: none;
    }

    .toggle-item:hover {
        background: var(--lavender, #f0ebf5);
    }

    .toggle-item.active {
        background: linear-gradient(
            135deg,
            rgba(233, 19, 136, 0.08) 0%,
            rgba(107, 45, 123, 0.08) 100%
        );
        border-color: rgba(233, 19, 136, 0.3);
    }

    .toggle-item.active .toggle-label {
        color: var(--magenta, #e91388);
    }

    .toggle-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--gray-600, #4b5563);
    }

    .toggle-switch {
        width: 36px;
        height: 20px;
        background: var(--gray-300, #d1d5db);
        border-radius: 10px;
        position: relative;
        transition: all 0.2s;
    }

    .toggle-switch::after {
        content: "";
        position: absolute;
        width: 16px;
        height: 16px;
        background: white;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: all 0.2s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .toggle-item.active .toggle-switch {
        background: linear-gradient(
            135deg,
            var(--magenta, #e91388) 0%,
            var(--purple, #6b2d7b) 100%
        );
    }

    .toggle-item.active .toggle-switch::after {
        left: 18px;
    }
</style>
