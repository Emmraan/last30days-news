<script lang="ts">
	import Closing from '#lib/components/Closing.svelte';
	import Faq from '#lib/components/Faq.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import Hero from '#lib/components/Hero.svelte';
	import HowItWorks from '#lib/components/HowItWorks.svelte';
	import Nav from '#lib/components/Nav.svelte';
	import ProofStrip from '#lib/components/ProofStrip.svelte';
	import Sources from '#lib/components/Sources.svelte';
	import WhatYouGet from '#lib/components/WhatYouGet.svelte';
</script>

<svelte:head>
	<title>last30days-news — one reading list for the last 30 days</title>
	<meta
		name="description"
		content="A local-first RSS reader: one timeline from your feeds, sorted by categories, with cited summaries when you ask."
	/>
</svelte:head>

<Nav />

<main id="top">
	<Hero />
	<ProofStrip />
	<HowItWorks />
	<WhatYouGet />
	<Sources />
	<Faq />
	<Closing />
</main>

<Footer />
