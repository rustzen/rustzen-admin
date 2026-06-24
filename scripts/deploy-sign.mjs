#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER_BEGIN = Buffer.from("\nRUSTZEN_ADMIN_SIGNED_MARKER_BEGIN\n");
const MARKER_END = Buffer.from("\nRUSTZEN_ADMIN_SIGNED_MARKER_END\n");
const MARKER_FILE = "__rustzen_admin_marker__.json";
const PAYLOAD_VERSION = "rustzen-admin-deploy-v1";
const ED25519_PKCS8_PRIVATE_KEY_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_KEY_FILE = path.join(
    PROJECT_ROOT,
    ".rustzen-admin",
    "config",
    "deploy-sign-private.pem",
);

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

try {
    if (command === "ensure-key") {
        const keyFile = ensureDefaultPrivateKey();
        console.log(keyFile);
    } else if (command === "public-key") {
        process.stdout.write(`${publicKeyHex(loadPrivateKey())}\n`);
    } else if (command === "sign-server") {
        signServer();
    } else if (command === "sign-web") {
        signWeb();
    } else {
        usage();
        process.exit(1);
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}

function signServer() {
    const file = requiredArg("file");
    const version = requiredArg("version");
    const arch = requiredArg("arch");
    const privateKey = loadPrivateKey();

    const original = fs.readFileSync(file);
    const content = stripServerMarker(original);
    const contentSha256 = sha256Hex(content);
    const marker = signedMarker({ component: "server", version, arch, contentSha256, privateKey });
    const mode = fs.statSync(file).mode;

    fs.writeFileSync(file, Buffer.concat([content, MARKER_BEGIN, Buffer.from(marker), MARKER_END]));
    fs.chmodSync(file, mode);
    console.log(`Signed server artifact: ${file}`);
}

function signWeb() {
    const dir = requiredArg("dir");
    const version = requiredArg("version");
    const privateKey = loadPrivateKey();
    const markerPath = path.join(dir, MARKER_FILE);

    fs.rmSync(markerPath, { force: true });
    const contentSha256 = webContentHash(dir);
    const marker = signedMarker({
        component: "web",
        version,
        arch: "universal",
        contentSha256,
        privateKey,
    });

    fs.writeFileSync(markerPath, `${marker}\n`);
    console.log(`Signed web dist: ${dir}`);
}

function signedMarker({ component, version, arch, contentSha256, privateKey }) {
    const payload = signaturePayload({ component, version, arch, contentSha256 });
    const signature = crypto.sign(null, Buffer.from(payload), privateKey).toString("hex");
    const marker = {
        schemaVersion: 1,
        component,
        version,
        arch,
        contentSha256,
        signature,
    };
    if (component === "web") {
        marker.build_id = "manual";
    }
    return JSON.stringify(marker);
}

function signaturePayload({ component, version, arch, contentSha256 }) {
    return `${PAYLOAD_VERSION}\ncomponent=${component}\nversion=${version}\narch=${arch}\ncontent_sha256=${contentSha256}\n`;
}

function stripServerMarker(data) {
    const begin = data.lastIndexOf(MARKER_BEGIN);
    if (begin === -1) {
        return data;
    }
    const end = data.indexOf(MARKER_END, begin + MARKER_BEGIN.length);
    if (end === -1) {
        return data;
    }
    const after = end + MARKER_END.length;
    if (after !== data.length) {
        return data;
    }
    return data.subarray(0, begin);
}

function webContentHash(dir) {
    const entries = listFiles(dir)
        .filter((file) => path.relative(dir, file).split(path.sep).join("/") !== MARKER_FILE)
        .map((file) => {
            const name = path.relative(dir, file).split(path.sep).join("/");
            const content = fs.readFileSync(file);
            return { name: `dist/${name}`, size: content.length, contentSha256: sha256Hex(content) };
        })
        .sort(compareEntryNames);

    const hasher = crypto.createHash("sha256");
    for (const entry of entries) {
        hasher.update(entry.name);
        hasher.update(Buffer.from([0]));
        const size = Buffer.alloc(8);
        size.writeBigUInt64LE(BigInt(entry.size));
        hasher.update(size);
        hasher.update(entry.contentSha256);
        hasher.update(Buffer.from([0]));
    }
    return hasher.digest("hex");
}

function compareEntryNames(left, right) {
    if (left.name < right.name) {
        return -1;
    }
    if (left.name > right.name) {
        return 1;
    }
    return 0;
}

function listFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return listFiles(entryPath);
        }
        if (entry.isFile()) {
            return [entryPath];
        }
        return [];
    });
}

function loadPrivateKey() {
    const keyFile = process.env.RUSTZEN_DEPLOY_SIGN_KEY_FILE;
    const key = process.env.RUSTZEN_DEPLOY_SIGN_KEY;
    if (keyFile) {
        return crypto.createPrivateKey(fs.readFileSync(keyFile, "utf8"));
    }
    if (key) {
        return crypto.createPrivateKey(key.replaceAll("\\n", "\n"));
    }
    return crypto.createPrivateKey(fs.readFileSync(ensureDefaultPrivateKey(), "utf8"));
}

function ensureDefaultPrivateKey() {
    if (!fs.existsSync(DEFAULT_KEY_FILE)) {
        fs.mkdirSync(path.dirname(DEFAULT_KEY_FILE), { recursive: true, mode: 0o700 });
        const seed = crypto.randomBytes(32);
        const der = Buffer.concat([ED25519_PKCS8_PRIVATE_KEY_PREFIX, seed]);
        fs.writeFileSync(DEFAULT_KEY_FILE, pemEncode("PRIVATE KEY", der), { mode: 0o600 });
        console.error(`Generated deploy signing key: ${DEFAULT_KEY_FILE}`);
    }
    return DEFAULT_KEY_FILE;
}

function pemEncode(label, der) {
    const body = der
        .toString("base64")
        .match(/.{1,64}/g)
        .join("\n");
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

function publicKeyHex(privateKey) {
    const der = crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" });
    const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    if (der.length !== ed25519SpkiPrefix.length + 32 || !der.subarray(0, ed25519SpkiPrefix.length).equals(ed25519SpkiPrefix)) {
        throw new Error("Deploy signing key must be an Ed25519 private key.");
    }
    return der.subarray(ed25519SpkiPrefix.length).toString("hex");
}

function sha256Hex(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

function requiredArg(name) {
    const value = args.get(name);
    if (!value) {
        throw new Error(`Missing --${name}`);
    }
    return value;
}

function parseArgs(values) {
    const result = new Map();
    for (let index = 0; index < values.length; index += 1) {
        const item = values[index];
        if (!item.startsWith("--")) {
            throw new Error(`Unexpected argument: ${item}`);
        }
        const key = item.slice(2);
        const value = values[index + 1];
        if (!value || value.startsWith("--")) {
            throw new Error(`Missing value for ${item}`);
        }
        result.set(key, value);
        index += 1;
    }
    return result;
}

function usage() {
    console.error(`Usage:
  node scripts/deploy-sign.mjs ensure-key
  node scripts/deploy-sign.mjs public-key
  node scripts/deploy-sign.mjs sign-server --file <binary> --version <version> --arch <x86_64|aarch64>
  node scripts/deploy-sign.mjs sign-web --dir apps/web/dist --version <version>

Environment:
  RUSTZEN_DEPLOY_SIGN_KEY_FILE=/path/to/ed25519-private.pem
  # or
  RUSTZEN_DEPLOY_SIGN_KEY='-----BEGIN PRIVATE KEY-----\\n...'

Default key file:
  ${DEFAULT_KEY_FILE}
`);
}
