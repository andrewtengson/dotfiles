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
    config = function()
      require("core.plugin_config.indent-blankline")
    end,
  },
  {
    "windwp/nvim-autopairs",
    config = function()
      require("core.plugin_config.autopairs")
    end,
  }, -- Autopairs, integrates with both cmp and treesitter
  {
    "numToStr/Comment.nvim",
    config = function()
      require("core.plugin_config.comment")
    end,
  },
  {
    "kyazdani42/nvim-web-devicons",
  },
  {
    "kyazdani42/nvim-tree.lua",
    config = function()
      require("core.plugin_config.nvim-tree")
    end,
  },
  {
    "akinsho/bufferline.nvim",
    branch = "main",
    config = function()
      require("core.plugin_config.bufferline")
    end,
  },
  {
    "moll/vim-bbye",
  },
  {
    "nvim-lualine/lualine.nvim",
    config = function()
      require("core.plugin_config.lualine")
    end,
  },
  {
    "akinsho/toggleterm.nvim",
    branch = "main",
    config = function()
      require("core.plugin_config.toggleterm")
    end,
  },
  {
    "lewis6991/impatient.nvim",
    config = function()
      require("core.plugin_config.impatient")
    end,
  },
  {
    "ahmedkhalf/project.nvim",
    config = function()
      require("core.plugin_config.project")
    end,
  },
  {
    "MunifTanjim/nui.nvim",
  },
  {
    "nvim-neotest/nvim-nio",
  },
  {
    "jmbuhr/otter.nvim",
    dependencies = {
      "nvim-treesitter/nvim-treesitter",
    },
    opts = {},
  },

  -- Colorschemes
  {
    "ellisonleao/gruvbox.nvim",
    config = function(_, opts)
      require("gruvbox").setup(opts)
    end,
    opts = {
      contrast = "hard",
      invert_selection = true,
      invert_intend_guides = true,
    },
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
    config = function()
      require("core.plugin_config.cmp")
    end,
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
  {
    "b0o/schemastore.nvim",
  },
  {
    "benlubas/molten-nvim",
    build = ":UpdateRemotePlugins",
    init = function()
      vim.g.molten_auto_open_output = false
      vim.g.molten_wrap_output = false
      vim.g.molten_virt_text_output = true
      vim.g.molten_virt_lines_off_by_1 = true
    end,
  },
  {
    "GCBallesteros/jupytext.nvim",
    config = true,
    opts = {
      style = "markdown",
      output_extension = "md",
      force_ft = "markdown",
    },
  },
  {
    "quarto-dev/quarto-nvim",
    dependencies = {
      "jmbuhr/otter.nvim",
      "nvim-treesitter/nvim-treesitter",
    },
    ft = { "quarto", "markdown" },
    config = function(_, opts)
      require("quarto").setup(opts)
      require("quarto").activate()
      local runner = require("quarto.runner")
      vim.keymap.set("n", "<leader>rc", runner.run_cell, { desc = "run cell", silent = true })
      vim.keymap.set("n", "<leader>ra", runner.run_above, { desc = "run cell and above", silent = true })
      vim.keymap.set("n", "<leader>rA", runner.run_all, { desc = "run all cells", silent = true })
      vim.keymap.set("n", "<leader>rl", runner.run_line, { desc = "run line", silent = true })
      vim.keymap.set("n", "<leader>RA", function()
        runner.run_all(true)
      end, { desc = "run all cells of all languages", silent = true })
    end,
    opts = {
      lspFeatures = {
        languages = { "python" },
        chunks = "all",
        diagnostics = {
          enabled = true,
          triggers = { "BufWritePost" },
        },
        completion = {
          enabled = true,
        },
      },
      codeRunner = {
        enabled = true,
        default_method = "molten",
      },
    },
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
    config = function()
      require("core.plugin_config.gitsigns")
    end,
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
    opts = {},
    dependencies = { "nvim-tree/nvim-web-devicons" },
  },

  -- Dressing
  {
    "stevearc/dressing.nvim",
  },

  -- Avante
  {
    "yetone/avante.nvim",
    version = false,
    build = "make",
    cmd = {
      "AvanteAsk",
      "AvanteChat",
      "AvanteEdit",
      "AvanteToggle",
      "AvanteFocus",
    },
    dependencies = {
      "stevearc/dressing.nvim",
      "nvim-lua/plenary.nvim",
      "MunifTanjim/nui.nvim",
      "echasnovski/mini.pick",
      "nvim-telescope/telescope.nvim",
      "hrsh7th/nvim-cmp",
      "ibhagwan/fzf-lua",
      "nvim-tree/nvim-web-devicons",
      {
        "HakonHarnes/img-clip.nvim",
        event = "VeryLazy",
        opts = {
          default = {
            embed_image_as_base64 = false,
            prompt_for_file_name = false,
            drag_and_drop = {
              insert_mode = true,
            },
            use_absolute_path = true,
          },
        },
      },
      {
        "MeanderingProgrammer/render-markdown.nvim",
        opts = {
          file_types = { "markdown", "Avante" },
        },
        ft = { "markdown", "Avante" },
      },
    },
    config = function()
      require("core.plugin_config.avante")
    end,
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
  rocks = {
    hererocks = true,
  },
}

require("lazy").setup(plugins, opts)
