/**
 * design.js — Simple Premium Menu System
 */

"use strict";

const { gmd, commands } = require("../luka");
const {
    getSetting,
    setSetting
} = require("../luka/database/settings");

const moment = require("moment-timezone");

const MENU_IMAGE =
    "https://i.imgur.com/gwSrfcK.png";

// ─────────────────────────────────────────────
// CATEGORY ICONS
// ─────────────────────────────────────────────

const ICONS = {
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
    sports: "⚽",
    media: "▶",
    sticker: "✿",
    extras: "✧"
};

// ─────────────────────────────────────────────
// GET CATEGORIES
// ─────────────────────────────────────────────

function getCategories() {

    const cats = {};

    for (const cmd of commands) {

        if (!cmd.pattern || cmd.dontAddCommandList)
            continue;

        const cat =
            (cmd.category || "general").toLowerCase();

        if (!cats[cat])
            cats[cat] = [];

        cats[cat].push(cmd);
    }

    return Object.keys(cats).sort();
}

// ─────────────────────────────────────────────
// MENU DATA
// ─────────────────────────────────────────────

async function getData(conText) {

    const {
        pushName,
        botName,
        botPrefix,
        botVersion,
        botMode,
        botFooter
    } = conText;

    const categories =
        getCategories();

    const totalCommands =
        commands.filter(
            c => c.pattern && !c.dontAddCommandList
        ).length;

    const timezone =
        process.env.TIME_ZONE ||
        "Africa/Nairobi";

    const hour =
        Number(
            moment()
                .tz(timezone)
                .format("HH")
        );

    let greeting = "GOOD NIGHT";

    if (hour < 12)
        greeting = "GOOD MORNING";
    else if (hour < 17)
        greeting = "GOOD AFTERNOON";
    else if (hour < 21)
        greeting = "GOOD EVENING";

    return {

        name:
            botName || "LUKA-AI",

        user:
            pushName || "User",

        prefix:
            botPrefix || ".",

        version:
            botVersion || "5.0.0",

        mode:
            (botMode || "public").toUpperCase(),

        footer:
            botFooter ||
            "ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʟᴜᴋᴀʙʀᴀɴᴅ",

        commands:
            totalCommands,

        categories,

        greeting

    };
}

// ─────────────────────────────────────────────
// THEMES
// ─────────────────────────────────────────────

const THEMES = {

    1: {

        name: "MINIMAL",

        render(d) {

            return `

╭━━━〔 ✦ ${d.name.toUpperCase()} ✦ 〕━━━╮
┃
┃  👋 ${d.greeting}, ${d.user}
┃
┃  🟢 STATUS   : ONLINE
┃  ⚡ COMMANDS : ${d.commands}
┃  📌 PREFIX   : ${d.prefix}
┃  🌐 MODE     : ${d.mode}
┃  📦 VERSION  : v${d.version}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 📚 COMMAND MENU 〕━━━╮
${d.categories.map((cat, i) => {

    const icon =
        ICONS[cat] || "◇";

    return `┃ ${String(i + 1).padStart(2, "0")}  ${icon}  ${cat.toUpperCase()}`;

}).join("\n")}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━〔 ⚡ ${d.name.toUpperCase()} 〕━━╮
┃
┃  Reply with a number
┃  1 - ${d.categories.length}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${d.footer}`;
        }
    },

    2: {

        name: "NEON",

        render(d) {

            return `

╔══════════════════════════════╗
║      ⚡ ${d.name.toUpperCase()}
╠══════════════════════════════╣
║
║  👋 ${d.greeting}
║  👤 User     : ${d.user}
║  🟢 Status   : ONLINE
║  ⚡ Commands : ${d.commands}
║  📌 Prefix   : ${d.prefix}
║  🌐 Mode     : ${d.mode}
║  📦 Version  : v${d.version}
║
╠══════════════════════════════╣
║        COMMAND CENTER
╠══════════════════════════════╣
${d.categories.map((cat, i) =>
`║  [${String(i + 1).padStart(2, "0")}] ${cat.toUpperCase()}`
).join("\n")}
╠══════════════════════════════╣
║  REPLY → 1-${d.categories.length}
╚══════════════════════════════╝

⚡ ${d.footer}`;
        }
    },

    3: {

        name: "LUXE",

        render(d) {

            return `

◇━━━━━━━━━━━━━━━━━━━━━━━━━━◇
        ${d.name.toUpperCase()}
◇━━━━━━━━━━━━━━━━━━━━━━━━━━◇

       ${d.greeting}
       ${d.user}

╭──〔 BOT STATUS 〕────────╮
│
│ ◉ ONLINE
│
│ Commands : ${d.commands}
│ Prefix   : ${d.prefix}
│ Mode     : ${d.mode}
│ Version  : v${d.version}
│
╰─────────────────────────╯

╭──〔 COMMANDS 〕─────────╮
${d.categories.map((cat, i) =>
`│ ${String(i + 1).padStart(2, "0")} ◇ ${cat.toUpperCase()}`
).join("\n")}
╰─────────────────────────╯

◇ Reply 1-${d.categories.length}

◇ ${d.footer}`;
        }
    }

};

const THEME_KEYS = Object.keys(THEMES);

// ─────────────────────────────────────────────
// SEND MENU
// ─────────────────────────────────────────────

async function sendMenu(Guru, from, text, conText) {

    const custom =
        await getSetting("MENU_PIC_CUSTOM");

    const image =
        custom || MENU_IMAGE;

    try {

        return await Guru.sendMessage(
            from,
            {
                image: {
                    url: image
                },
                caption: text.trim()
            },
            {
                quoted: conText.mek
            }
        );

    } catch {

        return Guru.sendMessage(
            from,
            {
                text: text.trim()
            },
            {
                quoted: conText.mek
            }
        );
    }
}

// ─────────────────────────────────────────────
// SETMENU
// ─────────────────────────────────────────────

gmd(
    {
        pattern: "setmenu",

        aliases: [
            "menutheme",
            "menudesign"
        ],

        react: "🎨",

        category: "owner",

        description:
            "Change menu design"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            args
        } = conText;

        if (!isSuperUser)
            return reply("❌ Owner Only!");

        if (!args[0]) {

            return reply(`

╭━━━〔 🎨 MENU DESIGNS 〕━━━╮
┃
${THEME_KEYS.map((key, i) =>
`┃ ${i + 1}. ${THEMES[key].name}`
).join("\n")}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯

Use:

.setmenu 1
.setmenu 2
.setmenu 3

`);
        }

        const number =
            Number(args[0]);

        if (!THEMES[number]) {

            await react("❌");

            return reply(
                `❌ Invalid design.\n\nChoose 1-${THEME_KEYS.length}`
            );
        }

        await setSetting(
            "MENU_THEME",
            number
        );

        const data =
            await getData(conText);

        const menu =
            THEMES[number].render(data);

        await sendMenu(
            Guru,
            from,
`🎨 *${THEMES[number].name} ACTIVATED*

${menu}`,
            conText
        );

        await react("✅");
    }
);

// ─────────────────────────────────────────────
// PREVIEW
// ─────────────────────────────────────────────

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
            "Preview menu design"
    },

    async (from, Guru, conText) => {

        const {
            reply,
            react,
            isSuperUser,
            args
        } = conText;

        if (!isSuperUser)
            return reply("❌ Owner Only!");

        const number =
            Number(args[0]);

        if (!THEMES[number]) {

            await react("❌");

            return reply(
                `❌ Use .previewmenu 1-${THEME_KEYS.length}`
            );
        }

        const data =
            await getData(conText);

        const menu =
            THEMES[number].render(data);

        await sendMenu(
            Guru,
            from,
`👁️ *PREVIEW — ${THEMES[number].name}*

${menu}`,
            conText
        );

        await react("✅");
    }
);

// ─────────────────────────────────────────────
// BUILD MENU
// ─────────────────────────────────────────────

async function buildThemedMenu(conText) {

    const selected =
        await getSetting("MENU_THEME");

    const theme =
        THEMES[selected] ||
        THEMES[1];

    const data =
        await getData(conText);

    return theme.render(data);
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────

module.exports = {

    buildThemedMenu,

    THEMES,

    THEME_KEYS,

    getData,

    sendMenu

};
