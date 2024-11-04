// Contains the default configuration for Bot & Plugins
// Any attribute not given in the configuration will take its default value

const botConfig = {
    authFolder: "auth",
    selfReply: false,
    logMessages: true,
  };
  
  const pluginsConfig = {
    cravli: {
      membersLimit: 1000,
      trigger: "cravli",
    }
  };
  
  module.exports = { botConfig, pluginsConfig };