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
  {
    "nvim-lua/popup.nvim",
  }, -- An implementation of the Popup API from vim in Neovim
  {
    "nvim-lua/plenary.nvim",
  }, -- Useful lua functions used ny lots of plugins
  {
    "lukas-reineke/indent-blankline.nvim",
    main = "ibl",
    opts = {},
  },
  {
    "windwp/nvim-autopairs",
  }, -- Autopairs, integrates with both cmp and treesitter
  {
    "numToStr/Comment.nvim",
  },
  {
    "kyazdani42/nvim-web-devicons",
  },
  {
    "kyazdani42/nvim-tree.lua",
  },
  {
    "akinsho/bufferline.nvim",
    branch = "main",
  },
  {
    "moll/vim-bbye",
  },
  {
    "nvim-lualine/lualine.nvim",
  },
  {
    "akinsho/toggleterm.nvim",
    branch = "main",
  },
  {
    "lewis6991/impatient.nvim",
  },
  {
    "ahmedkhalf/project.nvim",
  },
  {
    "MunifTanjim/nui.nvim",
  },

  -- Colorschemes
  {
    "gruvbox-community/gruvbox",
  },

  -- cmp plugins
  {
    "hrsh7th/nvim-cmp",
  }, -- The completion plugin
  {
    "hrsh7th/cmp-buffer",
  }, -- buffer completions
  {
    "hrsh7th/cmp-path",
  }, -- path completions
  {
    "hrsh7th/cmp-cmdline",
  }, -- cmdline completions
  {
    "saadparwaiz1/cmp_luasnip",
  }, -- snippet completions
  {
    "hrsh7th/cmp-nvim-lsp",
  },
  {
    "hrsh7th/cmp-nvim-lua",
  },

  -- snippets
  {
    "L3MON4D3/LuaSnip",
  }, --snippet engine
  {
    "rafamadriz/friendly-snippets",
  }, -- a bunch of snippets to use

  -- LSP
  {
    "neovim/nvim-lspconfig",
  }, -- enable LSP
  {
    "williamboman/mason.nvim",
  },
  {
    "williamboman/mason-lspconfig.nvim",
  },
  {
    "jayp0521/mason-null-ls.nvim",
  },
  {
    "nvimtools/none-ls.nvim",
  }, -- for formatters and linters

  -- DAP
  {
    "mfussenegger/nvim-dap",
  },
  {
    "jayp0521/mason-nvim-dap.nvim",
  },
  {
    "rcarriga/nvim-dap-ui",
  },

  -- Languages
  {
    "hashivim/vim-terraform",
    ft = "terraform",
  },
  {
    "rodjek/vim-puppet",
    ft = "puppet",
  },
  {
    "pearofducks/ansible-vim",
    ft = "yaml",
  },
  {
    "towolf/vim-helm",
    ft = "helm",
  },
  {
    "darfink/vim-plist",
    ft = "plist",
  },
  {
    "saecki/crates.nvim",
    event = { "BufEnter Cargo.toml" },
    config = function()
      require("core.plugin_config.crates")
    end,
  },
  {
    "mustache/vim-mustache-handlebars",
    ft = { "helm", "yaml" },
  },
  {
    "olexsmir/gopher.nvim",
    ft = { "go" },
    config = function(_, opts)
      require("gopher").setup(opts)
    end,
    build = function()
      vim.cmd([[silent! GoInstallDeps]])
    end,
  },

  -- Telescope
  {
    "nvim-telescope/telescope.nvim",
  },
  {
    "nvim-telescope/telescope-media-files.nvim",
  },
  {
    "nvim-telescope/telescope-dap.nvim",
  },

  -- Treesitter
  {
    "nvim-treesitter/nvim-treesitter",
  },
  {
    "nvim-treesitter/nvim-treesitter-context",
  },
  {
    "JoosepAlviste/nvim-ts-context-commentstring",
  },

  -- Git
  {
    "lewis6991/gitsigns.nvim",
  },
  {
    "tpope/vim-fugitive",
  },

  -- ChatGPT
  {
    "jackMort/ChatGPT.nvim",
    cmd = {
      "ChatGPT",
      "ChatGPTActAs",
      "ChatGPTCompleteCode",
      "ChatGPTEditWithInstructions",
      "ChatGPTRun",
    },
    config = function()
      require("core.plugin_config.chatgpt")
    end,
  },

  -- Obsidian
  {
    "epwalsh/obsidian.nvim",
    lazy = true,
    event = { "BufReadPre " .. vim.fn.expand("~") .. "/Documents/obsidian-vault/**.md" },
    opts = {
      dir = "~/Documents/obsidian-vault",
      daily_notes = {
        folder = "Dailies",
      },
      ui = {
        enable = false,
      },
      disable_frontmatter = true,
    },
  },

  -- Codeium
  {
    "Exafunction/codeium.vim",
    event = "BufEnter",
  },

  -- Silicon
  {
    "michaelrommel/nvim-silicon",
    lazy = true,
    cmd = "Silicon",
    config = function()
      require("core.plugin_config.silicon")
    end,
  },

  -- WhichKey
  {
    "folke/which-key.nvim",
    keys = { "<leader>", "<c-r>", "<c-w>", '"', "'", "`", "c", "v", "g" },
    cmd = "WhichKey",
    config = function(_, opts)
      local wk = require("which-key")
      wk.setup(opts)
    end,
  },

  -- Undotree
  {
    "jiaoshijie/undotree",
    keys = { { "<leader>u", "<cmd>lua require('undotree').toggle()<cr>" } },
    dependencies = "nvim-lua/plenary.nvim",
    config = function()
      require("core.plugin_config.undotree")
    end,
  },

  -- Harpoon
  {
    "ThePrimeagen/harpoon",
    branch = "harpoon2",
    dependencies = { "nvim-lua/plenary.nvim", "nvim-telescope/telescope.nvim" },
    config = function()
      require("core.plugin_config.harpoon")
    end,
  },

  -- Trouble
  {
    "folke/trouble.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
  },
}

local opts = {
  ui = {
    border = "single",
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
