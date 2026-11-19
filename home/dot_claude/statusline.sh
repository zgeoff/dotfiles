#!/usr/bin/env bash
# Delivery statusline for Claude Code.
# Reads the session JSON payload on stdin and renders a single tuned line:
#   folder  branch [dirty] | PR#n state | used/size pct% | 7d pct%·reset | model·effort [think]
# Set STATUSLINE_NERD_FONT=0 in a terminal with no Nerd Font, for labels in place of the glyphs.
# Nerd Font glyphs are emitted as \uXXXX escapes so the source file stays pure
# ASCII (nothing to mangle in transit); bash expands them at runtime.

payload=$(cat)

# --- glyphs (confirmed rendering in this terminal's Nerd Font) ---
G_FOLDER=$''
G_BRANCH=$''
G_PR=$''
G_CHECK=$''
G_X=$''
G_THINK=$'✳'
DIRTY=$'●' # ●
SEP=$'│'   # │  faint segment divider
if [ "${STATUSLINE_NERD_FONT:-1}" = "0" ]; then
  G_FOLDER='dir'
  G_BRANCH='git'
  G_PR='PR'
  G_CHECK='ok'
  G_X='changes'
  G_THINK='think'
  DIRTY='*'
  SEP='|'
fi

# --- ANSI 256-color helpers ---
R=$'\033[0m'
c() { printf '\033[38;5;%sm' "$1"; }
CYAN=$(c 45)
BLUE=$(c 39)
GREEN=$(c 71)
RED=$(c 203)
YELLOW=$(c 214)
GRAY=$(c 244)
DIM=$(c 240)
PINK=$(c 213)
MAG=$(c 170)

# --- extract fields (jq, tolerant of absent/null) ---
# One field per line, read line by line so empty fields survive (one tab-split
# `read` would collapse them, since tab is IFS whitespace). No mapfile: macOS ships bash 3.2.
F=()
while IFS= read -r line; do F+=("$line"); done < <(
  jq -r '
    [ .model.display_name // "?"
    , .effort.level // ""
    , (.thinking.enabled // false | tostring)
    , .workspace.current_dir // .cwd // ""
    , .worktree.branch // ""
    , (.pr.number // "" | tostring)
    , .pr.review_state // ""
    , (.context_window.used_percentage // -1 | floor | tostring)
    , (.exceeds_200k_tokens // false | tostring)
    , (.rate_limits.seven_day.used_percentage // -1 | floor | tostring)
    , (.rate_limits.seven_day.resets_at // -1 | floor | tostring)
    , (.context_window.context_window_size // 0 | floor | tostring)
    , ( .context_window.current_usage as $c
        | if $c == null
          then (.context_window.total_input_tokens // 0)
          else (($c.input_tokens // 0) + ($c.cache_creation_input_tokens // 0) + ($c.cache_read_input_tokens // 0))
          end | tostring )
    ] | .[]' <<< "$payload"
)
model=${F[0]}
effort=${F[1]}
thinking=${F[2]}
cwd=${F[3]}
wt_branch=${F[4]}
pr_num=${F[5]}
pr_state=${F[6]}
ctx=${F[7]}
over200=${F[8]}
rl7=${F[9]}
rl7_resets_at=${F[10]}
window=${F[11]}
tokens=${F[12]}

out=""
add_seg() {
  [ -n "$out" ] && out+="    ${DIM}${SEP}${R}    "
  out+="$1"
}

# --- folder + git branch + dirty state ---
dir=$(basename "$cwd" 2> /dev/null)
branch="$wt_branch"
[ -z "$branch" ] && branch=$(git --no-optional-locks -C "$cwd" branch --show-current 2> /dev/null)
seg="${GRAY}${G_FOLDER}${R} ${BLUE}${dir}${R}"
if [ -n "$branch" ]; then
  dirty=""
  [ -n "$(git --no-optional-locks -C "$cwd" status --porcelain 2> /dev/null)" ] && dirty=" ${RED}${DIRTY}${R}"
  bcol=$GREEN
  [ -n "$dirty" ] && bcol=$YELLOW
  seg+="   ${bcol}${G_BRANCH}  ${branch}${R}${dirty}"
fi
add_seg "$seg"

# --- pull request + review state ---
if [ -n "$pr_num" ]; then
  case "$pr_state" in
    approved) st="${GREEN}${G_CHECK}${R}" ;;
    changes_requested) st="${RED}${G_X}${R}" ;;
    pending)
      st="${YELLOW}⋯${R}"
      st=$(printf '%b' "$st")
      ;;
    draft)
      st="${GRAY}◌${R}"
      st=$(printf '%b' "$st")
      ;;
    *) st="" ;;
  esac
  add_seg "${MAG}${G_PR} #${pr_num}${R} ${st}"
fi

# Token count in its short form: 950, 182k, 1M, 1.5M.
fmt_tok() {
  if [ "$1" -ge 1000000 ]; then
    if [ $(($1 % 1000000)) -eq 0 ]; then
      printf '%dM' $(($1 / 1000000))
    else
      awk -v t="$1" 'BEGIN { printf "%.1fM", t / 1000000 }'
    fi
  elif [ "$1" -ge 1000 ]; then
    printf '%dk' $((($1 + 500) / 1000))
  else
    printf '%d' "$1"
  fi
}

# Seconds in the two largest units: 3d11h, 2h30m, 42m.
fmt_dur() {
  local s=$1
  [ "$s" -lt 0 ] && s=0
  local d=$((s / 86400)) h=$((s % 86400 / 3600)) m=$((s % 3600 / 60))
  if [ "$d" -gt 0 ]; then
    printf '%dd%dh' "$d" "$h"
  elif [ "$h" -gt 0 ]; then
    printf '%dh%02dm' "$h" "$m"
  else
    printf '%dm' "$m"
  fi
}

# --- context window: tokens used / window size, percent full ---
if [ "$ctx" -ge 0 ] 2> /dev/null; then
  ccol=$GREEN
  [ "$ctx" -ge 50 ] && ccol=$YELLOW
  [ "$ctx" -ge 75 ] && ccol=$RED
  [ "$over200" = "true" ] && ccol=$RED
  tok=$(fmt_tok "${tokens:-0}")
  [ "${window:-0}" -gt 0 ] 2> /dev/null && tok+="${DIM}/${R}${ccol}$(fmt_tok "$window")"
  add_seg "${ccol}${tok} ${ctx}%${R}"
fi

# --- usage cap: the 7-day rolling window, colored by its load, with the time until it resets ---
if [ "$rl7" -ge 0 ] 2> /dev/null; then
  rcol=$GREEN
  [ "$rl7" -ge 50 ] && rcol=$YELLOW
  [ "$rl7" -ge 75 ] && rcol=$RED
  rate="${GRAY}7d${R} ${rcol}${rl7}%${R}"
  [ "$rl7_resets_at" -ge 0 ] 2> /dev/null && rate+="${DIM}·$(fmt_dur $((rl7_resets_at - $(date +%s))))${R}"
  add_seg "$rate"
fi

# --- model · effort · thinking (final segment) ---
mseg="${CYAN}${model}${R}"
if [ -n "$effort" ] && [ "$effort" != "medium" ]; then
  ecol=$GRAY
  case "$effort" in high) ecol=$GREEN ;; xhigh) ecol=$YELLOW ;; max) ecol=$RED ;; esac
  mseg+="${DIM}·${R}${ecol}${effort}${R}"
fi
[ "$thinking" = "true" ] && mseg+=" ${PINK}${G_THINK}${R}"
add_seg "$mseg"

# Center the whole group: left-pad by half the slack. Visible width = the
# string minus SGR escapes; -4 accounts for the statusLine padding:2.
vis_len() {
  local s
  s=$(printf '%s' "$1" | sed $'s/\033\\[[0-9;]*m//g')
  printf '%s' "${#s}"
}
cols=${COLUMNS:-120}
pad=$(((cols - 4 - $(vis_len "$out")) / 2))
[ "$pad" -lt 0 ] && pad=0
printf '%*s%s' "$pad" '' "$out"
