import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: 'list',
	use: { baseURL: 'http://127.0.0.1:4477', trace: 'on-first-retry' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'pnpm build && pnpm preview --port 4477 --host 127.0.0.1',
		url: 'http://127.0.0.1:4477/api/health',
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
