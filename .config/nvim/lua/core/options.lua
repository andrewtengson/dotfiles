local options = {
  ttyfast = true,
  encoding = "utf8",
  termguicolors = true,
  conceallevel = 0,
  pumheight = 10,
  cursorline = true,
  expandtab = true,
  tabstop = 2,
  shiftwidth = 2,
  softtabstop = 2,
  autoindent = true,
  mouse = "a",
  number = true,
  hidden = true,
  incsearch = true,
  ignorecase = true,
  smartcase = true,
  hlsearch = true,
  relativenumber = true,
  numberwidth = 2,
  clipboard = "unnamedplus",
  wildmenu = true,
  wildmode = "longest:full,full",
  completeopt = "longest,menuone,preview",
  scrolloff = 2,
  sidescrolloff = 2,
  cmdheight = 2,
  splitbelow = true,
  splitright = true,
  backup = false,
  swapfile = false,
  autowrite = true,
  inccommand = "nosplit",
  signcolumn = "yes",
  wrap = false,
  updatetime = 300,
}

vim.opt.shortmess:append("c")

for k, v in pairs(options) do
  vim.opt[k] = v
end

vim.cmd("set whichwrap+=<,>,[,],h,l")
