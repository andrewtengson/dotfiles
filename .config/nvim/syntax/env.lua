-- Prevent duplicate loading
if vim.b.current_syntax ~= nil then
  return
end

vim.cmd([[
" ------------------------
" Syntax matches
" ------------------------

" Comments
syn match envComment '^#.*'

" Unassigned variables (keys without values)
syn match envVariableUnassigned "^\<\h\w*$"

" Variables with assignment
syn match envVariable "^\<\h\w*\ze=" nextgroup=envVarAssign
syn match envVarAssign   contained "=" nextgroup=envVar,envQuotedVarOpen,envSpace
syn match envVar         contained "\h\w*"
syn match envSpace       contained "\s\+" nextgroup=envQuotedVarOpen
syn match envQuotedVarOpen contained "[\"']"

" Trailing space
syn match envSpace "\s$"
syn match envQuotedVarClose "[\"']$"

" ------------------------
" Mark syntax as loaded
" ------------------------
let b:current_syntax = "env"

" ------------------------
" Highlight groups
" ------------------------
hi def link envComment          Comment
hi def link envVariableUnassigned Error

hi def link envVariable         Identifier
hi def link envVarAssign        Operator
hi def link envSpace            Error
hi def link envQuotedVarOpen    String
hi def link envQuotedVarClose   String
]])
