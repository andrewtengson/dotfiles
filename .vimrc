" Encoding
set encoding=utf8
language en_US
set nocompatible
filetype off

" Vundle
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
call vundle#end()

" Appearance
filetype plugin indent on
set tabstop=2
set shiftwidth=2
set softtabstop=2
set expandtab
set autoindent
set mouse=a
set number
syntax on
set background=dark
set termguicolors
let g:gruvbox_contrast_dark='medium'
let g:gruvbox_italics=1
colorscheme gruvbox
let g:airline_theme='gruvbox'
let g:minimap_highlight='Visual'
let g:airline#extensions#tabline#enabled = 1
let g:airline#extensions#whitespace#enabled = 1
let g:airline_section_z = ''
let g:airline_powerline_fonts = 1
let g:syntastic_check_on_wq = 0
set hidden
set incsearch
set hlsearch
let NERDTreeMinimalUI = 1
let NERDTreeDirArrows = 1
let g:indentLine_char = '│'
set conceallevel=0
let g:vim_json_syntax_conceal = 0
set relativenumber

" Shortcuts
set clipboard=unnamed
let mapleader="\<Space>"
nmap <leader>T :enew<cr>
nmap <leader>l :bnext<CR>
nmap <leader>h :bprevious<CR>
nmap <leader>bq :bp <BAR> bd #<CR>
nmap <leader>bl :ls<CR>
nmap <leader>n :NERDTree<CR>
autocmd VimEnter * NERDTree
autocmd VimEnter * wincmd p
autocmd BufReadPost * if @% !~# '\.git[\/\\]COMMIT_EDITMSG$' && line("'\"") > 1 && line("'\"") <= line("$") | exe "normal! g`\"" | endif
au InsertEnter * set nopaste
set autowrite
set inccommand=nosplit

" vim-go
map <C-n> :cnext<CR>
map <C-m> :cprevious<CR>
nnoremap <leader>a :cclose<CR>
autocmd FileType go nmap <leader>b  <Plug>(go-build)
autocmd FileType go nmap <leader>r  <Plug>(go-run)
autocmd FileType go nmap <Leader>i <Plug>(go-info)
