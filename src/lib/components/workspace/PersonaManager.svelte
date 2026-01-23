<script lang="ts">
    import { type Persona } from "$lib/types/minutes";
    import { DEFAULT_PERSONAS } from "$lib/data/personas";
    import { fade, scale } from "svelte/transition";

    let { isOpen, onClose, onSave } = $props<{
        isOpen: boolean;
        onClose: () => void;
        onSave: (persona: Persona) => void;
    }>();

    let personas = $state<Persona[]>([...DEFAULT_PERSONAS]);
    let editingId = $state<string | null>(null);
    let formState = $state<Partial<Persona>>({});

    function handleEdit(persona: Persona) {
        editingId = persona.id;
        formState = { ...persona };
    }

    function handleNew() {
        editingId = "new";
        formState = {
            id: crypto.randomUUID(),
            name: "",
            roleDefinition: "",
            toneDescription: "",
            formattingRules: "",
        };
    }

    function handleSave() {
        if (!formState.name) return;

        const newPersona = formState as Persona;

        if (editingId === "new") {
            personas = [...personas, newPersona];
        } else {
            personas = personas.map((p) =>
                p.id === newPersona.id ? newPersona : p,
            );
        }

        onSave(newPersona);
        editingId = null;
    }

    function handleDelete(id: string) {
        if (confirm("Are you sure you want to delete this persona?")) {
            personas = personas.filter((p) => p.id !== id);
            editingId = null;
        }
    }
</script>

{#if isOpen}
    <div class="modal-backdrop" transition:fade onclick={onClose}>
        <div
            class="modal-content"
            transition:scale
            onclick={(e) => e.stopPropagation()}
        >
            <header class="modal-header">
                <h3>Manage Writing Personas</h3>
                <button class="close-btn" onclick={onClose}>&times;</button>
            </header>

            <div class="modal-body">
                <div class="sidebar">
                    <button class="new-btn" onclick={handleNew}
                        >+ Create New Persona</button
                    >
                    <div class="persona-list">
                        {#each personas as persona}
                            <button
                                class="list-item"
                                class:active={editingId === persona.id}
                                onclick={() => handleEdit(persona)}
                            >
                                <span class="name">{persona.name}</span>
                                {#if persona.isDefault}<span class="badge"
                                        >Default</span
                                    >{/if}
                            </button>
                        {/each}
                    </div>
                </div>

                <div class="editor">
                    {#if editingId}
                        <div class="form-grid">
                            <div class="field">
                                <label>Persona Name</label>
                                <input
                                    type="text"
                                    bind:value={formState.name}
                                    placeholder="e.g. Friendly Coach"
                                />
                            </div>

                            <div class="field">
                                <label>Role Definition</label>
                                <p class="help-text">
                                    Who is the AI acting as?
                                </p>
                                <textarea
                                    bind:value={formState.roleDefinition}
                                    placeholder="You are an expert..."
                                ></textarea>
                            </div>

                            <div class="field">
                                <label>Tone & Style</label>
                                <p class="help-text">How should it sound?</p>
                                <textarea
                                    bind:value={formState.toneDescription}
                                    placeholder="Formal, concise, empathetic..."
                                ></textarea>
                            </div>

                            <div class="field">
                                <label>Formatting Rules</label>
                                <p class="help-text">
                                    Any structural constraints?
                                </p>
                                <textarea
                                    bind:value={formState.formattingRules}
                                    placeholder="Use bullet points for lists..."
                                ></textarea>
                            </div>

                            <div class="actions">
                                <button
                                    class="delete-btn"
                                    onclick={() => handleDelete(formState.id!)}
                                    disabled={formState.isDefault}
                                    >Delete</button
                                >
                                <button class="save-btn" onclick={handleSave}
                                    >Save Persona</button
                                >
                            </div>
                        </div>
                    {:else}
                        <div class="empty-selection">
                            <p>Select a persona to edit or create a new one.</p>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal-content {
        width: 900px;
        height: 600px;
        background: white;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        overflow: hidden;
    }

    .modal-header {
        padding: 16px 24px;
        border-bottom: 1px solid var(--gray-200);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--gray-100);
    }

    .modal-header h3 {
        margin: 0;
        font-size: 18px;
    }
    .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--gray-600);
    }

    .modal-body {
        flex: 1;
        display: flex;
        overflow: hidden;
    }

    .sidebar {
        width: 250px;
        border-right: 1px solid var(--gray-200);
        padding: 16px;
        background: var(--gray-100);
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .new-btn {
        width: 100%;
        padding: 8px;
        background: var(--white);
        border: 1px solid var(--gray-300);
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        color: var(--primary);
    }

    .persona-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        text-align: left;
    }

    .list-item:hover {
        background: var(--gray-200);
    }
    .list-item.active {
        background: var(--white);
        border-left: 3px solid var(--magenta);
        font-weight: 500;
    }

    .badge {
        font-size: 10px;
        background: var(--gray-200);
        padding: 2px 6px;
        border-radius: 4px;
    }

    .editor {
        flex: 1;
        padding: 24px;
        overflow-y: auto;
    }

    .form-grid {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 600px;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .field label {
        font-weight: 600;
        font-size: 14px;
    }
    .help-text {
        font-size: 12px;
        color: var(--gray-500);
        margin: 0;
    }

    input,
    textarea {
        padding: 10px;
        border: 1px solid var(--gray-300);
        border-radius: 6px;
        font-family: inherit;
        font-size: 14px;
    }

    textarea {
        height: 80px;
        resize: vertical;
    }

    .actions {
        display: flex;
        justify-content: space-between;
        margin-top: 16px;
    }

    .save-btn {
        background: var(--magenta);
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    }
    .delete-btn {
        background: transparent;
        color: var(--error-color);
        border: none;
        cursor: pointer;
    }
    .delete-btn:disabled {
        color: var(--gray-400);
        cursor: not-allowed;
    }

    .empty-selection {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--gray-400);
    }
</style>
