local sources = {
  "bash",
  "python",
  "js",
  "codelldb",
  "delve",
}

local mason_nvim_dap = require("mason-nvim-dap")

mason_nvim_dap.setup({
  ensure_installed = sources,
  automatic_setup = true,
  handlers = {
    function(config)
      mason_nvim_dap.default_setup(config)
    end,
  },
})
