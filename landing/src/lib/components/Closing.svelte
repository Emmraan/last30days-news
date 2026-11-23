<script lang="ts">
	import { REPO_URL } from '#lib/site';
</script>

<section class="closing" aria-labelledby="closing-title">
	<div class="wrap">
		<h2 id="closing-title">Read it on your machine.</h2>
		<p class="line">One command, a local database, and no account to create.</p>

		<div class="actions">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external repo, not an app route -->
			<a class="pill accent action" href={REPO_URL}>
				<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
					<path
						d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
						fill="currentColor"
					/>
				</svg>
				View on GitHub
			</a>
			<button class="pill line action" type="button" data-scroll="how">See how it works</button>
		</div>
	</div>
</section>

<style>
	.closing {
		padding: var(--section) 0;
	}

	h2 {
		max-width: 20ch;
		font-size: clamp(32px, 4vw, 44px);
		font-weight: 600;
		line-height: 1.08;
		letter-spacing: -0.028em;
	}

	.line {
		max-width: 52ch;
		margin-top: 14px;
		color: var(--txt-2);
		font-size: 14.5px;
		line-height: 1.65;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-top: 28px;
	}

	.action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		height: 42px;
		min-height: 42px;
		margin: 0;
		padding: 13px 20px;
		border: 1px solid transparent;
		border-radius: var(--pill);
		font-size: 14px;
		font-weight: 500;
		line-height: 1;
		gap: 8px;
		white-space: nowrap;
	}

	.pill.line {
		border-color: var(--line-2);
		background: transparent;
		box-shadow: none;
		appearance: none;
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: 500;
		line-height: 1;
		cursor: pointer;
	}

	@media (max-width: 760px) {
		h2 {
			font-size: 30px;
		}
	}
</style>
