#/usr/bin/env zsh

. "$HOME/.bashrc"

# load in our path that will be searched for commands
# shellcheck source=.zpath
. "$HOME/.zpath"

# grab all of our zsh functions from ~/.zfuncs and mark them for autoloading
function () {
  local -a zfuncs

  for func in "$HOME"/.zfuncs/*(.); do
    zfuncs+="$(basename $func)"
  done

  autoload -Uz "$zfuncs[@]"
}

# prompt & command configuration
setopt AUTOCD                     # automatically swap to a directory without requiring to type `cd`
setopt PROMPT_SUBST               # enable parameter expansion, command substituion, and arithmetic expansion in prompts
setopt CORRECT                    # try to correct the spelling of our commands
setopt NO_LIST_BEEP               # don't beep on an ambiguous completion

# directory stack
setopt AUTOPUSHD                  # automatically push directories into the stack
setopt PUSHDIGNOREDUPS            # don't push duplicates into the directory stack

# history
HISTFILE="$HOME/.zsh_history"
HISTSIZE=10000000
SAVEHIST=10000000

setopt BANG_HIST                  # treat the '!' character specially during expansion
setopt EXTENDED_HISTORY           # write the history file in the ":start:elapsed;command" format
setopt SHARE_HISTORY              # share history between all sessions
setopt HIST_EXPIRE_DUPS_FIRST     # expire duplicate entries first when trimming history
setopt HIST_IGNORE_DUPS           # don't record an entry that was just recorded again
setopt HIST_IGNORE_ALL_DUPS       # delete old recorded entry if new entry is a duplicate
setopt HIST_FIND_NO_DUPS          # do not display a line previously found
setopt HIST_IGNORE_SPACE          # don't record an entry starting with a space
setopt HIST_SAVE_NO_DUPS          # don't write duplicate entries in the history file
setopt HIST_REDUCE_BLANKS         # remove superfluous blanks before recording entry
setopt HIST_VERIFY                # don't execute immediately upon history expansion

# background commands
setopt NO_BG_NICE                 # don't run background commands at a lower priority
setopt NO_NOTIFY                  # don't notify us of background commands finishing
setopt NO_HUP                     # don't kill background commands if the spawning shell is exiting

# functions
setopt LOCAL_OPTIONS              # allow functions to have local options
setopt LOCAL_TRAPS                # allow functions to have local traps

# matches case insensitive for lowercase
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'

# initialize our completion
autoload -Uz bashcompinit && bashcompinit
autoload -Uz compinit && compinit

# shellcheck source=.zcompletions
. "$HOME/.zcompletions"

# initialize fzf completion
source "$HOME/bin/fzf-zsh-completion.sh"
bindkey '^I' fzf_completion

# shellcheck source=.zaliases
. "$HOME/.zaliases"

# install zinit if required
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"
if [ ! -d $ZINIT_HOME ]; then
  mkdir -p "$(dirname $ZINIT_HOME)"
fi

if [ ! -d $ZINIT_HOME/.git ]; then
  git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# initialize zinit
. "$HOME/.local/share/zinit/zinit.git/zinit.zsh"

autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit

zinit light-mode for \
    zdharma-continuum/zinit-annex-as-monitor \
    zdharma-continuum/zinit-annex-bin-gem-node \
    zdharma-continuum/zinit-annex-patch-dl \
    zdharma-continuum/zinit-annex-rust
# plugins

# theme: purepower
zinit ice depth"1"
zinit ice src"powerlevel10k.zsh-theme"
zinit light romkatv/powerlevel10k

. ~/.purepower

# enforce vi-mode rather than zsh's default emacs mode
bindkey -v
KEYTIMEOUT=1

# set up fzf keybindings & completion
source <(fzf --zsh)

# set up zoxide
eval "$(zoxide init zsh)"

# set up orbstack integration
if [ "$(uname -s)" = "Darwin" ]; then
  source ~/.orbstack/shell/init.zsh 2>/dev/null || :
fi

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
