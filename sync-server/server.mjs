import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8787);
const secret = process.env.OPENTURBO_SYNC_SECRET ?? "change-me";
const devices = new Map();
const envelopes = new Map();
const comments = new Map();
const presence = new Map();

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-device-id,x-sync-signature"
  });
  response.end(payload);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sign(value) {
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    json(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      json(response, 200, { ok: true, service: "openturbo-sync", devices: devices.size, envelopes: envelopes.size });
      return;
    }

    if (request.method === "POST" && url.pathname === "/devices/register") {
      const body = await readJson(request);
      const deviceId = body.deviceId ?? randomUUID();
      devices.set(deviceId, { deviceId, name: body.name ?? "OpenTurbo Desktop", publicKey: body.publicKey ?? "", updatedAt: new Date().toISOString() });
      json(response, 200, { deviceId, token: sign(deviceId) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/sync/push") {
      const body = await readJson(request);
      const workspaceId = body.workspaceId ?? "default";
      const list = envelopes.get(workspaceId) ?? [];
      list.push({ id: randomUUID(), deviceId: request.headers["x-device-id"] ?? "unknown", envelope: body.envelope, updatedAt: new Date().toISOString() });
      envelopes.set(workspaceId, list);
      json(response, 200, { accepted: true, cursor: list.length });
      return;
    }

    if (request.method === "GET" && url.pathname === "/sync/pull") {
      const workspaceId = url.searchParams.get("workspaceId") ?? "default";
      const cursor = Number(url.searchParams.get("cursor") ?? 0);
      const list = envelopes.get(workspaceId) ?? [];
      json(response, 200, { cursor: list.length, envelopes: list.slice(cursor) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/comments") {
      const body = await readJson(request);
      const targetId = body.targetId ?? "workspace";
      const list = comments.get(targetId) ?? [];
      list.push({ id: randomUUID(), body: body.body, author: body.author ?? "Anonymous", createdAt: new Date().toISOString() });
      comments.set(targetId, list);
      json(response, 200, { comments: list });
      return;
    }

    if (request.method === "POST" && url.pathname === "/presence") {
      const body = await readJson(request);
      presence.set(body.deviceId ?? "unknown", { ...body, updatedAt: new Date().toISOString() });
      json(response, 200, { presence: [...presence.values()] });
      return;
    }

    json(response, 404, { error: "Not found" });
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : "Unknown sync server error" });
  }
}).listen(port, () => {
  console.log(`OpenTurbo sync server listening on http://0.0.0.0:${port}`);
});
