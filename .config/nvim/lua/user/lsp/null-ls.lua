local null_ls_status_ok, null_ls = pcall(require, "null-ls")
if not null_ls_status_ok then
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
    formatting.prettier.with({ extra_args = { "--no-semi" } }),
    formatting.yapf,
    formatting.stylua,
    formatting.terraform_fmt,
    formatting.shellharden,
    formatting.golines,
    formatting.google_java_format,

    diagnostics.shellcheck,
    diagnostics.flake8,
    diagnostics.ansiblelint,
    diagnostics.write_good,
  },
})
