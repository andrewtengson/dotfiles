local wk = require("which-key")

wk.setup({
  plugins = {
    marks = true,
    registers = true,
    spelling = {
      enabled = true,
      suggestions = 20,
    },
    presets = {
      operators = true,
      motions = true,
      text_objects = true,
      windows = true,
      nav = true,
      z = true,
      g = true,
    },
  },
  icons = {
    breadcrumb = "»",
    separator = "➜",
    group = "+",
  },
  layout = {
    height = { min = 4, max = 25 },
    width = { min = 20, max = 50 },
    spacing = 3,
    align = "left",
  },
  show_help = true,
})

-- Define key group labels
wk.add({
  { "<leader>b",  group = "Buffer" },
  { "<leader>d",  group = "Debug/DAP" },
  { "<leader>ds", group = "Debug Step" },
  { "<leader>f",  group = "Find" },
  { "<leader>g",  group = "Git" },
  { "<leader>h",  group = "Help" },
  { "<leader>l",  group = "LSP" },
  { "<leader>o",  group = "Output" },
  { "<leader>p",  group = "Projects" },
  { "<leader>r",  group = "Run/Eval" },
  { "<leader>s",  group = "Search/Silicon/Spell" },
  { "<leader>t",  group = "Terminal/Toggle" },
  { "<leader>u",  group = "Undo" },
  { "<leader>v",  group = "Vim" },
  { "<leader>w",  group = "Window/Save" },
  { "<leader>x",  group = "Trouble" },
})
