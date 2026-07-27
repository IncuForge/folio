import { invoke } from "@tauri-apps/api/core";
import { fetch as mobileFetch } from "@tauri-apps/plugin-http";
import { mergeBackups, resolveMergeConflicts, snapshotFingerprint, type SyncConflict } from "@/lib/sync";
import type { FolioBackup } from "@/lib/backup";
import { applySyncSnapshot, createSyncRecoveryBackup, readSyncMeta, readSyncSnapshot, writeSyncMeta } from "./desktop-api";

type HubState = { revision: number; snapshot: FolioBackup | null };
type CommitResult = { accepted: boolean; revision: number; snapshot?: FolioBackup; error?: string };
type SyncPhase = "disabled" | "idle" | "syncing" | "offline" | "conflict" | "error";

export type SyncRuntimeStatus = {
  phase: SyncPhase;
  revision: number;
  pending: boolean;
  lastSyncedAt?: string;
  message?: string;
  conflicts?: number;
};

const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
let running = false;
let timer: number | undefined;
let dirty = false;
let revision = 0;
let base: FolioBackup | null = null;
let address = "";
let deviceToken = "";

function emit(status: SyncRuntimeStatus) {
  window.dispatchEvent(new CustomEvent("folio-sync-status", { detail: status }));
}

async function saveCursor(nextRevision: number, nextBase: FolioBackup) {
  revision = nextRevision;
  base = nextBase;
  dirty = false;
  await Promise.all([
    writeSyncMeta("revision", String(nextRevision)),
    writeSyncMeta("baseSnapshot", JSON.stringify(nextBase)),
    writeSyncMeta("dirty", "false"),
    writeSyncMeta("lastSyncedAt", new Date().toISOString()),
    writeSyncMeta("conflicts", "[]"),
  ]);
}

async function recordConflicts(conflicts: SyncConflict[], candidate: FolioBackup, remoteRevision: number) {
  await Promise.all([
    writeSyncMeta("conflicts", JSON.stringify(conflicts)),
    writeSyncMeta("conflictCandidate", JSON.stringify(candidate)),
    writeSyncMeta("conflictRevision", String(remoteRevision)),
  ]);
  emit({ phase: "conflict", revision, pending: true, conflicts: conflicts.length, message: "Concurrent edits need review." });
}

async function currentDesktopState(): Promise<HubState> {
  return invoke<HubState>("sync_snapshot_state");
}

async function commitDesktop(snapshot: FolioBackup, baseRevision: number): Promise<CommitResult> {
  return invoke<CommitResult>("sync_commit_host", { commitId: crypto.randomUUID(), baseRevision, snapshot });
}

async function mobileRequest(path: string, init?: RequestInit) {
  return mobileFetch(address + path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${deviceToken}` },
  });
}

async function commitMobile(snapshot: FolioBackup, baseRevision: number): Promise<CommitResult> {
  const response = await mobileRequest("/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commitId: crypto.randomUUID(), baseRevision, snapshot }),
  });
  const data = await response.json();
  if (response.status === 401) throw new Error("This device was revoked. Pair it again from Folio Desktop.");
  if (!response.ok && response.status !== 409) throw new Error(data.error || "The sync hub rejected this update.");
  return data;
}

async function resolveAndRetry(local: FolioBackup, remoteRevision: number, remote: FolioBackup, commitFn: (snapshot: FolioBackup, baseRevision: number) => Promise<CommitResult>) {
  if (!base) {
    await recordConflicts([{ table: "settings", key: "missing-base", base: null, local: null, remote: null }], local, remoteRevision);
    return;
  }
  const result = mergeBackups(base, local, remote);
  if (result.conflicts.length) {
    await recordConflicts(result.conflicts, result.merged, remoteRevision);
    return;
  }
  await createSyncRecoveryBackup("before-merge");
  await applySyncSnapshot(result.merged);
  const retry = await commitFn(result.merged, remoteRevision);
  if (!retry.accepted) throw new Error(retry.error || "The workspace changed again while merging.");
  await saveCursor(retry.revision, result.merged);
}

async function pushLocal() {
  if (!dirty || running || !base) return;
  running = true;
  emit({ phase: "syncing", revision, pending: true, message: "Uploading local changes…" });
  try {
    const local = await readSyncSnapshot();
    const response = isMobile ? await commitMobile(local, revision) : await commitDesktop(local, revision);
    if (response.accepted) await saveCursor(response.revision, local);
    else if (response.snapshot) await resolveAndRetry(local, response.revision, response.snapshot, isMobile ? commitMobile : commitDesktop);
    else throw new Error(response.error || "The sync commit was not accepted.");
    emit({ phase: "idle", revision, pending: false, lastSyncedAt: new Date().toISOString() });
  } catch (error) {
    emit({ phase: isMobile ? "offline" : "error", revision, pending: true, message: error instanceof Error ? error.message : "Sync failed." });
  } finally { running = false; }
}

async function pullRemote() {
  if (running || dirty || !base) return;
  running = true;
  try {
    let remote: HubState;
    if (isMobile) {
      const response = await mobileRequest("/snapshot");
      if (response.status === 401) throw new Error("This device was revoked. Pair it again from Folio Desktop.");
      if (!response.ok) throw new Error("Folio Desktop is unavailable.");
      remote = await response.json();
    } else remote = await currentDesktopState();
    if (remote.snapshot && remote.revision > revision) {
      await createSyncRecoveryBackup("before-pull");
      await applySyncSnapshot(remote.snapshot);
      await saveCursor(remote.revision, remote.snapshot);
      window.dispatchEvent(new CustomEvent("folio-data-reloaded"));
    }
    emit({ phase: "idle", revision, pending: false, lastSyncedAt: await readSyncMeta("lastSyncedAt") || undefined });
  } catch (error) {
    emit({ phase: isMobile ? "offline" : "error", revision, pending: false, message: error instanceof Error ? error.message : "Sync failed." });
  } finally { running = false; }
}

async function initialize() {
  const setup = await fetch("/api/setup").then((response) => response.json()).catch(() => ({ setupRequired: true }));
  if (setup.setupRequired) return false;
  dirty = (await readSyncMeta("dirty")) === "true";
  revision = Number(await readSyncMeta("revision") || 0);
  const savedBase = await readSyncMeta("baseSnapshot");
  base = savedBase ? JSON.parse(savedBase) : null;

  if (isMobile) {
    address = await readSyncMeta("address") || localStorage.getItem("folio-sync-address") || "";
    deviceToken = await readSyncMeta("deviceToken") || localStorage.getItem("folio-sync-device-token") || "";
    if (!address || !deviceToken) { emit({ phase: "disabled", revision: 0, pending: false }); return true; }
    await writeSyncMeta("address", address);
    await writeSyncMeta("deviceToken", deviceToken);
  }

  if (!base) {
    const local = await readSyncSnapshot();
    if (isMobile) {
      const response = await mobileRequest("/snapshot");
      if (!response.ok) throw new Error("Folio Desktop is unavailable.");
      const remote: HubState = await response.json();
      base = remote.snapshot || local;
      revision = remote.revision;
      if (snapshotFingerprint(local) !== snapshotFingerprint(base)) dirty = true;
      await writeSyncMeta("baseSnapshot", JSON.stringify(base));
      await writeSyncMeta("revision", String(revision));
    } else {
      const hub = await currentDesktopState();
      if (!hub.snapshot) {
        const accepted = await commitDesktop(local, 0);
        await saveCursor(accepted.revision, local);
      } else {
        base = hub.snapshot;
        revision = hub.revision;
        if (snapshotFingerprint(local) !== snapshotFingerprint(base)) dirty = true;
        await writeSyncMeta("baseSnapshot", JSON.stringify(base));
        await writeSyncMeta("revision", String(revision));
      }
    }
  }
  if (dirty) await pushLocal(); else await pullRemote();
  return true;
}

export async function startSyncCoordinator() {
  let initialized = false;
  const tryInitialize = async () => {
    if (!initialized) {
      try { initialized = await initialize(); }
      catch (error) { emit({ phase: isMobile ? "offline" : "error", revision, pending: dirty, message: error instanceof Error ? error.message : "Sync initialization failed." }); }
      return;
    }
    if (dirty) await pushLocal(); else await pullRemote();
  };

  window.addEventListener("folio-data-changed", () => {
    dirty = true;
    void writeSyncMeta("dirty", "true");
    emit({ phase: "syncing", revision, pending: true, message: "Change queued for synchronization." });
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void pushLocal(), 700);
  });
  window.addEventListener("online", () => void tryInitialize());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void tryInitialize(); });
  await tryInitialize();
  window.setInterval(() => void tryInitialize(), 5_000);
}
export async function resolveSyncConflicts(choice: "local" | "remote") {
  if (running) throw new Error("Wait for the current sync operation to finish.");
  const [rawConflicts, rawCandidate, rawRevision] = await Promise.all([
    readSyncMeta("conflicts"), readSyncMeta("conflictCandidate"), readSyncMeta("conflictRevision"),
  ]);
  const conflicts = rawConflicts ? JSON.parse(rawConflicts) as SyncConflict[] : [];
  if (!conflicts.length || !rawCandidate) throw new Error("There are no synchronization conflicts to resolve.");
  const resolved = resolveMergeConflicts(JSON.parse(rawCandidate), conflicts, choice);
  const remoteRevision = Number(rawRevision || revision);
  await createSyncRecoveryBackup("before-conflict-resolution");
  await applySyncSnapshot(resolved);
  const result = isMobile ? await commitMobile(resolved, remoteRevision) : await commitDesktop(resolved, remoteRevision);
  if (!result.accepted) throw new Error(result.error || "The workspace changed while resolving conflicts. Try again.");
  await saveCursor(result.revision, resolved);
  window.dispatchEvent(new CustomEvent("folio-data-reloaded"));
  emit({ phase: "idle", revision, pending: false, lastSyncedAt: new Date().toISOString() });
}