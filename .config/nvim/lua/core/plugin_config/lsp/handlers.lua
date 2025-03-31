local M = {}

-- TODO: backfill this to template
M.setup = function()
  vim.diagnostic.config({
    signs = {
      text = {
        [vim.diagnostic.severity.ERROR] = " ",
        [vim.diagnostic.severity.WARN] = " ",
        [vim.diagnostic.severity.INFO] = "󰋼 ",
        [vim.diagnostic.severity.HINT] = "󰌵 ",
      },
      numhl = {
        [vim.diagnostic.severity.ERROR] = "",
        [vim.diagnostic.severity.WARN] = "",
        [vim.diagnostic.severity.HINT] = "",
        [vim.diagnostic.severity.INFO] = "",
      },
    },
  })

  local config = {
    -- disable virtual text
    virtual_text = false,
    update_in_insert = true,
    underline = true,
    severity_sort = true,
    float = {
      focusable = false,
      style = "minimal",
      border = "single",
      source = "always",
      header = "",
      prefix = "",
    },
  }

  vim.diagnostic.config(config)
end

local function lsp_keymaps(bufnr)
  local opts = { noremap = true, silent = true }
  vim.api.nvim_buf_set_keymap(bufnr, "n", "gD", "<cmd>lua vim.lsp.buf.declaration()<CR>", opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "gd", "<cmd>lua vim.lsp.buf.definition()<CR>", opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "K", '<cmd>lua vim.lsp.buf.hover({ border = "single" })<CR>', opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "gi", "<cmd>lua vim.lsp.buf.implementation()<CR>", opts)
  -- vim.api.nvim_buf_set_keymap(bufnr, "n", "<C-k>", "<cmd>lua vim.lsp.buf.signature_help()<CR>", opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "<leader>rn", "<cmd>lua vim.lsp.buf.rename()<CR>", opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "gr", "<cmd>lua vim.lsp.buf.references()<CR>", opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "<leader>ca", "<cmd>lua vim.lsp.buf.code_action()<CR>", opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "[d", '<cmd>lua vim.diagnostic.goto_prev({ border = "single" })<CR>', opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "gl", "<cmd>lua vim.diagnostic.open_float()<CR>", opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "]d", '<cmd>lua vim.diagnostic.goto_next({ border = "single" })<CR>', opts)
  vim.api.nvim_buf_set_keymap(bufnr, "n", "<leader>i", "<cmd>lua vim.diagnostic.setloclist()<CR>", opts)
  vim.cmd([[ command! Format execute 'lua vim.lsp.buf.format()' ]])
end

M.on_attach = function(client, bufnr)
  local servers = {
    "tsserver",
    "jsonls",
    "terraformls",
    "gopls",
    "sumneko_lua",
    "jdtls",
    "biome",
  }

  for _, server in ipairs(servers) do
    if client.name == server then
      client.server_capabilities.documentFormattingProvider = false
    end
  end

  if client.server_capabilities.documentFormattingProvider then
    vim.api.nvim_create_autocmd("BufWritePre", {
      command = "lua vim.lsp.buf.format()",
      buffer = bufnr,
      desc = "Format File on Write",
    })
  end

  lsp_keymaps(bufnr)
end

local capabilities = vim.lsp.protocol.make_client_capabilities()

local cmp_nvim_lsp = require("cmp_nvim_lsp")

M.capabilities = cmp_nvim_lsp.default_capabilities(capabilities)

return M
