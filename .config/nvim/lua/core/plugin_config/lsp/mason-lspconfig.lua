local mason_lspconfig = require("mason-lspconfig")

local servers = {
  "bashls",
  "dockerls",
  "gopls",
  "jsonls",
  "pyright",
  "sqlls",
  "lua_ls",
  "terraformls",
  "tsserver",
  "ansiblels",
  "clangd",
  "rust_analyzer",
  "jdtls",
  "html",
  "cssls",
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

    require("lspconfig")[server_name].setup(server_opts)
  end,
})
