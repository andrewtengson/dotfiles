local status_ok, nvim_lsp = pcall(require, "lspconfig")
if not status_ok then
  return
end

require("user.lsp.lsp-installer")
local lsp_handlers = require("user.lsp.handlers")
require "user.lsp.null-ls"

lsp_handlers.setup()

local servers = {
  -- "terraform_lsp"
}

for _, lsp in ipairs(servers) do
  nvim_lsp[lsp].setup{
    on_attach = lsp_handlers.on_attach,
    capabilities = lsp_handlers.capabilities
  }
end

