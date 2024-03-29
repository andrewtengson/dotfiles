local configs = require("nvim-treesitter.configs")
configs.setup({
  ensure_installed = {
    "bash",
    "c",
    "c_sharp",
    "cmake",
    "comment",
    "cpp",
    "css",
    "dart",
    "diff",
    "dockerfile",
    "git_rebase",
    "gitattributes",
    "gitcommit",
    "gitignore",
    "go",
    "gomod",
    "graphql",
    "hcl",
    "html",
    "http",
    "java",
    "javascript",
    "json",
    "lua",
    "make",
    "markdown",
    "markdown_inline",
    "python",
    "rust",
    "ruby",
    "solidity",
    "sql",
    "toml",
    "typescript",
    "terraform",
    "vim",
    "yaml",
  },
  sync_install = true,
  ignore_install = { "" }, -- List of parsers to ignore installing
  autopairs = {
    enable = true,
  },
  highlight = {
    enable = true, -- false will disable the whole extension
    disable = {}, -- list of language that will be disabled
    additional_vim_regex_highlighting = false,
  },
  indent = { enable = true, disable = { "yaml" } },
})
vim.g.skip_ts_context_commentstring_module = true
