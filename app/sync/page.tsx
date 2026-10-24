/**
 * app/sync/page.tsx
 * ---------------------------------------------------------------------------
 * Serverless cross-device sync (feature: cross-device sync).
 *
 * The app has no accounts and no backend, so the two devices talk directly
 * over an encrypted WebRTC DataChannel with manual signalling (see
 * lib/sync.ts): the sender shows a send code, the receiver pastes it and
 * returns an answer code, the sender pastes that back, and the full backup
 * envelope flows across. Works best on the same WiFi; public STUN covers
 * most other networks.
 *
 * Roles are explicit tabs — one device Sends, the other Receives — and every
 * step shows its own status so a failed copy-paste is obvious instead of a
 * silent hang. Receiving restores through `restoreBackup()` and reloads, so
 * all providers rehydrate exactly like a file restore.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Send, Download, ShieldAlert, Loader2 } from "lucide-react";
import { restoreBackup } from "@/lib/backup";
import {
  acceptAnswer,
  createReceiveAnswer,
  createSendOffer,
  receiveBackupOverChannel,
  sendBackupOverChannel,
} from "@/lib/sync";

/** Which side of the transfer this device plays. */
type SyncRole = "send" | "receive";

/** Copies text with a clipboard-API-first, execCommand-fallback strategy. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Copy button with transient "Copied" feedback. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      aria-label={label}
      className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)] active:scale-[0.97]"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export default function SyncPage() {
  /** Send vs receive tab. */
  const [role, setRole] = useState<SyncRole>("send");

  /** Whether WebRTC exists here (very old browsers / some webviews lack it).
   *  Defaults true so server and client render identically; corrected once
   *  on mount (SSR-safe — `RTCPeerConnection` is client-only). */
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client capability probe after mount
    setSupported(typeof RTCPeerConnection !== "undefined");
  }, []);

  /** Human-readable connection / transfer status for the active role. */
  const [status, setStatus] = useState("");

  /** Error banner (bad codes, closed channel, restore failure). */
  const [error, setError] = useState("");

  /** Busy flag for async signalling steps. */
  const [busy, setBusy] = useState(false);

  /** Sender: the offer code this device generated. */
  const [sendCode, setSendCode] = useState("");

  /** Sender: the answer code pasted back from the receiver. */
  const [answerCode, setAnswerCode] = useState("");

  /** Sender: channel open and ready to push the backup. */
  const [sendReady, setSendReady] = useState(false);

  /** Receiver: the offer code pasted from the sender. */
  const [offerCode, setOfferCode] = useState("");

  /** Receiver: the answer code to hand back to the sender. */
  const [receiveCode, setReceiveCode] = useState("");

  /** Transfer progress (chunks). */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  /** Receiver: slices restored — transfer complete. */
  const [restored, setRestored] = useState<number | null>(null);

  /** Live connection objects, closed on unmount or role switch. */
  const connRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);

  const closeConn = () => {
    try {
      channelRef.current?.close();
    } catch {
      // Already closed — teardown is best-effort.
    }
    try {
      connRef.current?.close();
    } catch {
      // Already closed — teardown is best-effort.
    }
    connRef.current = null;
    channelRef.current = null;
  };

  // -- Teardown on unmount / role switch -------------------------------------

  useEffect(() => {
    const close = () => {
      try {
        channelRef.current?.close();
      } catch {
        // Best-effort teardown.
      }
      try {
        connRef.current?.close();
      } catch {
        // Best-effort teardown.
      }
    };
    return close;
  }, []);

  const resetRole = (next: SyncRole) => {
    closeConn();
    setRole(next);
    setStatus("");
    setError("");
    setBusy(false);
    setSendCode("");
    setAnswerCode("");
    setSendReady(false);
    setOfferCode("");
    setReceiveCode("");
    setProgress(null);
    setRestored(null);
  };

  // -- Sender flow -------------------------------------------------------------

  /** Step 1 (send): generate the offer code. */
  const handleCreateOffer = async () => {
    setError("");
    setBusy(true);
    setStatus("Creating a secure channel…");
    try {
      const { pc, channel, code } = await createSendOffer();
      connRef.current = pc;
      channelRef.current = channel;
      setSendCode(code);
      setStatus("Send code ready — enter it on the receiving device.");
      channel.onopen = () => {
        setSendReady(true);
        setStatus("Devices connected — send your data when ready.");
      };
      channel.onclose = () => setSendReady(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a send code.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  /** Step 2 (send): apply the receiver's answer code to open the channel. */
  const handleAcceptAnswer = async () => {
    if (!connRef.current) {
      setError("Create a send code first.");
      return;
    }
    setError("");
    setBusy(true);
    setStatus("Connecting…");
    try {
      await acceptAnswer(connRef.current, answerCode);
      setStatus("Connecting… waiting for the channel to open.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not use that answer code.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  /** Step 3 (send): push the full backup across the open channel. */
  const handleSend = async () => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") {
      setError("The channel is not open yet — finish connecting first.");
      return;
    }
    setError("");
    setBusy(true);
    setStatus("Sending…");
    try {
      await sendBackupOverChannel(channel, (done, total) => setProgress({ done, total }));
      setStatus("Sent — the other device is restoring now.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed — please retry.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  // -- Receiver flow -----------------------------------------------------------

  /** Step 1 (receive): consume the send code, produce the answer code. */
  const handleCreateAnswer = async () => {
    setError("");
    setBusy(true);
    setStatus("Answering…");
    try {
      const { pc, channel, code } = await createReceiveAnswer(offerCode);
      connRef.current = pc;
      setReceiveCode(code);
      setStatus("Answer code ready — enter it on the sending device, then wait.");
      // The backup arrives on its own once the sender pushes it.
      const ch = await channel;
      channelRef.current = ch;
      setStatus("Connected — waiting for the sender…");
      const json = await receiveBackupOverChannel(ch, (done, total) =>
        setProgress({ done, total })
      );
      const count = restoreBackup(json);
      if (count === 0) {
        setError("The transfer completed but the data was invalid — nothing was changed.");
        setStatus("");
        return;
      }
      setRestored(count);
      setStatus(`Received ${count} data sections — reloading with your data…`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not receive — please retry.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/bookmarks"
            aria-label="Back to bookmarks"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-sm font-bold">Sync to another device</h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              Direct device-to-device transfer — no account, no server
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-8 sm:px-8">
        {!supported && (
          <p role="alert" className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-light)] px-4 py-3 text-xs text-[var(--text-muted)]">
            This browser does not support direct device sync. Use “Back up all” on the bookmarks
            page to move a file instead.
          </p>
        )}

        {/* How it works */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 sm:p-5">
          <h2 className="text-xs font-bold">How it works</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-[var(--text-muted)]">
            <li>On the device that <strong>has</strong> your data, open Send and create a send code.</li>
            <li>On the other device, open Receive, enter that code, and copy back the answer code.</li>
            <li>Enter the answer on the sending device — the channel opens and your data transfers.</li>
          </ol>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
            <ShieldAlert size={13} className="mt-0.5 shrink-0" />
            <span>
              Codes grant full access to your saved data and work best on the same WiFi. Share
              them only between your own devices, never publicly.
            </span>
          </p>
        </section>

        {/* Role tabs */}
        <div className="flex rounded-xl border border-[var(--border)] p-1" role="group" aria-label="Sync role">
          {(["send", "receive"] as SyncRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => resetRole(r)}
              aria-pressed={role === r}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg text-xs font-bold transition ${
                role === r ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {r === "send" ? <Send size={14} /> : <Download size={14} />}
              <span>{r === "send" ? "Send (has my data)" : "Receive (new device)"}</span>
            </button>
          ))}
        </div>

        {/* Status + error */}
        {status && (
          <p role="status" className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 px-4 py-3 text-xs text-[var(--text-secondary)]">
            {busy && <Loader2 size={14} className="animate-spin text-[var(--accent)]" />}
            <span>{status}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-light)] px-4 py-3 text-xs text-[var(--text-muted)]">
            {error}
          </p>
        )}
        {progress && (
          <p role="status" className="text-center text-xs tabular-nums text-[var(--text-muted)]">
            Transferring… {progress.done}/{progress.total} chunks
          </p>
        )}

        {role === "send" ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 sm:p-5">
              <h2 className="text-xs font-bold">Step 1 — Create send code</h2>
              <button
                type="button"
                onClick={handleCreateOffer}
                disabled={busy || !supported}
                className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
              >
                {busy && !sendCode ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{sendCode ? "Create a fresh code" : "Create send code"}</span>
              </button>
              {sendCode && (
                <div className="mt-3 space-y-2">
                  <textarea
                    readOnly
                    value={sendCode}
                    rows={4}
                    aria-label="Send code"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] break-all text-[var(--text)] outline-none"
                  />
                  <CopyButton text={sendCode} label="Copy send code" />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 sm:p-5">
              <h2 className="text-xs font-bold">Step 2 — Enter the answer code</h2>
              <textarea
                value={answerCode}
                onChange={(e) => setAnswerCode(e.target.value)}
                rows={4}
                placeholder="Paste the answer code from the receiving device…"
                aria-label="Answer code"
                className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] break-all text-[var(--text)] outline-none placeholder:font-sans placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleAcceptAnswer}
                disabled={busy || !answerCode.trim() || !sendCode}
                className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-2.5 text-xs font-semibold transition hover:bg-[var(--surface-hover)] active:scale-[0.97] disabled:opacity-50"
              >
                <span>Connect</span>
              </button>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 sm:p-5">
              <h2 className="text-xs font-bold">Step 3 — Send your data</h2>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Sends bookmarks, notes, highlights, progress, settings, and reminders.
              </p>
              <button
                type="button"
                onClick={handleSend}
                disabled={!sendReady || busy}
                className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
              >
                <span>{sendReady ? "Send my data" : "Waiting for connection…"}</span>
              </button>
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 sm:p-5">
              <h2 className="text-xs font-bold">Step 1 — Enter the send code</h2>
              <textarea
                value={offerCode}
                onChange={(e) => setOfferCode(e.target.value)}
                rows={4}
                placeholder="Paste the send code from your other device…"
                aria-label="Send code"
                className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] break-all text-[var(--text)] outline-none placeholder:font-sans placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleCreateAnswer}
                disabled={busy || !offerCode.trim() || !supported || restored !== null}
                className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
              >
                {busy && !receiveCode ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>Create answer code</span>
              </button>
              {receiveCode && restored === null && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Enter this answer on the sending device, then wait — your data arrives
                    automatically and this page reloads.
                  </p>
                  <textarea
                    readOnly
                    value={receiveCode}
                    rows={4}
                    aria-label="Answer code"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] break-all text-[var(--text)] outline-none"
                  />
                  <CopyButton text={receiveCode} label="Copy answer code" />
                </div>
              )}
              {restored !== null && (
                <p role="status" className="mt-3 rounded-lg bg-[var(--accent-light)] px-3 py-2 text-[11px] font-medium text-[var(--accent)]">
                  Restored {restored} data sections — reloading…
                </p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
