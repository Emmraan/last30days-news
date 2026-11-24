<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Check, ChevronDown } from 'lucide-svelte';

	type Option = { value: string; label: string };

	let {
		value,
		options,
		onchange,
		label,
		placeholder = 'Choose…',
		disabled = false
	}: {
		value: string;
		options: Option[];
		onchange: (value: string) => void;
		label: string;
		placeholder?: string;
		disabled?: boolean;
	} = $props();

	const id = $props.id();
	let open = $state(false);
	let active = $state(-1);
	let above = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);
	let menu = $state<HTMLDivElement | null>(null);

	const selectedIndex = $derived(options.findIndex((option) => option.value === value));
	const selectedLabel = $derived(selectedIndex >= 0 ? options[selectedIndex].label : placeholder);

	function place() {
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const height = Math.min(options.length * 32 + 10, 240);
		above = window.innerHeight - rect.bottom < height + 12;
	}

	async function show() {
		if (disabled || options.length === 0) return;
		place();
		open = true;
		active = selectedIndex >= 0 ? selectedIndex : 0;
		await tick();
		// Focusing without preventScroll makes the drawer scroll to the menu.
		menu?.focus({ preventScroll: true });
	}

	function hide() {
		open = false;
	}

	function choose(index: number) {
		const option = options[index];
		if (!option) return;
		onchange(option.value);
		hide();
		trigger?.focus();
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (
			event.key !== 'ArrowDown' &&
			event.key !== 'ArrowUp' &&
			event.key !== 'Enter' &&
			event.key !== ' '
		) {
			return;
		}
		event.preventDefault();
		void show();
	}

	function onMenuKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				active = Math.min(options.length - 1, active + 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				active = Math.max(0, active - 1);
				break;
			case 'Home':
				event.preventDefault();
				active = 0;
				break;
			case 'End':
				event.preventDefault();
				active = options.length - 1;
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				choose(active);
				break;
			case 'Escape':
				event.preventDefault();
				hide();
				trigger?.focus();
				break;
			case 'Tab':
				hide();
				break;
		}
	}

	$effect(() => {
		if (!open || active < 0 || !menu) return;
		const option = menu.querySelector<HTMLElement>(`[data-index="${active}"]`);
		if (!option) return;
		// Scroll only the menu. scrollIntoView also scrolls the drawer.
		if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
		else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
			menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
		}
	});

	onMount(() => {
		const onPointer = (event: PointerEvent) => {
			if (!open) return;
			const target = event.target as Node;
			if (trigger?.contains(target) || menu?.contains(target)) return;
			hide();
		};
		const onResize = () => {
			if (open) place();
		};

		window.addEventListener('pointerdown', onPointer);
		window.addEventListener('resize', onResize);

		return () => {
			window.removeEventListener('pointerdown', onPointer);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<div class="dropdown">
	<button
		bind:this={trigger}
		class="trigger"
		class:open
		type="button"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={open ? `${id}-menu` : undefined}
		aria-label={label}
		{disabled}
		onclick={() => (open ? hide() : void show())}
		onkeydown={onTriggerKeydown}
	>
		<span class="value" class:placeholder={selectedIndex < 0}>{selectedLabel}</span>
		<span class="chev" aria-hidden="true"><ChevronDown size={14} /></span>
	</button>

	{#if open}
		<div
			bind:this={menu}
			id="{id}-menu"
			class="menu"
			class:above
			role="listbox"
			tabindex="-1"
			aria-label={label}
			aria-activedescendant="{id}-option-{active}"
			onkeydown={onMenuKeydown}
		>
			{#each options as option, index (option.value)}
				<button
					id="{id}-option-{index}"
					class="option"
					class:active={index === active}
					type="button"
					role="option"
					tabindex="-1"
					aria-selected={option.value === value}
					data-index={index}
					onmousedown={(event) => event.preventDefault()}
					onmouseenter={() => (active = index)}
					onclick={() => choose(index)}
				>
					<span>{option.label}</span>
					{#if option.value === value}
						<Check size={14} aria-hidden="true" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown {
		position: relative;
		width: 100%;
	}

	.trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 34px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--card);
		color: var(--txt);
		font: inherit;
		font-size: 13.5px;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 120ms var(--ease),
			border-color 120ms var(--ease),
			box-shadow 120ms var(--ease);
	}

	.trigger:hover:not(:disabled) {
		border-color: var(--line-2);
	}

	.trigger.open,
	.trigger:focus-visible {
		border-color: var(--accent);
		outline: none;
		box-shadow: 0 0 0 1px var(--accent);
	}

	.trigger:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.value.placeholder {
		color: var(--txt-3);
	}

	.chev {
		display: inline-grid;
		place-items: center;
		flex: none;
		color: var(--txt-3);
		transition: transform 140ms var(--ease);
	}

	.trigger.open .chev {
		transform: rotate(180deg);
	}

	.menu {
		position: absolute;
		z-index: 50;
		top: calc(100% + 6px);
		right: 0;
		left: 0;
		max-height: 240px;
		overflow-y: auto;
		padding: 4px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--card);
		box-shadow: 0 14px 34px rgb(0 0 0 / 0.22);
		outline: none;
		animation: menu-in 120ms var(--ease) both;
	}

	.menu.above {
		top: auto;
		bottom: calc(100% + 6px);
		animation-name: menu-in-up;
	}

	.option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		width: 100%;
		min-height: 32px;
		padding: 0 9px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--txt-2);
		font: inherit;
		font-size: 13.5px;
		text-align: left;
		cursor: pointer;
	}

	.option.active {
		background: var(--hover);
		color: var(--txt);
	}

	.option[aria-selected='true'] {
		color: var(--txt);
	}

	.option[aria-selected='true'] :global(svg) {
		color: var(--accent);
	}

	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-3px) scale(0.985);
		}

		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes menu-in-up {
		from {
			opacity: 0;
			transform: translateY(3px) scale(0.985);
		}

		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
