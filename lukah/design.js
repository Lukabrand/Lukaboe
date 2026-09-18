/**
 * design.js — Premium Bot Design & Menu Theme System
 *
 * Commands:
 * .setmenu
 * .previewmenu
 * .setbotpic
 * .setmenupic
 * .setfooter
 * .setcaption
 * .setbotname
 * .setexpiry
 * .designinfo
 * .resetdesign
 */

"use strict";

const { gmd, commands } = require("../luka");
const {
    getSetting,
    setSetting,
    resetSetting
} = require("../luka/database/settings");

const { getExpiryStatus } = require("../luka/expiry");
const { Jimp } = require("jimp");
const { S_WHATSAPP_NET } = require("@whiskeysockets/baileys");

const fs = require("fs").promises;
const moment = require("moment-timezone");

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    seconds %= 86400;

    const h = Math.floor(seconds / 3600);
    seconds %= 3600;

    const m = Math.floor(seconds / 60);
    seconds %= 60;

    return `${d}d ${h}h ${m}m ${seconds}s`;
}

function fmtMB(bytes) {
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function memProgress(used, total, width = 10) {
    if (!total) return "▱".repeat(width) + " 0%";

    const percent = Math.min(100, Math.max(0, (used / total) * 100));
    const filled = Math.round((percent / 100) * width);

    return (
        "▰".repeat(filled) +
        "▱".repeat(width - filled) +
        ` ${Math.round(percent)}%`
    );
}

function now(format, timezone) {
    return moment()
        .tz(timezone || "Africa/Nairobi")
        .format(format);
}

function cleanNumber(sender) {
    if (!sender) return "";

    return sender
        .split("@")[0]
        .split(":")[0]
        .replace(/\D/g, "");
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY ORDER
// ═══════════════════════════════════════════════════════════════

const CAT_ORDER = [
    "general",
    "ai",
    "downloader",
    "tools",
    "search",
    "games",
    "group",
    "owner",
    "settings",
    "fun",
    "converter",
    "religion",
    "texttools",
    "notes",
    "channels",
    "sports",
    "extras",
    "restrictions",
    "sticker",
    "media",
    "ultracore"
];

const CAT_ICONS = {
    general: "◈",
    ai: "✦",
    downloader: "⇩",
    tools: "⚙",
    search: "⌕",
    games: "♟",
    group: "♧",
    owner: "♛",
    settings: "⚙",
    fun: "☻",
    converter: "⇄",
    religion: "☪",
    texttools: "Aa",
    notes: "▤",
    channels: "◉",
    sports: "⚽",
    extras: "✧",
    restrictions: "⛨",
    sticker: "✿",
    media: "▶",
    ultracore: "⚡"
};

function getSortedCategories() {
    const catMap = {};

    for (const cmd of commands) {
        if (!cmd.pattern) continue;
        if (cmd.dontAddCommandList) continue;
        if (typeof cmd.pattern !== "string") continue;

        const cat = (cmd.category || "general").toLowerCase();

        if (!catMap[cat]) {
            catMap[cat] = [];
        }

        catMap[cat].push(cmd);
    }

    return Object.keys(catMap)
        .sort((a, b) => {
            const ai = CAT_ORDER.indexOf(a);
            const bi = CAT_ORDER.indexOf(b);

            if (ai === -1 && bi === -1) {
                return a.localeCompare(b);
            }

            if (ai === -1) return 1;
            if (bi === -1) return -1;

            return ai - bi;
        })
        .map(cat => ({
            cat,
            cmds: catMap[cat]
        }));
}

// ═══════════════════════════════════════════════════════════════
// MENU DATA
// ═══════════════════════════════════════════════════════════════

async function buildMenuData(conText) {

    const {
        sender,
        pushName,
        botName,
        botPrefix,
        botVersion,
        botMode,
        botFooter,
        botCaption,
        newsletterJid
    } = conText;

    const totalCmds = commands.filter(
        c => c.pattern && !c.dontAddCommandList
    ).length;

    const uptime = formatUptime(
        Math.floor(process.uptime())
    );

    const memory = process.memoryUsage();

    const memBar = memProgress(
        memory.heapUsed,
        memory.heapTotal,
        10
    );

    const memDetail =
        `${fmtMB(memory.heapUsed)} / ${fmtMB(memory.heapTotal)}`;

    const timezone =
        process.env.TIME_ZONE || "Africa/Nairobi";

    const hour = parseInt(
        now("HH", timezone),
        10
    );

    const date = now(
        "DD MMM YYYY",
        timezone
    );

    const time = now(
        "hh:mm A",
        timezone
    );

    const seconds = now(
        "HH:mm:ss",
        timezone
    );

    let greeting;

    if (hour < 12) {
        greeting = "GOOD MORNING";
    } else if (hour < 17) {
        greeting = "GOOD AFTERNOON";
    } else if (hour < 21) {
        greeting = "GOOD EVENING";
    } else {
        greeting = "GOOD NIGHT";
    }

    // ═══════════════════════════════════════════════════════════
    // EXPIRY
    // ═══════════════════════════════════════════════════════════

    let expiryLine = "Lifetime";
    let expiryDetail = "Always Active";

    try {

        const expiry = await getExpiryStatus();

        expiryLine = expiry.line;

        if (expiry.daysLeft !== null) {
            expiryDetail =
                expiry.daysLeft <= 0
                    ? "EXPIRED"
                    : `${expiry.daysLeft} days remaining`;
        }

    } catch {
        expiryLine = "Lifetime";
        expiryDetail = "Always Active";
    }

    // ═══════════════════════════════════════════════════════════
    // CATEGORIES
    // ═══════════════════════════════════════════════════════════

    const categories = getSortedCategories();

    const categoryLines = categories
        .map(({ cat }, index) => {

            const number = String(index + 1)
                .padStart(2, "0");

            const icon =
                CAT_ICONS[cat] || "◇";

            const name =
                cat.charAt(0).toUpperCase() +
                cat.slice(1);

            return `│ ${number}  ${icon}  ${name.toUpperCase()}`;

        })
        .join("\n");

    const compactCategories = categories
        .map(({ cat }, index) => {

            const number = String(index + 1)
                .padStart(2, "0");

            const name =
                cat.charAt(0).toUpperCase() +
                cat.slice(1);

            return `> ${number}  ${name.toUpperCase()}`;

        })
        .join("\n");

    return {

        sender,

        userNumber:
            cleanNumber(sender) ||
            pushName ||
            "User",

        pushName:
            pushName || "User",

        botName:
            botName || "LUKA-AI",

        botPrefix:
            botPrefix || ".",

        botVersion:
            botVersion || "5.0.0",

        botMode:
            botMode || "public",

        botFooter:
            botFooter || "ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʟᴜᴋᴀʙʀᴀɴᴅ",

        botCaption:
            botCaption || "",

        newsletterJid,

        totalCmds,

        uptime,

        memBar,

        memDetail,

        date,

        time,

        seconds,

        greeting,

        expiryLine,

        expiryDetail,

        categoryLines,

        compactCategories,

        numCats: categories.length
    };
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT MENU IMAGE
// ═══════════════════════════════════════════════════════════════

const MENU_IMAGE_URL =
    "https://i.imgur.com/gwSrfcK.png";

// ═══════════════════════════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════════════════════════

const THEMES = {

    // ╔══════════════════════════════════════════════════════════╗
    // ║ PREMIUM
    // ╚══════════════════════════════════════════════════════════╝

    premium: {

        name: "◆ PREMIUM",

        description:
            "Modern premium dashboard style",

        render(data) {

            return (
`╭━━━〔 ✦ ${data.botName.toUpperCase()} ✦ 〕━━━╮
┃
┃  ◉ STATUS     : ONLINE
┃  ◈ USER       : ${data.pushName}
┃  ◇ COMMANDS   : ${data.totalCmds}
┃  ⌁ PREFIX     : ${data.botPrefix}
┃  ◎ MODE       : ${data.botMode.toUpperCase()}
┃  ◷ UPTIME     : ${data.uptime}
┃  ◇ VERSION    : v${data.botVersion}
┃  ⛨ LICENCE    : ${data.expiryLine}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━〔 ◈ COMMAND CENTER ◈ 〕━━╮
${data.categoryLines}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━〔 ✦ ${data.greeting} ${data.pushName} ✦ 〕━━╮
┃
┃  Select a category number
┃  1 — ${data.numCats}
┃
╰━━〔 ${data.botFooter} 〕━━╯`
            );
        }
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║ CYBER
    // ╚══════════════════════════════════════════════════════════╝

    cyber: {

        name: "⌁ CYBER",

        description:
            "Futuristic cyber terminal interface",

        render(data) {

            return (
`╔════════════════════════════════╗
║  SYSTEM :: ${data.botName.toUpperCase()}
╠════════════════════════════════╣
║
║  [✓] SYSTEM ONLINE
║  [✓] USER     :: ${data.pushName}
║  [✓] PREFIX   :: ${data.botPrefix}
║  [✓] COMMANDS :: ${data.totalCmds}
║  [✓] MODE     :: ${data.botMode.toUpperCase()}
║  [✓] VERSION  :: v${data.botVersion}
║  [✓] UPTIME   :: ${data.uptime}
║  [✓] LICENCE  :: ${data.expiryLine}
║
╠════════════════════════════════╣
║  MODULES
╠════════════════════════════════╣
${data.categoryLines}
╠════════════════════════════════╣
║  SELECT MODULE → 1-${data.numCats}
╚════════════════════════════════╝

> ${data.botFooter}`
            );
        }
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║ VISION
    // ╚══════════════════════════════════════════════════════════╝

    vision: {

        name: "◉ VISION",

        description:
            "Minimal futuristic glass-panel style",

        render(data) {

            return (
`┌──────────────────────────────┐
│        ◉ ${data.botName.toUpperCase()}
├──────────────────────────────┤
│
│  HELLO, ${data.pushName.toUpperCase()}
│
│  ● ONLINE
│  ├─ Commands : ${data.totalCmds}
│  ├─ Prefix   : ${data.botPrefix}
│  ├─ Mode     : ${data.botMode.toUpperCase()}
│  ├─ Version  : v${data.botVersion}
│  ├─ Uptime   : ${data.uptime}
│  └─ Licence  : ${data.expiryLine}
│
├──────────────────────────────┤
│  COMMAND DIRECTORY
├──────────────────────────────┤
${data.categoryLines}
├──────────────────────────────┤
│  Reply with 1-${data.numCats}
└──────────────────────────────┘

${data.botFooter}`
            );
        }
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║ TITAN
    // ╚══════════════════════════════════════════════════════════╝

    titan: {

        name: "⚔ TITAN",

        description:
            "Strong bold command center design",

        render(data) {

            return (
`⚔️━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⚔️
        ${data.botName.toUpperCase()}
⚔️━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⚔️

「 ${data.greeting} ${data.pushName} 」

╭─〔 BOT INFORMATION 〕─╮
│ ⚡ STATUS   : ONLINE
│ 👤 USER     : ${data.pushName}
│ 📚 COMMANDS : ${data.totalCmds}
│ 🔑 PREFIX   : ${data.botPrefix}
│ 🌐 MODE     : ${data.botMode.toUpperCase()}
│ 📦 VERSION  : v${data.botVersion}
│ ⏱️ UPTIME   : ${data.uptime}
│ 🔒 LICENCE  : ${data.expiryLine}
╰──────────────────────╯

╭─〔 COMMAND CATEGORIES 〕─╮
${data.categoryLines}
╰─────────────────────────╯

⚔️ Reply with a number
⚔️ Available: 1-${data.numCats}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${data.botFooter}`
            );
        }
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║ NOVA
    // ╚══════════════════════════════════════════════════════════╝

    nova: {

        name: "✦ NOVA",

        description:
            "Clean modern star interface",

        render(data) {

            return (
`✦ ───────────────────────── ✦
        ${data.botName.toUpperCase()}
✦ ───────────────────────── ✦

       ${data.greeting}
       ${data.pushName}

┌─〔 BOT STATUS 〕────────────┐
│ ◉ ONLINE
│
│ ◈ Commands : ${data.totalCmds}
│ ◈ Prefix   : ${data.botPrefix}
│ ◈ Mode     : ${data.botMode.toUpperCase()}
│ ◈ Version  : v${data.botVersion}
│ ◈ Uptime   : ${data.uptime}
│ ◈ Licence  : ${data.expiryLine}
└─────────────────────────────┘

┌─〔 CATEGORIES 〕────────────┐
${data.categoryLines}
└─────────────────────────────┘

✦ Reply 1-${data.numCats} to open a category

✦ ${data.botFooter}`
            );
        }
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║ MATRIX
    // ╚══════════════════════════════════════════════════════════╝

    matrix: {

        name: "▣ MATRIX",

        description:
            "Terminal matrix command interface",

        render(data) {

            return (
`> [ SYSTEM INITIALIZED ]
> ────────────────────────────
> NAME      :: ${data.botName.toUpperCase()}
> USER      :: ${data.pushName}
> STATUS    :: ONLINE
> ────────────────────────────
> COMMANDS  :: ${data.totalCmds}
> PREFIX    :: ${data.botPrefix}
> MODE      :: ${data.botMode.toUpperCase()}
> VERSION   :: v${data.botVersion}
> UPTIME    :: ${data.uptime}
> RAM       :: ${data.memBar}
> LICENCE   :: ${data.expiryLine}
> ────────────────────────────
> MODULES
> ────────────────────────────
${data.compactCategories}
> ────────────────────────────
> INPUT :: REPLY 1-${data.numCats}
> ────────────────────────────
> ${data.botFooter}`
            );
        }
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║ ELITE
    // ╚══════════════════════════════════════════════════════════╝

    elite: {

        name: "♛ ELITE",

        description:
            "Luxury black command panel",

        render(data) {

            return (
`╭━━━━━━━〔 ♛ ${data.botName.toUpperCase()} 〕━━━━━━━╮
┃
┃  ✦ WELCOME, ${data.pushName.toUpperCase()}
┃
┃  ◉ SYSTEM       ONLINE
┃  ◇ COMMANDS     ${data.totalCmds}
┃  ◇ PREFIX       ${data.botPrefix}
┃  ◇ MODE         ${data.botMode.toUpperCase()}
┃  ◇ VERSION      v${data.botVersion}
┃  ◇ UPTIME       ${data.uptime}
┃  ◇ LICENCE      ${data.expiryLine}
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃             MENU
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
${data.categoryLines}
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  Reply with 1-${data.numCats}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

♛ ${data.botFooter}`
            );
        }
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║ WAVE
    // ╚══════════════════════════════════════════════════════════╝

    wave: {

        name: "〰 WAVE",

        description:
            "Smooth modern wave layout",

        render(data) {

            return (
`〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️
      ${data.botName.toUpperCase()}
〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️

🌊 ${data.greeting}, ${data.pushName}

╭──────── BOT ────────╮
│ ● ONLINE
│
│ Commands : ${data.totalCmds}
│ Prefix   : ${data.botPrefix}
│ Mode     : ${data.botMode.toUpperCase()}
│ Version  : v${data.botVersion}
│ Uptime   : ${data.uptime}
│ Licence  : ${data.expiryLine}
╰─────────────────────╯

╭──── CATEGORIES ─────╮
${data.categoryLines}
╰─────────────────────╯

🌊 Reply 1-${data.numCats}

〰️ ${data.botFooter}`
            );
        }
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║ LUXE
    // ╚══════════════════════════════════════════════════════════╝

    luxe: {

        name: "◇ LUXE",

        description:
            "Elegant luxury menu interface",

        render(data) {

            return (
`◇━━━━━━━━━━━━━━━━━━━━━━━━━━◇
       ${data.botName.toUpperCase()}
◇━━━━━━━━━━━━━━━━━━━━━━━━━━◇

          ${data.greeting}
          ${data.pushName}

╭──〔 ✦ PROFILE ✦ 〕────────╮
│
│  Status    ◉ ONLINE
│  Commands  ◇ ${data.totalCmds}
│  Prefix    ◇ ${data.botPrefix}
│  Mode      ◇ ${data.botMode.toUpperCase()}
│  Version   ◇ v${data.botVersion}
│  Uptime    ◇ ${data.uptime}
│  Licence   ◇ ${data.expiryLine}
│
╰───────────────────────────╯

╭──〔 ✦ DIRECTORY ✦ 〕──────╮
${data.categoryLines}
╰───────────────────────────╯

◇ Choose 1-${data.numCats}

◇ ${data.botFooter}`
            );
        }
    }

};

const THEME_KEYS = Object.keys(THEMES);

// ═══════════════════════════════════════════════════════════════
// SEND MENU MESSAGE
// ═══════════════════════════════════════════════════════════════

async function sendMenuMsg(Guru, from, text, conText) {

    const {
        mek,
        botName,
        newsletterJid,
        sender
    } = conText;

    const customPic =
        await getSetting("MENU_PIC_CUSTOM");

    const picUrl =
        customPic || MENU_IMAGE_URL;

    try {

        return await Guru.sendMessage(
            from,
            {
                image: {
                    url: picUrl
                },

                caption: text.trim(),

                contextInfo: {

                    mentionedJid:
                        sender
                            ? [sender]
                            : [],

                    forwardingScore: 5,

                    isForwarded: true,

                    forwardedNewsletterMessageInfo: {

                        newsletterJid:
                            newsletterJid ||
                            "120363406649804510@newsletter",

                        newsletterName:
                            botName ||
                            "LUKA-AI",

                        serverMessageId: 0
                    }
                }

            },
            {
                quoted: mek
            }
        );

    } catch (error) {

        return await Guru.sendMessage(
            from,
            {
                text: text.trim()
            },
            {
                quoted: mek
            }
        );
    }
}

// ═══════════════════════════════════════════════════════════════
// SETMENU
// ═══════════════════════════════════════════════════════════════

gmd(
    {
        pattern: "setmenu",

        aliases: [
            "menutheme",
            "menudesign",
            "themenu"
        ],

        react: "🎨",

        category: "owner",

        description:
            "Change menu theme. Usage: .setmenu <number>"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            args,
            botFooter
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        const current =
            (await getSetting("MENU_THEME")) ||
            "premium";

        if (!args[0]) {

            const list =
                THEME_KEYS.map((key, index) => {

                    const theme =
                        THEMES[key];

                    const active =
                        key === current
                            ? "  ✅ ACTIVE"
                            : "";

                    return (
`┃ ${index + 1}. ${theme.name}${active}
┃    ${theme.description}`
                    );

                }).join("\n\n");

            return reply(
`╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
│       🎨 MENU DESIGN
├━━━━━━━━━━━━━━━━━━━━━━━━━━━━┤
│ Available themes: ${THEME_KEYS.length}
│ Current: ${THEMES[current]?.name || current}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${list}

╭────────────────────────────╮
│ .setmenu <number>
│ .previewmenu <number>
╰────────────────────────────╯

> ${botFooter}`
            );
        }

        const number =
            parseInt(args[0], 10);

        if (
            isNaN(number) ||
            number < 1 ||
            number > THEME_KEYS.length
        ) {

            await react("❌");

            return reply(
`❌ Invalid theme number.

Choose between 1 and ${THEME_KEYS.length}.

Send .setmenu to view all themes.`
            );
        }

        const key =
            THEME_KEYS[number - 1];

        await setSetting(
            "MENU_THEME",
            key
        );

        await react("⏳");

        const data =
            await buildMenuData(conText);

        const preview =
            THEMES[key].render(data);

        await sendMenuMsg(
            Guru,
            from,
`✅ *${THEMES[key].name} ACTIVATED*

${preview}`,
            conText
        );

        await react("✅");
    }
);

// ═══════════════════════════════════════════════════════════════
// PREVIEWMENU
// ═══════════════════════════════════════════════════════════════

gmd(
    {
        pattern: "previewmenu",

        aliases: [
            "menupreview",
            "prevmenu"
        ],

        react: "👁️",

        category: "owner",

        description:
            "Preview menu theme without applying"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            args
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        const number =
            parseInt(args[0], 10);

        if (
            isNaN(number) ||
            number < 1 ||
            number > THEME_KEYS.length
        ) {

            await react("❌");

            return reply(
`❌ Usage:

.previewmenu <number>

Available: 1-${THEME_KEYS.length}`
            );
        }

        const key =
            THEME_KEYS[number - 1];

        const data =
            await buildMenuData(conText);

        const preview =
            THEMES[key].render(data);

        await sendMenuMsg(
            Guru,
            from,
`👁️ *PREVIEW — ${THEMES[key].name}*

_Not applied._

Use:
.setmenu ${number}

${preview}`,
            conText
        );

        await react("✅");
    }
);

// ═══════════════════════════════════════════════════════════════
// SETBOTPIC
// ═══════════════════════════════════════════════════════════════

gmd(
    {
        pattern: "setbotpic",

        aliases: [
            "botpic",
            "changebotpic",
            "botimage"
        ],

        react: "🖼️",

        category: "owner",

        description:
            "Change bot profile picture"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            quoted,
            quotedMsg,
            q
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        const quotedImg =
            quotedMsg?.imageMessage ||
            quoted?.imageMessage ||
            quoted?.message?.imageMessage ||
            null;

        const hasUrl =
            q &&
            q.trim().startsWith("http");

        if (!quotedImg && !hasUrl) {

            await react("❌");

            return reply(
`❌ Send an image or URL.

Example:

.setbotpic https://example.com/image.jpg

Or quote an image and send:

.setbotpic`
            );
        }

        await react("⏳");

        let tempPath = null;

        try {

            let imageBuffer;

            if (quotedImg) {

                tempPath =
                    await Guru.downloadAndSaveMediaMessage(
                        quotedImg,
                        "temp_botpic"
                    );

                const image =
                    await Jimp.read(tempPath);

                image.scaleToFit({
                    w: 720,
                    h: 720
                });

                imageBuffer =
                    await image.getBuffer(
                        "image/jpeg"
                    );

            } else {

                const image =
                    await Jimp.read(
                        q.trim()
                    );

                image.scaleToFit({
                    w: 720,
                    h: 720
                });

                imageBuffer =
                    await image.getBuffer(
                        "image/jpeg"
                    );
            }

            await Guru.query({

                tag: "iq",

                attrs: {
                    to: S_WHATSAPP_NET,
                    type: "set",
                    xmlns: "w:profile:picture"
                },

                content: [
                    {
                        tag: "picture",

                        attrs: {
                            type: "image"
                        },

                        content: imageBuffer
                    }
                ]
            });

            if (hasUrl) {
                await setSetting(
                    "BOT_PIC",
                    q.trim()
                );
            }

            await react("✅");

            return reply(
`✅ Bot profile picture updated!

🖼️ Your new profile picture is active.`
            );

        } catch (error) {

            await react("❌");

            return reply(
`❌ Failed to update picture.

${error.message}`
            );

        } finally {

            if (tempPath) {
                await fs.unlink(
                    tempPath
                ).catch(() => {});
            }
        }
    }
);

// ═══════════════════════════════════════════════════════════════
// SETMENUPIC
// ═══════════════════════════════════════════════════════════════

gmd(
    {
        pattern: "setmenupic",

        aliases: [
            "menupic",
            "menuimage",
            "setmenuimg"
        ],

        react: "🖼️",

        category: "owner",

        description:
            "Change menu image"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            quoted,
            quotedMsg,
            q
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        const quotedImg =
            quotedMsg?.imageMessage ||
            quoted?.imageMessage ||
            quoted?.message?.imageMessage ||
            null;

        const hasUrl =
            q &&
            q.trim().startsWith("http");

        if (!quotedImg && !hasUrl) {

            await react("❌");

            return reply(
`❌ Provide an image URL or quote an image.

Example:

.setmenupic https://example.com/menu.jpg`
            );
        }

        await react("⏳");

        let tempPath = null;

        try {

            let finalUrl;

            if (hasUrl) {

                finalUrl =
                    q.trim();

            } else {

                const {
                    uploadToCatbox
                } = require("../guru");

                tempPath =
                    await Guru.downloadAndSaveMediaMessage(
                        quotedImg,
                        "temp_menupic"
                    );

                finalUrl =
                    await uploadToCatbox(
                        tempPath
                    );

                if (!finalUrl) {
                    throw new Error(
                        "Image upload failed."
                    );
                }
            }

            await setSetting(
                "MENU_PIC_CUSTOM",
                finalUrl
            );

            await react("✅");

            return reply(
`✅ Menu image updated!

🖼️ ${finalUrl}

Send .menu to view it.`
            );

        } catch (error) {

            await react("❌");

            return reply(
`❌ Failed:

${error.message}`
            );

        } finally {

            if (tempPath) {
                await fs.unlink(
                    tempPath
                ).catch(() => {});
            }
        }
    }
);

// ═══════════════════════════════════════════════════════════════
// SETFOOTER
// ═══════════════════════════════════════════════════════════════

gmd(
    {
        pattern: "setfooter",

        aliases: [
            "footer",
            "botfooter",
            "changefooter"
        ],

        react: "✏️",

        category: "owner",

        description:
            "Change menu footer"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            q
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        if (!q || !q.trim()) {

            await react("❌");

            const current =
                await getSetting("FOOTER");

            return reply(
`❌ Enter footer text.

Current:
${current || "Not set"}

Example:
.setfooter Powered by LUKA iT`
            );
        }

        await setSetting(
            "FOOTER",
            q.trim()
        );

        await react("✅");

        return reply(
`✅ Footer updated!

${q.trim()}`
        );
    }
);

// ═══════════════════════════════════════════════════════════════
// SETCAPTION
// ═══════════════════════════════════════════════════════════════

gmd(
    {
        pattern: "setcaption",

        aliases: [
            "caption",
            "botcaption",
            "changecaption"
        ],

        react: "✏️",

        category: "owner",

        description:
            "Change bot caption"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            q
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        if (!q || !q.trim()) {

            await react("❌");

            const current =
                await getSetting("CAPTION");

            return reply(
`❌ Enter caption.

Current:
${current || "Not set"}

Example:
.setcaption Powered by LUKA-AI`
            );
        }

        await setSetting(
            "CAPTION",
            q.trim()
        );

        await react("✅");

        return reply(
`✅ Caption updated!

${q.trim()}`
        );
    }
);

// ═══════════════════════════════════════════════════════════════
// SETBOTNAME
// ═══════════════════════════════════════════════════════════════

gmd(
    {
        pattern: "setbotname",

        aliases: [
            "botname",
            "namebot",
            "changename",
            "renamebot"
        ],

        react: "✏️",

        category: "owner",

        description:
            "Change bot name"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            q
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        if (!q || !q.trim()) {

            await react("❌");

            const current =
                await getSetting("BOT_NAME");

            return reply(
`❌ Enter bot name.

Current:
${current || "LUKA-AI"}

Example:
.setbotname LUKA-AI`
            );
        }

        await setSetting(
            "BOT_NAME",
            q.trim()
        );

        try {
            await Guru.updateProfileName(
                q.trim()
            );
        } catch {}

        await react("✅");

        return reply(
`✅ Bot name updated!

🤖 ${q.trim()}`
        );
    }
);

// ═══════════════════════════════════════════════════════════════
// SETEXPIRY
// ═══════════════════════════════════════════════════════════════

gmd(
    {
        pattern: "setexpiry",

        aliases: [
            "expiry",
            "setlicence",
            "licence",
            "licensedate"
        ],

        react: "🔒",

        category: "owner",

        description:
            "Set bot licence expiry date"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            args
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        const {
            expiryLine,
            parseExpiryDate
        } = require("../guru/expiry");

        if (!args[0]) {

            await react("ℹ️");

            const current =
                await expiryLine();

            return reply(
`╭━━━━━━━━━━━━━━━━━━━━━━╮
│     🔒 LICENCE
├━━━━━━━━━━━━━━━━━━━━━━┤
│ Current: ${current}
│
│ Usage:
│ .setexpiry YYYY-MM-DD
│
│ Example:
│ .setexpiry 2026-12-31
╰━━━━━━━━━━━━━━━━━━━━━━╯`
            );
        }

        const raw =
            args[0].trim();

        const parsed =
            parseExpiryDate(raw);

        if (!parsed) {

            await react("❌");

            return reply(
`❌ Invalid date.

Accepted:

YYYY-MM-DD
DD/MM/YYYY
DD-MM-YYYY

Example:
.setexpiry 2026-12-31`
            );
        }

        await setSetting(
            "BOT_EXPIRY_DATE",
            raw
        );

        const status =
            await expiryLine();

        await react("✅");

        return reply(
`✅ Licence expiry updated!

🔒 ${status}`
        );
    }
);

// ═══════════════════════════════════════════════════════════════
// DESIGNINFO
// ═══════════════════════════════════════════════════════════════

gmd(
    {
        pattern: "designinfo",

        aliases: [
            "mydesign",
            "designstatus",
            "currentdesign"
        ],

        react: "🎨",

        category: "owner",

        description:
            "Show current design settings"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        const [
            theme,
            pic,
            footer,
            caption,
            name
        ] = await Promise.all([

            getSetting("MENU_THEME"),
            getSetting("MENU_PIC_CUSTOM"),
            getSetting("FOOTER"),
            getSetting("CAPTION"),
            getSetting("BOT_NAME")

        ]);

        let expiry = "Lifetime";

        try {

            const {
                expiryLine
            } = require("../guru/expiry");

            expiry =
                await expiryLine();

        } catch {}

        const themeKey =
            theme || "premium";

        const themeName =
            THEMES[themeKey]?.name ||
            themeKey;

        const themeNumber =
            THEME_KEYS.indexOf(themeKey) + 1;

        const shortPic =
            pic
                ? pic.length > 40
                    ? pic.slice(0, 37) + "..."
                    : pic
                : "Default";

        await react("✅");

        return reply(
`╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
│       🎨 DESIGN INFO
├━━━━━━━━━━━━━━━━━━━━━━━━━━━━┤
│
│ Theme   : ${themeName}
│ Number  : ${themeNumber}/${THEME_KEYS.length}
│ Bot     : ${name || "LUKA-AI"}
│ Footer  : ${footer || "Default"}
│ Caption : ${caption || "Default"}
│ MenuPic : ${shortPic}
│
│ 🔒 ${expiry}
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

COMMANDS

.setmenu
.previewmenu <n>
.setbotname <text>
.setbotpic
.setmenupic
.setfooter <text>
.setcaption <text>
.setexpiry YYYY-MM-DD
.resetdesign`
        );
    }
);

// ═══════════════════════════════════════════════════════════════
// RESET DESIGN
// ═══════════════════════════════════════════════════════════════

const resetConfirm =
    new Map();

gmd(
    {
        pattern: "resetdesign",

        aliases: [
            "designreset",
            "resettheme"
        ],

        react: "🔄",

        category: "owner",

        description:
            "Reset design settings"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser
        } = conText;

        if (!isSuperUser) {
            await react("❌");
            return reply("❌ Owner Only Command!");
        }

        const nowTime =
            Date.now();

        const pending =
            resetConfirm.get(from);

        if (
            !pending ||
            nowTime - pending > 25000
        ) {

            resetConfirm.set(
                from,
                nowTime
            );

            await react("⚠️");

            return reply(
`⚠️ RESET CONFIRMATION

This will reset:

◈ Menu theme
◈ Bot name
◈ Footer
◈ Caption
◈ Custom menu image

Send:

.resetdesign

again within 25 seconds
to confirm.`
            );
        }

        resetConfirm.delete(from);

        await Promise.all([

            resetSetting("MENU_THEME"),
            resetSetting("BOT_PIC"),
            resetSetting("MENU_PIC_CUSTOM"),
            resetSetting("FOOTER"),
            resetSetting("CAPTION"),
            resetSetting("BOT_NAME")

        ]);

        await react("✅");

        return reply(
`✅ DESIGN RESET COMPLETE!

Default menu design restored.

Send .menu to view it.`
        );
    }
);

// ═══════════════════════════════════════════════════════════════
// BUILD THEMED MENU
// ═══════════════════════════════════════════════════════════════

async function buildThemedMenu(
    conText,
    Guru
) {

    const themeKey =
        (await getSetting("MENU_THEME")) ||
        "premium";

    const theme =
        THEMES[themeKey] ||
        THEMES.premium;

    const data =
        await buildMenuData(
            conText
        );

    return theme.render(data);
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {

    buildThemedMenu,

    THEMES,

    THEME_KEYS,

    buildMenuData,

    sendMenuMsg,

    getSortedCategories,

    CAT_ICONS

};
