<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Editor } from "@tiptap/core";
    import StarterKit from "@tiptap/starter-kit";
    import Placeholder from "@tiptap/extension-placeholder";
    import BubbleMenuExtension from "@tiptap/extension-bubble-menu";
    import { Table } from "@tiptap/extension-table";
    import { TableRow } from "@tiptap/extension-table-row";
    import { TableCell } from "@tiptap/extension-table-cell";
    import { TableHeader } from "@tiptap/extension-table-header";
    import { workspaceStore } from "$lib/stores/workspace";
    import { refineText } from "$lib/services/ai";

    let element: HTMLElement;
    let editor: Editor;
    let bubbleMenuElement: HTMLElement;

    let isRefining = $state(false);

    onMount(() => {
        editor = new Editor({
            element: element,
            extensions: [
                StarterKit,
                Placeholder.configure({
                    placeholder: "Generative minutes will appear here...",
                }),
                BubbleMenuExtension.configure({
                    element: bubbleMenuElement,
                    tippyOptions: { duration: 100 },
                }),
                Table.configure({
                    resizable: true,
                }),
                TableRow,
                TableHeader,
                TableCell,
            ],
            content: $workspaceStore.minutesContent || "",
            onUpdate: ({ editor }) => {
                workspaceStore.updateMinutes(editor.getHTML());
            },
        });
    });

    onDestroy(() => {
        if (editor) {
            editor.destroy();
        }
    });

    async function handleRefine(instruction: string) {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        if (empty) return;

        const selectedText = editor.state.doc.textBetween(from, to, " ");

        isRefining = true;
        try {
            const refined = await refineText(selectedText, instruction);
            // Replace selection with refined text
            editor.chain().focus().insertContentAt({ from, to }, refined).run();
        } catch (e) {
            console.error(e);
            alert("Failed to refine text: " + String(e));
        } finally {
            isRefining = false;
        }
    }

    function handleStartOver() {
        if (
            confirm(
                "Are you sure? This will discard your current edits and take you back to template selection.",
            )
        ) {
            workspaceStore.setMinutesGenerated(false);
        }
    }
</script>

<div class="editor-layout">
    <div class="toolbar">
        <button
            class="tool-btn"
            onclick={() => editor?.chain().focus().toggleBold().run()}
            class:active={editor?.isActive("bold")}
        >
            <b>B</b>
        </button>
        <button
            class="tool-btn"
            onclick={() => editor?.chain().focus().toggleItalic().run()}
            class:active={editor?.isActive("italic")}
        >
            <i>I</i>
        </button>
        <div class="divider"></div>
        <button
            class="tool-btn"
            onclick={() =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            class:active={editor?.isActive("heading", { level: 1 })}
        >
            H1
        </button>
        <button
            class="tool-btn"
            onclick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            class:active={editor?.isActive("heading", { level: 2 })}
        >
            H2
        </button>
        <div class="divider"></div>
        <button
            class="tool-btn"
            onclick={() => editor?.chain().focus().toggleBulletList().run()}
            class:active={editor?.isActive("bulletList")}
        >
            • List
        </button>

        <div class="spacer"></div>

        <button
            class="tool-btn text-btn"
            onclick={handleStartOver}
            title="Browse templates"
        >
            <span class="icon">⊞</span> Templates
        </button>
    </div>

    <!-- Bubble Menu using pure HTML/CSS tied to Tiptap -->
    <div bind:this={bubbleMenuElement} class="bubble-menu-wrapper">
        {#if isRefining}
            <div class="refining-state">✨ Refining...</div>
        {:else}
            <div class="refine-options">
                <button
                    class="refine-btn"
                    onclick={() =>
                        handleRefine("Make this more professional and concise")}
                >
                    Formalize
                </button>
                <div class="sep"></div>
                <button
                    class="refine-btn"
                    onclick={() => handleRefine("Shorten this text")}
                >
                    Shorten
                </button>
                <div class="sep"></div>
                <button
                    class="refine-btn"
                    onclick={() => handleRefine("Fix grammar and spelling")}
                >
                    Fix Grammar
                </button>
            </div>
        {/if}
    </div>

    <div class="editor-container" bind:this={element}></div>
</div>

<style>
    .editor-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: white;
    }

    .toolbar {
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        gap: 8px;
        align-items: center;
        background: var(--gray-100);
    }

    .spacer {
        flex: 1;
    }

    .text-btn {
        width: auto;
        padding: 0 12px;
        gap: 6px;
        font-family: var(--font-sans, sans-serif);
        font-size: 13px;
        color: var(--gray-600);
        font-weight: 500;
    }

    .text-btn:hover {
        color: var(--navy);
        background: var(--gray-200);
    }

    .icon {
        font-size: 16px;
        line-height: 1;
    }

    .tool-btn {
        width: 32px;
        height: 32px;
        border: 1px solid transparent;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-family: serif;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .tool-btn:hover {
        background: var(--bg-hover);
    }
    .tool-btn.active {
        background: var(--lavender);
        color: var(--purple);
        border-color: var(--lavender-dark);
    }

    .divider {
        width: 1px;
        height: 20px;
        background: var(--gray-300);
        margin: 0 4px;
    }

    .editor-container {
        flex: 1;
        overflow-y: auto;
        padding: 40px;
        cursor: text;
    }

    /* Bubble Menu */
    .bubble-menu-wrapper {
        background: var(--navy);
        color: white;
        border-radius: 8px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        padding: 4px;
        display: flex;
        align-items: center;
        overflow: hidden;
    }

    /* Hide bubble menu when idle */
    :global(.tippy-box[data-state="hidden"]) {
        opacity: 0;
    }

    .refine-options {
        display: flex;
        align-items: center;
    }

    .refine-btn {
        background: transparent;
        border: none;
        color: white;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 10px;
        cursor: pointer;
        transition: background 0.1s;
        border-radius: 4px;
    }

    .refine-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .sep {
        width: 1px;
        height: 12px;
        background: rgba(255, 255, 255, 0.2);
        margin: 0 2px;
    }

    .refining-state {
        padding: 6px 12px;
        font-size: 12px;
        color: var(--magenta-light);
        font-weight: 600;
    }

    /* Tiptap Styles */
    :global(.ProseMirror) {
        outline: none;
        max-width: 800px;
        margin: 0 auto;
    }

    :global(.ProseMirror p.is-editor-empty:first-child::before) {
        color: #adb5bd;
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
    }

    :global(.ProseMirror h1) {
        color: var(--navy);
        margin-top: 0;
    }
    :global(.ProseMirror h2) {
        color: var(--navy-light);
        margin-top: 24px;
    }
    :global(.ProseMirror ul) {
        padding-left: 20px;
    }
    :global(.ProseMirror li) {
        margin-bottom: 4px;
    }
</style>
