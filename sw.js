var CACHE = "cache-and-update";

self.addEventListener("install", function(evt) {
	console.log("The service worker is being installed.");
});

self.addEventListener("fetch", function(evt) {
	const fetchPromise = fromCache(evt.request);
	evt.respondWith(fetchPromise);
	evt.waitUntil(fetchPromise);
});

async function fromCache(request) {
	const cache = await caches.open(CACHE);
	const matching = await cache.match(request);
	if (matching) {
		console.log("The service worker is serving the asset from cache, " + request.url);
		return matching;
	}

	const response = await fetch(request);

	// Cache 3rd party
	if (location.origin !== new URL(request.url).origin) {
		console.log('Caching ' + request.url);
		await cache.put(request, response.clone());
	}

	return response;
}
