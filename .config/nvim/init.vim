if empty(glob('~/.local/share/nvim/site/autoload/plug.vim'))
  silent !curl -fLo ~/.local/share/nvim/site/autoload/plug.vim --create-dirs
    \ https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
  autocmd VimEnter * PlugInstall --sync | source $MYVIMRC
endif

call plug#begin('~/.vim/plugged')
  Plug 'VundleVim/Vundle.vim'
  Plug 'vim-airline/vim-airline'
  Plug 'morhetz/gruvbox'
  Plug 'scrooloose/nerdtree'
  Plug 'Xuyuanp/nerdtree-git-plugin'
  Plug 'ryanoasis/vim-devicons'
  Plug 'tiagofumo/vim-nerdtree-syntax-highlight'
  Plug 'tpope/vim-fugitive'
  Plug 'airblade/vim-gitgutter'
  Plug 'godlygeek/tabular'
  Plug 'Yggdroot/indentLine'
  Plug 'itspriddle/vim-shellcheck'
  Plug 'mustache/vim-mustache-handlebars'
  Plug 'pangloss/vim-javascript'
  Plug 'neoclide/coc.nvim'
  Plug 'vim-syntastic/syntastic'
  Plug 'elzr/vim-json'
  Plug 'rodjek/vim-puppet'
  Plug 'sheerun/vim-polyglot'
  Plug 'dart-lang/dart-vim-plugin'
  Plug 'hashivim/vim-terraform'
  Plug 'fatih/vim-go'
call plug#end()

set ttyfast
set nocompatible
set t_Co=256
set encoding=utf8
set background=dark
set termguicolors
set conceallevel=0
set cursorline
set tabstop=2 shiftwidth=2 softtabstop=2 expandtab
set autoindent
set mouse=a
set number
set hidden
set incsearch
set ignorecase
set smartcase
set hlsearch
set relativenumber
set clipboard=unnamedplus
set wildmenu
set wildmode=longest:full,full
set completeopt=longest,menuone,preview
set scrolloff=2
set cursorline
set splitbelow
set splitright
set nobackup
set noswapfile
set autowrite
set inccommand=nosplit
set updatetime=300

" Theme
let g:gruvbox_contrast_dark='hard'
let g:gruvbox_italics=1
let g:airline_theme='gruvbox'
let g:minimap_highlight='Visual'
let g:airline#extensions#tabline#enabled=1
let g:airline#extensions#whitespace#enabled=1
let g:airline_section_z='%p%% %l:%v'
let g:airline_powerline_fonts=1
let g:airline_left_sep = "\uE0B8"
let g:airline_right_sep = "\uE0BA"
let g:indentLine_char='│'
let g:vim_json_syntax_conceal=0
let g:omni_sql_no_default_maps=1
let g:webdevicons_enable_airline_statusline=0

syntax on
colorscheme gruvbox
filetype plugin indent on
set omnifunc=syntaxcomplete#Complete

" WSL yank support
let s:clip = '/mnt/c/Windows/System32/clip.exe'  " change this path according to your mount point
if executable(s:clip)
  augroup WSLYank
  autocmd!
  autocmd TextYankPost * if v:event.operator ==# 'y' | call system(s:clip, @0) | endif
  augroup END
endif

" Shortcuts
let mapleader="\<Space>"

nnoremap ! :!
nnoremap <leader>w :w<cr>
" replace the word under cursor
nnoremap <leader>* :%s/\<<c-r><c-w>\>//g<left><left>
" toggle showing hidden characters
nnoremap <silent> <leader>s :set nolist!<cr>
" toggle spell checking
nnoremap <leader>ss :setlocal spell!<cr>
" override system files by typing :w!!
cnoremap w!! %!sudo tee > /dev/null %
" remove search highlight
nmap <leader>q :nohlsearch<CR>
nnoremap <leader>T :enew<cr>
nnoremap <Tab> :bnext<CR>
nnoremap <S-Tab> :bprevious<CR>
nnoremap <leader>bq :bp <BAR> bd! #<CR>
nnoremap <leader>ba :bufdo bd!<cr>
nnoremap <leader>bl :ls<CR>
" cycle between last two open buffers
nnoremap <leader><leader> <c-^>
nnoremap <leader>n :NERDTree<CR>
nnoremap <leader>t :NERDTreeToggle<CR>
nnoremap <leader>f :NERDTreeFind<CR>
nnoremap <leader>d :windo difft<CR>
nnoremap <leader>D :windo diffoff<CR>
nnoremap <leader>p :GitGutterPreviewHunk<CR>
nnoremap <leader>u :GitGutterUndoHunk<CR>

" move lines around
nnoremap <leader>k :m-2<cr>==
nnoremap <leader>j :m+<cr>==
xnoremap <leader>k :m-2<cr>gv=gv
xnoremap <leader>j :m'>+<cr>gv=gv

" quickfix lists
nnoremap <C-k> :cnext<CR>zz
nnoremap <C-j> :cprev<CR>zz
nnoremap <leader>K :lnext<CR>zz
nnoremap <leader>J :lprev<CR>zz

" exit terminal
tnoremap <Esc> <C-\><C-n>

autocmd BufReadPost * if @% !~# '\.git[\/\\]COMMIT_EDITMSG$' && line("'\"") > 1 && line("'\"") <= line("$") | exe "normal! g`\"" | endif
autocmd InsertEnter * set nopaste

" vim-go
autocmd FileType go nmap <leader>b  <Plug>(go-build)
autocmd FileType go nmap <leader>r  <Plug>(go-run)
autocmd FileType go nmap <Leader>i  <Plug>(go-imports)
autocmd FileType go nmap <Leader>v  <Plug>(go-vet)
let g:go_fmt_command="goimports"
let g:go_highlight_extra_types=1
let g:go_highlight_operators=1
let g:go_highlight_functions=1
let g:go_highlight_function_parameters=1
let g:go_highlight_function_calls=1
let g:go_highlight_types=1
let g:go_highlight_fields=1

" terraform
let g:terraform_align=1
let g:terraform_fmt_on_save=1

" NERDTree
let NERDTreeMinimalUI=1
let NERDTreeDirArrows=1
let g:NERDTreeGitStatusUpdateOnWrite=0
let NERDTreeHighlightCursorline=0
let g:NERDTreeLimitedSyntax=1

" Syntastic
let g:syntastic_check_on_wq=0
let g:syntastic_auto_loc_list=0
let g:syntastic_mode_map = { 'passive_filetypes': ['dart'] }

" coc config
let g:coc_global_extensions = [
  \ 'coc-pairs',
  \ 'coc-tsserver',
  \ 'coc-prettier',
  \ 'coc-go',
  \ 'coc-json',
  \ 'coc-yaml',
  \ 'coc-html',
  \ 'coc-css',
  \ 'coc-python',
  \ 'coc-flutter',
  \ 'coc-sh'
  \ ]

" Give more space for displaying messages.
set cmdheight=2

" Don't pass messages to |ins-completion-menu|.
set shortmess+=c

" always show signcolumns
set signcolumn=yes

" Use tab for trigger completion with characters ahead and navigate.
" NOTE: Use command ':verbose imap <tab>' to make sure tab is not mapped by
" other plugin before putting this into your config.
inoremap <silent><expr> <TAB>
      \ pumvisible() ? "\<C-n>" :
      \ <SID>check_back_space() ? "\<TAB>" :
      \ coc#refresh()
inoremap <expr><S-TAB> pumvisible() ? "\<C-p>" : "\<C-h>"

function! s:check_back_space() abort
  let col = col('.') - 1
  return !col || getline('.')[col - 1]  =~# '\s'
endfunction

" Use <c-space> to trigger completion.
inoremap <silent><expr> <c-space> coc#refresh()

" Use <cr> to confirm completion, `<C-g>u` means break undo chain at current
" position. Coc only does snippet and additional edit on confirm.
" <cr> could be remapped by other vim plugin, try `:verbose imap <CR>`.
if exists('*complete_info')
  inoremap <expr> <cr> complete_info()["selected"] != "-1" ? "\<C-y>" : "\<C-g>u\<CR>"
else
  inoremap <expr> <cr> pumvisible() ? "\<C-y>" : "\<C-g>u\<CR>"
endif

" Use `[g` and `]g` to navigate diagnostics
nmap <silent> [g <Plug>(coc-diagnostic-prev)
nmap <silent> ]g <Plug>(coc-diagnostic-next)

" GoTo code navigation.
nmap <silent> gd <Plug>(coc-definition)
nmap <silent> gy <Plug>(coc-type-definition)
nmap <silent> gi <Plug>(coc-implementation)
nmap <silent> gr <Plug>(coc-references)

" Use K to show documentation in preview window.
nnoremap <silent> K :call <SID>show_documentation()<CR>

function! s:show_documentation()
  if (index(['vim','help'], &filetype) >= 0)
    execute 'h '.expand('<cword>')
  else
    call CocAction('doHover')
  endif
endfunction

" Highlight the symbol and its references when holding the cursor.
autocmd CursorHold * silent call CocActionAsync('highlight')

" Symbol renaming.
nmap <leader>rn <Plug>(coc-rename)

augroup mygroup
  autocmd!
  " Setup formatexpr specified filetype(s).
  autocmd FileType typescript,json setl formatexpr=CocAction('formatSelected')
  " Update signature help on jump placeholder.
  autocmd User CocJumpPlaceholder call CocActionAsync('showSignatureHelp')
augroup end

" Applying codeAction to the selected region.
" Example: `<leader>aap` for current paragraph
xmap <leader>a  <Plug>(coc-codeaction-selected)
nmap <leader>a  <Plug>(coc-codeaction-selected)

" Remap keys for applying codeAction to the current buffer.
nmap <leader>ac  <Plug>(coc-codeaction)
" Apply AutoFix to problem on the current line.
nmap <leader>x  <Plug>(coc-fix-current)

" Map function and class text objects
" NOTE: Requires 'textDocument.documentSymbol' support from the language server.
xmap if <Plug>(coc-funcobj-i)
omap if <Plug>(coc-funcobj-i)
xmap af <Plug>(coc-funcobj-a)
omap af <Plug>(coc-funcobj-a)
xmap ic <Plug>(coc-classobj-i)
omap ic <Plug>(coc-classobj-i)
xmap ac <Plug>(coc-classobj-a)
omap ac <Plug>(coc-classobj-a)

" Use CTRL-S for selections ranges.
" Requires 'textDocument/selectionRange' support of LS, ex: coc-tsserver
nmap <silent> <C-s> <Plug>(coc-range-select)
xmap <silent> <C-s> <Plug>(coc-range-select)

" Add `:Format` command to format current buffer.
command! -nargs=0 Format :call CocAction('format')

" Add `:Fold` command to fold current buffer.
command! -nargs=? Fold :call     CocAction('fold', <f-args>)

" Add `:OR` command for organize imports of the current buffer.
command! -nargs=0 OR   :call     CocAction('runCommand', 'editor.action.organizeImport')

" Add status line support, for integration with other plugin, checkout `:h coc-status`
set statusline^=%{coc#status()}%{get(b:,'coc_current_function','')}

" Using CocList
" Show all diagnostics
nnoremap <silent> <leader>i  :<C-u>CocList diagnostics<cr>
" Manage extensions
nnoremap <silent> <leader>e  :<C-u>CocList extensions<cr>
" Show commands
nnoremap <silent> <leader>c  :<C-u>CocList commands<cr>
