local mason_lspconfig = require("mason-lspconfig")

local servers = {
  "bashls",
  "dockerls",
  "gopls",
  "jsonls",
  "basedpyright",
  "lua_ls",
  "terraformls",
  "ts_ls",
  "ansiblels",
  "clangd",
  "rust_analyzer",
  "jdtls",
  "html",
  "cssls",
  "taplo",
  "ruff",
  "yamlls",
  "biome",
  "tailwindcss",
}

mason_lspconfig.setup({
  ensure_installed = servers,
})

mason_lspconfig.setup_handlers({
  function(server_name)
    local server_opts = {
      on_attach = require("core.plugin_config.lsp.handlers").on_attach,
      capabilities = require("core.plugin_config.lsp.handlers").capabilities,
    }

    if server_name == "jsonls" then
      local jsonls_opts = require("core.plugin_config.lsp.settings.jsonls")
      server_opts = vim.tbl_deep_extend("force", jsonls_opts, server_opts)
    end

    if server_name == "lua_ls" then
      local sumneko_opts = require("core.plugin_config.lsp.settings.lua_ls")
      server_opts = vim.tbl_deep_extend("force", sumneko_opts, server_opts)
    end

    if server_name == "ansiblels" then
      local ansiblels_opts = require("core.plugin_config.lsp.settings.ansiblels")
      server_opts = vim.tbl_deep_extend("force", ansiblels_opts, server_opts)
    end

    if server_name == "rust_analyzer" then
      local rust_analyzer_opts = require("core.plugin_config.lsp.settings.rust_analyzer")
      server_opts = vim.tbl_deep_extend("force", rust_analyzer_opts, server_opts)
    end

    if server_name == "terraformls" then
      local terraformls_opts = require("core.plugin_config.lsp.settings.terraformls")
      server_opts = vim.tbl_deep_extend("force", terraformls_opts, server_opts)
    end

    if server_name == "yamlls" then
      local yamlls_opts = require("core.plugin_config.lsp.settings.yamlls")
      server_opts = vim.tbl_deep_extend("force", yamlls_opts, server_opts)
    end

    if server_name == "basedpyright" then
      local basedpyright_opts = require("core.plugin_config.lsp.settings.basedpyright")
      server_opts = vim.tbl_deep_extend("force", basedpyright_opts, server_opts)
    end

    if server_name == "biome" then
      local biome_opts = require("core.plugin_config.lsp.settings.biome")
      server_opts = vim.tbl_deep_extend("force", biome_opts, server_opts)
    end

    require("lspconfig")[server_name].setup(server_opts)
  end,
})
