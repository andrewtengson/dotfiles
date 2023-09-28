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
    formatting.shellharden,
    formatting.golines,
    formatting.gofumpt,
    formatting.goimports_reviser,
    formatting.google_java_format,
    formatting.black,
    formatting.rustfmt,

    diagnostics.write_good,
    diagnostics.mypy,
    diagnostics.ruff,
    diagnostics.jsonlint,
    diagnostics.golangci_lint,
  },
  border = "single",
})

mason_null_ls.setup({
  automatic_installation = true,
})
