<script lang="ts">
    import { chatStore } from "$lib/stores/chat";
    import { workspaceStore } from "$lib/stores/workspace";
    import { sendChatMessage } from "$lib/services/chat";
    import { fade, fly } from "svelte/transition";

    let inputValue = $state("");
    let messagesContainer: HTMLDivElement | undefined = $state();
    let inputElement: HTMLTextAreaElement | undefined = $state();

    const SUGGESTED_QUESTIONS = [
        "What were the key decisions made?",
        "Summarize the main action items",
        "What topics generated the most discussion?",
        "Were there any disagreements or concerns raised?",
    ];

    // Auto-scroll to bottom when messages change
    $effect(() => {
        if ($chatStore.messages.length > 0 && messagesContainer) {
            // Small delay to ensure DOM has updated
            setTimeout(() => {
                messagesContainer?.scrollTo({
                    top: messagesContainer.scrollHeight,
                    behavior: "smooth",
                });
            }, 50);
        }
    });

    // Initialize chat when job changes
    $effect(() => {
        const jobId = $workspaceStore.currentJobId;
        if (jobId && jobId !== $chatStore.currentJobId) {
            chatStore.initForJob(jobId);
        }
    });

    async function handleSend() {
        const message = inputValue.trim();
        if (!message || $chatStore.isLoading || !$workspaceStore.currentTranscript)
            return;

        inputValue = "";

        // Resize textarea back to default
        if (inputElement) {
            inputElement.style.height = "auto";
        }

        chatStore.addUserMessage(message);

        try {
            const response = await sendChatMessage(
                message,
                $workspaceStore.currentTranscript,
                $chatStore.messages.filter((m) => m.role !== "user" || m.content !== message),
            );
            chatStore.addAssistantMessage(response);
        } catch (e) {
            console.error("Chat error:", e);
            chatStore.addAssistantMessage(
                `⚠️ Sorry, I couldn't process that request. ${String(e)}`,
            );
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function handleSuggestedQuestion(question: string) {
        inputValue = question;
        handleSend();
    }

    function autoResize(e: Event) {
        const textarea = e.target as HTMLTextAreaElement;
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }

    function formatTime(isoString: string): string {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }
</script>

<div class="chat-container">
    {#if $chatStore.messages.length === 0 && !$chatStore.isLoading}
        <!-- Empty State -->
        <div class="empty-state" in:fade={{ duration: 200 }}>
            <div class="empty-icon">💬</div>
            <h3>Ask the Transcript</h3>
            <p>
                Ask questions about your meeting and get answers grounded in
                the transcript.
            </p>
            <div class="suggested-questions">
                {#each SUGGESTED_QUESTIONS as question}
                    <button
                        class="suggestion-chip"
                        onclick={() => handleSuggestedQuestion(question)}
                    >
                        {question}
                    </button>
                {/each}
            </div>
        </div>
    {:else}
        <!-- Messages -->
        <div class="messages" bind:this={messagesContainer}>
            {#each $chatStore.messages as message (message.id)}
                <div
                    class="message {message.role}"
                    in:fly={{ y: 10, duration: 200 }}
                >
                    <div class="message-bubble">
                        {#if message.role === "assistant"}
                            <div class="message-content">
                                {@html message.content
                                    .replace(/\n/g, "<br>")
                                    .replace(
                                        /\*\*(.*?)\*\*/g,
                                        "<strong>$1</strong>",
                                    )
                                    .replace(/\*(.*?)\*/g, "<em>$1</em>")
                                    .replace(
                                        /- (.*?)(<br>|$)/g,
                                        "<span class='bullet'>• $1</span><br>",
                                    )}
                            </div>
                        {:else}
                            <div class="message-content">{message.content}</div>
                        {/if}
                        <span class="message-time"
                            >{formatTime(message.timestamp)}</span
                        >
                    </div>
                </div>
            {/each}

            {#if $chatStore.isLoading}
                <div class="message assistant" in:fade={{ duration: 150 }}>
                    <div class="message-bubble typing">
                        <div class="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    {/if}

    <!-- Input Area -->
    <div class="input-area">
        {#if $chatStore.messages.length > 0}
            <button
                class="clear-btn"
                onclick={() => chatStore.clearChat()}
                title="Clear conversation"
                disabled={$chatStore.isLoading}
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    ></path>
                </svg>
            </button>
        {/if}
        <div class="input-wrapper">
            <textarea
                bind:this={inputElement}
                bind:value={inputValue}
                placeholder="Ask about the transcript..."
                onkeydown={handleKeydown}
                oninput={autoResize}
                rows="1"
                disabled={$chatStore.isLoading}
            ></textarea>
            <button
                class="send-btn"
                aria-label="Send message"
                onclick={handleSend}
                disabled={!inputValue.trim() || $chatStore.isLoading}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
    </div>
</div>

<style>
    .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    /* Empty State */
    .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 24px;
        text-align: center;
        gap: 8px;
    }

    .empty-icon {
        font-size: 40px;
        margin-bottom: 8px;
    }

    .empty-state h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--navy, #1a2b4a);
    }

    .empty-state p {
        margin: 0;
        font-size: 14px;
        color: var(--gray-500, #6b7280);
        max-width: 280px;
        line-height: 1.5;
    }

    .suggested-questions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
        width: 100%;
        max-width: 320px;
    }

    .suggestion-chip {
        padding: 10px 14px;
        background: var(--color-secondary-muted);
        border: 1px solid rgba(0, 168, 184, 0.25);
        border-radius: 10px;
        font-size: var(--font-size-sm);
        font-family: var(--font-family);
        color: var(--color-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);
        text-align: left;
    }

    .suggestion-chip:hover {
        background: rgba(0, 168, 184, 0.18);
        border-color: var(--color-secondary);
        transform: translateY(-1px);
    }

    /* Messages */
    .messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .message {
        display: flex;
        max-width: 85%;
    }

    .message.user {
        align-self: flex-end;
    }

    .message.assistant {
        align-self: flex-start;
    }

    .message-bubble {
        padding: 10px 14px;
        border-radius: 16px;
        position: relative;
    }

    .message.user .message-bubble {
        background: var(--color-accent);
        color: white;
        border-bottom-right-radius: 4px;
    }

    .message.assistant .message-bubble {
        background: var(--gray-50, #f9fafb);
        border: 1px solid var(--gray-200, #e5e7eb);
        color: var(--navy, #1a2b4a);
        border-bottom-left-radius: 4px;
    }

    .message-content {
        font-size: 14px;
        line-height: 1.6;
        word-wrap: break-word;
    }

    .message-content :global(.bullet) {
        display: block;
        padding-left: 4px;
    }

    .message-time {
        display: block;
        font-size: 11px;
        margin-top: 4px;
        opacity: 0.6;
    }

    .message.user .message-time {
        text-align: right;
    }

    /* Typing indicator */
    .typing {
        padding: 12px 18px;
    }

    .typing-indicator {
        display: flex;
        gap: 4px;
        align-items: center;
    }

    .typing-indicator span {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--gray-400, #9ca3af);
        animation: typingBounce 1.4s infinite ease-in-out;
    }

    .typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
    }

    @keyframes typingBounce {
        0%,
        80%,
        100% {
            transform: scale(0.7);
            opacity: 0.4;
        }
        40% {
            transform: scale(1);
            opacity: 1;
        }
    }

    /* Input Area */
    .input-area {
        padding: 12px 16px;
        border-top: 1px solid var(--gray-200, #e5e7eb);
        background: white;
        display: flex;
        align-items: flex-end;
        gap: 8px;
    }

    .input-wrapper {
        flex: 1;
        display: flex;
        align-items: flex-end;
        background: var(--gray-50, #f9fafb);
        border: 1px solid var(--gray-300, #d1d5db);
        border-radius: 16px;
        padding: 4px 4px 4px 14px;
        transition: border-color 0.2s;
    }

    .input-wrapper:focus-within {
        border-color: var(--magenta, #e91388);
        box-shadow: 0 0 0 2px rgba(233, 19, 136, 0.08);
    }

    .input-wrapper textarea {
        flex: 1;
        border: none;
        background: none;
        font-size: 14px;
        color: var(--navy, #1a2b4a);
        resize: none;
        outline: none;
        padding: 6px 0;
        max-height: 120px;
        font-family: inherit;
        line-height: 1.4;
    }

    .input-wrapper textarea::placeholder {
        color: var(--gray-400, #9ca3af);
    }

    .send-btn {
        width: 34px;
        height: 34px;
        border-radius: var(--radius-md);
        border: none;
        background: var(--color-accent);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all var(--transition-fast);
    }

    .send-btn:hover:not(:disabled) {
        background: var(--color-accent-hover);
        transform: scale(1.05);
    }

    .send-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .clear-btn {
        background: none;
        border: 1px solid var(--gray-200, #e5e7eb);
        color: var(--gray-400, #9ca3af);
        cursor: pointer;
        padding: 8px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
    }

    .clear-btn:hover:not(:disabled) {
        background: #fef2f2;
        border-color: #fca5a5;
        color: #ef4444;
    }

    .clear-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
