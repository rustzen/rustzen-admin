import { createHmac, randomUUID } from "node:crypto";

const ipcToken = required("RUSTZEN_IPC_TOKEN");
const agentToken = required("RUSTZEN_MONITOR_AGENT_TOKEN");
const adminToken = required("RUSTZEN_ADMIN_TOKEN");
const adminUserId = required("RUSTZEN_ADMIN_USER_ID");
const adminBase = `http://127.0.0.1:${required("RUSTZEN_ADMIN_PORT")}`;
const monitorBase = `http://127.0.0.1:${required("RUSTZEN_MONITOR_PORT")}`;
const insightsBase = `http://127.0.0.1:${required("RUSTZEN_INSIGHTS_PORT")}`;
const reportsBase = `http://127.0.0.1:${required("RUSTZEN_REPORTS_PORT")}`;
const latencyOutput = required("RUSTZEN_GATEWAY_LATENCY_OUTPUT");
const latencyBudgetMs = Number(process.env.RUSTZEN_GATEWAY_P95_BUDGET_MS ?? "2");

if (!Number.isFinite(latencyBudgetMs) || latencyBudgetMs <= 0) {
  throw new Error("RUSTZEN_GATEWAY_P95_BUDGET_MS must be a positive number");
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function delegatedHeaders(module, path, access, method = "GET") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const requestId = randomUUID();
  const userId = access === "public" ? "anonymous" : adminUserId;
  const payload = [
    "1",
    timestamp,
    requestId,
    userId,
    module,
    method,
    path,
    access,
  ].join("\n");
  const signature = createHmac("sha256", ipcToken).update(payload).digest("hex");
  return {
    "x-rustzen-contract-version": "1",
    "x-rustzen-ipc-timestamp": timestamp,
    "x-rustzen-request-id": requestId,
    "x-rustzen-user-id": userId,
    "x-rustzen-module": module,
    "x-rustzen-ipc-capability": access,
    "x-rustzen-ipc-signature": signature,
  };
}

function directRequest(base, module, pathAndQuery, access, init = {}) {
  const method = init.method ?? "GET";
  const path = new URL(`${base}${pathAndQuery}`).pathname;
  return fetch(`${base}${pathAndQuery}`, {
    ...init,
    method,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...delegatedHeaders(module, path, access, method),
      ...init.headers,
    },
  });
}

async function expectStatus(response, status, label) {
  if (response.status !== status) {
    throw new Error(
      `${label}: expected ${status}, got ${response.status}: ${await response.text()}`,
    );
  }
  return response;
}

async function responseData(response, label) {
  const payload = await response.json();
  if (payload.code !== 0 || payload.message !== "Success") {
    throw new Error(`${label}: invalid response envelope: ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

const heartbeat = {
  agentId: "verify-agent",
  hostname: "verify-host",
  agentVersion: "0.5.0",
  cpuPercent: 12.5,
  memoryUsedBytes: 10,
  memoryTotalBytes: 20,
  diskUsedBytes: 30,
  diskTotalBytes: 40,
  collectedAt: new Date().toISOString(),
};

await expectStatus(
  await fetch(`${adminBase}/api/monitor/heartbeat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rustzen-monitor-agent-token": agentToken,
    },
    body: JSON.stringify(heartbeat),
  }),
  200,
  "public Monitor heartbeat through Admin",
);

await expectStatus(
  await directRequest(monitorBase, "monitor", "/api/monitor/heartbeat", "public", {
    method: "POST",
    headers: { "x-rustzen-monitor-agent-token": agentToken },
    body: JSON.stringify({ ...heartbeat, agentId: "verify-direct-agent" }),
  }),
  200,
  "direct delegated Monitor heartbeat",
);

const nodes = await responseData(
  await expectStatus(
    await directRequest(monitorBase, "monitor", "/api/monitor/nodes", "monitor:view"),
    200,
    "Monitor node list",
  ),
  "Monitor node list",
);
if (!nodes.some((node) => node.agentId === "verify-agent")) {
  throw new Error("Monitor public gateway heartbeat was not persisted");
}

await expectStatus(
  await directRequest(monitorBase, "monitor", "/api/monitor/nodes", "monitor:manage"),
  403,
  "Monitor local capability mismatch",
);

const project = await responseData(
  await expectStatus(
    await directRequest(
      insightsBase,
      "insights",
      "/api/insights/projects",
      "insights:manage",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Local verification",
          allowedOrigins: ["https://verify.local"],
        }),
      },
    ),
    200,
    "Insights project creation",
  ),
  "Insights project creation",
);

for (const event of [
  { eventType: "page_view", visitorId: "visitor-a", path: "/verify" },
  {
    eventType: "api_request",
    visitorId: "visitor-a",
    path: "/api/verify",
    durationMs: 42,
    isError: true,
  },
]) {
  await expectStatus(
    await directRequest(insightsBase, "insights", "/api/insights/track", "public", {
      method: "POST",
      headers: {
        origin: "https://verify.local",
        "x-rustzen-project-key": project.projectKey,
      },
      body: JSON.stringify(event),
    }),
    200,
    "Insights event write",
  );
}

await expectStatus(
  await directRequest(insightsBase, "insights", "/api/insights/track", "public", {
    method: "POST",
    headers: {
      origin: "https://denied.local",
      "x-rustzen-project-key": project.projectKey,
    },
    body: JSON.stringify({
      eventType: "page_view",
      visitorId: "visitor-b",
      path: "/denied",
    }),
  }),
  403,
  "Insights origin rejection",
);

const overview = await responseData(
  await expectStatus(
    await directRequest(
      insightsBase,
      "insights",
      `/api/insights/overview?projectId=${encodeURIComponent(project.id)}`,
      "insights:view",
    ),
    200,
    "Insights overview",
  ),
  "Insights overview",
);
if (
  overview.pv !== 1 ||
  overview.uv !== 1 ||
  overview.requestCount !== 1 ||
  overview.errorCount !== 1 ||
  overview.p95DurationMs !== 42
) {
  throw new Error(`unexpected Insights overview: ${JSON.stringify(overview)}`);
}

const template = await responseData(
  await expectStatus(
    await directRequest(
      reportsBase,
      "reports",
      "/api/reports/templates",
      "reports:manage",
      {
        method: "POST",
        body: JSON.stringify({
          id: "local-verification",
          name: "Local verification",
          content: "<h1>{{name}}</h1>",
        }),
      },
    ),
    200,
    "Reports template creation",
  ),
  "Reports template creation",
);
const job = await responseData(
  await expectStatus(
    await directRequest(reportsBase, "reports", "/api/reports/jobs", "reports:manage", {
      method: "POST",
      body: JSON.stringify({ templateId: template.id, data: { name: "<RustZen>" } }),
    }),
    200,
    "Reports job creation",
  ),
  "Reports job creation",
);
if (job.status !== "succeeded") {
  throw new Error(`Reports job did not succeed: ${JSON.stringify(job)}`);
}
const download = await expectStatus(
  await directRequest(
    reportsBase,
    "reports",
    `/api/reports/jobs/${job.id}/download`,
    "reports:view",
  ),
  200,
  "Reports download",
);
if ((await download.text()) !== "<h1>&lt;RustZen&gt;</h1>") {
  throw new Error("Reports download did not preserve HTML escaping");
}

function percentile(values, quantile) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
}

async function timedRequest(kind) {
  const directHeaders =
    kind === "direct"
      ? delegatedHeaders("monitor", "/api/monitor/nodes", "monitor:view")
      : undefined;
  const start = performance.now();
  const response =
    kind === "direct"
      ? await fetch(`${monitorBase}/api/monitor/nodes`, { headers: directHeaders })
      : await fetch(`${adminBase}/api/monitor/nodes`, {
          headers: { authorization: `Bearer ${adminToken}` },
        });
  await expectStatus(response, 200, `${kind} latency request`);
  await response.arrayBuffer();
  return performance.now() - start;
}

async function runBatch(kind, concurrency) {
  return Promise.all(Array.from({ length: concurrency }, () => timedRequest(kind)));
}

const concurrency = 32;
for (let batch = 0; batch < 4; batch += 1) {
  await runBatch("direct", concurrency);
  await runBatch("gateway", concurrency);
}

const directSamples = [];
const gatewaySamples = [];
for (let batch = 0; batch < 10; batch += 1) {
  directSamples.push(...(await runBatch("direct", concurrency)));
  gatewaySamples.push(...(await runBatch("gateway", concurrency)));
}

const direct = {
  p50Ms: percentile(directSamples, 0.5),
  p95Ms: percentile(directSamples, 0.95),
  p99Ms: percentile(directSamples, 0.99),
};
const gateway = {
  p50Ms: percentile(gatewaySamples, 0.5),
  p95Ms: percentile(gatewaySamples, 0.95),
  p99Ms: percentile(gatewaySamples, 0.99),
};
const overhead = {
  p50Ms: gateway.p50Ms - direct.p50Ms,
  p95Ms: gateway.p95Ms - direct.p95Ms,
  p99Ms: gateway.p99Ms - direct.p99Ms,
};
const latency = {
  measuredAt: new Date().toISOString(),
  endpoint: "GET /api/monitor/nodes",
  buildProfile: "release",
  host: "127.0.0.1",
  concurrency,
  warmupRequestsPerPath: concurrency * 4,
  sampleRequestsPerPath: directSamples.length,
  direct,
  gateway,
  overhead,
  p95BudgetMs: latencyBudgetMs,
};
await Bun.write(latencyOutput, `${JSON.stringify(latency, null, 2)}\n`);
console.log(`Gateway latency: ${JSON.stringify(latency)}`);
if (overhead.p95Ms > latencyBudgetMs) {
  throw new Error(
    `gateway p95 overhead ${overhead.p95Ms.toFixed(3)} ms exceeds ${latencyBudgetMs} ms`,
  );
}

console.log("Local Monitor, Insights, Reports, delegation, and gateway contracts verified");
