local opts = { noremap = true, silent = true }

local term_opts = { silent = true }

-- Shorten function name
local keymap = vim.api.nvim_set_keymap

--Remap space as leader key
keymap("", "<Space>", "<Nop>", opts)
vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- Modes
--   normal_mode = "n",
--   insert_mode = "i",
--   visual_mode = "v",
--   visual_block_mode = "x",
--   term_mode = "t",
--   command_mode = "c",

-- Normal --

-- :! shortcut
keymap("n", "!", ":!", opts)

-- Save
keymap("n", "<leader>w", ":w<CR>", opts)

-- Replace the word under cursor
keymap("n", "<leader>*", ":%s/\\<<c-r><c-w>\\>//g<left><left>", opts)

-- Toggle showing hidden characters
keymap("n", "<leader>s", ":set nolist!<cr>", opts)

-- Toggle spell checking
keymap("n", "<leader>ss", ":setlocal spell!<cr>", opts)

-- Navigate buffers
keymap("n", "<Tab>", ":bnext<CR>", opts)
keymap("n", "<S-Tab>", ":bprevious<CR>", opts)
keymap("n", "<leader>T", ":enew<CR>", opts)
keymap("n", "<leader>bq", ":bp <BAR> bd! #<CR>", opts)
keymap("n", "<leader>ba", ":bufdo bd!<CR>", opts)
keymap("n", "<leader>bl", ":ls<CR>", opts)
keymap("n", "<leader><leader>", "<c-^>", opts)

-- Diff
keymap("n", "<leader>d", ":windo difft<CR>", opts)
keymap("n", "<leader>D", ":windo diffoff<CR>", opts)

-- Git
keymap("n", "<leader>gs", ":G<CR>", opts)
keymap("n", "<leader>gj", ":diffget //3<CR>", opts)
keymap("n", "<leader>gf", ":diffget //2<CR>", opts)

-- Move text up and down
keymap("n", "<A-j>", "<Esc>:m .+1<CR>==gi", opts)
keymap("n", "<A-k>", "<Esc>:m .-2<CR>==gi", opts)
keymap("v", "p", '"_dP', opts)

-- Quickfix lists
keymap("n", "<C-k>", ":cnext<CR>zz", opts)
keymap("n", "<C-j>", ":cprev<CR>zz", opts)
keymap("n", "<leader>K", ":lnext<CR>zz", opts)
keymap("n", "<leader>J", ":lprev<CR>zz", opts)

-- Insert --

-- Visual --
-- Stay in indent mode
keymap("v", "<", "<gv", opts)
keymap("v", ">", ">gv", opts)

-- Move text up and down
keymap("v", "<A-j>", ":m .+1<CR>==", opts)
keymap("v", "<A-k>", ":m .-2<CR>==", opts)
keymap("v", "p", '"_dP', opts)

-- Visual Block --
-- Move text up and down
keymap("x", "<A-j>", ":move '>+1<CR>gv-gv", opts)
keymap("x", "<A-k>", ":move '<-2<CR>gv-gv", opts)

-- Terminal --
-- Better terminal navigation
keymap("t", "<C-h>", "<C-\\><C-N><C-w>h", term_opts)
keymap("t", "<C-j>", "<C-\\><C-N><C-w>j", term_opts)
keymap("t", "<C-k>", "<C-\\><C-N><C-w>k", term_opts)
keymap("t", "<C-l>", "<C-\\><C-N><C-w>l", term_opts)

-- Command --
-- Override system files by typing :w!!
keymap("c", "w!!", "%!sudo tee > /dev/null %", opts)

-- Nvimtree
keymap("n", "<leader>e", ":NvimTreeToggle<cr>", opts)
keymap("n", "<leader>F", ":NvimTreeFindFileToggle<cr>", opts)

-- Telescope
keymap(
  "n",
  "<leader>f",
  "<cmd>lua require'telescope.builtin'.find_files(require('telescope.themes').get_dropdown({ previewer = false }))<cr>",
  opts
)
keymap("n", "<c-t>", "<cmd>Telescope live_grep<cr>", opts)
keymap("n", "<leader>p", "<cmd> Telescope projects<cr>", opts)
keymap("n", "<leader>dt", "<cmd> Telescope dap commands<cr>", opts)

-- Dap
keymap("n", "<leader>db", "<cmd> DapToggleBreakpoint<cr>", opts)
keymap("n", "<leader>dB", "<cmd> lua require'dap'.set_breakpoint(vim.fn.input('Breakpoint condition: '))<cr>", opts)
keymap("n", "<leader>dn", "<cmd> DapContinue<cr>", opts)
keymap("n", "<leader>dr", "<cmd> lua require'dap'.repl.toggle({height=10})<cr>", opts)
keymap("n", "<leader>dsj", "<cmd> DapStepOver<cr>", opts)
keymap("n", "<leader>dsk", "<cmd> DapStepOut<cr>", opts)
keymap("n", "<leader>dsl", "<cmd> DapStepInto<cr>", opts)
keymap(
  "n",
  "<leader>d?",
  "<cmd> lua local widgets=require'dap.ui.widgets';widgets.centered_float(widgets.scopes)<cr>",
  opts
)
keymap("n", "<leader>di", "<cmd> lua require'dap.ui.widgets'.hover()<cr>", opts)
keymap("v", "<leader>di", "<cmd> lua require'dap.ui.widgets'.visual_hover()<cr>", opts)
keymap("n", "<leader>dk", "<cmd> lua require'dap'.up()<cr>", opts)
keymap("n", "<leader>dj", "<cmd> lua require'dap'.down()<cr>", opts)
keymap("n", "<leader>dc", "<cmd> lua require'dap'.close()<cr>", opts)
keymap("n", "<leader>du", "<cmd> lua require'dapui'.toggle()<cr>", opts)
