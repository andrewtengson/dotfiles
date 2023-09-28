require("ibl").setup({
  indent = { char = "▏" },
  scope = { enabled = false },
  exclude = {
    filetypes = {
      "terminal",
      "nofile",
    },
    buftypes = {
      "help",
      "startify",
      "dashboard",
      "packer",
      "neogitstatus",
      "NvimTree",
      "Trouble",
    },
  },
})
