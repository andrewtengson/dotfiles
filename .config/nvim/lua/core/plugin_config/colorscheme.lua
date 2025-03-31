local colorscheme = "gruvbox"

vim.opt.background = "dark"

local status_ok, _ = pcall(vim.api.nvim_exec2, "colorscheme " .. colorscheme, { output = false })
if not status_ok then
  vim.notify("colorscheme " .. colorscheme .. " not found!")
  return
end

vim.cmd("highlight! link FloatBorder Normal")
vim.cmd("highlight! link NormalFloat Normal")
vim.cmd("highlight! link markdownError NONE")
