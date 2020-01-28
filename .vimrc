set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()
  Plugin 'VundleVim/Vundle.vim'
  Plugin 'vim-airline/vim-airline'
  Plugin 'vim-airline/vim-airline-themes'
  Plugin 'tpope/vim-fugitive'
  Plugin 'scrooloose/nerdtree'
  Plugin 'rodjek/vim-puppet'
  Plugin 'scrooloose/syntastic'
  Plugin 'Xuyuanp/nerdtree-git-plugin'
  Plugin 'airblade/vim-gitgutter'
  Plugin 'raimondi/delimitmate'
  Plugin 'godlygeek/tabular'
  Plugin 'sophacles/vim-processing'
  Plugin 'morhetz/gruvbox'
  Plugin 'Yggdroot/indentLine'
  Plugin 'elzr/vim-json'
  Plugin 'hashivim/vim-terraform'
  Plugin 'fatih/vim-go'
  Plugin 'itspriddle/vim-shellcheck'
call vundle#end()

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
set clipboard=unnamed
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
set updatetime=750

"Theme
let g:gruvbox_contrast_dark='hard'
let g:gruvbox_italics=1
let g:airline_theme='gruvbox'
let g:minimap_highlight='Visual'
let g:airline#extensions#tabline#enabled=1
let g:airline#extensions#whitespace#enabled=1
let g:airline_section_z=''
let g:airline_powerline_fonts=1
let g:indentLine_char='│'
let g:vim_json_syntax_conceal=0
let g:omni_sql_no_default_maps=1

language en_US
syntax on
colorscheme gruvbox
filetype plugin indent on

"Shortcuts
let mapleader="\<Space>"

nnoremap ! :!
nnoremap <leader>w :w<cr>
"replace the word under cursor
nnoremap <leader>* :%s/\<<c-r><c-w>\>//g<left><left>
"toggle showing hidden characters
nnoremap <silent> <leader>s :set nolist!<cr>
"toggle spell checking
nnoremap <leader>ss :setlocal spell!<cr>
"override system files by typing :w!!
cnoremap w!! %!sudo tee > /dev/null %
"remove search highlight
nmap <leader>q :nohlsearch<CR>
nnoremap <leader>T :enew<cr>
nnoremap <Tab> :bnext<CR>
nnoremap <S-Tab> :bprevious<CR>
nnoremap <leader>bq :bp <BAR> bd! #<CR>
nnoremap <leader>ba :bufdo bd!<cr>
nnoremap <leader>bl :ls<CR>
"cycle between last two open buffers
nnoremap <leader><leader> <c-^>
nnoremap <leader>n :NERDTree<CR>
nnoremap <leader>t :NERDTreeToggle<CR>
nnoremap <leader>f :NERDTreeFind<CR>
nnoremap <leader>d :windo difft<CR>
nnoremap <leader>D :windo diffoff<CR>

"move lines around
nnoremap <leader>k :m-2<cr>==
nnoremap <leader>j :m+<cr>==
xnoremap <leader>k :m-2<cr>gv=gv
xnoremap <leader>j :m'>+<cr>gv=gv

autocmd VimEnter * NERDTree
autocmd VimEnter * wincmd p
autocmd BufReadPost * if @% !~# '\.git[\/\\]COMMIT_EDITMSG$' && line("'\"") > 1 && line("'\"") <= line("$") | exe "normal! g`\"" | endif
autocmd InsertEnter * set nopaste

"vim-go
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

"terraform
let g:terraform_align=1
let g:terraform_fmt_on_save=1

"NERDTree
let NERDTreeMinimalUI=1
let NERDTreeDirArrows=1
let g:NERDTreeUpdateOnWrite=0

"Syntastic
let g:syntastic_check_on_wq=0
let g:syntastic_auto_loc_list=0
