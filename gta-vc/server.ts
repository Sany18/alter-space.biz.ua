// Serves the revcDOS binaries and the compiled game data as one site,
// so the browser never needs to be granted access to local files.
const PORT = 8124;
const BIN_ROOT = new URL("./revcdos-bin/", import.meta.url).pathname;
const DATA_ROOT = new URL("./vc-assets/", import.meta.url).pathname;

Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        let pathname = url.pathname;
        if (pathname === "/") pathname = "/auto.html";

        const isDataPath = pathname.startsWith("/vc-assets/");
        const filePath = isDataPath
            ? DATA_ROOT + pathname.slice("/vc-assets/".length)
            : BIN_ROOT + pathname.slice(1);

        const file = Bun.file(filePath);
        if (await file.exists()) {
            const etag = `"${file.size}-${file.lastModified}"`;
            const lastModified = new Date(file.lastModified).toUTCString();

            if (req.headers.get("If-None-Match") === etag) {
                return new Response(null, { status: 304, headers: { ETag: etag } });
            }

            const headers: Record<string, string> = { ETag: etag, "Last-Modified": lastModified };
            // The compiled game data never changes once built - cache it forever.
            // The engine/HTML/JS files are still being iterated on, so only let the
            // browser skip re-downloading via conditional (ETag) revalidation, not
            // a blind time-based cache, so edits show up on the very next reload.
            headers["Cache-Control"] = isDataPath
                ? "public, max-age=31536000, immutable"
                : "no-cache";

            return new Response(file, { headers });
        }

        // The engine speculatively probes for lots of optional data paths -
        // directories, optional mod files, etc. - that are expected to often
        // not exist. For the game-data namespace, answer "not here" with an
        // empty 200 instead of a 404: functionally the same "nothing here"
        // signal to our own client code, but it doesn't get flagged as a
        // failed request in the browser console.
        if (isDataPath) {
            return new Response(null, { status: 200, headers: { "X-Missing": "1" } });
        }

        return new Response("Not found", { status: 404 });
    },
});

console.log(`revcDOS serving on http://localhost:${PORT}`);
