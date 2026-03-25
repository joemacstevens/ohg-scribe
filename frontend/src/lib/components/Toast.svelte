<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    message: string;
    type?: 'success' | 'error' | 'info';
    duration?: number;
    onClose?: () => void;
  }

  let { message, type = 'info', duration = 4000, onClose }: Props = $props();
  let visible = $state(true);

  onMount(() => {
    const timer = setTimeout(() => {
      visible = false;
      setTimeout(() => onClose?.(), 300);
    }, duration);

    return () => clearTimeout(timer);
  });

  function handleClose() {
    visible = false;
    setTimeout(() => onClose?.(), 300);
  }

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };
</script>

<div class="toast {type}" class:visible>
  <span class="icon">{icons[type]}</span>
  <span class="message">{message}</span>
  <button class="close" onclick={handleClose} aria-label="Dismiss">×</button>
</div>

<style>
  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    background: white;
    border-radius: 10px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s ease;
    max-width: 400px;
    z-index: 1001;
  }

  .toast.visible {
    transform: translateY(0);
    opacity: 1;
  }

  .toast.success {
    border-left: 4px solid var(--success-color, #10b981);
  }

  .toast.error {
    border-left: 4px solid var(--error-color, #ef4444);
  }

  .toast.info {
    border-left: 4px solid var(--accent-color, #6366f1);
  }

  .icon {
    font-size: 16px;
    font-weight: bold;
  }

  .toast.success .icon {
    color: var(--success-color, #10b981);
  }

  .toast.error .icon {
    color: var(--error-color, #ef4444);
  }

  .toast.info .icon {
    color: var(--accent-color, #6366f1);
  }

  .message {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary, #111827);
  }

  .close {
    background: none;
    border: none;
    font-size: 18px;
    color: var(--text-secondary, #9ca3af);
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .close:hover {
    color: var(--text-primary, #6b7280);
  }
</style>
