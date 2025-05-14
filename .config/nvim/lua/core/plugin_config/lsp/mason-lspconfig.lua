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
  automatic_enable = true,
})
