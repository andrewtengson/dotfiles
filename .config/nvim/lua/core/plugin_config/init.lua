-- Helper function to safely require plugin configurations
local function safe_require(module)
  local ok, err = pcall(require, module)
  if not ok then
    vim.notify("Error loading " .. module .. ": " .. err, vim.log.levels.ERROR)
  end
end

safe_require("core.plugin_config.colorscheme")
safe_require("core.plugin_config.lsp")
safe_require("core.plugin_config.telescope")
safe_require("core.plugin_config.treesitter")
safe_require("core.plugin_config.treesitter-context")
safe_require("core.plugin_config.dap")
safe_require("core.plugin_config.which-key")
