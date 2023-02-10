local null_ls_status_ok, null_ls = pcall(require, "null-ls")
if not null_ls_status_ok then
  return
end

local mason_null_ls_status_ok, mason_null_ls = pcall(require, "mason-null-ls")
if not mason_null_ls_status_ok then
  return
end

-- https://github.com/jose-elias-alvarez/null-ls.nvim/tree/main/lua/null-ls/builtins/formatting
local formatting = null_ls.builtins.formatting
-- https://github.com/jose-elias-alvarez/null-ls.nvim/tree/main/lua/null-ls/builtins/diagnostics
local diagnostics = null_ls.builtins.diagnostics

null_ls.setup({
  on_attach = require("user.lsp.handlers").on_attach,
  debug = false,
  sources = {
    formatting.prettier,
    formatting.stylua,
    formatting.terraform_fmt,
    formatting.shellharden,
    formatting.golines,
    formatting.google_java_format,
    formatting.yapf,

    diagnostics.ansiblelint,
    diagnostics.write_good,
    diagnostics.shellcheck,
  },
})

mason_null_ls.setup({
  automatic_installation = true,
})
