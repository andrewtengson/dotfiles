local util = require("lspconfig.util")

local opts = {
  root_dir = function(fname)
    -- Ensure fname is a string
    if type(fname) ~= "string" then
      return vim.fn.getcwd()
    end

    -- First try to find biome config files
    local biome_root = util.root_pattern("biome.json", "biome.jsonc")(fname)
    if biome_root then
      return biome_root
    end

    -- Try to find package.json
    local package_json_files = vim.fs.find("package.json", { path = fname, upward = true })
    if package_json_files and #package_json_files > 0 then
      return vim.fs.dirname(package_json_files[1])
    end

    -- Try to find node_modules
    local node_modules_dirs = vim.fs.find("node_modules", { path = fname, upward = true })
    if node_modules_dirs and #node_modules_dirs > 0 then
      return vim.fs.dirname(node_modules_dirs[1])
    end

    -- Try to find .git
    local git_dirs = vim.fs.find(".git", { path = fname, upward = true })
    if git_dirs and #git_dirs > 0 then
      return vim.fs.dirname(git_dirs[1])
    end

    -- Fallback to current directory
    return vim.fn.getcwd()
  end,
}

return opts
