local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  local lazyrepo = "https://github.com/folke/lazy.nvim.git"
  local out = vim.fn.system({ "git", "clone", "--filter=blob:none", "--branch=stable", lazyrepo, lazypath })
  if vim.v.shell_error ~= 0 then
    vim.api.nvim_echo({
      { "Failed to clone lazy.nvim:\n", "ErrorMsg" },
      { out, "WarningMsg" },
      { "\nPress any key to exit..." },
    }, true, {})
    vim.fn.getchar()
    os.exit(1)
  end
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
    event = { "BufReadPre", "BufNewFile" },
    config = function()
      require("core.plugin_config.comment")
    end,
  },
  {
    "nvim-tree/nvim-web-devicons",
  },
  {
    "nvim-tree/nvim-tree.lua",
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
    event = "VeryLazy",
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
    priority = 1000,
    config = true,
    opts = {
      contrast = "hard",
      invert_selection = true,
      invert_intend_guides = true,
      overrides = {
        SignColumn = { bg = "#1d2021" },
        ColorColumn = { bg = "#1d2021" },
        WinBarNC = { bg = "#1d2021" },
      },
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
    "mason-org/mason.nvim",
  },
  {
    "mason-org/mason-lspconfig.nvim",
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
    "MeanderingProgrammer/render-markdown.nvim",
    dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-tree/nvim-web-devicons" },
    opts = {
      heading = {
        width = "block",
        backgrounds = {
          "RenderMarkdownH6Bg",
          "RenderMarkdownH6Bg",
          "RenderMarkdownH6Bg",
          "RenderMarkdownH6Bg",
          "RenderMarkdownH6Bg",
          "RenderMarkdownH6Bg",
        },
      },
      sign = {
        enabled = false,
      },
      code = {
        conceal_delimiters = false,
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

  -- Obsidian
  {
    "epwalsh/obsidian.nvim",
    lazy = true,
    event = function()
      local obsidian_dir = vim.env.OBSIDIAN_VAULT or vim.fn.expand("~/Documents/obsidian-vault")
      return { "BufReadPre " .. obsidian_dir .. "/**.md" }
    end,
    opts = function()
      local obsidian_dir = vim.env.OBSIDIAN_VAULT or "~/Documents/obsidian-vault"
      return {
        dir = obsidian_dir,
        daily_notes = {
          folder = "Dailies",
        },
        ui = {
          enable = false,
        },
        disable_frontmatter = true,
      }
    end,
  },

  -- Codeium
  {
    "Exafunction/codeium.nvim",
    event = "BufEnter",
    opts = {
      enable_cmp_source = false,
      virtual_text = {
        enabled = true,
        accept_fallback = "<Tab>",
        filetypes = {
          markdown = false,
          text = false,
          env = false,
        },
      },
    },
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
    config = function()
      require("core.plugin_config.which-key")
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
