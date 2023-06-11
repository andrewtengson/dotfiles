local null_ls = require("null-ls")
local mason_null_ls = require("mason-null-ls")
-- https://github.com/jose-elias-alvarez/null-ls.nvim/tree/main/lua/null-ls/builtins/formatting
local formatting = null_ls.builtins.formatting
-- https://github.com/jose-elias-alvarez/null-ls.nvim/tree/main/lua/null-ls/builtins/diagnostics
local diagnostics = null_ls.builtins.diagnostics

null_ls.setup({
  on_attach = require("core.plugin_config.lsp.handlers").on_attach,
  debug = false,
  sources = {
    formatting.prettier,
    formatting.stylua,
    formatting.terraform_fmt,
    formatting.shellharden,
    formatting.golines,
    formatting.google_java_format,
    formatting.yapf,
    formatting.rustfmt,

    diagnostics.write_good,
  },
  border = "single",
})

mason_null_ls.setup({
  automatic_installation = true,
})
