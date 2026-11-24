<script lang="ts">
	import { INSTALL_PS1_URL, INSTALL_SH_URL } from '#lib/site';
	import AppPreview from './AppPreview.svelte';

	// These are served by this landing app, so APP_URL decides where the
	// commands point before the user has installed anything.
	const TARGETS = [
		{ name: 'Windows', cmd: `irm ${INSTALL_PS1_URL} | iex` },
		{ name: 'macOS / Linux', cmd: `curl -fsSL ${INSTALL_SH_URL} | sh` },
		{ name: 'npx', cmd: 'npx last30days-news' }
	];

	const FIRST = TARGETS[0].cmd;
</script>

<section class="hero" aria-labelledby="hero-title">
	<div class="wrap">
		<p class="eyebrow">Local-first RSS reader</p>
		<h1 id="hero-title">One reading list,<br /><span class="dim">for the last 30 days.</span></h1>
		<p class="lede">
			Every feed you follow, merged into one timeline, sorted by your categories, and summarised
			with citations when you ask.
		</p>

		<div class="actions">
			<div class="runner">
				<div class="tabs" role="group" aria-label="Install target">
					{#each TARGETS as item, i (item.name)}
						<button
							class="tab"
							type="button"
							aria-pressed={i === 0}
							data-cmd={item.cmd}
						>
							{item.name}
						</button>
					{/each}
				</div>
				<div class="exec">
					<span class="prompt mono" aria-hidden="true">$</span>
					<code class="cmd mono" id="install-cmd">{FIRST}</code>
					<button
						id="copy-install"
						class="copy"
						type="button"
						data-copy={FIRST}
						aria-label="Copy install command"
						title="Copy install command"
					>
						<svg
							class="copy-icon"
							viewBox="0 0 24 24"
							width="14"
							height="14"
							fill="none"
							stroke="currentColor"
							stroke-width="1.7"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
							<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
						</svg>
						<svg
							class="check-icon"
							viewBox="0 0 24 24"
							width="14"
							height="14"
							fill="none"
							stroke="currentColor"
							stroke-width="1.9"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M20 6 9 17l-5-5" />
						</svg>
					</button>
					<span class="sr-only" id="copy-status" role="status"></span>
				</div>
			</div>

			<button class="pill accent cta" type="button" data-scroll="how">
				See how it works
				<svg
					viewBox="0 0 16 16"
					width="14"
					height="14"
					fill="none"
					stroke="currentColor"
					stroke-width="1.7"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M3 8h10M9 4l4 4-4 4" />
				</svg>
			</button>
		</div>

		<p class="note">One command installs it. The first run uses password <code>last30</code>.</p>
	</div>

	<div class="bleed">
		<AppPreview />
	</div>
</section>

<style>
	.hero {
		padding: var(--section) 0 0;
	}

	.eyebrow {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 20px;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	.eyebrow::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 1.5px;
		background: var(--accent);
	}

	h1 {
		font-size: clamp(42px, 5.4vw, 68px);
		font-weight: 600;
		line-height: 1.02;
		letter-spacing: -0.032em;
	}

	h1 .dim {
		color: var(--txt-3);
	}

	.lede {
		max-width: 54ch;
		margin-top: 24px;
		color: var(--txt-2);
		font-size: 16px;
		line-height: 1.6;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-top: 34px;
	}

	.runner {
		display: flex;
		max-width: 100%;
		height: 46px;
		border: 1px solid var(--line-2);
		border-radius: 11px;
		background: var(--raise);
	}

	.tabs {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: none;
		padding: 0 7px;
		border-right: 1px solid var(--line);
	}

	.tab {
		height: 28px;
		padding: 0 9px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 11.5px;
		cursor: pointer;
	}

	.tab:hover {
		color: var(--txt);
	}

	.tab[aria-pressed='true'] {
		background: var(--card);
		box-shadow: inset 0 0 0 1px var(--line);
		color: var(--txt);
	}

	.exec {
		display: flex;
		align-items: center;
		gap: 10px;
		width: max-content;
		min-width: 0;
		padding: 0 6px 0 14px;
	}

	.prompt {
		color: var(--accent);
		font-size: 12.5px;
		font-weight: 600;
		user-select: none;
	}

	.cmd {
		overflow: hidden;
		flex: none;
		color: var(--txt);
		font-size: 12.5px;
		text-overflow: ellipsis;
		white-space: nowrap;
		user-select: all;
	}

	.copy {
		position: relative;
		display: grid;
		place-items: center;
		flex: none;
		width: 30px;
		height: 30px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--txt-3);
		cursor: pointer;
	}

	.copy:hover {
		background: var(--hover);
		color: var(--txt);
	}

	.check-icon {
		display: none;
	}

	.cta {
		height: 46px;
		padding: 0 20px;
		gap: 8px;
		font-size: 14px;
		font-family: inherit;
		cursor: pointer;
	}

	.cta svg {
		transition: transform 0.18s var(--ease);
	}

	.cta:hover svg {
		transform: translateX(2px);
	}

	.note {
		margin-top: 15px;
		color: var(--txt-3);
		font-size: 12.5px;
	}

	.note code {
		font-family: var(--font-mono);
		font-size: 11.5px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.bleed {
		width: 100%;
		max-width: 1240px;
		margin: 64px auto 0;
		padding: 0 24px;
	}

	@media (max-width: 760px) {
		h1 {
			font-size: clamp(38px, 10vw, 48px);
		}

		.lede {
			margin-top: 18px;
			font-size: 15.5px;
		}

		.actions {
			margin-top: 26px;
		}

		.runner {
			flex-direction: column;
			width: 100%;
			height: auto;
		}

		.tabs {
			justify-content: center;
			padding: 5px 6px;
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}

		.exec {
			width: 100%;
			height: 42px;
		}

		.cmd {
			flex: 1;
		}

		.cta {
			width: 100%;
			justify-content: center;
		}

		.note {
			font-size: 12px;
		}

		.bleed {
			margin-top: 36px;
			padding: 0 18px;
		}
	}
</style>
