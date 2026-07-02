" `:set nocompatible` is not needed as it's done automatically when a .vimrc
" is found, so only explicitly set it when it's not set, as it has many side
" effects

filetype plugin indent on
syntax on

" fix for rendering issue with theme background colors highlighting lines
let &t_ut=''

" unmap the space key's default binding and set it up as our leader key
nnoremap <space> <Nop>
let mapleader=' '

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" disable default plugins
"""

" let g:netrw_altv         = 1
" let g:netrw_banner       = 1
" let g:netrw_browse_split = 1
" let g:netrw_cursor       = 3
" let g:netrw_preview      = 1
" let g:netrw_winsize      = -60
let g:loaded_2html_plugin      = 1
let g:loaded_getscript         = 1
let g:loaded_getscriptPlugin   = 1
let g:loaded_gzip              = 1
let g:loaded_logipat           = 1
let g:loaded_logiPat           = 1
let g:loaded_matchit           = 1
let g:loaded_matchparen        = 1
let g:loaded_netrw             = 1
let g:loaded_netrwFileHandlers = 1
let g:loaded_netrwPlugin       = 1
let g:loaded_netrwSettings     = 1
let g:loaded_rrhelper          = 1
let g:loaded_spellfile_plugin  = 1
let g:loaded_sql_completion    = 1
let g:loaded_syntax_completion = 1
let g:loaded_tar               = 1
let g:loaded_tarPlugin         = 1
let g:loaded_vimball           = 1
let g:loaded_vimballPlugin     = 1
let g:loaded_zip               = 1
let g:loaded_zipPlugin         = 1
let g:vimsyn_embed             = 1

set encoding=utf-8

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" appearance
"""

let g:nord_cursor_line_number_background = 1
let g:nord_italic = 1
let g:nord_italic_comments = 1
let g:nord_underline = 1
set background=dark
set cursorline

" show non printable characters
set list
if has('multi_byte') && &encoding ==# 'utf-8'
  let &listchars = 'tab:▸ ,extends:❯,precedes:❮,nbsp:±'
else
  let &listchars = 'tab:> ,extends:>,precedes:<,nbsp:.'
endif

" search highlighting
set hlsearch
set incsearch

" buffer's side column
set number
set numberwidth=4
set relativenumber
set signcolumn=yes

" completion
set completeopt=menu,preview,noselect

" current buffer information
set cmdheight=2
set display=lastline
set laststatus=2
set noshowmode
set report=0
set ruler
set shortmess=aFc
set showcmd
set title

" editing behaviour
set autoindent
set backspace=indent,eol,start
" set formatoptions=tcrq
set expandtab
set shiftround
set shiftwidth=2
set smarttab
set softtabstop=2
set tabstop=2
" set textwidth=80
set wrapscan

" buffer management
set hidden

" window splitting
set splitbelow
set splitright

" rendering performance
set lazyredraw
set synmaxcol=500

" backups
set backup
set backupdir=$HOME/.vim/files/backup/
set backupext=-vimbackup
set backupskip=
set directory=$HOME/.vim/files/swap/
set updatecount=100
set updatetime=500
set undofile
set undodir=$HOME/.vim/files/undo/

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" abbreviations
"""

" spelling errors
iabbrev adn and
iabbrev waht what
iabbrev tehn then

" shortcuts
iabbrev @@    me@geoffwhatley.com

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" neovim
"""

if has('nvim')
  " use the system version of python2 to avoid complexity of managing both
  " with `asdf`
  let g:python_host_prog = expand('/usr/bin/python2')

  " explicitly use our `asdf` managed python & ruby versions
  let g:python3_host_prog = expand('~/.asdf/shims/python3')
  let g:ruby_host_prog = expand('~/.asdf/installs/ruby/2.6.3/bin/neovim-ruby-host')
  " use our hacky root package.json installed neovim instead of the expected
  " global installation location
  let g:node_host_prog = expand('~/node_modules/.bin/neovim-node-host')
endif

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" veonim
"""

if exists('veonim')
  let g:vn_font = 'Operator Mono'
  let g:vn_font_size = 14
  let g:vn_line_height = '1.5'
  let g:vn_explorer_ignore_dirs = ['.git', '.history']
  let g:vn_explorer_ignore_files = ['.DS_Store']
endif

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" oni
"""

if exists('g:gui_oni')
  " oni specific
endif

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" plugins via `vim-plug`
"""

" auto install `vim-plug`
if empty(glob('~/.vim/autoload/plug.vim'))
  silent !curl -fLo ~/.vim/autoload/plug.vim --create-dirs
    \ https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
  autocmd VimEnter * PlugInstall --sync | source $MYVIMRC
endif

" cleaner conditional plugins via a custom function. example usage:
" Plug 'benekastah/neomake', Cond(has('nvim'), { 'on' 'Neomake' })
function! Cond(cond, ...)
  let opts = get(a:000, 0, {})
  return a:cond ? opts : extend(opts, { 'on': [], 'for': [] })
endfunction

call plug#begin('~/.vim/plugged')
  " tmux integration
  Plug 'christoomey/vim-tmux-navigator'
  Plug 'tmux-plugins/vim-tmux-focus-events'
  Plug 'edkolev/tmuxline.vim'

  " editor ui
  Plug 'ap/vim-buftabline'
  Plug 'itchyny/lightline.vim'
  Plug 'jeffkreeftmeijer/vim-numbertoggle'
  Plug 'ryanoasis/vim-devicons'
  Plug 'arcticicestudio/nord-vim'

  " syntax highlighting
  Plug 'sheerun/vim-polyglot'

  " session management
  Plug 'thaerkh/vim-workspace'

  " editor behaviour
  Plug 'tpope/vim-sensible'
  Plug 'editorconfig/editorconfig-vim'
  Plug 'tpope/vim-endwise'
  Plug 'rstacruz/vim-closer'
  Plug 'tpope/vim-commentary'

  " searching
  Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
  Plug 'junegunn/fzf.vim'

  " autocomplete, linting, autoformatting
  Plug 'python/black'
  Plug 'neoclide/coc.nvim', { 'branch': 'release' }

  " git
  Plug 'tpope/vim-fugitive'

  " utils
  " Plug 'kabbamine/zeavim.vim'
call plug#end()

" custom command to upgrade vim-plug after updating plugins
command! PU PlugUpdate | PlugUpgrade

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" lightline
"""

let g:lightline = {
  \ 'colorscheme': '16color',
  \ 'active': {
  \   'left': [
  \             ['mode', 'paste'],
  \             [ 'gitbranch', 'cocstatus', 'readonly', 'filename', 'modified']
  \           ],
  \   'right': [
  \              ['lineinfo'],
  \              ['percent'],
  \              ['fileformat', 'fileencoding', 'filetype']
  \            ]
  \ },
  \ 'component_function': {
  \   'cocstatus': 'coc#status',
  \   'gitbranch': 'fugitive#head'
  \ },
  \ }

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" vthaerkh/vim-workspace
"""
let g:workspace_session_name = 'Session.vim'
let g:workspace_autosave_always = 1

nnoremap <leader>cw :ToggleWorkspace<CR>

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" editorconfig/editorconfig-vim
"""

let g:EditorConfig_exclude_patterns = ['fugitive://.\*']

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" junegunn/fzf.vim
"""

let g:fzf_nvim_statusline = 0

" configure file contents search via ripgrep to include a preview pane
command! -bang -nargs=* Rg
  \ call fzf#vim#grep(
  \   'rg --column --hidden --line-number --no-heading --no-ignore-vcs '.shellescape(<q-args>), 1,
  \   <bang>0 ? fzf#vim#with_preview('up:60%')
  \           : fzf#vim#with_preview('right:50%:hidden', '?'),
  \   <bang>0)

" configure file search to include a preview pane
command! -bang -nargs=? -complete=dir Files
  \ call fzf#vim#files(<q-args>, fzf#vim#with_preview(), <bang>0)

let g:fzf_colors =
\ { 'fg':      ['fg', 'Normal'],
  \ 'bg':      ['bg', 'Normal'],
  \ 'hl':      ['fg', 'Comment'],
  \ 'fg+':     ['fg', 'CursorLine', 'CursorColumn', 'Normal'],
  \ 'bg+':     ['bg', 'CursorLine', 'CursorColumn'],
  \ 'hl+':     ['fg', 'Statement'],
  \ 'info':    ['fg', 'PreProc'],
  \ 'border':  ['fg', 'Ignore'],
  \ 'prompt':  ['fg', 'Conditional'],
  \ 'pointer': ['fg', 'Exception'],
  \ 'marker':  ['fg', 'Keyword'],
  \ 'spinner': ['fg', 'Label'],
  \ 'header':  ['fg', 'Comment'] }

nnoremap <C-f> :Files<CR>
nnoremap <S-f> :Rg<CR>
nnoremap <C-g> :GFiles?<CR>
nnoremap <S-g> :Commits<CR>

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" neoclide/coc.nvim
"""
let g:coc_global_extensions = [
  \ 'coc-eslint',
  \ 'coc-git',
  \ 'coc-html',
  \ 'coc-jest',
  \ 'coc-json',
  \ 'coc-lists',
  \ 'coc-pairs',
  \ 'coc-prettier',
  \ 'coc-python',
  \ 'coc-rls',
  \ 'coc-snippets',
  \ 'coc-stylelint',
  \ 'coc-tsserver',
  \ 'coc-yaml',
  \ 'coc-yank',
  \ ]

function! s:check_back_space() abort
  let col = col('.') - 1
  return !col || getline('.')[col - 1] =~# '\s'
endfunction

" use tab for triggering completion and cycling through our completion list
inoremap <silent> <expr> <TAB>
      \ pumvisible() ? "\<C-n>" :
      \ <SID>check_back_space() ? "\<TAB>" :
      \ coc#refresh()

" use <S-TAB> for cycling backwards through the completion list if visible
inoremap <expr> <TAB> pumvisible() ? "\<C-n>" : "\<TAB>"
inoremap <expr> <S-TAB> pumvisible() ? "\<C-p>" : "\<S-TAB>"

" use <C-,> to trigger completion
inoremap <silent> <expr> <C-,> coc#refresh()

" use <CR> to confirm completion if available, otherwise <C-g>u breaks our undo
" chain at the current position. CoC only does snippet insertion and editing
" on confirmation
" inoremap <expr> <CR> pumvisible() ? "\<C-y>" : "\<C-g>u\<CR>"

" use [c and ]c to navigate diagnostics
nnoremap <silent> [c <Plug>(coc-diagnostic-prev)
nnoremap <silent> ]c <Plug>(coc-diagnostic-next)

" remap keys for gotos
nnoremap <silent> gd <Plug>(coc-definition)
nnoremap <silent> gy <Plug>(coc-type-definition)
nnoremap <silent> gi <Plug>(coc-implementation)
nnoremap <silent> gr <Plug>(coc-references)

" use K to show the documentation in a preview window
nnoremap <silent> K :call <SID>show_documentation()<CR>

function! s:show_documentation()
  if (index(['vim', 'help'], &filetype) >= 0)
    execute 'h '.expand('<cword>')
  else
    call CocAction('doHover')
  endif
endfunction

" highlight symbol under the cursor on CursorHold
autocmd CursorHold * silent call CocActionAsync('highlight')

" remap for reaming the current word
nnoremap <leader>rn <Plug>(coc-rename)

" format the selection region
xnoremap <leader>f <Plug>(coc-format-selected)
nnoremap <leader>f <Plug>(coc-format-selected)

augroup mygroup
  autocmd!

  " setup formatexpr specific filetype(s)
  autocmd FileType typescript,json setl formatexpr=CocAction('formatSelected')

  " update signature help on jump placeholder
  autocmd User CocJumpPlaceholder call CocActionAsync('showSignatureHelp')
augroup end

" run our codeAction of selected region, ex: `<leader>aap` for current
" paragraph
xnoremap <leader>a <Plug>(coc-codeaction-selected)
nnoremap <leader>a <Plug>(coc-codeaction-selected)

" run our codeAction on the current line
nnoremap <leader>ac <Plug>(coc-codeaction)

" autofix problem of the current line
nnoremap <leader>qf <Plug>(coc-fix-current)

" use `:Format` to format current buffer
command! -nargs=0 Format :call CocAction('format')

"use `:Fold` to fold the current buffer
command! -nargs=? Fold :call CocAction('fold, <f-args>)

" using CocList
" show all diagnostics
nnoremap <silent> ,a :<C-u>CocList diagnostics<CR>

" manage extensions
nnoremap <silent> ,c :<C-u>CocList extensions<CR>

" find symbol in current document
nnoremap <silent> ,e :<C-u>CocList outline<CR>

" search workspace symbols
nnoremap <silent> ,s :<C-u>CocList -I symbols<CR>

" open yank list
nnoremap <silent> ,y :<C-u>CocList -A --normal yank<cr>

" do default action for next item
nnoremap <silent> ,j :<C-u>CocNext<CR>

" do default action for previous item
nnoremap <silent> ,k :<C-u>CocPrevious<CR>

" resume latest coc list
nnoremap <silent> ,p :<C-u>CocListResume<CR>

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" keymappings
"""

" next & previous buffer
nnoremap <C-n> :bnext<CR>
nnoremap <C-p> :bprev<CR>

nnoremap <leader>\ :vsplit<CR>
nnoremap <leader>- :split<CR>


" quote the current word
nnoremap <leader>" viw<ESC>a"<ESC>bi"<ESC>lel
nnoremap <leader>' viw<ESC>a'<ESC>bi'<ESC>lel

" edit and soure our vim config
nnoremap <leader>ev :vsplit $MYVIMRC<CR>
nnoremap <leader>sv :source $MYVIMRC<CR>

" remove our arrow key mappings
nnoremap <left>   <Nop>
nnoremap <down>   <Nop>
nnoremap <right>  <Nop>
nnoremap <up>     <Nop>
inoremap <left>   <Nop>
inoremap <down>   <Nop>
inoremap <right>  <Nop>
inoremap <up>     <Nop>

colorscheme nord
