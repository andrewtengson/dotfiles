local dapui_status_ok, dapui = pcall(require, "dapui")
if not dapui_status_ok then
  return
end

local dap_status_ok, dap = pcall(require, "dap")
if not dap_status_ok then
  return
end

dapui.setup({
  icons = { expanded = "", collapsed = "", current_frame = "" },
  layouts = {
    {
      elements = {
        -- Elements can be strings or table with id and size keys.
        { id = "scopes", size = 0.25 },
        "breakpoints",
        "stacks",
        "watches",
      },
      size = 60,
      position = "right",
    },
    {
      elements = {
        "repl",
        "console",
      },
      size = 0.25, -- 25% of total lines
      position = "bottom",
    },
  },
  controls = {
    -- Requires Neovim nightly (or 0.8 when released)
    enabled = true,
    -- Display controls in this element
    element = "repl",
    icons = {
      pause = "",
      play = "",
      step_into = "",
      step_over = "",
      step_out = "",
      step_back = "",
      run_last = "ﯩ",
      terminate = "",
      disconnect = "",
    },
  },
})

dap.listeners.after.event_initialized["dapui_config"] = function()
  dapui.open()
end
dap.listeners.before.event_terminated["dapui_config"] = function()
  dapui.close()
end
dap.listeners.before.event_exited["dapui_config"] = function()
  dapui.close()
end

function _G.dap_run_config_with_args()
  local ft = vim.bo.filetype
  if ft == "" then
    print("Filetype option is required to determine which dap configs are available")
    return
  end
  local configs = dap.configurations[ft]
  if configs == nil then
    print('Filetype "' .. ft .. '" has no dap configs')
    return
  end
  local mConfig = nil
  vim.ui.select(configs, {
    prompt = "Select config to run: ",
    format_item = function(config)
      return config.name
    end,
  }, function(config)
    mConfig = config
  end)

  -- redraw to make ui selector disappear
  vim.api.nvim_command("redraw")

  if mConfig == nil then
    return
  end
  vim.ui.input({
    prompt = mConfig.name .. " - with args: ",
  }, function(input)
    if input == nil then
      return
    end
    local args = vim.split(input, " ")
    mConfig.args = args
    dap.run(mConfig)
  end)
end