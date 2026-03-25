<script>
    import { onMount } from "svelte";
    let { children } = $props();
</script>

{@render children()}

<style>
    :global(:root) {
        /* Animation Duration Tokens */
        --duration-instant: 100ms;
        --duration-fast: 150ms;
        --duration-normal: 250ms;
        --duration-slow: 350ms;
        --duration-emphasis: 500ms;

        /* Animation Easing Tokens */
        --ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
        --ease-in: cubic-bezier(0.55, 0.06, 0.68, 0.19);
        --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
        --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
        --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.1);
    }

    /* Reduced motion support - REQUIRED for accessibility */
    @media (prefers-reduced-motion: reduce) {
        :global(*),
        :global(*::before),
        :global(*::after) {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
    }
</style>
