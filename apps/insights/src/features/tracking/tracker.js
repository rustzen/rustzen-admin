(() => {
  const script = document.currentScript;
  const key = script?.dataset.projectKey;
  if (!key) return;

  const endpoint = new URL(
    script.dataset.endpoint || "/api/insights/track",
    script.src,
  ).href;
  const nativeFetch = window.fetch.bind(window);
  const visitorId = localStorage.getItem("rz_vid") || crypto.randomUUID();
  localStorage.setItem("rz_vid", visitorId);
  const sessionId = sessionStorage.getItem("rz_sid") || crypto.randomUUID();
  sessionStorage.setItem("rz_sid", sessionId);
  let identifiedUserId;
  let queue = [];

  const requestDetails = (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url || String(input), location.href);
    return {
      url,
      method: String(init?.method || request?.method || "GET").toUpperCase(),
      trackable: url.href !== endpoint,
    };
  };

  const send = () => {
    if (!queue.length) return;
    const batch = queue.splice(0, 100);
    nativeFetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rustzen-project-key": key,
      },
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch(() => {
      queue = batch.concat(queue).slice(0, 1000);
    });
  };

  const track = (eventName, fields = {}) => {
    queue.push({
      eventName,
      visitorId,
      sessionId,
      userId: identifiedUserId,
      platform: navigator.userAgentData?.platform || navigator.platform,
      occurredAt: new Date().toISOString(),
      ...fields,
    });
    if (queue.length >= 20) send();
  };

  window.rustzenAnalytics = {
    track,
    identify: (userId) => {
      identifiedUserId = String(userId || "").trim() || undefined;
    },
  };

  window.fetch = async (input, init) => {
    const details = requestDetails(input, init);
    if (!details.trackable) return nativeFetch(input, init);
    const started = performance.now();
    try {
      const response = await nativeFetch(input, init);
      track("api_request", {
        apiPath: details.url.pathname + details.url.search,
        apiMethod: details.method,
        statusCode: response.status,
        durationMs: Math.round(performance.now() - started),
        isError: !response.ok,
      });
      return response;
    } catch (error) {
      track("api_request", {
        apiPath: details.url.pathname + details.url.search,
        apiMethod: details.method,
        durationMs: Math.round(performance.now() - started),
        isError: true,
      });
      throw error;
    }
  };

  const xhrMetadata = new WeakMap();
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    xhrMetadata.set(this, requestDetails(url, { method }));
    return nativeOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    const details = xhrMetadata.get(this);
    if (details?.trackable) {
      const started = performance.now();
      this.addEventListener(
        "loadend",
        () => {
          track("api_request", {
            apiPath: details.url.pathname + details.url.search,
            apiMethod: details.method,
            statusCode: this.status || undefined,
            durationMs: Math.round(performance.now() - started),
            isError: this.status === 0 || this.status >= 400,
          });
        },
        { once: true },
      );
    }
    return nativeSend.apply(this, args);
  };

  track("page_view", {
    pagePath: location.pathname + location.search,
    referrer: document.referrer,
    durationMs: performance.getEntriesByType("navigation")[0]?.duration,
  });
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest("button,a") : null;
      if (target) {
        track("button_click", {
          pagePath: location.pathname,
          properties: { text: target.textContent?.trim().slice(0, 100) },
        });
      }
    },
    true,
  );
  document.addEventListener(
    "submit",
    (event) =>
      track("form_submit", {
        pagePath: location.pathname,
        properties: { id: event.target.id || null },
      }),
    true,
  );
  setInterval(send, 5000);
  addEventListener("pagehide", send);
})();
