<script lang="ts">
	let { command, label = 'Copy' }: { command: string; label?: string } = $props();

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copyText(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Older browsers and plain-http hosts: select and copy by hand.
			const field = document.createElement('textarea');
			field.value = text;
			field.setAttribute('readonly', '');
			field.style.position = 'fixed';
			field.style.opacity = '0';
			document.body.append(field);
			field.select();
			let ok = false;
			try {
				ok = document.execCommand('copy');
			} catch {}
			field.remove();
			return ok;
		}
	}

	async function copy() {
		if (!(await copyText(command))) return;
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 1600);
	}
</script>

<div class="cmd">
	<pre><code>{command}</code></pre>
	<button class="copy-command" class:done={copied} type="button" onclick={copy}>
		{copied ? 'Copied' : label}
	</button>
</div>

<style>
	.cmd {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin: 14px 0;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--card);
	}

	pre {
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		margin: 0;
		padding: 0;
		background: none;
		border: 0;
	}

	code {
		background: none;
		border: 0;
		padding: 0;
		white-space: pre;
	}

	.copy-command {
		flex: none;
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--line-2);
		border-radius: 7px;
		background: var(--raise);
		color: var(--txt-2);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.copy-command:hover {
		border-color: var(--txt-3);
		color: var(--txt);
	}

	.copy-command.done {
		color: var(--ok);
	}

	@media (max-width: 560px) {
		.cmd {
			flex-direction: column;
		}
	}
</style>
