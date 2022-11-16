local status_ok, mason_nvim_dap = pcall(require, "mason-nvim-dap")
if not status_ok then
  return
end

local sources = {
  "bash",
  "python",
  "node2",
}

mason_nvim_dap.setup({
  ensure_installed = sources,
  automatic_setup = true,
})

mason_nvim_dap.setup_handlers({})
