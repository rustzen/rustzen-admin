import { createHmac } from "node:crypto";

const token = process.env.RUSTZEN_IPC_TOKEN;
const monitorBase = `http://127.0.0.1:${process.env.RUSTZEN_MONITOR_PORT}`;
const insightsBase = `http://127.0.0.1:${process.env.RUSTZEN_INSIGHTS_PORT}`;
const reportsBase = `http://127.0.0.1:${process.env.RUSTZEN_REPORTS_PORT}`;

if (!token) {
  throw new Error("RUSTZEN_IPC_TOKEN is required");
}

async function ipcRequest(base, path, capability, init = {}) {
  const method = init.method ?? "GET";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const pathname = new URL(`${base}${path}`).pathname;
  const payload = `1\n${method}\n${pathname}\n${timestamp}\n${capability}`;
  const signature = createHmac("sha256", token).update(payload).digest("hex");
  return fetch(`${base}${path}`, {
    ...init,
    method,
    headers: {
      "content-type": "application/json",
      "x-rustzen-contract-version": "1",
      "x-rustzen-ipc-timestamp": timestamp,
      "x-rustzen-ipc-capability": capability,
      "x-rustzen-ipc-signature": signature,
      ...init.headers,
    },
  });
}

async function expectStatus(response, status, label) {
  if (response.status !== status) {
    throw new Error(`${label}: expected ${status}, got ${response.status}: ${await response.text()}`);
  }
  return response;
}

async function waitForMonitorHeartbeat() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await ipcRequest(
      monitorBase,
      "/ipc/v1/monitor/nodes",
      "monitor:view",
    );
    await expectStatus(response, 200, "monitor node list");
    const nodes = await response.json();
    if (nodes.length > 0 && nodes[0].status === "online") {
      return nodes[0];
    }
    await Bun.sleep(100);
  }
  throw new Error("monitor agent heartbeat was not observed");
}

const node = await waitForMonitorHeartbeat();
if (!node.cpuPercent && node.cpuPercent !== 0) {
  throw new Error("monitor latest metrics are missing");
}

await expectStatus(
  await ipcRequest(monitorBase, "/ipc/v1/monitor/nodes", "insights:view"),
  403,
  "cross-module capability rejection",
);

const projectResponse = await expectStatus(
  await ipcRequest(insightsBase, "/ipc/v1/insights/projects", "insights:manage", {
    method: "POST",
    body: JSON.stringify({ name: "Local verification", allowedOrigins: ["https://verify.local"] }),
  }),
  200,
  "insights project creation",
);
const project = await projectResponse.json();

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
    await ipcRequest(insightsBase, "/ipc/v1/insights/track", "insights:track", {
      method: "POST",
      body: JSON.stringify({
        ...event,
        projectKey: project.projectKey,
        origin: "https://verify.local",
      }),
    }),
    202,
    "insights event write",
  );
}

await expectStatus(
  await ipcRequest(insightsBase, "/ipc/v1/insights/track", "insights:track", {
    method: "POST",
    body: JSON.stringify({
      projectKey: project.projectKey,
      origin: "https://denied.local",
      eventType: "page_view",
      visitorId: "visitor-b",
      path: "/denied",
    }),
  }),
  403,
  "insights origin rejection",
);

const overviewResponse = await expectStatus(
  await ipcRequest(
    insightsBase,
    `/ipc/v1/insights/overview?projectId=${encodeURIComponent(project.id)}`,
    "insights:view",
  ),
  200,
  "insights overview",
);
const overview = await overviewResponse.json();
if (
  overview.pv !== 1 ||
  overview.uv !== 1 ||
  overview.requestCount !== 1 ||
  overview.errorCount !== 1 ||
  overview.p95DurationMs !== 42
) {
  throw new Error(`unexpected insights overview: ${JSON.stringify(overview)}`);
}

const templateResponse = await expectStatus(
  await ipcRequest(reportsBase, "/ipc/v1/reports/templates", "reports:manage", {
    method: "POST",
    body: JSON.stringify({ name: "Local verification", content: "<h1>{{name}}</h1>" }),
  }),
  200,
  "report template creation",
);
const template = await templateResponse.json();
const jobResponse = await expectStatus(
  await ipcRequest(reportsBase, "/ipc/v1/reports/jobs", "reports:manage", {
    method: "POST",
    body: JSON.stringify({ templateId: template.id, data: { name: "<RustZen>" } }),
  }),
  201,
  "report generation",
);
const job = await jobResponse.json();
if (job.status !== "succeeded") {
  throw new Error(`report did not succeed: ${JSON.stringify(job)}`);
}
const downloadResponse = await expectStatus(
  await ipcRequest(
    reportsBase,
    `/ipc/v1/reports/jobs/${job.id}/download`,
    "reports:view",
  ),
  200,
  "report download",
);
if ((await downloadResponse.text()) !== "<h1>&lt;RustZen&gt;</h1>") {
  throw new Error("report download did not preserve HTML escaping");
}

console.log("Local Monitor, Insights, Reports, and IPC contracts verified");
