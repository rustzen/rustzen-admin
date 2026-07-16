import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const reportsPort = Number(process.env.RUSTZEN_REPORTS_PORT);
const fixturePort = Number(process.env.RUSTZEN_AUTOMATION_FIXTURE_PORT);
const token = process.env.RUSTZEN_IPC_TOKEN;
if (!reportsPort || !fixturePort || !token) throw new Error("Automation verification environment is incomplete");
const reportsBase = `http://127.0.0.1:${reportsPort}`;
const verifierId = "1";
let submitted = "";
const fixture = createServer((request, response) => {
  if (request.method === "POST") {
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => {
      submitted = Buffer.concat(chunks).toString();
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<main id="received">Received ${submitted}</main>`);
    });
    return;
  }
  response.writeHead(200, { "content-type": "text/html" });
  response.end(`<form method="post"><input id="username" name="username"><input id="password" name="password"><input id="title" name="title"><button id="submit" type="submit">Submit</button></form>`);
});
await new Promise(resolve => fixture.listen(fixturePort, "127.0.0.1", resolve));

function headers(path, capability, method = "GET") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const requestId = randomUUID();
  const payload = ["1", timestamp, requestId, verifierId, "reports", method, path, capability].join("\n");
  return {
    "content-type": "application/json",
    "x-rustzen-contract-version": "1",
    "x-rustzen-ipc-timestamp": timestamp,
    "x-rustzen-request-id": requestId,
    "x-rustzen-user-id": verifierId,
    "x-rustzen-module": "reports",
    "x-rustzen-ipc-capability": capability,
    "x-rustzen-ipc-signature": createHmac("sha256", token).update(payload).digest("hex"),
  };
}
async function call(path, capability, method = "GET", body) {
  const response = await fetch(`${reportsBase}${path}`, { method, headers: headers(new URL(`${reportsBase}${path}`).pathname, capability, method), ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  return payload.data;
}

try {
  const system = await call("/api/reports/systems", "reports:system:manage", "POST", { name: "Browser fixture", baseUrl: `http://127.0.0.1:${fixturePort}` });
  const account = await call("/api/reports/accounts", "reports:system:manage", "POST", { systemId: system.id, name: "Fixture", username: "rustzen-user", secret: "rustzen-secret" });
  if (JSON.stringify(account).includes("rustzen-secret")) throw new Error("Account response exposed secret");
  const flow = await call("/api/reports/flows", "reports:flow:manage", "POST", { systemId: system.id, name: "Real form submission", steps: [
    { action: "goto", url: "/" },
    { action: "fill", selector: "#username", value: "{{account.username}}" },
    { action: "fill", selector: "#password", value: "{{account.password}}" },
    { action: "fill", selector: "#title", value: "{{input.title}}" },
    { action: "click", selector: "#submit" },
    { action: "waitFor", selector: "#received" },
    { action: "assertText", selector: "#received", text: "RustZen+MVP" },
    { action: "screenshot", name: "submitted" },
  ] });
  const run = await call("/api/reports/runs", "reports:run:manage", "POST", { flowId: flow.id, accountId: account.id, input: { title: "RustZen MVP" } });
  let current;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    current = await call(`/api/reports/runs/${run.id}`, "reports:run:view");
    if (!["queued", "running"].includes(current.status)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (current?.status !== "succeeded") {
    const failedSteps = await call(`/api/reports/runs/${run.id}/steps`, "reports:run:view");
    throw new Error(`Browser run failed: ${JSON.stringify(current)}, steps=${JSON.stringify(failedSteps)}`);
  }
  if (!submitted.includes("username=rustzen-user") || !submitted.includes("password=rustzen-secret") || !submitted.includes("title=RustZen+MVP")) throw new Error(`Fixture received unexpected form: ${submitted}`);
  const steps = await call(`/api/reports/runs/${run.id}/steps`, "reports:run:view");
  if (steps.length !== 8 || steps.some(step => step.status !== "succeeded")) throw new Error(`Unexpected step audit: ${JSON.stringify(steps)}`);
  if (JSON.stringify(steps).includes("rustzen-secret")) throw new Error("Step audit exposed secret");
  const artifacts = await call(`/api/reports/runs/${run.id}/artifacts`, "reports:run:view");
  if (artifacts.length !== 1) throw new Error(`Expected one screenshot artifact: ${JSON.stringify(artifacts)}`);
  console.log(`Automation browser verification passed: run=${run.id}, steps=${steps.length}, artifacts=${artifacts.length}`);
} finally {
  await new Promise(resolve => fixture.close(resolve));
}
