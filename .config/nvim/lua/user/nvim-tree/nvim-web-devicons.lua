local status_ok, nvim_web_devicons = pcall(require, "nvim-web-devicons")
if not status_ok then
  return
end

nvim_web_devicons.setup({
  override = {
    pp = {
      icon = "",
      color = "#FFA61A",
      name = "Pp",
    },
    epp = {
      icon = "",
      color = "#FFA61A",
      name = "Epp",
    },
  },
})
