local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

local plugins = {
  -- My plugins here
  "nvim-lua/popup.nvim", -- An implementation of the Popup API from vim in Neovim
  "nvim-lua/plenary.nvim", -- Useful lua functions used ny lots of plugins
  "lukas-reineke/indent-blankline.nvim",
  "windwp/nvim-autopairs", -- Autopairs, integrates with both cmp and treesitter
  "numToStr/Comment.nvim",
  "kyazdani42/nvim-web-devicons",
  "kyazdani42/nvim-tree.lua",
  { "akinsho/bufferline.nvim", branch = "main" },
  "moll/vim-bbye",
  "nvim-lualine/lualine.nvim",
  { "akinsho/toggleterm.nvim", branch = "main" },
  "lewis6991/impatient.nvim",
  "ahmedkhalf/project.nvim",
  "MunifTanjim/nui.nvim",

  -- Colorschemes
  "gruvbox-community/gruvbox",

  -- cmp plugins
  "hrsh7th/nvim-cmp", -- The completion plugin
  "hrsh7th/cmp-buffer", -- buffer completions
  "hrsh7th/cmp-path", -- path completions
  "hrsh7th/cmp-cmdline", -- cmdline completions
  "saadparwaiz1/cmp_luasnip", -- snippet completions
  "hrsh7th/cmp-nvim-lsp",
  "hrsh7th/cmp-nvim-lua",

  -- snippets
  "L3MON4D3/LuaSnip", --snippet engine
  "rafamadriz/friendly-snippets", -- a bunch of snippets to use

  -- LSP
  "neovim/nvim-lspconfig", -- enable LSP
  "williamboman/mason.nvim",
  "williamboman/mason-lspconfig.nvim",
  "jayp0521/mason-null-ls.nvim",
  "jose-elias-alvarez/null-ls.nvim", -- for formatters and linters

  -- DAP
  "mfussenegger/nvim-dap",
  "jayp0521/mason-nvim-dap.nvim",
  "rcarriga/nvim-dap-ui",

  -- Languages
  { "hashivim/vim-terraform", event = { "BufRead *.tf,*.hcl" } },
  { "rodjek/vim-puppet", event = { "BufRead *.pp" } },
  { "pearofducks/ansible-vim", event = { "BufRead *.yaml,*.yml" } },
  { "towolf/vim-helm", event = { "BufRead *.yaml,*.yml" } },
  { "darfink/vim-plist", event = { "BufRead *.plist" } },
  {
    "saecki/crates.nvim",
    event = { "BufRead Cargo.toml" },
    config = function()
      require("core.plugin_config.crates")
    end,
  },
  { "mustache/vim-mustache-handlebars", event = { "BufRead *.yaml,*.yml" } },

  -- Telescope
  "nvim-telescope/telescope.nvim",
  "nvim-telescope/telescope-media-files.nvim",
  "nvim-telescope/telescope-dap.nvim",

  -- Treesitter
  {
    "nvim-treesitter/nvim-treesitter",
  },
  "nvim-treesitter/nvim-treesitter-context",
  "JoosepAlviste/nvim-ts-context-commentstring",

  -- Git
  "lewis6991/gitsigns.nvim",
  "tpope/vim-fugitive",

  -- ChatGPT
  {
    "jackMort/ChatGPT.nvim",
    event = "VeryLazy",
    config = function()
      require("core.plugin_config.chatgpt")
    end,
  },
}

local opts = {
  ui = {
    icons = {
      cmd = "",
      config = "󱐋",
      event = "󰠠",
      ft = "",
      init = "",
      import = "",
      keys = "",
      lazy = "󰒲 ",
      loaded = "●",
      not_loaded = "○",
      plugin = "",
      runtime = "",
      source = "",
      start = "󰐊",
      task = "✔ ",
      list = {
        "●",
        "➜",
        "★",
        "‒",
      },
    },
  },
}

require("lazy").setup(plugins, opts)
