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
  key_labels = {},
  icons = {
    breadcrumb = "»",
    separator = "➜",
    group = "+",
  },
  popup_mappings = {
    scroll_down = "<c-d>",
    scroll_up = "<c-u>",
  },
  window = {
    border = "single",
    position = "bottom",
    margin = { 1, 0, 1, 0 },
    padding = { 2, 2, 2, 2 },
    winblend = 0,
  },
  layout = {
    height = { min = 4, max = 25 },
    width = { min = 20, max = 50 },
    spacing = 3,
    align = "left",
  },
  ignore_missing = false,
  hidden = { "<silent>", "<cmd>", "<Cmd>", "<CR>", "call", "lua", "^:", "^ " },
  show_help = true,
  triggers = "auto",
  triggers_blacklist = {
    i = { "j", "k" },
    v = { "j", "k" },
  },
})

-- Define key group labels
wk.register({
  ["<leader>b"] = { name = "+Buffer" },
  ["<leader>d"] = { name = "+Debug/DAP" },
  ["<leader>ds"] = { name = "+Debug Step" },
  ["<leader>f"] = { name = "+Find" },
  ["<leader>g"] = { name = "+Git" },
  ["<leader>h"] = { name = "+Help" },
  ["<leader>l"] = { name = "+LSP" },
  ["<leader>m"] = { name = "+Molten" },
  ["<leader>o"] = { name = "+Output" },
  ["<leader>p"] = { name = "+Projects" },
  ["<leader>r"] = { name = "+Run/Eval" },
  ["<leader>s"] = { name = "+Search/Silicon/Spell" },
  ["<leader>t"] = { name = "+Terminal/Toggle" },
  ["<leader>u"] = { name = "+Undo" },
  ["<leader>v"] = { name = "+Vim" },
  ["<leader>w"] = { name = "+Window/Save" },
  ["<leader>x"] = { name = "+Trouble" },
})

