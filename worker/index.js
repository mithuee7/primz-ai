// Cloudflare entry point. Serves the Next.js app exactly as OpenNext built it, and runs the
// reply retry queue on a schedule (see triggers.crons in wrangler.jsonc).
// Requires the build first: `npm run cf:build` writes .open-next/worker.js.
import openNext from "../.open-next/worker.js";

export * from "../.open-next/worker.js";

export default {
  fetch(request, env, ctx) {
    return openNext.fetch(request, env, ctx);
  },

  async scheduled(_event, env, ctx) {
    const request = new Request("https://primz-ai.internal/api/cron/retry-queue", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
    });
    ctx.waitUntil(
      openNext.fetch(request, env, ctx).then(async (res) => {
        console.log(`[cron] retry-queue responded ${res.status}`);
      }),
    );
  },
};
