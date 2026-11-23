<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<div class="empty">{text}</div>

<style>
	.empty {
		display: grid;
		place-items: center;
		flex: 1;
		padding: 24px;
		color: var(--txt-3);
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.5;
		text-align: center;
	}
</style>
