local colorscheme = "gruvbox"

vim.api.nvim_exec("colorscheme gruvbox", false)
local status_ok, _ = pcall(vim.api.nvim_exec, "colorscheme " .. colorscheme, false)
if not status_ok then
  vim.notify("colorscheme " .. colorscheme .. " not found!")
  return
end

vim.g.gruvbox_contrast_dark = "hard"
vim.g.gruvbox_italics = 1
vim.opt.background = "dark"
vim.cmd("highlight link FloatBorder Normal")
vim.cmd("highlight link NormalFloat Normal")
vim.cmd("highlight link markdownError NONE")
