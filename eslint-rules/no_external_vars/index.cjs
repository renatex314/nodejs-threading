const noExternalVarsRule = require("./no-external-vars-in-specific-function.cjs");

const plugin = {
  rules: {
    "no-external-vars-function": noExternalVarsRule
  }
}

module.exports = plugin;
