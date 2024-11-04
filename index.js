console.log("starting...");
const Bot = require("./Bot");
const cravli = require("./cravli");
const { botConfig, pluginsConfig } = require("./config");

const plugins = [
    new cravli(pluginsConfig.cravli)
];

const bot = new Bot(plugins, botConfig);

(async () => {
    await bot.connect();
    await bot.run();
})();