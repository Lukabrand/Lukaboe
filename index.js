// ════════════════════════════════════════════════════════════════════════════
//  LUKA-XMD — WhatsApp Bot
//  Customized by Luka
// ════════════════════════════════════════════════════════════════════════════

"use strict";

// ─── Polyfills ───────────────────────────────────────────────────────────────
require("events").EventEmitter.defaultMaxListeners = 960;

if (!globalThis.crypto) {
    globalThis.crypto = require("crypto").webcrypto;
}

try {
    if (typeof File === "undefined") {
        globalThis.File = require("buffer").File;
    }
} catch (_) {}

// ─── Node & Third-Party ──────────────────────────────────────────────────────
const path = require("path");
const http = require("http");
const express = require("express");

const {
    default: makeWASocket,
    jidNormalizedUser,
    fetchLatestWaWebVersion,
} = require("@whiskeysockets/baileys");

// ─── LUKA Core ───────────────────────────────────────────────────────────────
require("./luka/gmdHelpers");

const {
    logger,
    commands,
    loadSession,
    useSQLiteAuthState,
    safeNewsletterFollow,
    safeGroupAcceptInvite,
    setupConnectionHandler,
    setupGroupEventsListeners,
    initializeLidStore,
    getAllSettings,
    DEFAULT_SETTINGS,
    createSocketConfig,
    createContext,
    syncDatabase,
    initializeSettings,
    initializeGroupSettings,
    loadPlugins,
} = require("./luka");

const {
    startCleanup,
    SQLiteStore,
} = require("./luka/database/messageStore");

const {
    setupCommandHandler,
} = require("./luka/messageHandler");

const {
    setupAutoReact,
    setupAntiDelete,
    setupAutoBio,
    setupAntiCall,
    setupPresence,
    setupChatBotAndAntiLink,
    setupAntiEdit,
    setupStatusHandlers,
} = require("./luka/eventHandlers");

// ─── Constants ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const SESSION_DIR = path.join(__dirname, "luka", "session");
const PLUGINS_DIR = path.join(__dirname, "lukah");

const MEMORY_LIMIT = 400 * 1024 * 1024;
const AUTO_RESTART_MS = 24 * 60 * 60 * 1000;

logger.level = "silent";

// ─── Mutable State ───────────────────────────────────────────────────────────
let LukaSocket = null;
let store = null;
let botSettings = {};

// ════════════════════════════════════════════════════════════════════════════
//  WEB SERVER
// ════════════════════════════════════════════════════════════════════════════

function startWebServer() {
    const app = express();

    app.use(express.json());
    app.use(express.static(path.join(__dirname, "luka")));

    // Keep these filenames unchanged unless you rename the actual HTML files.
    app.get("/", (_req, res) => {
        res.sendFile(path.join(__dirname, "luka", "guru.html"));
    });

    app.get("/pair", (_req, res) => {
        res.sendFile(path.join(__dirname, "luka", "pair.html"));
    });

    app.get("/health", (_req, res) => {
        res.status(200).json({
            status: "alive",
            bot: "LUKA-XMD",
            uptime: process.uptime(),
        });
    });

    // ─── Pairing API ─────────────────────────────────────────────────────────
    const pairing = require("./luka/pairing");

    app.post("/api/pair", async (req, res) => {
        const phone = (req.body?.phone || "").replace(/\D/g, "");

        if (!phone || phone.length < 7) {
            return res.status(400).json({
                ok: false,
                error: "Invalid phone number.",
            });
        }

        try {
            await pairing.startPairing(phone);

            return res.json({
                ok: true,
                bot: "LUKA-XMD",
            });
        } catch (error) {
            console.error("[LUKA-XMD] Pairing error:", error.message);

            return res.status(500).json({
                ok: false,
                error: "Pairing could not be started.",
            });
        }
    });

    app.get("/api/pair/status", (_req, res) => {
        res.json(pairing.getStatus());
    });

    app.get("/api/pair/cancel", (_req, res) => {
        pairing.cancelPairing();
        res.json({ ok: true });
    });

    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`✅ LUKA-XMD Server Running on Port: ${PORT}`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(
                `❌ Port ${PORT} is already in use.`
            );
        } else {
            console.error(
                "[LUKA-XMD] Server error:",
                err.message
            );
        }
    });
}

// ════════════════════════════════════════════════════════════════════════════
//  SYSTEM TASKS
// ════════════════════════════════════════════════════════════════════════════

function startSystemTasks() {
    // Memory watchdog
    setInterval(() => {
        if (
            process.memoryUsage().heapUsed > MEMORY_LIMIT &&
            typeof global.gc === "function"
        ) {
            global.gc();
        }
    }, 60_000);

    // Health ping
    setInterval(() => {
        http.get(
            `http://127.0.0.1:${PORT}/health`,
            (response) => {
                response.resume();
            }
        ).on("error", () => {});
    }, 240_000);

    // Scheduled restart
    setTimeout(() => {
        console.log(
            "🔄 [LUKA-XMD] Scheduled 24-hour restart triggered."
        );

        process.exit(0);
    }, AUTO_RESTART_MS);

    console.log(
        `✅ LUKA-XMD auto-restart scheduled in 24 hours.`
    );
}

// ════════════════════════════════════════════════════════════════════════════
//  EXPIRY WATCHDOG
// ════════════════════════════════════════════════════════════════════════════

function startExpiryWatchdog() {
    try {
        const {
            startExpiryWatchdog: watch,
        } = require("./luka/expiry");

        const notifyOwner = async (text) => {
            const ownerNum = (
                process.env.OWNER_NUMBER || ""
            ).replace(/\D/g, "");

            if (!ownerNum) return;

            const ownerJid = `${ownerNum}@s.whatsapp.net`;

            if (global._botSocket) {
                await global._botSocket.sendMessage(
                    ownerJid,
                    { text }
                ).catch(() => {});
            }
        };

        watch(
            async (msg) => {
                global._licenceExpired = true;

                console.warn(
                    "[LUKA-XMD] Licence expired — commands locked."
                );

                await notifyOwner(
                    `⛔ *LUKA-XMD — LICENCE EXPIRED*\n\n` +
                    `${msg}\n\n` +
                    `_Commands are locked. Renew your licence to continue._`
                );
            },

            async (warnMsg) => {
                await notifyOwner(warnMsg);
            }
        );
    } catch (error) {
        console.warn(
            "[LUKA-XMD] Expiry watchdog not started:",
            error.message
        );
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  DATABASE INIT
// ════════════════════════════════════════════════════════════════════════════

async function initDatabase() {
    await syncDatabase();
    await initializeSettings();
    await initializeGroupSettings();

    botSettings = await getAllSettings();

    console.log("[LUKA-XMD] Database initialized.");
}

// ════════════════════════════════════════════════════════════════════════════
//  BOT START
// ════════════════════════════════════════════════════════════════════════════

async function startLuka() {
    try {
        console.log("[LUKA-XMD] Initializing WhatsApp connection...");

        const { version } = await fetchLatestWaWebVersion();

        const sessionDbPath = path.join(
            SESSION_DIR,
            "session.db"
        );

        const {
            state,
            saveCreds,
        } = await useSQLiteAuthState(sessionDbPath);

        if (store) {
            store.destroy();
        }

        store = new SQLiteStore();

        // ─── Socket Configuration ────────────────────────────────────────────
        const socketConfig = createSocketConfig(
            version,
            state,
            logger
        );

        socketConfig.getMessage = async (key) => {
            if (!store) {
                return { conversation: "Message unavailable" };
            }

            const msg = await store.loadMessage(
                key.remoteJid,
                key.id
            );

            return msg?.message ?? undefined;
        };

        LukaSocket = makeWASocket(socketConfig);

        global._botSocket = LukaSocket;

        store.bind(LukaSocket.ev);

        // ─── Save Credentials ────────────────────────────────────────────────
        LukaSocket.ev.process(async (events) => {
            if (events["creds.update"]) {
                await saveCreds();
            }
        });

        // ─── Event Handlers ──────────────────────────────────────────────────
        setupAutoReact(LukaSocket);
        setupAntiDelete(LukaSocket);
        setupAutoBio(LukaSocket);
        setupAntiCall(LukaSocket);
        setupPresence(LukaSocket);
        setupChatBotAndAntiLink(LukaSocket);
        setupAntiEdit(LukaSocket);
        setupStatusHandlers(LukaSocket);
        setupGroupEventsListeners(LukaSocket);

        // ─── Load Plugins & Commands ─────────────────────────────────────────
        loadPlugins(PLUGINS_DIR);

        setupCommandHandler(LukaSocket);

        // ─── Connection Lifecycle ────────────────────────────────────────────
        setupConnectionHandler(
            LukaSocket,
            SESSION_DIR,
            startLuka,
            {
                onOpen: (socket) => onLukaConnected(socket),
            }
        );

        console.log("[LUKA-XMD] Socket initialization completed.");
    } catch (error) {
        console.error(
            "[LUKA-XMD] Socket initialization error:",
            error.message
        );

        setTimeout(startLuka, 5000);
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  ON CONNECTED
// ════════════════════════════════════════════════════════════════════════════

async function onLukaConnected(socket) {
    const settings = await getAllSettings();

    console.log("💜 LUKA-XMD connected to WhatsApp!");

    // Follow configured channel and join configured group
    await safeNewsletterFollow(
        socket,
        settings.NEWSLETTER_JID
    );

    await safeGroupAcceptInvite(
        socket,
        settings.GC_JID
    );

    await initializeLidStore(socket);

    // ─── Scheduler ───────────────────────────────────────────────────────────
    try {
        const { startScheduler } = require("./luka/scheduler");

        startScheduler(socket);
    } catch (error) {
        console.error(
            "[LUKA-XMD] Scheduler start error:",
            error.message
        );
    }

    // ─── Startup Message ─────────────────────────────────────────────────────
    setTimeout(() => {
        sendLukaStartupMessage(socket, settings);
    }, 5000);
}

// ════════════════════════════════════════════════════════════════════════════
//  STARTUP MESSAGE
// ════════════════════════════════════════════════════════════════════════════

async function sendLukaStartupMessage(socket, settings) {
    try {
        const defaults = DEFAULT_SETTINGS;

        const totalCommands = commands.filter(
            (command) =>
                command.pattern &&
                !command.dontAddCommandList
        ).length;

        const botName = (
            settings.BOT_NAME ||
            "LUKA-XMD"
        ).toUpperCase();

        const prefix =
            settings.PREFIX ||
            defaults.PREFIX;

        const modeLabel =
            settings.MODE === "public"
                ? "🌐 PUBLIC"
                : "🔒 PRIVATE";

        console.log(
            `💜 ${botName} is online — Active commands: ${totalCommands}`
        );

        if (settings.STARTING_MESSAGE !== "true") {
            return;
        }

        const { expiryLine } = require("./luka/expiry");

        const expiryMessage = await expiryLine()
            .catch(() => "✅ Active");

        const message = [
            `╭━━⟮ ⚡ ${botName} ⟯━━┈⊷`,
            `┃ 🟢 Status  : ✅ ONLINE`,
            `┃ 📊 Commands: ${totalCommands}`,
            `┃ 📌 Prefix  : ${prefix}`,
            `┃ 🌐 Mode    : ${modeLabel}`,
            `┃ ⏳ Licence : ${expiryMessage}`,
            `╰━━⟮ ✦ POWERED BY LUKA ✦ ⟯━━┈⊷`,
            "",
            "> _Allow a few seconds to sync._",
        ].join("\n");

        const destinationJid = jidNormalizedUser(
            socket.user.id
        );

        let context = {};

        try {
            context = await createContext(
                botName,
                {
                    title: "LUKA-XMD",
                    body: "Status: Ready for Use",
                }
            );
        } catch (_) {}

        await socket.sendMessage(
            destinationJid,
            {
                text: message,
                ...context,
            },
            {
                disappearingMessagesInChat: true,
                ephemeralExpiration: 300,
            }
        );
    } catch (error) {
        console.error(
            "[LUKA-XMD] Startup message error:",
            error.message
        );
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ════════════════════════════════════════════════════════════════════════════

(async () => {
    try {
        console.log("╭──────────────────────────────╮");
        console.log("│       LUKA-XMD STARTING      │");
        console.log("│       Customized by Luka     │");
        console.log("╰──────────────────────────────╯");

        startWebServer();
        startSystemTasks();
        startExpiryWatchdog();
        startCleanup();

        await loadSession();
        await initDatabase();

        await startLuka();
    } catch (error) {
        console.error(
            "[LUKA-XMD] Bootstrap error:",
            error.message
        );

        process.exitCode = 1;
    }
})();
