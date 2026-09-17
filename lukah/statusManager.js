'use strict';
// ╭─────────────────────────────────────────────────────────────╮
//   LUKA-AI  ·  guruh/statusManager.js
//   Bridge/alias so plugins inside lukah/ can import:
//     require('../statusManager')
//   and resolve to the real module at luka/handlers/statusManager.js
//   Do NOT put business logic here — edit the real module instead.
// └──𝐋𝐔𝐊𝐀-𝐀𝐈 ────────────────────────────────────────────────╯

module.exports = require('../luka/handlers/statusManager');
