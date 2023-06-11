local status_ok, mason_nvim_dap = pcall(require, "mason-nvim-dap")
if not status_ok then
  return
end

local sources = {
  "bash",
  "python",
  "node2",
  "codelldb",
}

mason_nvim_dap.setup({
  ensure_installed = sources,
  automatic_setup = true,
  handlers = {
    function(config)
      mason_nvim_dap.default_setup(config)
    end,
  },
})