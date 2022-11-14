local status_ok, mason_lspconfig = pcall(require, "mason-lspconfig")
if not status_ok then
  return
end

local servers = {
  "bashls",
  "dockerls",
  "gopls",
  "jsonls",
  "pyright",
  "sqls",
  "sumneko_lua",
  "terraformls",
  "tsserver",
  "ansiblels",
  "clangd",
  "rust_analyzer",
  "jdtls",
  "pylsp",
}

require("mason-lspconfig").setup({
  ensure_installed = servers,
})

require("mason-lspconfig").setup_handlers({
  function(server_name)
    local server_opts = {
      on_attach = require("user.lsp.handlers").on_attach,
      capabilities = require("user.lsp.handlers").capabilities,
    }

    if server_name == "jsonls" then
      local jsonls_opts = require("user.lsp.settings.jsonls")
      server_opts = vim.tbl_deep_extend("force", jsonls_opts, server_opts)
    end

    if server_name == "sumneko_lua" then
      local sumneko_opts = require("user.lsp.settings.sumneko_lua")
      server_opts = vim.tbl_deep_extend("force", sumneko_opts, server_opts)
    end

    if server_name == "ansiblels" then
      local ansiblels_opts = require("user.lsp.settings.ansiblels")
      server_opts = vim.tbl_deep_extend("force", ansiblels_opts, server_opts)
    end

    require("lspconfig")[server_name].setup(server_opts)
  end,
})
